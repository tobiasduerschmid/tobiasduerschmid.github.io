/*
 * Information-hiding kit for "Every Module Keeps a Secret": a spy-thriller
 * visual language whose metaphors carry the concept, drawn over the "spy"
 * stage theme (spy-noir.js). Each piece keeps the real notation beside its
 * picture:
 *
 *   a module is a manila case file with a typed name label; the design
 *     decision it hides is a sealed TOP SECRET envelope, so a decision
 *     copied into many modules is the same envelope in every file;
 *   an interface is a public credential badge (what callers may see), and
 *     a module split into what and how is a vault: brass nameplate outside,
 *     the secret visible only through an X-ray window;
 *   dependencies are red string on a detective's corkboard, which knots into
 *     a Big Ball of Mud when every module depends on every other;
 *   calls are courier routes with sealed envelopes travelling along them;
 *   "from the others" is a laser wall between modules;
 *   Parnas's sentence arrives as a decrypted transmission;
 *   searching code is a green-phosphor intercept console;
 *   a cutaway iceberg keeps its exposed tip fixed while its inner mechanism
 *     changes; an outlet keeps supplying a phone as the generation changes.
 *
 * Builds on SongKit (kit.js) and Timeline (timeline.js); every builder
 * schedules its own motion, and every pose is a pure function of song time.
 * Coordinates are CSS pixels on the 960×540 stage. Styles:
 * css/song-video-ih-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place, icon } = kit;
  let uid = 0;

  /** Ease out with a small overshoot past 1 before settling. */
  const backOut = (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
  /** Eases in and out over u in [0, 1], holding 0 before and 1 after. */
  const smooth = (u) => { const v = Math.min(1, Math.max(0, u)); return v * v * (3 - 2 * v); };
  /**
   * Starts from rest, swings a little past 1 (about 5 %), and settles at
   * rest: a limb's flourish without backOut's sudden start.
   */
  const softBack = (u) => u * u * (3 - 2 * u) + 6 * u * u * (1 - u) * (1 - u);

  /** The newest entry of a time-sorted list at or before t (or undefined). */
  function latest(entries, t) {
    let found;
    for (const entry of entries) if (entry.at <= t) found = entry;
    return found;
  }

  /** Shows a node from `at` (popping in) until `until` (popping out). */
  function show(node, at, until, { rotate = 0, from = 0.6 } = {}) {
    fx.pop(node, at, { from, rotate });
    if (until !== undefined) fx.popOut(node, until);
    return node;
  }

  /** Toggles a class on a node during [from, to). */
  function during(node, className, from, to = Infinity) {
    onFrame((t) => node.classList.toggle(className, t >= from && t < to));
  }

  /** A short ink note: { tone: white | gold | pink | cyan | green | red }. */
  function note(parent, text, { x, y, at, until, tone = 'white', rotate = -2 }) {
    const node = place(el('div', `ih-note${tone === 'white' ? '' : ` ih-note--${tone}`} is-staged`, parent, text), x, y);
    return show(node, at, until, { rotate });
  }

  /** A heading with an optional <b> highlight: parts = [text, bold, text…]. */
  function heading(parent, parts, { x, y, at, until, size }) {
    const node = place(el('div', 'ih-heading is-staged', parent), x, y);
    if (size) node.style.fontSize = `${size}px`;
    parts.forEach((part, i) => {
      if (i % 2) el('b', null, node, part);
      else node.append(document.createTextNode(part));
    });
    fx.rise(node, at, { distance: 14, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Paper: cards, briefing lists, speech bubbles
  // ------------------------------------------------------------------

  function paper(parent, { x, y, w, kicker, title, meta, cite, clip = false, lines = [], at, until, rotate = -1.5 }) {
    const node = place(el('div', 'ih-paper is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (clip) {
      const art = svg('svg', { class: 'ih-clip ih-clip--paper', viewBox: '0 0 16 40', 'aria-hidden': 'true' }, node);
      svg('path', { d: 'M5 38V8a3 3 0 0 1 6 0v26a5 5 0 0 1-10 0V6a7 7 0 0 1 14 0v22' }, art);
    }
    if (kicker) el('div', 'ih-paper-kicker', node, kicker);
    if (title) el('div', 'ih-paper-title', node, title);
    if (meta) el('div', 'ih-paper-meta', node, meta);
    if (cite) el('div', 'ih-paper-cite', node, cite);
    const rows = lines.map((line) => {
      const row = el('div', `ih-paper-line${line.total ? ' ih-paper-line--total' : ''}${line.at !== undefined ? ' is-staged' : ''}`, node, line.text);
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 8, duration: 0.3 });
      return row;
    });
    fx.pop(node, at, { from: 0.85, rotate });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  function list(parent, { x, y, w, title, items, at, until }) {
    const node = place(el('div', 'ih-list is-staged', parent), x, y);
    node.style.width = `${w}px`;
    if (title) el('div', 'ih-list-title', node, title);
    const rows = items.map((item) => {
      const row = el('div', 'ih-list-item is-staged', node);
      row.append(icon(item.iconName || 'check'));
      el('span', null, row, item.text);
      fx.rise(row, item.at, { distance: 8, duration: 0.3 });
      return row;
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  /** A speech (or thought) bubble with an optional speaker line. */
  /**
   * A speech (or thought) bubble with an optional speaker line. Without `w`
   * a speech bubble is as wide as its longest line; "\n" in `text` breaks a
   * line. tailX is where the tail's tip sits, from the bubble's left edge.
   */
  function bubble(parent, { x, y, w, text, who, whoIcon = 'user', at, until, side = 'left', thought = false, tailX = 40 }) {
    const node = place(el('div', `ih-bubble${side === 'right' ? ' ih-bubble--right' : ''}${thought ? ' ih-bubble--thought' : ''} is-staged`, parent), x, y);
    if (w) node.style.width = `${w}px`;
    if (who) {
      const head = el('div', 'ih-bubble-who', node);
      head.append(icon(whoIcon));
      head.append(document.createTextNode(who));
    }
    el('div', 'ih-bubble-text', node, text);
    if (!thought) {
      // A curved tail whose fill covers the bubble's border where they join,
      // so the bubble and its tail read as one outline.
      const tail = svg('svg', { class: 'ih-bubble-tail', viewBox: '0 0 40 30', width: 40, height: 30, 'aria-hidden': 'true' }, node);
      tail.style.left = `${tailX - 6}px`;
      const wedge = 'M8 0 Q14 16 6 27 Q27 19 33 0Z';
      svg('path', { class: 'ih-bubble-tail-shadow', d: wedge, transform: 'translate(4 4)' }, tail);
      svg('path', { class: 'ih-bubble-tail-fill', d: wedge }, tail);
      svg('path', { class: 'ih-bubble-tail-edge', d: 'M8 0 Q14 16 6 27 Q27 19 33 0' }, tail);
    }
    return show(node, at, until, { rotate: side === 'right' ? 2 : -2, from: 0.5 });
  }

  // ------------------------------------------------------------------
  // Digits: split-flap fields, the mission clock, counters
  // ------------------------------------------------------------------

  /**
   * A row of flip digits. values = [{ at, text, tone }] (text is one char per
   * cell, ' ' leaves a cell blank); changed cells roll up into place.
   * strikes = [{ at, cells: [indices] }] draws a red slash through cells.
   */
  function digits(parent, { x, y, label, cells, values, size = 54, strikes = [], at, until }) {
    const node = place(el('div', 'ih-digits is-staged', parent), x, y);
    if (label) el('div', 'ih-digits-label', node, label);
    const row = el('div', 'ih-digits-row', node);
    row.style.fontSize = `${size}px`;
    const steps = [...values].sort((a, b) => a.at - b.at);
    const slots = Array.from({ length: cells }, (_, i) => {
      const cell = el('div', 'ih-digit', row);
      const now = el('div', 'ih-digit-face', cell);
      const before = el('div', 'ih-digit-face', cell);
      const strike = strikes.find((s) => s.cells.includes(i));
      if (strike) {
        const bar = el('div', 'ih-digit-strike is-staged', cell);
        tween(bar, [{ opacity: 0, scale: '0 1' }, { opacity: 1, scale: '1 1' }], strike.at, 0.25, EASE.out);
      }
      return { cell, now, before };
    });
    onFrame((t) => {
      const index = steps.findLastIndex((s) => s.at <= t);
      const current = steps[Math.max(0, index)];
      const previous = index > 0 ? steps[index - 1] : null;
      const roll = previous ? easeInOutCubic(progress(t, current.at, 0.32)) : 1;
      slots.forEach((slot, i) => {
        const a = current.text[i] ?? ' ';
        const b = previous ? previous.text[i] ?? ' ' : a;
        if (slot.now.textContent !== a) slot.now.textContent = a;
        if (slot.before.textContent !== b) slot.before.textContent = b;
        const rolling = a !== b && roll < 1;
        slot.now.style.transform = `translateY(${rolling ? (1 - roll) * 100 : 0}%)`;
        slot.before.style.transform = `translateY(${rolling ? -roll * 100 : -100}%)`;
        slot.cell.className = `ih-digit${current.tone ? ` ih-digit--${current.tone}` : ''}`;
      });
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A digital clock that counts down to midnight and turns over on `turnAt`. */
  function clock(parent, { x, y, w = 330, at, turnAt, until }) {
    const node = place(el('div', 'ih-clock is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const date = el('div', 'ih-clock-date', node);
    const time = el('div', 'ih-clock-time', node);
    onFrame((t) => {
      const after = t >= turnAt;
      const left = Math.max(0, Math.ceil(turnAt - t));
      const seconds = after ? 0 : 60 - Math.min(59, left);
      date.textContent = after ? 'JAN 1, 2000' : 'DEC 31, 1999';
      time.textContent = after ? '00:00:00' : `23:59:${String(Math.min(59, seconds)).padStart(2, '0')}`;
      node.classList.toggle('is-new', after);
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    fx.bump(node, turnAt, 0.12);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A number that counts from `from` to `to` over [at, at + duration]. */
  function counter(parent, { x, y, label, from = 0, to, at, duration = 1.2, until, format = (n) => n.toLocaleString('en-US') }) {
    const node = place(el('div', 'ih-counter is-staged', parent), x, y);
    const value = el('div', 'ih-counter-value', node);
    if (label) el('div', 'ih-counter-label', node, label);
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, at, duration));
      const text = format(Math.round(from + (to - from) * p));
      if (value.textContent !== text) value.textContent = text;
    });
    fx.rise(node, at, { distance: 12, duration: 0.3 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // Illustrations
  // ------------------------------------------------------------------

  function art(parent, { x, y, w, h, viewBox, className = '' }) {
    const node = svg('svg', { class: `ih-art ${className} is-staged`, viewBox: viewBox || `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    return node;
  }

  /** Photo-referenced vector portrait; the adjacent record supplies its text alternative. */
  function apolloPortrait(parent, { x, y, at, until }) {
    const node = place(el('img', 'ih-apollo-portrait is-staged', parent), x, y);
    node.src = '/assets/song-art/margaret-hamilton-apollo.svg';
    node.alt = '';
    node.setAttribute('aria-hidden', 'true');
    fx.fadeIn(node, at, 0.5);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // The 17 bound volumes of the Apollo listing, top to bottom, traced from
  // the hand-drawn stack in /assets/song-art/margaret-hamilton-apollo.svg.
  const APOLLO_VOLUMES = [
    'M653 80 C729 87 830 85 894 80 Q889 146 913 220 C835 225 736 218 671 212 Q658 146 653 80 Z',
    'M671 212 C747 219 849 225 913 220 Q908 256.5 936 298 C858 303 743 307 678 301 Q676 256.5 671 212 Z',
    'M678 301 C754 308 872 303 936 298 Q931 340 920 381 C842 386 731 385 666 379 Q683 340 678 301 Z',
    'M666 379 C742 386 856 386 920 381 Q915 406 915 429 C837 434 746 439 681 433 Q671 406 666 379 Z',
    'M681 433 C757 440 851 434 915 429 Q910 472 940 499 C862 504 747 517 682 511 Q686 472 681 433 Z',
    'M682 511 C758 518 876 504 940 499 Q935 541 926 564 C848 569 745 577 680 571 Q687 541 682 511 Z',
    'M680 571 C756 578 862 569 926 564 Q921 598 930 629 C852 634 735 631 670 625 Q685 598 680 571 Z',
    'M670 625 C746 632 866 634 930 629 Q925 654.5 929 681 C851 686 723 690 658 684 Q675 654.5 670 625 Z',
    'M658 684 C734 691 865 686 929 681 Q924 712 934 733 C856 738 715 746 650 740 Q663 712 658 684 Z',
    'M650 740 C726 747 870 738 934 733 Q929 786.5 916 834 C838 839 721 839 656 833 Q655 786.5 650 740 Z',
    'M656 833 C732 840 852 839 916 834 Q911 875 900 914 C822 919 714 923 649 917 Q661 875 656 833 Z',
    'M649 917 C725 924 836 919 900 914 Q895 954 916 987 C838 992 724 997 659 991 Q654 954 649 917 Z',
    'M659 991 C735 998 852 992 916 987 Q911 1029.5 943 1052 C865 1057 740 1074 675 1068 Q664 1029.5 659 991 Z',
    'M675 1068 C751 1075 879 1057 943 1052 Q938 1105.5 933 1143 C855 1148 735 1149 670 1143 Q680 1105.5 675 1068 Z',
    'M670 1143 C746 1150 869 1148 933 1143 Q928 1172.5 931 1204 C853 1209 725 1208 660 1202 Q675 1172.5 670 1143 Z',
    'M660 1202 C736 1209 867 1209 931 1204 Q926 1241.5 932 1280 C854 1285 730 1287 665 1281 Q665 1241.5 660 1202 Z',
    'M665 1281 C741 1288 868 1285 932 1280 Q927 1320.5 938 1360 C860 1365 728 1366 663 1360 Q670 1320.5 665 1281 Z',
  ];

  /**
   * Hamilton counts the printout: an overlay that fits the portrait image
   * exactly (same box, same viewBox) lights the volumes one by one from the
   * floor up to her raised hand, while a gold chip beside the stack ticks
   * 1 … 17. The count follows the same easing as a counter() over
   * [at, at + duration], so a lines-of-code counter stays in step.
   */
  function apolloCount(parent, { x, y, at, duration, until }) {
    const node = art(parent, { x, y, w: 230, h: 350, viewBox: '225 25 750 1360', className: 'ih-apollo-count' });
    const total = APOLLO_VOLUMES.length;
    // Bottom volume first: volumes are listed top to bottom.
    const marks = APOLLO_VOLUMES.map((d, i) => svg('path', { class: 'ih-apollo-volume', d, 'data-order': total - 1 - i }, node));
    const centers = APOLLO_VOLUMES.map((d) => {
      const ys = d.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, k) => k % 2);
      return (Math.min(...ys) + Math.max(...ys)) / 2;
    });
    const chip = svg('g', { class: 'ih-apollo-chip' }, node);
    svg('circle', { r: 52 }, chip);
    const number = svg('text', { 'text-anchor': 'middle', y: 24 }, chip);
    onFrame((t) => {
      const counted = total * easeInOutCubic(progress(t, at, duration));
      marks.forEach((path, i) => {
        const order = total - 1 - i;
        // Seconds since this volume was counted, on the eased count.
        const lit = counted - order;
        const flash = lit <= 0 ? 0 : Math.max(0.28, 1 - lit / 1.6);
        path.setAttribute('opacity', lit <= 0 ? '0' : flash.toFixed(2));
      });
      const n = Math.min(total, Math.floor(counted + 1e-6));
      // The chip leaves once the count is done; the total lives in the record.
      const done = at + duration;
      chip.setAttribute('opacity', t < at ? '0' : t < done ? '1' : Math.max(0, 1 - (t - done) / 0.3).toFixed(2));
      if (n >= 1) {
        // The chip glides up to the volume being counted.
        const k = Math.min(total - 1, Math.max(0, counted - 0.5));
        const lo = Math.floor(k), hi = Math.min(total - 1, lo + 1), f = k - lo;
        const cy = centers[total - 1 - lo] + (centers[total - 1 - hi] - centers[total - 1 - lo]) * f;
        chip.setAttribute('transform', `translate(990 ${cy.toFixed(1)})`);
      } else chip.setAttribute('transform', `translate(990 ${centers[total - 1].toFixed(1)})`);
      const text = String(Math.max(1, n));
      if (number.textContent !== text) number.textContent = text;
    });
    fx.fadeIn(node, at, 0.2);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A car (for "a modern car? A hundred million lines"). */
  function car(parent, { x, y, at, until, w = 220 }) {
    const node = art(parent, { x, y, w, h: w * 0.5, viewBox: '0 0 220 110' });
    svg('ellipse', { class: 'ih-prop-shadow', cx: 111, cy: 96, rx: 99, ry: 6 }, node);
    svg('path', { class: 'ih-car-body', d: 'M12 78 L15 60 Q17 51 32 49 L60 45 L82 25 Q89 18 103 18 H146 Q159 18 171 29 L189 46 Q205 48 209 59 L211 77 Q210 84 203 84 H20 Q12 84 12 78 Z' }, node);
    svg('path', { class: 'ih-car-sill', d: 'M13 72 Q82 78 210 70 L210 79 Q209 84 201 84 H21 Q13 84 13 78 Z' }, node);
    svg('path', { class: 'ih-car-window', d: 'M88 29 Q92 26 101 26 H122 V46 H72 Z M130 26 H147 Q155 26 162 32 L176 46 H130 Z' }, node);
    svg('path', { class: 'ih-car-glass-shine', d: 'M90 29 H101 L85 43 H75 Z M135 29 H142 L157 43 H150 Z' }, node);
    svg('path', { class: 'ih-car-seam', d: 'M125 50 V71 M72 50 L66 69 M181 50 L185 67' }, node);
    svg('path', { class: 'ih-car-trim', d: 'M76 54 H85 M140 54 H149 M19 68 H30 M193 70 H206' }, node);
    svg('path', { class: 'ih-car-highlight', d: 'M34 52 Q91 48 180 51' }, node);
    svg('path', { class: 'ih-car-light', d: 'M195 55 L204 57 Q207 59 207 64 H195 Z' }, node);
    svg('rect', { class: 'ih-car-tail-light', x: 16, y: 57, width: 6, height: 8, rx: 2 }, node);
    for (const cx of [56, 168]) {
      svg('circle', { class: 'ih-car-wheel', cx, cy: 80, r: 17 }, node);
      svg('circle', { class: 'ih-car-rim', cx, cy: 80, r: 10 }, node);
      for (let i = 0; i < 5; i++) svg('path', { class: 'ih-car-spoke', d: `M${cx} 80 l0 -7`, transform: `rotate(${i * 72} ${cx} 80)` }, node);
      svg('circle', { class: 'ih-car-hub', cx, cy: 80, r: 3 }, node);
    }
    show(node, at, until, { from: 0.7 });
    return node;
  }

  /** A head overflowing with lines of code. */
  /**
   * A head in profile whose skull opens like a hinged lid: three case files
   * drop into the open head (what one person can hold), then at
   * `overflowAt` more files cram in, the lid rattles, papers keep bursting
   * out of the top, steam puffs from the ear, and the brow worries. One
   * head can't hold a whole modern system. Every pose is a pure function of
   * song time.
   */
  function overflowingHead(parent, { x, y, size = 210, at, until, overflowAt }) {
    const id = `ih-head-${++uid}`;
    const node = art(parent, { x, y, w: size, h: size, viewBox: '-30 -50 260 260' });
    const over = overflowAt ?? at + 1.5;
    const CUT = 66;       // the skull's cut plane
    const HINGE = [46, CUT];
    // The profile, front to chin: brow, a softly convex nose with a rounded
    // tip, the philtrum, both lips meeting at the mouth's corner, the fold
    // under the lower lip, and the chin.
    const skull = 'M46 96 C40 46 78 14 118 18 C156 22 176 52 172 86 L171 98 C173.6 104.4 179.4 112.6 182.8 117.6 C185.6 121.8 184.6 125.8 179.8 126.4 C177.2 126.8 174.6 126.6 172.6 127.4 C172.8 130.2 174.4 133 175.2 135.2 C176 137.6 175.2 139.8 172.6 140.8 C175.4 142.4 175.8 145.8 173.8 148 C172.6 149.2 171.2 149.8 171 151.4 C170.8 155.6 168.2 159.6 162 161.4 C154 163.4 145 161.2 138 158 L110 152 C88 150 70 140 62 126 C52 120 47 110 46 96 Z';
    const defs = svg('defs', {}, node);
    const below = svg('clipPath', { id: `${id}-below` }, defs);
    svg('rect', { x: -50, y: CUT, width: 400, height: 300 }, below);
    const above = svg('clipPath', { id: `${id}-above` }, defs);
    svg('rect', { x: -50, y: -200, width: 400, height: 200 + CUT }, above);
    // Files stand in the hole: hide whatever lies below its front rim.
    const inHole = svg('clipPath', { id: `${id}-hole` }, defs);
    svg('path', { d: `M-50 -200 H350 V${CUT} H174 A64 10 0 0 1 44 ${CUT} H-50 Z` }, inHole);
    // Skin lit from the front, the face's side: a soft radial gradient.
    const skin = svg('radialGradient', { id: `${id}-skin`, gradientUnits: 'userSpaceOnUse', cx: 150, cy: 96, r: 120 }, defs);
    for (const [index, offset] of ['0', '0.55', '1'].entries()) svg('stop', { offset, class: `ih-head-skin-stop-${index}` }, skin);

    svg('ellipse', { class: 'ih-head-glow', cx: 100, cy: 100, rx: 118, ry: 112 }, node);
    svg('path', { class: 'ih-head-neck', d: 'M78 150 L118 160 L122 190 Q96 200 70 190 Z' }, node);
    // The jaw's shadow on the neck, and the Adam's apple.
    svg('path', { class: 'ih-head-neck-shade', d: 'M78 150 L118 160 L119.4 170 Q99 167 79.6 158 Z' }, node);
    svg('path', { class: 'ih-head-neck-line', d: 'M113.6 171.4 Q117.4 176 114.6 181.2' }, node);
    svg('path', { class: 'ih-head-shirt', d: 'M44 205 Q52 184 74 182 Q97 196 124 184 Q148 188 156 205 Z' }, node);
    svg('path', { class: 'ih-head-shirt-shade', d: 'M124 184 Q148 188 156 205 L132 205 Q132 194 124 184 Z M74 182 Q60 186 52 196 L48 205 L62 205 Q64 192 74 182 Z' }, node);
    svg('path', { class: 'ih-head-collar', d: 'M74 182 Q97 196 124 184 L128 191 Q97 207 68 190 Z' }, node);
    svg('path', { class: 'ih-head-collar-rib', d: 'M71.4 186.6 Q97 200.6 126 187.8' }, node);

    // The lower head: skin below the cut, hair at the back with its strands,
    // the sideburn, the ear with its folds, and the face.
    const lower = svg('g', { 'clip-path': `url(#${id}-below)` }, node);
    svg('path', { class: 'ih-head', d: skull, fill: `url(#${id}-skin)` }, lower);
    svg('path', { class: 'ih-head-jaw-shade', d: 'M62 126 C72 142 92 150 112 152 L138 158 C146 160.8 155 161.6 162 160.2 C166 159 169 156.4 170.4 153 C162 157 148 156 134 150 L110 145 C90 142 74 134 62 118 Z' }, lower);
    svg('path', { class: 'ih-head-hair', d: 'M40 60 C40 84 44 102 54 114 C58 104 66 97 76 94 C80 84 86 74 94 60 Z' }, lower);
    svg('path', { class: 'ih-head-hair-strand', d: 'M47 70 Q49 88 55 102 M56 70 Q60 82 66 92 M66 68 Q72 78 78 86' }, lower);
    // The sideburn: a slim strip down from the hairline in front of the ear.
    svg('path', { class: 'ih-head-hair', d: 'M70.4 97.6 C73.6 95 76.6 93.8 79.4 94 C80.2 99.6 79.8 105 78.6 109.4 C78 110.8 76.4 110.8 75.8 109.4 C74.8 105.4 73.2 101 70.4 97.6 Z' }, lower);
    svg('ellipse', { class: 'ih-head-cheek', cx: 149, cy: 124, rx: 10, ry: 6.4 }, lower);
    svg('path', { class: 'ih-head-ear', d: 'M70 112 C66 100 52 104 52 116 C52 128 60 136 68 132 Q74 128 72 120 Z' }, node);
    svg('path', { class: 'ih-head-ear-detail', d: 'M66.6 113.4 C64.6 106.8 57.4 107.4 57.4 115.6 C57.4 121.6 61.2 126.6 65.4 124.8 M61.6 116.4 Q64.4 118.4 62 121.6' }, node);
    const brow = svg('path', { class: 'ih-head-brow' }, node);
    svg('path', { class: 'ih-head-eye', d: 'M150 102 Q158 96 166 102 Q158 106 150 102 Z' }, node);
    svg('circle', { class: 'ih-head-iris', cx: 161, cy: 101.5, r: 2.6 }, node);
    svg('circle', { class: 'ih-head-catchlight', cx: 162.1, cy: 100.5, r: 0.85 }, node);
    svg('path', { class: 'ih-head-lid', d: 'M149.6 101.4 Q158 95 166.4 101.4 M149.4 98.6 Q157.6 93.2 165 97.2' }, node);
    svg('path', { class: 'ih-head-lash', d: 'M165.6 100.8 L168 99.4 M166 102 L168.6 101.6' }, node);
    // The nose's wing curls round the nostril; the lips are tinted just
    // inside the profile, and the mouth runs back from their corner.
    svg('path', { class: 'ih-head-nose-wing', d: 'M178.8 121 C175 118.8 171.6 120.6 172 123.6 C172.3 125.4 174.2 126.2 176 125.8' }, node);
    svg('path', { class: 'ih-head-lips', d: 'M173.6 136.4 C173.9 137.9 173.3 139 172 139.6 C171 139.3 170.6 138.6 170.9 137.9 C171.9 137.6 172.8 137.1 173.6 136.4 Z M172.6 142.6 C173.9 143.7 174 145.6 172.8 146.7 C171.4 146.4 170.6 145.2 170.8 144 C171.3 143.3 171.9 142.9 172.6 142.6 Z' }, node);
    const mouth = svg('path', { class: 'ih-head-feature' }, node);

    // The open skull: a dark hole with a lit rim.
    const hole = svg('g', { opacity: 0 }, node);
    svg('ellipse', { class: 'ih-head-hole', cx: 109, cy: CUT, rx: 64, ry: 10 }, hole);
    // Case files standing in the head; the first three are what fits.
    const files = svg('g', { 'clip-path': `url(#${id}-hole)` }, node);
    const FILES = [
      { x: 84, rot: -7, at: at + 0.55 }, { x: 109, rot: 2, at: at + 0.85 }, { x: 134, rot: 8, at: at + 1.15 },
      { x: 96, rot: -18, at: over, extra: true }, { x: 122, rot: 15, at: over + 0.08, extra: true },
      { x: 72, rot: -26, at: over + 0.16, extra: true }, { x: 147, rot: 24, at: over + 0.24, extra: true },
      { x: 109, rot: -4, at: over + 0.32, extra: true },
    ];
    const fileNodes = FILES.map((f, i) => {
      const g = svg('g', { opacity: 0 }, files);
      const lift = f.extra ? 14 : 0;
      const top = CUT - 38 - lift;
      svg('path', { class: 'ih-head-file-tab', d: `M${f.x - 12} ${top + 2} v-6 q0 -2 2 -2 h9 l3 4 Z` }, g);
      // A sheet of paper peeks out of each folder.
      svg('rect', { class: 'ih-head-file-sheet', x: f.x - 9, y: top - 3.4, width: 19, height: 8, rx: 0.8 }, g);
      svg('rect', { class: `ih-head-file${f.extra ? ' ih-head-file--extra' : ''}`, x: f.x - 13, y: top, width: 26, height: 48, rx: 2 }, g);
      svg('path', { class: 'ih-head-file-spine', d: `M${f.x - 10.4} ${top + 2.6} V${top + 45.4}` }, g);
      svg('path', { class: 'ih-head-file-line', d: `M${f.x - 8} ${top + 9} h16 M${f.x - 8} ${top + 16} h11 M${f.x - 8} ${top + 23} h14` }, g);
      svg('rect', { class: 'ih-head-file-label', x: f.x - 7, y: top + 30, width: 14, height: 6, rx: 0.8 }, g);
      return { g, f, top };
    });
    svg('path', { class: 'ih-head-rim', d: `M45 ${CUT} A64 10 0 0 0 173 ${CUT}` }, hole);
    const lipFront = svg('path', { class: 'ih-head-lip', d: `M45 ${CUT} A64 10 0 0 0 173 ${CUT}`, opacity: 0 }, node);

    // The lid: the hair-covered top of the skull, hinged at the back.
    const lid = svg('g', {}, node);
    const underside = svg('ellipse', { class: 'ih-head-underside', cx: 109, cy: CUT, rx: 64, ry: 10, opacity: 0 }, lid);
    const cap = svg('g', { 'clip-path': `url(#${id}-above)` }, lid);
    svg('path', { class: 'ih-head ih-head--cap', d: skull, fill: `url(#${id}-skin)` }, cap);
    svg('path', { class: 'ih-head-hair', d: 'M38 70 C34 36 70 10 112 12 C152 14 178 40 176 72 Z' }, cap);
    svg('path', { class: 'ih-head-hair-shine', d: 'M62 34 C78 20 104 16 124 20 C100 22 80 30 62 34 Z' }, cap);
    svg('path', { class: 'ih-head-hair-strand', d: 'M50 52 Q76 28 116 24 M60 60 Q90 38 132 34 M86 18 Q116 14 146 26 M128 44 Q152 46 168 58 M44 64 Q60 44 84 36' }, cap);
    // Hinged at the back, the open lid stands behind the files.
    node.insertBefore(lid, files);

    // Papers burst out of the open head, a steady stream once it overflows.
    const stream = svg('g', {}, node);
    const papers = Array.from({ length: 9 }, (_, i) => {
      const g = svg('g', { opacity: 0 }, stream);
      svg('path', { class: 'ih-head-overflow', d: 'M-9 -14 H5 L11 -8 V12 Q11 14 9 14 H-9 Q-11 14 -11 12 V-12 Q-11 -14 -9 -14 Z' }, g);
      svg('path', { class: 'ih-head-dogear', d: 'M5 -14 V-8 H11 Z' }, g);
      svg('path', { class: 'ih-head-code', d: 'M-6 -7 h8 M-6 0 h11 M-6 7 h9' }, g);
      return {
        g,
        delay: i * 0.17,
        x0: 92 + hash01(i * 13 + 1) * 34,
        vx: ((i % 2 ? 1 : -1) * (0.25 + 0.75 * hash01(i * 7 + 3))) * 150,
        vy: 175 + hash01(i * 11 + 5) * 55,
        spin: (hash01(i * 17 + 2) - 0.5) * 520,
      };
    });
    // Steam from the ear and a bead of sweat when it overflows.
    // Steam clouds: three overlapping circles each, so they read as vapour.
    const puffs = [0, 1, 2].map(() => {
      const g = svg('g', { opacity: 0 }, node);
      for (const [cx, cy, r] of [[-5, 1, 5], [3, -3, 6], [8, 2, 4.5]]) svg('circle', { class: 'ih-head-steam', cx, cy, r }, g);
      return g;
    });
    const sweat = svg('path', { class: 'ih-head-sweat', d: 'M0 -9 Q-6 1 0 5 Q6 1 0 -9 Z', opacity: 0 }, node);

    const CALM_BROW = 'M148 92 Q158 87 166 92';
    const WORRIED_BROW = 'M148 94 Q157 89 166 85';
    const CALM_MOUTH = 'M172.4 141 Q168.8 142.8 164.6 140.6';
    const WORRIED_MOUTH = 'M172.4 141.4 Q169.6 139.8 167.4 141.2 Q165.4 142.6 163.4 141.2';
    const PERIOD = 1.3;
    onFrame((t) => {
      const open = easeInOutCubic(progress(t, at + 0.15, 0.4));
      const jam = progress(t, over, 0.35);
      const rattle = t >= over ? 4 * Math.sin((t - over) * 26) * (0.5 + 0.5 * Math.sin((t - over) * 3.1)) : 0;
      const angle = -34 * open - 12 * jam + rattle;
      lid.setAttribute('transform', `translate(0 ${(-6 * jam).toFixed(1)}) rotate(${angle.toFixed(1)} ${HINGE[0]} ${HINGE[1]})`);
      hole.setAttribute('opacity', open > 0.05 ? '1' : '0');
      lipFront.setAttribute('opacity', open > 0.05 ? '1' : '0');
      underside.setAttribute('opacity', open > 0.05 ? '1' : '0');
      fileNodes.forEach(({ g, f }) => {
        const p = progress(t, f.at, 0.3);
        if (p <= 0) { g.setAttribute('opacity', '0'); return; }
        const drop = (1 - easeInOutCubic(p)) * -46;
        const wobble = t >= over ? 1.6 * Math.sin(t * 19 + f.x) : 0;
        g.setAttribute('opacity', '1');
        g.setAttribute('transform', `translate(0 ${drop.toFixed(1)}) rotate(${(f.rot + wobble).toFixed(1)} ${f.x} ${CUT})`);
      });
      papers.forEach((pp) => {
        const since = t - over - pp.delay;
        if (since < 0) { pp.g.setAttribute('opacity', '0'); return; }
        const age = since % PERIOD;
        const px = pp.x0 + pp.vx * age;
        const py = CUT - 30 - pp.vy * age + 220 * age * age;
        // Gone before falling back past the opening, so no ghost crosses the face.
        const fade = Math.max(0, Math.min(1, age / 0.1, (PERIOD - age) / 0.35, (CUT - 8 - py) / 22));
        pp.g.setAttribute('opacity', fade.toFixed(2));
        pp.g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${(pp.spin * age).toFixed(1)})`);
      });
      puffs.forEach((puff, i) => {
        const since = t - over - 0.3 - i * 0.45;
        if (since < 0) { puff.setAttribute('opacity', '0'); return; }
        const age = (since % 1.35) / 1.35;
        const grow = 0.7 + 1.1 * age;
        puff.setAttribute('transform', `translate(${(50 - 18 * age).toFixed(1)} ${(108 - 40 * age).toFixed(1)}) scale(${grow.toFixed(2)})`);
        puff.setAttribute('opacity', (0.8 * Math.min(1, age * 5) * (1 - age)).toFixed(2));
      });
      const drip = t - over - 0.5;
      sweat.setAttribute('opacity', drip < 0 ? '0' : '1');
      sweat.setAttribute('transform', `translate(140 ${(84 + Math.min(12, Math.max(0, drip) * 8)).toFixed(1)})`);
      const worried = t >= over;
      brow.setAttribute('d', worried ? WORRIED_BROW : CALM_BROW);
      mouth.setAttribute('d', worried ? WORRIED_MOUTH : CALM_MOUTH);
    });
    show(node, at, until, { from: 0.7 });
    return node;
  }



  /** A flowchart of processing steps; cross(at) strikes the whole idea. */
  /**
   * The processing steps of a flowchart as cards riding a conveyor belt
   * (one module per step: the decomposition Parnas argued against).
   * labels = [{ text, iconName }] or plain strings.
   */
  function steps(parent, { x, y, labels, at, step = 0.3, until }) {
    const node = place(el('div', 'ih-steps', parent), x, y);
    const belt = el('div', 'ih-belt is-staged', node);
    const tread = el('div', 'ih-belt-tread', belt);
    fx.fadeIn(belt, at - 0.1, 0.25);
    onFrame((t) => { tread.style.backgroundPosition = `${((t * 40) % 28).toFixed(1)}px 0`; });
    labels.forEach((label, i) => {
      const spec = typeof label === 'string' ? { text: label } : label;
      if (i) {
        const arrow = icon('pointer', 'ih-step-arrow is-staged');
        node.append(arrow);
        fx.fadeIn(arrow, at + i * step - 0.1, 0.2);
      }
      const box = el('div', 'ih-step is-staged', node);
      if (spec.iconName) box.append(icon(spec.iconName));
      box.append(document.createTextNode(spec.text));
      fx.pop(box, at + i * step, { from: 0.7 });
    });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /**
   * One big case file labelled "System" that dashed cut lines divide into
   * module files at `cutAt`, and that comes apart into separate files at
   * `apartAt`: the question of how to split a system into modules.
   * pipeline = { at, labels: [{ text, iconName }] } then straightens the
   * same files into a row on a conveyor belt and relabels them as
   * processing steps (the flowchart decomposition Parnas argued against).
   */
  function systemSplit(parent, { x, y, w, h, title = 'System', parts, at, cutAt, apartAt, pipeline, until }) {
    const node = place(el('div', 'ih-split is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const pieceW = w / parts.length;
    const spread = (parts.length - 1) / 2;
    const pieces = parts.map((name, i) => {
      const piece = place(el('div', 'ih-split-piece', node), i * pieceW, 0);
      piece.style.width = `${pieceW}px`;
      piece.style.height = `${h}px`;
      if (i === 0) piece.classList.add('ih-split-piece--first');
      if (i === parts.length - 1) piece.classList.add('ih-split-piece--last');
      const label = el('div', 'ih-split-label is-staged', piece);
      label.append(icon(SERVICE_ICONS[name] || 'box'));
      label.append(document.createTextNode(name));
      fx.fadeIn(label, apartAt + 0.15, 0.3);
      const offset = i - spread;
      const apart = { translate: `${offset * 44}px ${Math.abs(offset) * 10 + 8}px`, rotate: `${offset * 3}deg` };
      tween(piece, [{ translate: '0 0', rotate: '0deg' }, apart], apartAt, 0.6, EASE.back);
      if (pipeline) {
        const spec = pipeline.labels[i];
        const stepLabel = el('div', 'ih-split-label ih-split-label--step is-staged', piece);
        if (spec.iconName) stepLabel.append(icon(spec.iconName));
        stepLabel.append(document.createTextNode(spec.text));
        fx.fadeOut(label, pipeline.at, 0.2);
        tween(stepLabel, [{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }], pipeline.at + i * 0.3 + 0.15, 0.35, EASE.back);
        tween(piece, [apart, { translate: `${offset * 44}px 0`, rotate: '0deg' }], pipeline.at, 0.5, EASE.inOut);
      }
      return piece;
    });
    if (pipeline) {
      const belt = el('div', 'ih-belt ih-split-belt is-staged', node);
      belt.style.top = `${h + 12}px`;
      const tread = el('div', 'ih-belt-tread', belt);
      fx.fadeIn(belt, pipeline.at, 0.35);
      onFrame((t) => { tread.style.backgroundPosition = `${((t * 40) % 28).toFixed(1)}px 0`; });
      for (let i = 1; i < parts.length; i++) {
        const arrow = place(icon('pointer', 'ih-step-arrow ih-split-arrow is-staged'), i * pieceW + (i - 1 - spread) * 44 + 8, h / 2 - 14);
        node.append(arrow);
        fx.fadeIn(arrow, pipeline.at + i * 0.3, 0.25);
      }
      if (pipeline.verdictAt !== undefined) {
        // A bad idea: the steps dim and a "no" sign lands left of the
        // verdict below the flowchart.
        const pad = 90;
        const tall = h + 170;
        const ban = svg('svg', { class: 'ih-ban is-staged', viewBox: `${-pad} -40 ${w + 2 * pad} ${tall + 40}`, 'aria-hidden': 'true' }, node);
        place(ban, -pad, -40);
        ban.style.width = `${w + 2 * pad}px`;
        ban.style.height = `${tall + 40}px`;
        fx.fadeIn(ban, pipeline.verdictAt, 0.1);
        for (const piece of pieces) tween(piece, [{ opacity: 1 }, { opacity: 0.6 }], pipeline.verdictAt, 0.4, EASE.inOut);
        const stroke = (d, at, cls = '') => {
          for (const part of ['ih-ban-edge', 'ih-ban-stroke']) {
            const path = svg('path', { class: `${part} ${cls}`, d }, ban);
            path.style.strokeDashoffset = '1';
            fx.draw(path, at, 0.35);
          }
        };
        if (pipeline.noAt !== undefined) {
          const r = 34;
          const cx = pipeline.noX ?? 70;
          const cy = h + 98;
          const disc = svg('circle', { class: 'ih-ban-disc is-staged', cx, cy, r }, ban);
          fx.pop(disc, pipeline.noAt, { from: 0.4 });
          const k = r * Math.SQRT1_2;
          stroke(`M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx} ${cy + r}A${r} ${r} 0 1 1 ${cx} ${cy - r}`, pipeline.noAt, 'ih-ban-thin');
          stroke(`M${cx - k} ${cy - k}L${cx + k} ${cy + k}`, pipeline.noAt + 0.2, 'ih-ban-thin');
        }
      }
    }
    const whole = el('div', 'ih-split-title', node);
    whole.append(icon('box'));
    whole.append(document.createTextNode(title));
    fx.fadeOut(whole, apartAt, 0.2);
    for (let i = 1; i < parts.length; i++) {
      const cut = place(el('div', 'ih-split-cut is-staged', node), i * pieceW, -16);
      cut.style.height = `${h + 32}px`;
      cut.append(icon('scissors'));
      tween(cut, [
        { opacity: 0, clipPath: 'inset(-30px -20px 100% -20px)' },
        { opacity: 1, clipPath: 'inset(-30px -20px 0 -20px)' },
      ], cutAt + (i - 1) * 0.12, 0.4);
      fx.fadeOut(cut, apartAt, 0.2);
    }
    during(node, 'is-apart', apartAt);
    fx.rise(node, at, { distance: 18, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return { node, pieces };
  }

  /**
   * A tear-off desk calendar. pages = [{ at, month, day, year, tone }]; on
   * each change the old page tears off and falls away.
   */
  function calendar(parent, { x, y, pages, at, until }) {
    const node = place(el('div', 'ih-calendar is-staged', parent), x, y);
    const rings = el('div', 'ih-calendar-rings', node);
    for (let i = 0; i < 4; i++) el('span', null, rings);
    const sheet = el('div', 'ih-calendar-page', node);
    const month = el('div', 'ih-calendar-month', sheet);
    const day = el('div', 'ih-calendar-day', sheet);
    const year = el('div', 'ih-calendar-year', sheet);
    const sorted = [...pages].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      const page = latest(sorted, t) || sorted[0];
      if (month.textContent !== page.month) month.textContent = page.month;
      if (day.textContent !== String(page.day)) day.textContent = String(page.day);
      if (year.textContent !== String(page.year)) year.textContent = String(page.year);
      sheet.classList.toggle('is-bad', page.tone === 'bad');
    });
    sorted.slice(1).forEach((page, i) => {
      const old = sorted[i];
      const torn = el('div', 'ih-calendar-page ih-calendar-torn is-staged', node);
      el('div', 'ih-calendar-month', torn, old.month);
      el('div', 'ih-calendar-day', torn, String(old.day));
      el('div', 'ih-calendar-year', torn, String(old.year));
      tween(torn, [
        { opacity: 1, translate: '0 0', rotate: '0deg' },
        { opacity: 1, translate: '10px 30px', rotate: '8deg', offset: 0.3 },
        { opacity: 0, translate: '60px 180px', rotate: '38deg' },
      ], page.at, 0.8, EASE.in);
      fx.bump(sheet, page.at + 0.05, 0.06);
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  // ------------------------------------------------------------------
  // The iceberg: interface above the water, implementation below
  // ------------------------------------------------------------------

  function gearPath(teeth, outer, inner) {
    let d = '';
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? inner : outer;
      const a1 = a - Math.PI / (teeth * 4);
      const a2 = a + Math.PI / (teeth * 4);
      d += `${i ? 'L' : 'M'} ${(r * Math.cos(a1)).toFixed(1)} ${(r * Math.sin(a1)).toFixed(1)} L ${(r * Math.cos(a2)).toFixed(1)} ${(r * Math.sin(a2)).toFixed(1)} `;
    }
    return `${d}Z`;
  }

  /**
   * A cutaway in a 420×360 frame. The exposed ice stays fixed while two
   * implementations crossfade below the waterline; swap time is seekable.
   */
  function iceberg(parent, { x, y, scale = 1, at, until, gearsFrom }) {
    const id = `ih-berg-${++uid}`;
    const node = art(parent, { x, y, w: 420 * scale, h: 360 * scale, viewBox: '0 0 420 360', className: 'ih-iceberg' });
    node.dataset.testid = 'ih-iceberg';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const defs = svg('defs', {}, node);
    for (const name of ['sea', 'ice', 'tip']) {
      const gradient = svg('linearGradient', { id: `${id}-${name}`, x1: '0%', y1: '0%', x2: '35%', y2: '100%' }, defs);
      for (const [index, offset] of ['0%', '55%', '100%'].entries()) {
        svg('stop', { offset, class: `ih-iceberg-${name}-stop-${index}` }, gradient);
      }
    }
    svg('rect', { class: 'ih-iceberg-sea', x: 0, y: 120, width: 420, height: 240, rx: 16, fill: `url(#${id}-sea)` }, node);
    // Under the surface: soft shafts of light fanning down, and bubbles
    // rising behind the ice.
    const rays = svg('g', { class: 'ih-iceberg-rays' }, node);
    for (const d of ['M22 122 L48 122 L26 360 L-6 360 Z', 'M92 122 L112 122 L118 360 L84 360 Z', 'M318 122 L340 122 L372 360 L336 360 Z', 'M372 122 L392 122 L432 360 L402 360 Z']) {
      svg('path', { class: 'ih-iceberg-ray', d }, rays);
    }
    const BUBBLES = [[30, 9, 0.2, 2.4], [52, 13, 0.55, 1.6], [70, 8, 0.8, 2], [348, 11, 0.1, 2.2], [366, 7, 0.45, 1.5], [388, 10, 0.7, 2.6], [16, 12, 0.9, 1.4], [400, 9, 0.3, 1.8]];
    const bubbles = BUBBLES.map(([bx, speed, phase, r]) => ({ node: svg('circle', { class: 'ih-iceberg-bubble', cx: bx, cy: 300, r }, node), bx, speed, phase }));
    const deep = svg('g', { class: 'ih-iceberg-deep' }, node);
    svg('path', { class: 'ih-iceberg-outline', fill: `url(#${id}-ice)`, d: 'M105 120 L81 154 L63 200 L91 255 L137 308 L204 344 L265 322 L311 272 L349 208 L332 162 L309 120 Z' }, deep);
    svg('path', { class: 'ih-iceberg-facet-light', d: 'M105 120 L159 166 L129 244 L137 308 L91 255 L63 200 Z M159 166 L215 130 L257 203 L204 344 L192 252 Z' }, deep);
    svg('path', { class: 'ih-iceberg-facet-dark', d: 'M309 120 L332 162 L349 208 L311 272 L265 322 L286 237 L257 203 L273 146 Z M129 244 L192 252 L204 344 L137 308 Z' }, deep);
    svg('path', { class: 'ih-iceberg-seam', d: 'M105 120 L159 166 L129 244 L137 308 M159 166 L215 130 L257 203 L286 237 M257 203 L204 344' }, deep);
    const tip = svg('g', { class: 'ih-iceberg-tip', 'data-testid': 'ih-iceberg-tip' }, node);
    svg('path', { class: 'ih-iceberg-outline', fill: `url(#${id}-tip)`, d: 'M105 120 L142 76 L166 62 L205 10 L233 48 L263 67 L309 120 Z' }, tip);
    svg('path', { class: 'ih-iceberg-tip-shadow', d: 'M205 10 L233 48 L263 67 L309 120 L239 120 L224 70 Z' }, tip);
    svg('path', { class: 'ih-iceberg-tip-light', d: 'M205 10 L190 81 L161 120 L105 120 L142 76 L166 62 Z' }, tip);
    svg('path', { class: 'ih-iceberg-ridge', d: 'M166 62 L151 97 M205 10 L224 70 L239 120' }, tip);
    // Cracks and snow catching the light on the ice above the water.
    svg('path', { class: 'ih-iceberg-crack', d: 'M246 62 L252 82 L247 100 M183 52 L178 70 L184 86 M140 86 L148 104' }, tip);
    svg('path', { class: 'ih-iceberg-snow', d: 'M199 22 L206 18 L212 26 M160 70 L168 64 L174 72 M243 60 L250 64' }, tip);
    for (const [sx, sy] of [[198, 40], [176, 92], [214, 30]]) svg('path', { class: 'ih-iceberg-glint', d: `M${sx} ${sy - 3} L${sx + 0.8} ${sy - 0.8} L${sx + 3} ${sy} L${sx + 0.8} ${sy + 0.8} L${sx} ${sy + 3} L${sx - 0.8} ${sy + 0.8} L${sx - 3} ${sy} L${sx - 0.8} ${sy - 0.8} Z` }, tip);
    // Small floes drifting at the surface.
    for (const d of ['M26 120 L34 113 L46 112 L54 120 Z', 'M356 120 L362 115 L374 114 L384 120 Z']) svg('path', { class: 'ih-iceberg-floe', d, fill: `url(#${id}-tip)` }, node);
    // A translucent inspection window separates the metaphor from literal ice.
    const mechanism = svg('g', { class: 'ih-iceberg-mechanism', 'data-testid': 'ih-iceberg-mechanism', opacity: 0 }, deep);
    svg('rect', { class: 'ih-iceberg-window', x: 121, y: 168, width: 169, height: 133, rx: 24 }, mechanism);
    const specs = [
      [{ x: 167, y: 211, r: 31, teeth: 10 }, { x: 220, y: 253, r: 31, teeth: 10 }, { x: 256, y: 204, r: 21, teeth: 7 }],
      [],
    ];
    const sets = specs.map((layout, setIndex) => {
      const group = svg('g', { class: `ih-iceberg-layout ih-iceberg-layout--${setIndex}`, opacity: setIndex ? 0 : 1 }, mechanism);
      if (setIndex === 1) {
        const vessel = svg('g', { transform: 'translate(111 191) scale(1.27)', 'data-testid': 'ih-iceberg-submarine' }, group);
        const { ringNodes } = submarineBody(vessel);
        ringNodes.forEach(ring => ring.setAttribute('opacity', '0'));
      }
      const gears = layout.map((spec) => {
        const gear = svg('g', {}, group);
        svg('path', { class: 'ih-iceberg-gear', d: gearPath(spec.teeth, spec.r, spec.r * 0.8) }, gear);
        svg('circle', { class: 'ih-iceberg-gear-ring', r: spec.r * 0.53 }, gear);
        svg('circle', { class: 'ih-iceberg-axle', r: 5 }, gear);
        return { gear, spec };
      });
      return { group, gears };
    });
    // Foam where the ice meets the water.
    const foam = svg('path', { class: 'ih-iceberg-foam' }, node);
    const surface = svg('path', { class: 'ih-iceberg-surface', 'data-testid': 'ih-iceberg-surface' }, node);
    svg('path', { class: 'ih-iceberg-reflection', d: 'M92 131 H157 M274 134 H325 M43 146 H82 M337 149 H377' }, node);
    let swapAt = Infinity;
    const spinFrom = gearsFrom ?? at;
    onFrame((t) => {
      const motionTime = reducedMotion.matches ? 0 : Math.max(0, t - at);
      const wave = Array.from({ length: 43 }, (_, i) => `${i ? 'L' : 'M'}${i * 10} ${(120 + 1.6 * Math.sin(i / 4 + motionTime * 0.7)).toFixed(2)}`).join(' ');
      surface.setAttribute('d', wave);
      foam.setAttribute('d', Array.from({ length: 22 }, (_, i) => `${i ? 'L' : 'M'}${104 + i * 9.8} ${(122.2 + 1.4 * Math.sin(i / 1.6 + motionTime * 1.3)).toFixed(2)}`).join(' '));
      // Bubbles rise from the deep, wobbling, and fade before the surface.
      for (const { node: bubble, bx, speed, phase } of bubbles) {
        const rise = ((motionTime * speed / 210 + phase) % 1);
        bubble.setAttribute('cy', (352 - rise * 210).toFixed(1));
        bubble.setAttribute('cx', (bx + 2.4 * Math.sin(motionTime * 2 + phase * 9)).toFixed(1));
        bubble.setAttribute('opacity', (Math.min(1, rise * 6) * Math.min(1, (1 - rise) * 4) * 0.7).toFixed(2));
      }
      mechanism.setAttribute('opacity', progress(t, spinFrom, 0.4).toFixed(2));
      const swapped = reducedMotion.matches ? Number(t >= swapAt) : progress(t, swapAt, 0.6);
      sets.forEach(({ group, gears }, index) => {
        group.setAttribute('opacity', (index ? swapped : 1 - swapped).toFixed(2));
        gears.forEach(({ gear, spec }, gearIndex) => {
          const angle = reducedMotion.matches ? 0 : Math.max(0, t - spinFrom) * (gearIndex % 2 ? -12 : 12);
          gear.setAttribute('transform', `translate(${spec.x} ${spec.y}) rotate(${angle.toFixed(2)})`);
        });
      });
    });
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, swap(when) { swapAt = when; return this; }, point(px, py) { return [x + px * scale, y + py * scale]; } };
  }

  /**
   * A two-way design choice: a pill with both options, the chosen one lit.
   * flips = [absoluteSongTime, ...] switch sides.
   */
  function toggle(parent, { x, y, a, b, at, flips = [], until, start = 0 }) {
    const node = place(el('div', 'ih-toggle is-staged', parent), x, y);
    const left = el('span', 'ih-toggle-side', node, a);
    el('span', 'ih-toggle-or', node, 'or');
    const right = el('span', 'ih-toggle-side', node, b);
    const times = [...flips].sort((p, q) => p - q);
    onFrame((t) => {
      const side = (start + times.filter((f) => f <= t).length) % 2;
      left.classList.toggle('is-on', side === 0);
      right.classList.toggle('is-on', side === 1);
    });
    fx.fadeIn(node, at, 0.25);
    if (until !== undefined) fx.fadeOut(node, until, 0.25);
    return node;
  }

  /** A dashed waterline across the stage at y (the iceberg's sea level). */
  function waterline(parent, { y, x1 = 0, x2 = 960, at, until }) {
    const line = svg('svg', { class: 'ih-waterline is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    svg('line', { x1, y1: y, x2, y2: y }, line);
    fx.fadeIn(line, at, 0.4);
    if (until !== undefined) fx.fadeOut(line, until, 0.3);
    return line;
  }

  // ------------------------------------------------------------------
  // The wall outlet and the plant behind the wall
  // ------------------------------------------------------------------

  /**
   * An 880×360 cutaway of the outlet analogy. Left, behind the wall: the
   * hidden power plant, a framed landscape that changes from a solar farm at
   * noon to a wind farm at midnight (plants = [{ at, kind }]), with current
   * running over a pylon into the brick wall. Right, in the room: the outlet
   * (the stable interface), a charger, and a phone on a desk that keeps
   * charging through every swap. On `blindAt` the charger gets a spy's
   * blindfold: it can't tell where the power comes from. Pure function of
   * song time; with reduced motion all decorative motion holds still.
   */
  function outlet(parent, { x, y, scale = 1, at, until, plants, blindAt }) {
    const node = art(parent, { x, y, w: 880 * scale, h: 360 * scale, viewBox: '0 0 880 360', className: 'ih-power' });
    node.setAttribute('data-testid', 'ih-power-scene');
    const sorted = [...plants].sort((a, b) => a.at - b.at);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const id = `ih-power-${++uid}`;
    const defs = svg('defs', {}, node);
    function gradient(name, tones) {
      const gradientNode = svg('linearGradient', { id: `${id}-${name}`, x1: '0%', y1: '0%', x2: '0%', y2: '100%' }, defs);
      tones.forEach((tone, i) => svg('stop', { offset: `${i * 100 / (tones.length - 1)}%`, class: `ih-power-${tone}` }, gradientNode));
      return `url(#${id}-${name})`;
    }
    const S = (parentNode, cls, attrs) => svg(attrs.d ? 'path' : attrs.r !== undefined ? 'circle' : attrs.rx !== undefined && attrs.width === undefined ? 'ellipse' : 'rect', { class: cls, ...attrs }, parentNode);
    function label(parentNode, text, lx, ly, width) {
      const g = svg('g', {}, parentNode);
      S(g, 'ih-power-pill', { x: lx, y: ly, width, height: 32, rx: 16 });
      const textNode = svg('text', { class: 'ih-power-label', x: lx + width / 2, y: ly + 23, 'text-anchor': 'middle' }, g);
      textNode.textContent = text;
      return g;
    }
    const dayPaint = gradient('day', ['day-top', 'day-bottom']);
    const nightPaint = gradient('night', ['night-top', 'night-bottom']);
    const porcelain = gradient('porcelain', ['porcelain-top', 'porcelain-bottom']);
    const screen = gradient('screen', ['screen-top', 'screen-bottom']);
    const wood = gradient('wood', ['wood-top', 'wood-bottom']);
    const clip = svg('clipPath', { id: `${id}-landscape` }, defs);
    S(clip, '', { x: 14, y: 34, width: 330, height: 250, rx: 16 });

    // ---- Behind the wall: the hidden plant -------------------------------
    S(node, 'ih-power-hard-shadow', { x: 21, y: 41, width: 330, height: 250, rx: 16 });
    const landscape = svg('g', { 'clip-path': `url(#${id}-landscape)` }, node);
    const day = svg('g', { class: 'ih-power-source ih-power-source--solar', 'data-testid': 'ih-power-source', 'data-source': 'solar' }, landscape);
    S(day, '', { x: 14, y: 34, width: 330, height: 250, fill: dayPaint });
    const sun = svg('g', { transform: 'translate(282 92)' }, day);
    S(sun, 'ih-power-sun-halo', { cx: 0, cy: 0, r: 44 });
    const rays = svg('g', {}, sun);
    for (let k = 0; k < 12; k++) {
      const a = (k * 30) * Math.PI / 180;
      S(rays, 'ih-power-ray', { d: `M${(31 * Math.cos(a)).toFixed(1)} ${(31 * Math.sin(a)).toFixed(1)} L${(40 * Math.cos(a)).toFixed(1)} ${(40 * Math.sin(a)).toFixed(1)}` });
    }
    S(sun, 'ih-power-sun', { cx: 0, cy: 0, r: 24 });
    const cloud = svg('g', { class: 'ih-power-cloud' }, day);
    for (const [cx, cy, r] of [[0, 0, 15], [18, -8, 19], [38, 0, 15], [18, 6, 14]]) S(cloud, '', { cx, cy, r });
    S(day, 'ih-power-hill-far', { d: 'M14 200 Q92 160 172 196 Q252 156 344 190 V284 H14Z' });
    S(day, 'ih-power-hill', { d: 'M14 234 Q110 204 200 230 Q280 210 344 228 V284 H14Z' });
    const glints = [];
    for (const [px, py, sc] of [[34, 236, 0.92], [142, 250, 0.84], [244, 240, 0.88]]) {
      const rack = svg('g', { transform: `translate(${px} ${py}) scale(${sc})` }, day);
      S(rack, 'ih-power-rack', { d: 'M18 0 V24 M90 0 V24 M12 24 H96' });
      S(rack, 'ih-power-panel-edge', { d: 'M0 2 L16 -44 H112 L96 2 V8 H0Z' });
      S(rack, 'ih-power-panel', { d: 'M0 2 L16 -44 H112 L96 2Z' });
      S(rack, 'ih-power-panel-grid', { d: 'M6 -13 H102 M11 -29 H107 M24 2 L40 -44 M48 2 L64 -44 M72 2 L88 -44' });
      glints.push(S(rack, 'ih-power-glint', { d: 'M30 2 L46 -44 H58 L42 2Z' }));
    }
    const dayLabel = label(day, 'Solar · noon', 26, 246, 150);

    const night = svg('g', { class: 'ih-power-source ih-power-source--wind', 'data-testid': 'ih-power-source', 'data-source': 'wind', opacity: 0 }, landscape);
    S(night, '', { x: 14, y: 34, width: 330, height: 250, fill: nightPaint });
    const stars = [[44, 64], [92, 96], [140, 58], [196, 84], [230, 52], [118, 132], [58, 140], [318, 140], [176, 128], [252, 124]]
      .map(([sx, sy], k) => S(night, 'ih-power-star', { cx: sx, cy: sy, r: 1.4 + (k % 3) * 0.5 }));
    S(night, 'ih-power-moon-glow', { cx: 282, cy: 88, r: 38 });
    S(night, 'ih-power-moon', { d: 'M282 62 A26 26 0 1 0 306 102 A22 22 0 0 1 282 62Z' });
    S(night, 'ih-power-night-hill-far', { d: 'M14 214 Q100 168 188 210 Q256 172 344 202 V284 H14Z' });
    S(night, 'ih-power-night-hill', { d: 'M14 244 Q100 214 180 240 Q258 220 344 238 V284 H14Z' });
    const lights = [];
    const turbines = [[70, 262, 0.78], [178, 270, 0.6], [282, 258, 0.7]].map(([tx, ty, size]) => {
      const tower = svg('g', { transform: `translate(${tx} ${ty}) scale(${size})` }, night);
      S(tower, 'ih-power-tower', { d: 'M-6 0 L-3 -112 Q0 -116 3 -112 L6 0Z' });
      S(tower, 'ih-power-tower-shade', { d: 'M1 -113 L3 -112 L6 0 H1Z' });
      S(tower, 'ih-power-nacelle', { x: -11, y: -119, width: 26, height: 12, rx: 5 });
      lights.push(S(tower, 'ih-power-beacon', { cx: 2, cy: -122, r: 3 }));
      const rotor = svg('g', { class: 'ih-power-rotor', 'data-testid': 'ih-power-rotor', transform: 'translate(0 -113)' }, tower);
      for (let blade = 0; blade < 3; blade++) S(rotor, 'ih-power-blade', { d: 'M-2 0 C-7 -14 -6 -37 -2 -59 Q0 -64 2 -58 L5 -13 Q6 -4 2 0Z', transform: `rotate(${blade * 120})` });
      S(rotor, 'ih-power-rotor-hub', { cx: 0, cy: 0, r: 6 });
      return rotor;
    });
    const nightLabel = label(night, 'Wind · midnight', 26, 246, 178);
    S(node, 'ih-power-frame-ink', { x: 14, y: 34, width: 330, height: 250, rx: 16 });
    S(node, 'ih-power-frame', { x: 14, y: 34, width: 330, height: 250, rx: 16 });

    // ---- The pylon and the current running into the wall ------------------
    S(node, 'ih-power-ground', { cx: 412, cy: 302, rx: 34, ry: 5 });
    S(node, 'ih-power-pylon', { d: 'M396 300 L406 134 M428 300 L418 134 M406 134 L412 112 L418 134 M398 268 L426 232 L400 200 L424 170 L406 146 M426 268 L398 232 L424 200 L400 170 L418 146 M390 140 H434 M394 164 H430' });
    for (const ix of [392, 432]) S(node, 'ih-power-insulator', { x: ix - 3, y: 140, width: 6, height: 9, rx: 2 });
    const supplyPath = 'M344 172 Q368 204 392 149 M432 149 Q452 196 470 186 H494 V220 H536';
    S(node, 'ih-power-wire', { d: supplyPath });
    const supplyFlow = S(node, 'ih-power-flow', { 'data-testid': 'ih-power-flow', d: supplyPath });

    // ---- The wall, cut open --------------------------------------------
    S(node, 'ih-power-brick', { x: 470, y: 18, width: 50, height: 312 });
    let mortar = '';
    for (let by = 32; by < 330; by += 16) mortar += `M470 ${by} H520 `;
    for (let row = 0, by = 18; by < 330; by += 16, row++) for (const bx of row % 2 ? [482, 506] : [494]) mortar += `M${bx} ${by} V${Math.min(330, by + 16)} `;
    S(node, 'ih-power-mortar', { d: mortar });
    S(node, 'ih-power-wire', { d: 'M470 186 H494 V220 H536' });
    S(node, 'ih-power-flow ih-power-flow--wall', { d: 'M470 186 H494 V220 H536' });

    // ---- The room: outlet, charger, desk, phone -------------------------
    S(node, 'ih-power-hard-shadow', { d: 'M520 25 H860 Q873 25 873 38 V330 Q873 343 860 343 H520Z' });
    S(node, 'ih-power-room', { d: 'M520 18 H853 Q866 18 866 31 V323 Q866 336 853 336 H520Z' });
    let stripes = '';
    for (let sx = 538; sx < 866; sx += 22) stripes += `M${sx} 18 V300 `;
    S(node, 'ih-power-wallpaper', { d: stripes });
    S(node, 'ih-power-lamp-light', { d: 'M686 74 L736 74 L812 250 L610 250Z' });
    S(node, 'ih-power-lamp-cord', { d: 'M711 18 V52' });
    S(node, 'ih-power-lamp-shade', { d: 'M690 74 Q692 52 711 52 Q730 52 732 74Z' });
    S(node, 'ih-power-baseboard', { x: 520, y: 300, width: 346, height: 14 });
    S(node, 'ih-power-floor', { d: 'M520 314 H866 V323 Q866 336 853 336 H520Z' });
    S(node, 'ih-power-room-edge', { d: 'M520 18 H853 Q866 18 866 31 V323 Q866 336 853 336 H520Z' });

    const outletGroup = svg('g', { 'data-testid': 'ih-power-outlet' }, node);
    S(outletGroup, 'ih-power-plate-shadow', { x: 545, y: 156, width: 74, height: 116, rx: 12 });
    S(outletGroup, 'ih-power-plate', { x: 540, y: 150, width: 74, height: 116, rx: 12, fill: porcelain });
    S(outletGroup, 'ih-power-plate-highlight', { d: 'M549 172 V162 Q549 157 555 157 H600' });
    for (const sy of [161, 255]) {
      S(outletGroup, 'ih-power-screw', { cx: 577, cy: sy, r: 3 });
      S(outletGroup, 'ih-power-screw-slot', { d: `M575 ${sy + 1} l4 -2` });
    }
    for (const oy of [172, 214]) {
      S(outletGroup, 'ih-power-socket-outline', { d: `M557 ${oy} Q577 ${oy - 9} 597 ${oy} L600 ${oy + 21} Q577 ${oy + 31} 554 ${oy + 21}Z` });
      S(outletGroup, 'ih-power-socket', { x: 565, y: oy + 4, width: 4, height: 12, rx: 1 });
      S(outletGroup, 'ih-power-socket', { x: 585, y: oy + 5, width: 4, height: 10, rx: 1 });
      S(outletGroup, 'ih-power-socket', { d: `M573 ${oy + 23} V${oy + 19} Q577 ${oy + 13} 581 ${oy + 19} V${oy + 23}Z` });
    }

    // The charger: a cheerful plug-in cube that never sees the power plant.
    // Down from the charger, under the desk, and up into the phone's stand.
    const cablePath = 'M577 262 C580 318 776 322 786 248';
    S(node, 'ih-power-cable', { d: cablePath });
    const cableFlow = S(node, 'ih-power-cable-flow', { 'data-testid': 'ih-power-flow', d: cablePath });
    const charger = svg('g', { class: 'ih-power-charger' }, node);
    S(charger, 'ih-power-adapter-shadow', { x: 554, y: 214, width: 52, height: 48, rx: 10 });
    S(charger, 'ih-power-adapter', { x: 550, y: 210, width: 54, height: 50, rx: 10, fill: porcelain });
    const led = S(charger, 'ih-power-led', { cx: 596, cy: 218, r: 2.6 });
    for (const ex of [568, 586]) S(charger, 'ih-power-charger-eye', { cx: ex, cy: 232, r: 2.8 });
    S(charger, 'ih-power-charger-smile', { d: 'M570 243 Q577 249 584 243' });
    const blindfold = svg('g', { class: 'ih-power-blindfold', opacity: 0 }, charger);
    S(blindfold, 'ih-power-blindfold-band', { x: 546, y: 225, width: 62, height: 13, rx: 4 });
    S(blindfold, 'ih-power-blindfold-band', { d: 'M606 230 L620 222 L616 233 L622 242 L606 236Z' });

    S(node, 'ih-power-desk-leg', { x: 658, y: 260, width: 8, height: 54 });
    S(node, 'ih-power-desk-leg', { x: 846, y: 260, width: 8, height: 54 });
    S(node, 'ih-power-desk', { x: 640, y: 250, width: 226, height: 12, rx: 3, fill: wood });
    // A mug with gently rising steam, and a small potted plant.
    S(node, 'ih-power-mug', { d: 'M676 222 H704 V244 Q704 250 698 250 H682 Q676 250 676 244Z' });
    S(node, 'ih-power-mug-handle', { d: 'M704 228 Q714 228 714 236 Q714 244 704 244' });
    const steam = [S(node, 'ih-power-steam', { d: 'M684 214 Q680 206 686 198 Q690 190 686 182' }), S(node, 'ih-power-steam', { d: 'M696 214 Q692 206 698 198 Q702 190 698 182' })];
    S(node, 'ih-power-pot', { d: 'M832 232 H856 L852 250 H836Z' });
    for (const d of ['M844 232 Q834 214 840 204 Q846 214 844 232', 'M844 232 Q852 212 862 210 Q858 224 844 232', 'M844 232 Q830 222 826 210 Q838 214 844 232']) S(node, 'ih-power-leaf', { d });

    const glow = S(node, 'ih-power-screen-glow', { cx: 785, cy: 178, rx: 58, ry: 74 });
    S(node, 'ih-power-stand', { d: 'M760 250 L772 232 H798 L810 250Z' });
    S(node, 'ih-power-phone', { x: 748, y: 104, width: 74, height: 140, rx: 14 });
    S(node, 'ih-power-screen', { x: 754, y: 112, width: 62, height: 124, rx: 9, fill: screen });
    S(node, 'ih-power-speaker', { x: 774, y: 116, width: 22, height: 4, rx: 2 });
    S(node, 'ih-power-battery-frame', { x: 769, y: 136, width: 32, height: 54, rx: 5 });
    S(node, 'ih-power-battery-cap', { x: 778, y: 130, width: 14, height: 5, rx: 2 });
    const battery = S(node, 'ih-power-battery', { 'data-testid': 'ih-power-battery', x: 773, y: 172, width: 24, height: 14, rx: 2 });
    S(node, 'ih-power-bolt', { d: 'M788 146 L777 166 H785 L782 180 L795 158 H787Z' });
    const percent = svg('text', { class: 'ih-power-percent', x: 785, y: 222, 'text-anchor': 'middle' }, node);

    onFrame((t) => {
      const reduce = reducedMotion.matches;
      const current = latest(sorted, t) || sorted[0];
      const index = sorted.indexOf(current);
      const previous = index > 0 ? sorted[index - 1] : current;
      const blend = reduce ? 1 : progress(t, current.at, 0.6);
      const nightOpacity = (previous.kind === 'wind' ? 1 : 0) * (1 - blend) + (current.kind === 'wind' ? 1 : 0) * blend;
      day.setAttribute('opacity', (1 - nightOpacity).toFixed(2));
      night.setAttribute('opacity', nightOpacity.toFixed(2));
      // The two labels share one spot: swap them at the midpoint of the
      // cross-fade instead of blending two texts into one garbled label.
      dayLabel.setAttribute('opacity', nightOpacity < 0.5 ? '1' : '0');
      nightLabel.setAttribute('opacity', nightOpacity < 0.5 ? '0' : '1');
      const m = reduce ? 0 : Math.max(0, t - at);
      rays.setAttribute('transform', `rotate(${(m * 14 % 360).toFixed(1)})`);
      cloud.setAttribute('transform', `translate(${(40 + (m * 9) % 340).toFixed(1)} 70)`);
      glints.forEach((g, k) => g.setAttribute('opacity', (0.15 + 0.5 * Math.max(0, Math.sin(m * 1.6 - k * 1.1))).toFixed(2)));
      stars.forEach((star, k) => star.setAttribute('opacity', (reduce ? 0.85 : 0.55 + 0.45 * Math.sin(m * 1.7 + k * 1.9)).toFixed(2)));
      lights.forEach((light, k) => light.setAttribute('opacity', (reduce ? 1 : 0.35 + 0.65 * (Math.sin(m * 2.4 + k * 2) > 0 ? 1 : 0.2)).toFixed(2)));
      turbines.forEach((rotor, k) => rotor.setAttribute('transform', `translate(0 -113) rotate(${(m * (30 + k * 7) % 360).toFixed(1)})`));
      supplyFlow.setAttribute('stroke-dashoffset', (-m * 30).toFixed(1));
      cableFlow.setAttribute('stroke-dashoffset', (-m * 30).toFixed(1));
      led.setAttribute('opacity', (reduce ? 1 : 0.55 + 0.45 * Math.sin(m * 3)).toFixed(2));
      glow.setAttribute('opacity', (reduce ? 0.5 : 0.4 + 0.15 * Math.sin(m * 2)).toFixed(2));
      steam.forEach((wisp, k) => {
        const phase = (m * 0.5 + k * 0.5) % 1;
        wisp.setAttribute('opacity', (reduce ? 0.6 : Math.sin(phase * Math.PI) * 0.8).toFixed(2));
        wisp.setAttribute('transform', `translate(0 ${(reduce ? 0 : -8 * phase).toFixed(1)})`);
      });
      // Blindfolded on "can't tell": it slides down over the charger's eyes.
      const b = blindAt === undefined ? 0 : reduce ? Number(t >= blindAt) : easeInOutCubic(progress(t, blindAt, 0.35));
      blindfold.setAttribute('opacity', Math.min(1, b * 1.5).toFixed(2));
      blindfold.setAttribute('transform', `translate(0 ${(-14 * (1 - b)).toFixed(1)})`);
      const level = reduce ? 0.7 : 0.35 + 0.55 * progress(t, at, 12);
      battery.setAttribute('height', (46 * level).toFixed(1));
      battery.setAttribute('y', (186 - 46 * level).toFixed(1));
      const text = `${Math.round(level * 100)}%`;
      if (percent.textContent !== text) percent.textContent = text;
    });
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Title card: a manila dossier
  // ------------------------------------------------------------------

  /** A manila case file title card; fade: true fades it in instead of popping. */
  function dossier(parent, { x, y, w, tab, title, sub, at, until, rotate = -2, fade = false }) {
    const node = place(el('div', 'ih-dossier is-staged', parent), x, y);
    node.style.width = `${w}px`;
    el('div', 'ih-dossier-tab', node, tab);
    el('div', 'ih-dossier-title', node, title);
    if (sub) el('div', 'ih-dossier-sub', node, sub);
    if (fade) {
      node.style.rotate = `${rotate}deg`;
      fx.fadeIn(node, at, 0.3);
    } else fx.pop(node, at, { from: 0.8, rotate });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Decryption: text that resolves from cipher noise, left to right
  // ------------------------------------------------------------------

  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const DIGIT = '0123456789';

  /** A cipher character that keeps the case (and so the width) of `ch`. */
  function cipher(ch, seed) {
    const pool = /[A-Z]/.test(ch) ? UPPER : /[a-z]/.test(ch) ? LOWER : /[0-9]/.test(ch) ? DIGIT : null;
    return pool ? pool[Math.floor(hash01(seed) * pool.length)] : ch;
  }

  /**
   * Shows `text` in `node` from `at`: characters before the lock point are
   * the real text, the rest churn as cipher. `offset` delays this span's
   * lock point (to decrypt several spans as one line). Before `at` the
   * node shows `before`.
   */
  function decrypt(node, text, at, { cps = 75, offset = 0, seed = 1, before = '' } = {}) {
    onFrame((t) => {
      if (t < at) {
        if (node.textContent !== before) node.textContent = before;
        return;
      }
      const locked = Math.floor((t - at) * cps) - offset;
      if (locked >= text.length) {
        if (node.textContent !== text) node.textContent = text;
        return;
      }
      const frame = Math.floor(t * 20);
      let out = '';
      for (let i = 0; i < text.length; i++) out += i < locked ? text[i] : cipher(text[i], seed * 7919 + frame * 131 + i * 17);
      node.textContent = out;
    });
  }

  // ------------------------------------------------------------------
  // Case files: every module is a manila folder; secrets are sealed
  // ------------------------------------------------------------------

  /**
   * Each named service keeps one logo wherever it appears in the song, and
   * no two services share one, so a viewer can follow a module from scene
   * to scene by its badge as well as its name.
   */
  const SERVICE_ICONS = {
    OrderService: 'cart', RefundService: 'resend', WalletService: 'wallet',
    PaymentGateway: 'card', PayPalGateway: 'plug', StripeGateway: 'bolt', PayPal: 'globe',
    Dates: 'calendar', UserRepository: 'database',
    Payroll: 'cash', Billing: 'receipt', Interest: 'percent', Reports: 'chart',
    Login: 'key', Profile: 'user', Admin: 'gear',
    // The corkboard's pinned modules.
    Cart: 'cart', Order: 'box', Pay: 'card', Ship: 'truck', Auth: 'key', Mail: 'envelope', Tax: 'percent', Stock: 'stack',
  };

  // Each case file keeps one number wherever it turns up again: numbered
  // in order of first appearance, by name.
  const fileNumbers = new Map();
  const fileNumberOf = (name) => {
    if (!fileNumbers.has(name)) fileNumbers.set(name, fileNumbers.size + 1);
    return fileNumbers.get(name);
  };

  /**
   * A module drawn as a case file: a manila folder with a typed name label,
   * a paper clip, and a file number. kind = 'interface' draws a public
   * credential badge instead (what callers may see); 'external' draws a
   * foreign-contact card. lines = [{ text, at }] lists operations.
   */
  function module(parent, { x, y, w = 200, h = 74, name, sub, iconName = SERVICE_ICONS[name] || 'box', kind, lines = [], at, until, rise = true }) {
    const variant = kind || 'file';
    const node = place(el('div', `ih-module ih-module--${variant} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    const glows = {};
    if (variant === 'file') {
      el('div', 'ih-file-tab', node);
      const clip = svg('svg', { class: 'ih-clip', viewBox: '0 0 16 40', 'aria-hidden': 'true' }, node);
      svg('path', { d: 'M5 38V8a3 3 0 0 1 6 0v26a5 5 0 0 1-10 0V6a7 7 0 0 1 14 0v22' }, clip);
      el('span', 'ih-file-no', node, `№ ${String(fileNumberOf(name) % 100).padStart(2, '0')}`);
    }
    if (variant === 'interface') {
      el('div', 'ih-badge-strip', node, '«interface» · public');
      el('span', 'ih-badge-hole', node);
    }
    if (variant === 'external') el('div', 'ih-contact-strip', node, 'external contact');
    const head = el('div', 'ih-module-head', node);
    const seal = el('span', 'ih-module-seal', head);
    seal.append(icon(iconName));
    el('span', 'ih-module-name', head, name);
    if (sub) el('div', 'ih-module-sub', node, sub);
    for (const line of lines) {
      const row = el('div', `ih-module-line${line.at !== undefined ? ' is-staged' : ''}`, node, line.text);
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 6, duration: 0.25 });
    }
    if (at !== undefined) {
      if (rise) fx.rise(node, at, { distance: 18, duration: 0.4 });
      else fx.pop(node, at, { from: 0.7 });
    }
    if (until !== undefined) fx.fadeOut(node, until, 0.25);

    function glow(tone) {
      if (!glows[tone]) glows[tone] = el('div', `ih-module-glow${tone === 'gold' ? '' : ` ih-module-glow--${tone}`} is-staged`, node);
      return glows[tone];
    }

    return {
      node, x, y, w, h,
      /**
       * A sealed red "top secret" envelope pinned to the file: the decision
       * it hides. The file's number fades as the envelope seals over it.
       */
      secret(text, { at: when, until: gone, dx, dy } = {}) {
        const env = envelope(node, { text, x: dx ?? 14, y: dy ?? h - 18 });
        show(env, when, gone, { rotate: -3, from: 1.6 });
        const number = node.querySelector('.ih-file-no');
        if (number) {
          fx.fadeOut(number, when, 0.2);
          if (gone !== undefined) fx.fadeIn(number, gone, 0.2);
        }
        return env;
      },
      verdict(text, { at: when, until: gone, ok = true, dx, dy } = {}) {
        const tag = el('div', `ih-verdict ih-verdict--${ok ? 'ok' : 'no'} is-staged`, node);
        tag.append(icon(ok ? 'check' : 'cross'));
        tag.append(document.createTextNode(text));
        tag.style.left = `${dx ?? w - 40}px`;
        tag.style.top = `${dy ?? -14}px`;
        show(tag, when, gone, { rotate: 4, from: 1.5 });
        return tag;
      },
      /** A rubber stamp across the folder (AFFECTED, CHANGED, ...). */
      stamp(text, { at: when, color = 'red', rotate = -9, dx, dy } = {}) {
        const mark = el('div', `ih-file-stamp ih-file-stamp--${color} is-staged`, node, text);
        mark.style.left = `${dx ?? w / 2 - 40}px`;
        mark.style.top = `${dy ?? h / 2 - 14}px`;
        fx.slam(mark, when, { from: 2.2, rotate });
        return mark;
      },
      light(when, gone, tone = 'gold') {
        const g = glow(tone);
        tween(g, [{ opacity: 0 }, { opacity: 1 }], when, 0.18, EASE.out);
        fx.bump(node, when, 0.05);
        if (gone !== undefined) tween(g, { opacity: 0 }, gone, 0.3, EASE.in);
        return this;
      },
      dim(when, gone) {
        tween(node, { opacity: 0.32 }, when, 0.3, EASE.inOut);
        if (gone !== undefined) tween(node, { opacity: 1 }, gone, 0.3, EASE.inOut);
        return this;
      },
    };
  }

  /** A sealed envelope with a wax seal and a "TOP SECRET" band: a module's secret. */
  function envelope(parent, { text, x, y }) {
    const node = place(el('div', 'ih-envelope is-staged', parent), x, y);
    const flap = svg('svg', { class: 'ih-envelope-flap', viewBox: '0 0 100 20', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, node);
    svg('path', { d: 'M1 1 L50 18 L99 1' }, flap);
    const seal = el('span', 'ih-envelope-seal', node);
    seal.append(icon('lock'));
    el('span', 'ih-envelope-band', node, 'Top secret');
    el('span', 'ih-envelope-text', node, text);
    return node;
  }

  /**
   * A public credential tag: the gold «interface» strip over a name, the
   * label counterpart of the sealed envelope (what callers may see).
   */
  function publicTag(parent, { text, x, y }) {
    const node = place(el('div', 'ih-public-tag is-staged', parent), x, y);
    el('div', 'ih-badge-strip', node, '«interface» · public');
    el('span', 'ih-badge-hole', node);
    el('div', 'ih-public-tag-name', node, text);
    return node;
  }

  // ------------------------------------------------------------------
  // Couriers: a dashed route with sealed envelopes travelling along it
  // ------------------------------------------------------------------

  /**
   * A route from `from` to `to` (bowed by `bend`), drawn on at `at`, along
   * which envelopes travel every `period` seconds until `until`. tone =
   * gold | cyan | pink | red. Every route ends in an arrowhead at `to`:
   * a call always shows which way the message goes.
   */
  function courier(parent, { from, to, bend = 0, at, until, tone = 'gold', period = 1.8, carriers = 1 }) {
    const art = svg('svg', { class: 'ih-route-art is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const [x1, y1] = from;
    const [x2, y2] = to;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + bend;
    // The route's dark edge draws in with its line, not ahead of it.
    const shadow = svg('path', { class: 'ih-route-shadow', d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    const path = svg('path', { class: `ih-route ih-route--${tone}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    const ink = svg('path', { class: `ih-route-draw ih-route--${tone}`, d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}` }, art);
    fx.draw(shadow, at, 0.35);
    fx.draw(ink, at, 0.35);
    tween(path, [{ opacity: 0 }, { opacity: 1 }], at + 0.3, 0.1, EASE.out);
    const letters = Array.from({ length: carriers }, () => {
      const g = svg('g', { class: 'ih-route-letter', opacity: 0 }, art);
      svg('rect', { x: -9, y: -6.5, width: 18, height: 13, rx: 1.5 }, g);
      svg('path', { d: 'M -8 -5.5 L 0 1 L 8 -5.5' }, g);
      svg('circle', { class: 'ih-route-wax', cx: 0, cy: 1.5, r: 2.4 }, g);
      return g;
    });
    // A message always has a direction: a filled arrowhead with an ink edge,
    // drawn above the envelopes, which deliver just short of it.
    const angle = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
    const head = svg('path', { class: `ih-route-head ih-route-head--${tone} is-staged`, d: 'M 1 0 L -15 -8.5 L -15 8.5 Z', transform: `translate(${x2} ${y2}) rotate(${angle.toFixed(1)})` }, art);
    fx.fadeIn(head, at + 0.3, 0.1);
    const length = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
    const reach = Math.max(0.5, 1 - 24 / Math.max(1, length));
    const end = until ?? Infinity;
    onFrame((t) => {
      letters.forEach((g, k) => {
        const age = t - (at + 0.4) - (k * period) / carriers;
        if (age < 0 || t > end - 0.3) {
          g.setAttribute('opacity', '0');
          return;
        }
        const phase = (age % period) / period;
        const p = phase * reach;
        const q = 1 - p;
        const px = q * q * x1 + 2 * q * p * cx + p * p * x2;
        const py = q * q * y1 + 2 * q * p * cy + p * p * y2;
        g.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
        g.setAttribute('opacity', Math.min(1, phase * 6, (1 - phase) * 6).toFixed(2));
      });
    });
    fx.fadeIn(art, at, 0.05);
    if (until !== undefined) fx.fadeOut(art, until - 0.25, 0.25);
    return art;
  }

  /**
   * "Implements" (UML realization): a dashed cream line from the
   * implementing module to the interface it fulfils, ending in a hollow
   * triangle. No envelopes travel on it: it is a promise kept, not a call.
   */
  function implementsLink(parent, { from, to, at, until }) {
    const art = svg('svg', { class: 'ih-realize-art is-staged', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const [x1, y1] = from;
    const [x2, y2] = to;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    // The line stops at the triangle's base, so the hollow head stays empty.
    const bx = x2 - Math.cos(angle) * 20;
    const by = y2 - Math.sin(angle) * 20;
    svg('path', { class: 'ih-realize-shadow', d: `M ${x1} ${y1} L ${bx.toFixed(1)} ${by.toFixed(1)}` }, art);
    svg('path', { class: 'ih-realize-line', d: `M ${x1} ${y1} L ${bx.toFixed(1)} ${by.toFixed(1)}` }, art);
    // The head's placement lives on a wrapper group, so animating the
    // triangle itself never overrides where it points.
    const anchor = svg('g', { transform: `translate(${x2} ${y2}) rotate(${(angle * 180 / Math.PI).toFixed(1)})` }, art);
    svg('path', { class: 'ih-realize-head', d: 'M 0 0 L -20 -12 L -20 12 Z' }, anchor);
    fx.fadeIn(art, at, 0.3);
    if (until !== undefined) fx.fadeOut(art, until - 0.25, 0.25);
    return art;
  }

  // ------------------------------------------------------------------
  // Security hardware: laser walls, spotlights, the interrogation lamp
  // ------------------------------------------------------------------

  /** A vertical laser wall between two emitters; it hums (slowly) once on. */
  function laser(parent, { x, y1, y2, at, until }) {
    const node = svg('svg', { class: 'ih-laser is-staged', viewBox: `0 0 30 ${y2 - y1 + 24}`, width: 30, height: y2 - y1 + 24, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x - 15}px`;
    node.style.top = `${y1 - 12}px`;
    const len = y2 - y1;
    const glowLine = svg('line', { class: 'ih-laser-glow', x1: 15, y1: 12, x2: 15, y2: 12 + len }, node);
    const beam = svg('line', { class: 'ih-laser-beam', x1: 15, y1: 12, x2: 15, y2: 12 + len }, node);
    svg('rect', { class: 'ih-laser-emitter', x: 5, y: 0, width: 20, height: 12, rx: 3 }, node);
    svg('rect', { class: 'ih-laser-emitter', x: 5, y: 12 + len, width: 20, height: 12, rx: 3 }, node);
    svg('circle', { class: 'ih-laser-eye', cx: 15, cy: 9, r: 2.5 }, node);
    svg('circle', { class: 'ih-laser-eye', cx: 15, cy: 15 + len, r: 2.5 }, node);
    fx.fadeIn(node, at, 0.2);
    fx.draw(beam, at + 0.1, 0.3);
    fx.draw(glowLine, at + 0.1, 0.3);
    onFrame((t) => glowLine.setAttribute('opacity', (0.45 + 0.15 * Math.sin((t - at) * 3.6)).toFixed(3)));
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A soft pool of light from above (a searchlight picking something out). */
  function spotlight(parent, { x, y, w = 300, h = 300, at, until }) {
    const node = place(el('div', 'ih-spot is-staged', parent), x - w / 2, y - h / 2);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    fx.fadeIn(node, at, 0.4);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  /** A hanging interrogation lamp whose light falls on what is below it. */
  function lamp(parent, { x, y = 0, w = 520, h = 360, at, until }) {
    const node = svg('svg', { class: 'ih-lamp is-staged', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, parent);
    node.style.left = `${x - w / 2}px`;
    node.style.top = `${y}px`;
    const c = w / 2;
    svg('path', { class: 'ih-lamp-light', d: `M ${c - 30} 46 L ${c + 30} 46 L ${w} ${h} L 0 ${h} Z` }, node);
    svg('line', { class: 'ih-lamp-cord', x1: c, y1: 0, x2: c, y2: 22 }, node);
    svg('path', { class: 'ih-lamp-shade', d: `M ${c - 12} 22 L ${c + 12} 22 L ${c + 36} 48 L ${c - 36} 48 Z` }, node);
    svg('ellipse', { class: 'ih-lamp-bulb', cx: c, cy: 49, rx: 14, ry: 5 }, node);
    fx.fadeIn(node, at, 0.4);
    onFrame((t) => node.style.transform = `rotate(${(1.2 * Math.sin(t * 1.3)).toFixed(2)}deg)`);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Agents: a trench-coat silhouette with a name tag
  // ------------------------------------------------------------------

  /**
   * A secret agent in a fedora, trench coat, and sunglasses, holding a
   * briefcase; sways a little and the lenses glint now and then. tie =
   * hat-band colour (red | gold | cyan). The figure is 160×300 at scale 1.
   */
  /**
   * Shows the shading strip on the side of a sleeve segment that faces away
   * from the upper-left light, `raise` degrees up from hanging: the outer
   * strip when it hangs, the inner one once it is raised. `side` is -1 for
   * the mirrored free arm.
   */
  function shadeArm([outer, inner], raise, side = 1) {
    const a = raise * Math.PI / 180;
    const away = side * Math.cos(a) - Math.sin(a);
    outer.setAttribute('fill-opacity', Math.min(1, Math.max(0, away)).toFixed(2));
    inner.setAttribute('fill-opacity', Math.min(1, Math.max(0, -away)).toFixed(2));
  }

  // The tuxedo agent's arm, in the martini arm's coordinates: shoulder,
  // elbow, and hand, and each segment's direction when it hangs (degrees).
  const ARM = { sx: 116, sy: 114, upper: Math.hypot(7, 42), fore: Math.hypot(2, 42), upperDir: Math.atan2(42, 7) * 180 / Math.PI, foreDir: Math.atan2(42, 2) * 180 / Math.PI };

  /**
   * The [upper, forearm] raise that puts a tuxedo agent's hand at (x, y) in
   * figure coordinates (two-bone inverse kinematics). side = 1 is the
   * martini arm (stage right), -1 the free arm; elbow = 'out' bends the
   * elbow away from the body, 'in' across it, 'down' or 'up' below or above
   * the hand, 'low' out to the side and below the shoulder (so the elbow
   * stays clear of the body when the hand crosses it). Out of reach, the
   * arm points at the target. `foreshorten` (0.4–1) shortens the upper arm
   * as when it points towards the viewer, so the hand can come up to the
   * face or the bow tie with the elbow down in front of the chest, as a
   * person's does, rather than with the upper arm swung across the chest.
   * Returns [upper, forearm, foreshorten], the pose agent() expects.
   */
  function armReach([x, y], side = 1, elbow = 'out', foreshorten = 1) {
    const upperLength = ARM.upper * foreshorten;
    const tx = side > 0 ? x : 160 - x;
    const dx = tx - ARM.sx, dy = y - ARM.sy;
    const d = Math.min(upperLength + ARM.fore - 0.5, Math.max(Math.abs(upperLength - ARM.fore) + 0.5, Math.hypot(dx, dy)));
    const toTarget = Math.atan2(dy, dx);
    const bend = Math.acos((upperLength ** 2 + d ** 2 - ARM.fore ** 2) / (2 * upperLength * d));
    const elbows = [toTarget + bend, toTarget - bend].map((dir) => ({ dir, ex: ARM.sx + upperLength * Math.cos(dir), ey: ARM.sy + upperLength * Math.sin(dir) }));
    const prefer = { out: (e) => e.ex, in: (e) => -e.ex, down: (e) => e.ey, up: (e) => -e.ey, low: (e) => e.ex + (e.ey > ARM.sy ? 1000 : 0) }[elbow];
    elbows.sort((a, b) => prefer(b) - prefer(a));
    const { dir, ex, ey } = elbows[0];
    const reach = Math.min(1, d / Math.hypot(dx, dy));
    const foreDir = Math.atan2(ARM.sy + dy * reach - ey, ARM.sx + dx * reach - ex);
    const raise = (rest, rad) => ((rest - rad * 180 / Math.PI + 540) % 360) - 180;
    return [raise(ARM.upperDir, dir), raise(ARM.foreDir, foreDir), foreshorten];
  }

  /**
   * The [upper, forearm, foreshorten] pose that puts a tuxedo agent's elbow
   * at `elbow` and points his forearm at `hand` (figure coordinates; side -1
   * mirrors them for the free arm), for posing an arm as a person would
   * hold it. An elbow nearer the shoulder than the upper arm is long
   * foreshortens the upper arm: it points towards the viewer.
   */
  function armVia([ex, ey], [hx, hy], side = 1) {
    const local = (x) => (side > 0 ? x : 160 - x);
    const angle = (dx, dy) => Math.atan2(dy, dx) * 180 / Math.PI;
    const raise = (rest, at) => ((rest - at + 540) % 360) - 180;
    const foreshorten = Math.min(1, Math.hypot(local(ex) - ARM.sx, ey - ARM.sy) / ARM.upper);
    return [
      raise(ARM.upperDir, angle(local(ex) - ARM.sx, ey - ARM.sy)),
      raise(ARM.foreDir, angle(local(hx) - local(ex), hy - ey)),
      foreshorten,
    ];
  }

  /**
   * The wrist bend (degrees, in the arm's own frame) that turns the hand on
   * a forearm posed at `pose` to point at `angle` (SVG degrees: -90 is up).
   */
  function wristToward(pose, angle) {
    return ((angle - (ARM.foreDir - pose[1]) + 540) % 360) - 180;
  }

  /**
   * Whether a #rrggbb colour all but vanishes into the noir stage: a very
   * dark tone, under about 1.6:1 contrast against its near-black backdrop
   * (#0b1122 at its lightest), which is a relative luminance below 0.04.
   */
  function sinksIntoStage(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return false;
    const linear = (i) => {
      const channel = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(0) + 0.7152 * linear(1) + 0.0722 * linear(2) < 0.04;
  }

  /**
   * The raise equivalent to `to` (degrees) nearest `from`, so that easing
   * from one to the other takes the shorter way round: a glass raised from
   * his chest comes up across it, rather than swinging down and out first.
   */
  function nearTurn(from, to) {
    return to + 360 * Math.round((from - to) / 360);
  }

  // His stance at ease: the martini held up at his chest, the glass level,
  // and the free arm relaxed at his side, its elbow softly bent so the hand
  // hangs in by his thigh.
  const GLASS_HELD = armReach([105, 166]);
  const ARM_RELAXED = [6, 2, 1];
  // A watch check: the elbow stays at his side and the forearm comes up
  // level across his waist, the watch on top of the wrist in view.
  const WATCH_CHECK = armVia([40, 152], [80, 146], -1);
  // Shh: the elbow comes forward and down in front of his chest (the upper
  // arm foreshortened), the forearm rises to his face, and the wrist turns
  // the index finger upright across his lips.
  const SHH_HAND = armVia([64, 133], [81, 95], -1);
  const SHH_WRIST = wristToward(SHH_HAND, -90);
  // A bow-tie tug: the elbow forward and down by his side, the hand up to
  // the knot.
  const TIE_HAND = armVia([52, 140], [70, 102], -1);
  // Toasts, the martini rising from his chest. cheers: the elbow down at
  // his side, the forearm upright, the glass at face height beside his
  // head; high: the elbow raised out, the forearm up and in, the glass held
  // above his head. Either way the hand cocks at the wrist (see
  // tuxedoFigure), so the glass stands upright with its stem across the
  // curled fingers.
  const TOAST_POSES = {
    cheers: armVia([138, 150], [137, 108]),
    high: armVia([147, 85], [126, 48]),
  };

  /** The tuxedo agent standing at ease: every pose field agent() applies. */
  const AT_EASE = { martini: [0, 0], free: [0, 0], freeWrist: 0, finger: 0, middle: 0, crouch: 0, tie: 0, look: 0, down: 0, wink: 0, brow: 0, hush: 0, tilt: 0, nod: 0, sparkle: 0, glassTilt: 0 };
  /** The cameos' stance: the glass held at his chest, the free arm relaxed. */
  const STANCE = { ...AT_EASE, martini: GLASS_HELD, free: ARM_RELAXED };

  /**
   * Agent 00's signature moves for agent({ moves }), as pose keys [delay,
   * duration, fields] from the sung moment each is keyed to. tie tugs his
   * bow tie crooked and square again; lapel smooths his left lapel; shh
   * leans in and lays his index finger upright across pursed lips, one brow
   * raised, eyes darting left and right; button closes his jacket; watch
   * raises his wrist and looks down at his watch; glance looks towards his
   * free hand's side, then
   * back with a knowing nod; wink shuts his left eye and raises the other
   * brow, tilting his head towards the wink (and agent() flashes a glint off
   * his smile). Each returns the free arm (or the face) to rest.
   *
   * The arm sets off a little before the sung moment, unhurried (half a
   * second or more), so the hand arrives on the word; the eyes and head
   * follow the hand a beat behind rather than all at once.
   */
  const toRest = (at, duration = 0.58) => [at, duration, { free: ARM_RELAXED, freeWrist: 0 }];
  const MOVES = {
    tie: [[-0.12, 0.52, { free: TIE_HAND }], [0.02, 0.36, { down: 0.4 }], [0.32, 0.2, { tie: -10 }], [0.6, 0.3, { tie: 0, down: 0 }], toRest(0.92)],
    lapel: [[-0.06, 0.4, { free: armReach([61, 104], -1, 'out') }], [0.34, 0.52, { free: armReach([62, 140], -1, 'out') }], toRest(0.9)],
    shh: [
      [-0.14, 0.56, { free: SHH_HAND, freeWrist: SHH_WRIST, finger: 1 }], [0.02, 0.4, { hush: 1, nod: 0.5 }],
      [0.4, 0.26, { look: -1, brow: 1 }], [0.76, 0.3, { look: 1 }], [1.12, 0.24, { look: 0 }],
      [1.32, 0.34, { finger: 0, hush: 0, nod: 0, brow: 0 }], toRest(1.3),
    ],
    button: [[-0.08, 0.52, { free: armReach([76, 182], -1, 'out') }], [0.04, 0.36, { down: 0.5 }], [0.6, 0.34, { down: 0 }], toRest(0.95)],
    watch: [[-0.1, 0.54, { free: WATCH_CHECK }], [0.08, 0.4, { look: -0.6, down: 1, nod: 0.6 }], [0.82, 0.4, { look: 0, down: 0, nod: 0 }], toRest(0.84)],
    glance: [[0, 0.26, { look: -1, tilt: -2 }], [0.75, 0.28, { look: 0, tilt: 0 }], [0.84, 0.2, { nod: 1 }], [1.04, 0.3, { nod: 0 }]],
    wink: [[0, 0.12, { wink: 1 }], [0, 0.26, { tilt: 6, brow: 1 }], [0.45, 0.16, { wink: 0 }], [0.5, 0.38, { tilt: 0, brow: 0 }]],
  };
  // The fields the moves animate, at rest; everything else is left to the
  // toast and the caper's rig.
  const MOVES_AT_REST = { free: ARM_RELAXED, freeWrist: 0, finger: 0, tie: 0, look: 0, down: 0, wink: 0, brow: 0, hush: 0, tilt: 0, nod: 0 };

  /**
   * Draws the tuxedo agent into `sway` (160×300 figure space) and returns
   * { glass, pose, face, wear }. pose(p) places every joint from an
   * AT_EASE-shaped p:
   *   martini, free  [upper, forearm, foreshorten] raise in degrees (0
   *                  hangs, 180 is up), and how far the upper arm points
   *                  towards the viewer (1 not at all, 0.4 well forward)
   *   freeWrist      degrees the free hand bends at the wrist
   *   finger         0–1, the free hand's index finger pointing on (the
   *                  fingers left curled close into a tight fist)
   *   middle         0–1, its middle finger straightening beside it
   *   crouch         degrees the knees bend; the hips drop, feet stay put
   *   tie            bow-tie tilt in degrees
   *   tilt           head tilt in degrees, towards the winking eye
   *   nod            0–1, the head dipping in a nod
   *   sparkle        0–1 through a glint flaring off his smile
   *   glassTilt      extra degrees that keep the martini upright while the
   *                  whole figure turns (minus the figure's rotation)
   * face(time, p, reduced) sets the eyes from p.look (−1…1, a glance to
   * stage left…right in figure space), p.down (0–1, a look down), p.wink
   * (0–1 shuts his left eye), p.brow (0–1 raises the brow over the other),
   * and p.hush (0–1 purses his lips).
   * wear(head) swaps the drawn head and neck for an SE Gym hero's own
   * (SongStudentAvatar's heroHead), which also blinks on the song clock.
   * On a flipped figure the worn head stays unmirrored.
   */
  function tuxedoFigure(fig, sway, { flip = false } = {}) {
    // White dinner jacket, lit from the upper left: one gradient, fixed to
    // the figure, so the light reads continuously across body and sleeves.
    // A gradient in user space would turn and flip with each sleeve, so
    // every sleeve segment gets its own copy: mirrored for the free arm, and
    // counter-turned by poseArm each frame.
    const defs = svg('defs', {}, fig);
    const clothGradient = (side = 1) => {
      const id = `ih-agent-cloth-${++uid}`;
      const gradient = svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: side < 0 ? 120 : 40, y1: 92, x2: side < 0 ? 38 : 122, y2: 212 }, defs);
      for (const [index, offset] of ['0', '0.45', '0.8', '1'].entries()) svg('stop', { offset, class: `ih-agent-cloth-stop-${index}` }, gradient);
      return { gradient, url: `url(#${id})` };
    };
    const cloth = clothGradient().url;
    const mirror = (side) => (side < 0 ? 'translate(160 0) scale(-1 1)' : '');
    // Each hand's skin, lit from the upper left like the jacket: a radial
    // gradient that poseArm counter-turns as the forearm turns.
    const skinGradient = (side) => {
      const id = `ih-agent-skin-${++uid}`;
      const gradient = svg('radialGradient', { id, cx: side < 0 ? 0.62 : 0.38, cy: 0.3, r: 0.85 }, defs);
      for (const [index, offset] of ['0', '0.5', '1'].entries()) svg('stop', { offset, class: `ih-agent-skin-stop-${index}` }, gradient);
      return { gradient, url: `url(#${id})` };
    };
    // The tailoring's other gradients, each stop coloured by its class (CSS).
    // Without userSpaceOnUse a gradient spans its shape's own bounding box,
    // so on a turning sleeve it turns with the shape.
    const paint = (kind, name, attrs, offsets) => {
      const id = `ih-agent-${name}-${++uid}`;
      const gradient = svg(kind, { id, ...attrs }, defs);
      offsets.forEach((offset, index) => svg('stop', { offset, class: `ih-agent-${name}-stop-${index}` }, gradient));
      return `url(#${id})`;
    };
    const oxford = paint('linearGradient', 'oxford', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '0.5', '1']);
    // Shading strips along a sleeve's edge fade from the edge inwards.
    const edgeShade = { outer: paint('linearGradient', 'edge-shade', { x1: 1, y1: 0, x2: 0, y2: 0 }, ['0', '1']), inner: paint('linearGradient', 'edge-shade', { x1: 0, y1: 0, x2: 1, y2: 0 }, ['0', '1']) };

    // Legs: thick round-joined strokes (a white rim under the dark trouser),
    // so a bent knee stays whole, with a sheen down the side towards the
    // light, a pressed crease, and a soft break above the shoe. Built for the
    // stage-left leg; the other is its mirror. Hip (67, 200), knee 43 below,
    // ankle 43 below that.
    const legs = [1, -1].map((side) => {
      const g = svg('g', { transform: mirror(side) }, sway);
      const leg = {
        strokes: ['leg-rim', 'leg-cloth', 'leg-sheen', 'crease'].map((part) => svg('path', { class: `ih-agent-${part}` }, g)),
        braid: svg('path', { class: 'ih-agent-braid' }, g),
        // The braid's satin catches the light along one edge.
        braidSheen: svg('path', { class: 'ih-agent-braid-sheen', transform: `translate(${-0.8 * side} 0)` }, g),
      };
      // The sheen lies towards the light, whichever way the leg is mirrored.
      leg.strokes[2].setAttribute('transform', `translate(${-3.6 * side} 0)`);
      svg('path', { class: 'ih-agent-trouser-break', d: 'M58.4 282.4 Q66.5 285.4 74.8 282.2' }, g);
      leg.shoe = svg('g', {}, g);
      // Patent leather oxfords: a toe cap, the laces, a shine, and the sole.
      svg('path', { class: 'ih-agent-oxford', d: 'M-14.5 -1 H10.5 Q13.5 6 6.5 7 H-16.5 Q-18.5 3 -14.5 -1 Z', fill: oxford }, leg.shoe);
      svg('path', { class: 'ih-agent-shoe-seam', d: 'M-10.4 -0.6 Q-12.8 2.8 -11 6.4 M-15.4 5.2 H7.4' }, leg.shoe);
      svg('path', { class: 'ih-agent-shoe-lace', d: 'M-3.4 0.4 L2 0.7 M-3 1.9 L1.6 2.2' }, leg.shoe);
      svg('path', { class: 'ih-agent-shoe-shine', d: 'M-11.5 1.6 Q-5.5 0.6 0.5 1.6' }, leg.shoe);
      return leg;
    });
    // The upper body drops with the knees. Its layers, back to front: the
    // jacket and drawn head; the upper arms; the armhole lines; a worn
    // head's neck, collar and bow tie, and face; the forearms and hands.
    // Each upper arm is masked away inside its shoulder (the
    // "socket", the jacket inside the armhole), so the shoulder joint sits
    // inside the jacket and the sleeve emerges from the armhole at any
    // angle; below the armpit it hangs in front of the jacket. The forearms
    // stay in front, so a hand can reach the bow tie or the brow.
    const trunk = svg('g', {}, sway);
    const torso = svg('g', {}, trunk);
    const upperArms = svg('g', {}, trunk);
    const armholeLines = svg('g', {}, trunk);
    // A worn hero head (wear) drapes its hair over the shoulders and upper
    // arms, under the forearms. Its neck tucks under the collar and bow tie,
    // which move up between its layers; its face, hair, and beard fall over
    // them.
    const wornUnder = svg('g', { transform: mirror(flip ? -1 : 1) }, trunk);
    const wornCollar = svg('g', {}, trunk);
    const wornOver = svg('g', { transform: mirror(flip ? -1 : 1) }, trunk);
    const frontArms = svg('g', {}, trunk);
    const jacket = (className, d, parent = torso, fill = cloth) => svg('path', { class: className, d, fill }, parent);
    // The trousers' seat hides where the legs meet the jacket, and the
    // jacket's hem shades the trousers just under it.
    svg('path', { class: 'ih-agent-seat', d: 'M55.5 196 H104.5 V211 Q80 220 55.5 211 Z' }, torso);
    svg('path', { class: 'ih-agent-hem-shadow', d: 'M41.6 206.6 Q57 213.8 74 211.8 M86 211.8 Q103 213.8 118.4 206.6' }, torso);
    // A pleated black cummerbund shows where the jacket's fronts part.
    svg('path', { class: 'ih-agent-cummerbund', d: 'M60 176 L100 176 L101 200 L59 200 Z' }, torso);
    svg('path', { class: 'ih-agent-cummerbund-pleat', d: 'M68 184 H92 M67 191 H93' }, torso);
    // Jacket body: a shoulder line sloping down from the collar, sides that
    // come in from the armpit to a suppressed waist, and fronts that curve
    // away below the single button. Fill and shading first, outline on top.
    // The shoulder line ends at the shoulder point, tangent to the sleeve
    // head and half a line width outside its rim (where the sleeve's ink,
    // drawn outside its edge, is centred), so shoulder, sleeve head, and the
    // sleeve's outer edge run on as one smooth, even contour. From the
    // shoulder point the armhole (ARMHOLE) runs down the front of the sleeve
    // to the armpit, where the jacket's side begins. Jacket and sleeve read
    // as one surface there: no seam is drawn, the jacket's shading starts
    // below the armpit, and the sleeve's shading tapers in from the
    // shoulder. The armhole is inked only where it meets the background
    // (the shoulder line, and the armpit under a raised arm); the arm's
    // inner contour begins where it leaves the jacket, at the armpit.
    const JACKET = 'M66 92 Q52.5 99.2 40.03 106.53 C39 112 41.1 121 43.4 126.3 C47.4 148 45.6 174 40 204 Q57 211 74 209 Q79 196 80 180 Q81 196 86 209 Q103 211 120 204 C114.4 174 112.6 148 116.6 126.3 C118.9 121 121 112 119.97 106.53 Q107.5 99.2 94 92 L80 90 Z';
    const ARMHOLE = 'M116.6 126.3 C118.9 121 121 112 119.97 106.53 Q107.5 99.2 94 92';
    // The jacket's side outline starts a little below the armpit (so its
    // end stays under a hanging sleeve), and the armhole's ink runs down the
    // same curve to meet it, so where a raised arm bares both they join in
    // one round corner.
    const ARMHOLE_INK = `M115.75 131.59 C116 129.8 116.28 128.04 ${ARMHOLE.slice(1)}`;
    const SOCKET = `${ARMHOLE} L92 100 L100 124 C104 126 109 127.3 111.4 127.3 C113.3 127.3 115 127 116.6 126.3 Z`;
    jacket('ih-agent-tux-fill', JACKET);
    // The jacket's far side is shaded from the armpit down, in a crescent
    // that tapers to nothing at the armpit and fades in towards the side;
    // the near chest catches a soft light.
    svg('path', { class: 'ih-agent-tux-shading', d: 'M115.9 131 C112.8 150 114.4 174 120 204 Q109 208 97 209 Q103 168 115.9 131 Z', fill: paint('linearGradient', 'far-shade', { gradientUnits: 'userSpaceOnUse', x1: 101, y1: 0, x2: 119, y2: 0 }, ['0', '1']) }, torso);
    svg('ellipse', { class: 'ih-agent-chest-light', cx: 57, cy: 128, rx: 12.5, ry: 25, fill: paint('radialGradient', 'chest-light', {}, ['0', '1']) }, torso);
    svg('path', { class: 'ih-agent-tux-rim', d: 'M61 97 Q52 102.4 44.6 107.4 M45.4 134 C49 152 47.8 170 43.8 186' }, torso);
    svg('path', { class: 'ih-agent-tux-outline', d: 'M44.25 131.59 C47.09 152.19 45.15 176.4 40 204 Q57 211 74 209 Q79 196 80 180 Q81 196 86 209 Q103 211 120 204 C114.85 176.4 112.91 152.19 115.75 131.59 M66 92 L80 90 L94 92' }, torso);
    // Masks, per side, each holding a copy of the sleeve that poseArm turns
    // with it: the armhole's ink shows only where no sleeve lies against it
    // (cut on the sleeve's edge, so it runs into the sleeve's own ink). The
    // socket mask hides the sleeve inside the jacket; it lives in the
    // turning sleeve's frame, so poseArm turns it back. It is inset a hair,
    // so the sleeve overlaps the jacket's same-coloured cloth at the armhole
    // instead of meeting it edge to edge, where the two anti-aliased edges
    // would let a hairline of background through.
    // The upper arm with a round sleeve head on its pivot: hidden in the
    // jacket at rest except its outer curve (the shoulder point); raised, it
    // rounds the armpit.
    const UPPER_ARM = 'M108.4 115.3 A7.71 7.71 0 0 1 123.6 112.7 Q128 133 129.9 154.85 L116.1 157.15 Q113.8 135 108.4 115.3 Z';
    const maskOf = (parts, { inset = false } = {}) => {
      const id = `ih-agent-mask-${++uid}`;
      const mask = svg('mask', { id, maskUnits: 'userSpaceOnUse', x: -100, y: -100, width: 400, height: 500 }, defs);
      svg('rect', { class: 'ih-agent-mask-keep', x: -100, y: -100, width: 400, height: 500 }, mask);
      const turn = svg('g', {}, mask);
      const cut = svg('path', { class: 'ih-agent-mask-cut', d: parts }, turn);
      if (inset) svg('path', { class: 'ih-agent-mask-inset', d: parts }, turn);
      return { url: `url(#${id})`, turn, cut };
    };
    const armholes = {};
    for (const side of [1, -1]) {
      const open = maskOf(UPPER_ARM), socket = maskOf(SOCKET, { inset: true });
      const g = svg('g', { transform: mirror(side) }, armholeLines);
      svg('path', { class: 'ih-agent-tux-outline ih-agent-armhole', d: ARMHOLE_INK, mask: open.url }, g);
      armholes[side] = { sleeves: [open.turn], sleeveShape: open.cut, socket };
    }
    svg('path', { class: 'ih-agent-tux-fold', d: 'M78 177 Q69 171 60 170 M82 177 Q91 171 100 169' }, torso);
    // The fronts' darts, tailored in from the chest to the hip pockets.
    svg('path', { class: 'ih-agent-tux-dart', d: 'M55.6 141 Q57.4 160 55.8 178.6 M104.4 141 Q102.6 160 104.2 178.6' }, torso);
    // A welted breast pocket on his left, with a white silk pocket square
    // folded into three points, and flapped hip pockets, each with its
    // shadow under the welt or flap.
    svg('path', { class: 'ih-agent-pocket-square', d: 'M106 131.3 L106.9 127.6 L108.7 129.6 L110.5 126.2 L112.1 129.1 L113.8 127.5 L114.5 130.1 Z' }, torso);
    svg('path', { class: 'ih-agent-pocket-square-fold', d: 'M108.7 129.6 L109.1 131 M112.1 129.1 L112.4 130.6 M110.5 126.2 L110.9 130.8' }, torso);
    svg('path', { class: 'ih-agent-pocket', d: 'M105.4 131.4 L114.6 130' }, torso);
    svg('path', { class: 'ih-agent-pocket-light', d: 'M105.6 132.6 L114.6 131.2' }, torso);
    const POCKET_FLAP = 'M47.6 182.6 Q55 181.6 62.4 182 L62.6 186.4 Q55 187.6 48 186.8 Z';
    const POCKET_SHADOW = 'M48.4 187.8 Q55.2 188.8 62.2 187.6';
    for (const side of [1, -1]) {
      const g = svg('g', { transform: mirror(side) }, torso);
      svg('path', { class: 'ih-agent-pocket-shadow', d: POCKET_SHADOW }, g);
      jacket('ih-agent-pocket-flap', POCKET_FLAP, g);
    }
    // Pleated dress shirt with studs.
    svg('path', { class: 'ih-agent-shirt', d: 'M66 94 L80 91 L94 94 L84 160 L80 168 L76 160 Z' }, torso);
    svg('path', { class: 'ih-agent-pleat', d: 'M75 104 L78.6 158 M85 104 L81.4 158' }, torso);
    for (const sy of [118, 134, 150]) {
      svg('circle', { class: 'ih-agent-stud', cx: 80, cy: sy, r: 1.7 }, torso);
      svg('circle', { class: 'ih-agent-stud-glint', cx: 80.5, cy: sy - 0.5, r: 0.55 }, torso);
    }
    // Satin shawl lapels rolling down to the button, each with a sheen. The
    // bow tie and lapels cast soft shadows down and to the right, onto the
    // shirt and the jacket (the lapels hide what falls under themselves).
    const LAPELS = 'M64 92 C56 102 53 120 58 136 C63 152 72 166 80 177 L80 168 C76 150 71 120 69 96 Z M96 92 C104 102 107 120 102 136 C97 152 88 166 80 177 L80 168 C84 150 89 120 91 96 Z';
    svg('ellipse', { class: 'ih-agent-tie-shadow', cx: 81.5, cy: 107.5, rx: 13, ry: 2.4 }, torso);
    svg('path', { class: 'ih-agent-lapel-shadow', d: LAPELS, transform: 'translate(1 1.4)' }, torso);
    svg('path', { class: 'ih-agent-satin', d: LAPELS, fill: paint('linearGradient', 'satin', { x1: 0, y1: 0, x2: 1, y2: 1 }, ['0', '0.5', '1']) }, torso);
    svg('path', { class: 'ih-agent-satin-sheen', d: 'M61 101 C57.5 112 57.5 124 60.5 134 M99 101 C101.5 110 102 118 101 126' }, torso);
    svg('circle', { class: 'ih-agent-tux-button', cx: 80, cy: 180, r: 3 }, torso);
    svg('circle', { class: 'ih-agent-stud-glint', cx: 79.2, cy: 179.2, r: 0.8 }, torso);
    // A red carnation on the lapel: a ruffled, scalloped blossom with a
    // darker heart, its green calyx, a stem, and a leaf.
    const ruffle = (cx, cy, r, n, turn = 0) => Array.from({ length: n + 1 }, (_, k) => {
      const at = (k + turn) * 2 * Math.PI / n, mid = at - Math.PI / n;
      const point = `${(cx + 0.82 * r * Math.cos(at)).toFixed(2)} ${(cy + 0.82 * r * Math.sin(at)).toFixed(2)}`;
      return k === 0 ? `M${point}` : `Q${(cx + 1.12 * r * Math.cos(mid)).toFixed(2)} ${(cy + 1.12 * r * Math.sin(mid)).toFixed(2)} ${point}`;
    }).join(' ') + ' Z';
    svg('path', { class: 'ih-agent-stem', d: 'M97.9 116.4 L95.6 122' }, torso);
    svg('path', { class: 'ih-agent-leaf', d: 'M96.6 119.4 Q93.2 117.8 92.4 120.4 Q94.8 121.6 96.6 119.4 Z' }, torso);
    svg('path', { class: 'ih-agent-leaf-vein', d: 'M96.2 119.6 Q94.4 119.6 93 120.2' }, torso);
    svg('path', { class: 'ih-agent-calyx', d: 'M96.1 115.4 Q97.2 118.4 97.9 118.8 Q98.8 118.2 99.7 115.4 Z' }, torso);
    svg('path', { class: 'ih-agent-carnation', d: ruffle(97.9, 112.4, 3.9, 11), fill: paint('radialGradient', 'carnation', { cx: 0.4, cy: 0.35, r: 0.75 }, ['0', '0.6', '1']) }, torso);
    svg('path', { class: 'ih-agent-carnation-heart', d: ruffle(98.2, 112.8, 2.1, 7, 0.5) }, torso);
    svg('path', { class: 'ih-agent-carnation-light', d: 'M95.6 111.2 Q96.4 109.6 98 109.4' }, torso);
    // Neck, with the chin's shadow, wing collar, and a sculpted bow tie.
    const drawnNeck = svg('g', {}, torso);
    svg('rect', { class: 'ih-agent-neck', x: 72, y: 80, width: 16, height: 14 }, drawnNeck);
    svg('ellipse', { class: 'ih-agent-face-shade', cx: 80, cy: 85, rx: 8, ry: 3 }, drawnNeck);
    // The wing collar: starched wing tips, shaded on their inner halves, with
    // the crease where each tip folds over the band.
    const collar = svg('g', { class: 'ih-agent-wing-collar' }, torso);
    svg('path', { class: 'ih-agent-collar-wing', d: 'M66 94 L72 84 L78 98 Z M94 94 L88 84 L82 98 Z' }, collar);
    svg('path', { class: 'ih-agent-collar-shade', d: 'M72 84 L78 98 L74 95.4 Z M88 84 L82 98 L86 95.4 Z' }, collar);
    svg('path', { class: 'ih-agent-collar-crease', d: 'M68.4 92.5 L74.8 94.4 M91.6 92.5 L85.2 94.4' }, collar);
    const bowTie = svg('g', { 'data-testid': 'ih-agent-bow-tie' }, torso);
    const silk = paint('linearGradient', 'bowtie', { x1: 0, y1: 0, x2: 0.35, y2: 1 }, ['0', '1']);
    svg('path', { class: 'ih-agent-bowtie', d: 'M80 99 C74 94 68 91 64.5 92.5 C62.5 96.5 62.5 101.5 64.5 105.5 C68 107 74 104 80 99 Z M80 99 C86 94 92 91 95.5 92.5 C97.5 96.5 97.5 101.5 95.5 105.5 C92 107 86 104 80 99 Z', fill: silk }, bowTie);
    // Each wing gathers into soft pleats at the knot, and its upper edge
    // catches the light.
    svg('path', { class: 'ih-agent-bowtie-fold', d: 'M76.6 97.6 Q71.6 95.8 66.2 95.2 M76.6 100.4 Q71.6 102.2 66.2 102.8 M83.4 97.6 Q88.4 95.8 93.8 95.2 M83.4 100.4 Q88.4 102.2 93.8 102.8' }, bowTie);
    svg('path', { class: 'ih-agent-bowtie-sheen', d: 'M66.6 93.6 Q71.4 93 76 96.4 M93.4 93.6 Q88.6 93 84 96.4' }, bowTie);
    svg('rect', { class: 'ih-agent-bowtie', x: 76.5, y: 95.5, width: 7, height: 7, rx: 2, fill: silk }, bowTie);
    svg('path', { class: 'ih-agent-bowtie-knot-light', d: 'M78 97.2 Q80 96.4 82 97.2' }, bowTie);
    svg('path', { class: 'ih-agent-bowtie-knot-fold', d: 'M78.2 96.6 Q77.6 99 78.2 101.4 M81.8 96.6 Q82.4 99 81.8 101.4' }, bowTie);
    const drawnHead = svg('g', { 'data-testid': 'ih-agent-drawn-face' }, torso);
    svg('circle', { class: 'ih-agent-face', cx: 61, cy: 66, r: 4.5 }, drawnHead);
    svg('circle', { class: 'ih-agent-face', cx: 99, cy: 66, r: 4.5 }, drawnHead);
    svg('path', { class: 'ih-agent-ear', d: 'M61.4 63.6 Q59.2 65.6 61 68.6 M98.6 63.6 Q100.8 65.6 99 68.6' }, drawnHead);
    svg('ellipse', { class: 'ih-agent-face', cx: 80, cy: 64, rx: 19, ry: 22 }, drawnHead);
    svg('path', { class: 'ih-agent-nose', d: 'M81.4 64 Q78.6 69.4 80.6 70.6 Q82.6 71 83.4 70' }, drawnHead);
    svg('path', { class: 'ih-agent-hair', d: 'M60 60 Q57 38 76 35 Q97 33 101 52 Q100 58 99 61 Q96 47 84 46 Q73 45 66 51 Q62 55 60 60 Z' }, drawnHead);
    svg('path', { class: 'ih-agent-hair-sheen', d: 'M63.5 52 Q66.5 43 75 40' }, drawnHead);
    svg('path', { class: 'ih-agent-part', d: 'M68 44 Q78 39 92 40' }, drawnHead);
    const brows = ['M66 56 Q71 54 76 56', 'M84 53 Q89 49 94 52'].map((d) => svg('path', { class: 'ih-agent-brow', d }, drawnHead));
    const eyes = [71, 89].map((ex) => {
      const eye = svg('g', {}, drawnHead);
      svg('ellipse', { class: 'ih-agent-eye', cx: ex, cy: 62, rx: 2.2, ry: 2.6 }, eye);
      svg('circle', { class: 'ih-agent-catchlight', cx: ex + 0.8, cy: 61, r: 0.75 }, eye);
      return eye;
    });
    const mouth = svg('path', { class: 'ih-agent-mouth', d: 'M73 77 Q81 81 88 74' }, drawnHead);
    const pursed = svg('ellipse', { class: 'ih-agent-mouth', cx: 80.6, cy: 77.4, rx: 2.4, ry: 1.9, opacity: 0 }, drawnHead);
    // A glint off his smile as he winks: a four-point star beside the corner
    // of his mouth, on the winking side (wear moves it onto a worn face).
    const sparkle = svg('path', { class: 'ih-agent-sparkle', d: 'M0 -4.2 Q0.6 -0.6 4.2 0 Q0.6 0.6 0 4.2 Q-0.6 0.6 -4.2 0 Q-0.6 -0.6 0 -4.2 Z', display: 'none' }, drawnHead);

    // Arms. Each bends: the upper arm turns at the shoulder (116, 114), the
    // forearm at the elbow (123, 156); the free arm is the martini arm's
    // mirror. An arm's outline is drawn as one: every part's ink goes first,
    // at twice the line width (the upper arm, a round elbow, the forearm),
    // then the fills on top, so only the outer edge of the whole arm stays
    // inked. Any bend rounds the elbow and creases its inside cleanly, and
    // a straight arm shows no joint. The forearm's fill sits in the front
    // layer, so it still crosses the jacket with its outline. Each segment
    // has a shading strip down both sides; shadeArm shows the side turned
    // away from the light. The upper arm's strips taper to a point at both
    // ends, so they fade in from the shoulder and out before the elbow.
    const FOREARM_SIDES = ['M129.9 154.85 C131 170 131.5 181 131.5 190.6', 'M118.5 191.2 C118 181 117.6 170 116.1 157.15'];
    const FOREARM = `M116.1 157.15 L${FOREARM_SIDES[0].slice(1)} L${FOREARM_SIDES[1].slice(1)} Z`;
    const ELBOW = 'M116.1 156 A6.9 6.9 0 1 0 129.9 156 A6.9 6.9 0 1 0 116.1 156 Z';
    // A foreshortened upper arm (as when it points towards the viewer) has
    // its outline redrawn shorter along its own axis (upperArmPath), its
    // round head, the shoulder, unchanged; the elbow joint, the forearm, and
    // its ink move up the arm with it, the elbow staying round.
    const arm = (side) => {
      const upper = svg('g', {}, svg('g', { transform: mirror(side) }, upperArms));
      upper.setAttribute('mask', armholes[side].socket.url);
      const upperInk = svg('path', { class: 'ih-agent-limb-ink', d: UPPER_ARM }, upper);
      const elbowInk = svg('g', {}, upper);
      svg('path', { class: 'ih-agent-limb-ink', d: ELBOW }, elbowInk);
      const foreInk = svg('g', {}, upper);
      svg('path', { class: 'ih-agent-limb-ink', d: FOREARM }, foreInk);
      const upperCloth = clothGradient(side), elbowCloth = clothGradient(side), foreCloth = clothGradient(side);
      const elbowFill = svg('g', {}, upper);
      jacket('ih-agent-tux-fill', ELBOW, elbowFill, elbowCloth.url);
      const upperFill = jacket('ih-agent-tux-fill', UPPER_ARM, upper, upperCloth.url);
      // The outer strip fades in from the shoulder point, the inner one from
      // the armpit, where the arm's inner contour leaves the jacket. These
      // details simply scale with a foreshortened arm.
      const upperDetail = svg('g', {}, upper);
      const upperShade = [
        svg('path', { class: 'ih-agent-tux-shading', d: 'M123.6 112.7 Q127.34 129.96 129.27 148.34 Q119.45 131.24 123.6 112.7 Z', fill: edgeShade.outer }, upperDetail),
        svg('path', { class: 'ih-agent-tux-shading', d: 'M111.35 127.3 Q113.82 138.55 115.34 150.56 Q120.74 137.37 111.35 127.3 Z', fill: edgeShade.inner }, upperDetail),
      ];
      // A soft fold on each segment, near the elbow.
      svg('path', { class: 'ih-agent-tux-fold', d: 'M117.4 145.8 Q121.6 148.4 126.8 146.6' }, upperDetail);
      // The forearm turns with the upper arm, then at the elbow. The hand
      // goes in first, under the sleeve and the shirt cuff, so its wrist
      // stays tucked into the cuff however far it bends.
      const reach = svg('g', {}, svg('g', { transform: mirror(side) }, frontArms));
      const fore = svg('g', {}, reach);
      const grip = svg('g', {}, fore);
      jacket('ih-agent-tux-fill', FOREARM, fore, foreCloth.url);
      const foreShade = [
        svg('path', { class: 'ih-agent-tux-shading', d: 'M130.4 162 Q126.2 175 126.2 190.8 L131.5 190.6 C131.5 181 131.2 172 130.4 162 Z', fill: edgeShade.outer }, fore),
        svg('path', { class: 'ih-agent-tux-shading', d: 'M116.9 163 C117.8 172 118.2 181 118.5 191.2 L123.4 191 Q121.8 173 116.9 163 Z', fill: edgeShade.inner }, fore),
      ];
      svg('path', { class: 'ih-agent-tux-fold', d: 'M118.6 163.6 Q123 166.2 128.8 164.2' }, fore);
      // Two covered buttons on the sleeve; the hand (and a martini) go in
      // under the shirt cuff, which shows below the sleeve, shaded where the
      // sleeve overhangs it, and closed with a gold link.
      for (const by of [180.8, 184.2]) {
        svg('circle', { class: 'ih-agent-sleeve-button', cx: 129.3, cy: by, r: 0.85 }, fore);
        svg('circle', { class: 'ih-agent-sleeve-button-light', cx: 129.05, cy: by - 0.25, r: 0.28 }, fore);
      }
      svg('rect', { class: 'ih-agent-cuff', x: 118.2, y: 189.2, width: 13, height: 4.9, rx: 1.1 }, fore);
      svg('path', { class: 'ih-agent-cuff-shadow', d: 'M118.8 191.4 Q124.7 192.2 130.6 191.2' }, fore);
      svg('circle', { class: 'ih-agent-cufflink', cx: 124.7, cy: 192.3, r: 1.05, fill: paint('radialGradient', 'gold', { cx: 0.35, cy: 0.3, r: 0.8 }, ['0', '1']) }, fore);
      return { side, upper, upperOutline: [upperInk, upperFill], upperDetail, elbowParts: [elbowInk, elbowFill], reach, fore, foreInk, grip, upperShade, foreShade, upperCloth, elbowCloth, foreCloth, skin: skinGradient(side), armhole: armholes[side] };
    };
    const free = arm(-1);
    // Hands, seen from the back: four curled fingers below the knuckles and
    // the thumb wrapped over the index finger, each part shaded by the
    // hand's skin gradient, with creases between the fingers and light on
    // the knuckles. As on the arms, every part is inked at twice the line
    // width under all the fills, so the fist keeps one outline. The free
    // hand's index and middle fingers straighten (by FINGER_REACH) to point
    // or salute, while the others close into a tight fist.
    const FIST = 'M119.4 193.6 H130.6 Q132.1 193.6 132.2 195.6 L132.3 200.6 H117.9 L118 195.6 Q118.1 193.6 119.4 193.6 Z';
    const FINGERS = [[118.1, 121.7, 197.4, 204.6], [121.5, 125.1, 197.2, 205.2], [124.9, 128.5, 197.3, 204.8], [128.4, 131.9, 197.7, 203.8]];
    const FINGER_REACH = 7.6;
    const THUMB = 'M117.6 195.4 C117.2 193.1 119.6 192.4 120.6 194.3 L123.5 199.9 C124.4 201.8 122 203.2 120.9 201.4 Z';
    const fingerPath = ([x0, x1, y0, y1]) => {
      const r = (x1 - x0) / 2;
      return `M${x0} ${y0 + r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${(y1 - r).toFixed(2)} A${r} ${r} 0 0 1 ${x0} ${(y1 - r).toFixed(2)} Z`;
    };
    const hand = (a) => {
      const palm = svg('g', {}, a.grip);
      // A light edge behind the ink, shown only for very dark skin (CSS).
      const halo = svg('g', {}, palm);
      const ink = svg('g', {}, palm);
      const part = (d, attrs = {}) => [
        svg('path', { class: 'ih-agent-hand-halo', d }, halo),
        svg('path', { class: 'ih-agent-hand-ink', d }, ink),
        svg('path', { class: 'ih-agent-skin', d, fill: a.skin.url, ...attrs }, palm),
      ];
      part(FIST, { 'data-testid': 'ih-agent-hand' });
      const fingers = FINGERS.map((knuckle) => part(fingerPath(knuckle)));
      const creases = svg('path', { class: 'ih-agent-knuckle', d: 'M121.6 200 V203.8 M125 200.2 V204.4 M128.45 200.2 V203.4' }, palm);
      for (const [x0, x1, y0] of FINGERS) svg('ellipse', { class: 'ih-agent-knuckle-light', cx: (x0 + x1) / 2 - 0.3, cy: y0 + 1.4, rx: 0.75, ry: 0.5 }, palm);
      part(THUMB);
      svg('ellipse', { class: 'ih-agent-nail', cx: 122.4, cy: 200.4, rx: 0.8, ry: 1.15, transform: 'rotate(-30 122.4 200.4)' }, palm);
      return { palm, fingers, creases };
    };
    const martini = arm(1);
    // A martini, shaken: a conical glass held by its stem, its rim an
    // ellipse; gin up to just under the rim, with a cold meniscus, tinting
    // the olive (and its pimento) sunk on a pick; light down the near wall,
    // on the rim and the stem; and the foot below the hand. It turns at the
    // hand (125, 198) so it stays upright.
    const glass = svg('g', { class: 'ih-agent-glass' }, martini.grip);
    const crystal = paint('linearGradient', 'crystal', { x1: 0, y1: 0, x2: 1, y2: 0 }, ['0', '0.45', '1']);
    const BOWL = 'M115.4 176.6 L124.4 187.2 L125.6 187.2 L134.6 176.6 Z';
    svg('path', { class: 'ih-agent-glass-fill', d: 'M124.45 187 L124.7 207.4 L125.3 207.4 L125.55 187 Z', fill: crystal }, glass);
    svg('ellipse', { class: 'ih-agent-glass-fill', cx: 125, cy: 207.8, rx: 5.2, ry: 1, fill: crystal }, glass);
    svg('path', { class: 'ih-agent-glass-fill', d: BOWL, fill: crystal }, glass);
    svg('path', { class: 'ih-agent-pick', d: 'M118.4 172.4 L126 186' }, glass);
    svg('ellipse', { class: 'ih-agent-olive', cx: 123, cy: 181, rx: 2.15, ry: 1.85, transform: 'rotate(-30 123 181)', fill: paint('radialGradient', 'olive', { cx: 0.35, cy: 0.3, r: 0.8 }, ['0', '1']) }, glass);
    svg('circle', { class: 'ih-agent-pimento', cx: 123.9, cy: 180.4, r: 0.75 }, glass);
    svg('path', { class: 'ih-agent-gin', d: 'M116.93 178.4 L133.07 178.4 L125.5 186.8 L124.5 186.8 Z' }, glass);
    svg('ellipse', { class: 'ih-agent-gin-surface', cx: 125, cy: 178.4, rx: 8.07, ry: 0.75 }, glass);
    svg('path', { class: 'ih-agent-pick ih-agent-pick--dry', d: 'M118.4 172.4 L119.7 174.8' }, glass);
    svg('circle', { class: 'ih-agent-pick-end', cx: 118.4, cy: 172.4, r: 0.7 }, glass);
    svg('path', { class: 'ih-agent-glass-line', d: `${BOWL} M124.45 187 L124.7 207 M125.55 187 L125.3 207` }, glass);
    svg('ellipse', { class: 'ih-agent-glass-line', cx: 125, cy: 207.8, rx: 5.2, ry: 1 }, glass);
    svg('ellipse', { class: 'ih-agent-glass-rim', cx: 125, cy: 176.6, rx: 9.6, ry: 0.95 }, glass);
    svg('path', { class: 'ih-agent-glass-light', d: 'M117.4 177.9 L122.5 184.1 M124.8 189 V205.2 M121.6 207.2 Q123.2 206.8 124.4 206.9' }, glass);
    svg('circle', { class: 'ih-agent-glass-spark', cx: 117.9, cy: 176.85, r: 0.42 }, glass);
    // His watch: a steel diver on the free wrist, worn over the edge of the
    // cuff. A link bracelet round the wrist; the case with its crown; a navy
    // bezel with minute marks and a lume pip; a sunburst dial with hour
    // markers; hands at ten past ten and a seconds hand; and glare on the
    // crystal. 12 o'clock points up the arm.
    const watch = svg('g', { class: 'ih-agent-watch', 'data-testid': 'ih-agent-watch' }, free.fore);
    const steel = paint('linearGradient', 'steel', { x1: 0, y1: 0, x2: 0, y2: 1 }, ['0', '0.5', '1']);
    const [wx, wy] = [125, 194];
    const dialAt = (r, clock) => [wx + r * Math.sin(clock * Math.PI / 6), wy - r * Math.cos(clock * Math.PI / 6)];
    svg('rect', { class: 'ih-agent-bracelet', x: 118.4, y: 192.5, width: 13.2, height: 3, rx: 0.9, fill: steel }, watch);
    svg('path', { class: 'ih-agent-bracelet-links', d: 'M120.3 192.6 V195.4 M122 192.6 V195.4 M128 192.6 V195.4 M129.7 192.6 V195.4' }, watch);
    svg('rect', { class: 'ih-agent-watch-crown', x: 128.4, y: 193.35, width: 1.5, height: 1.3, rx: 0.35, fill: steel }, watch);
    svg('circle', { class: 'ih-agent-watch-case', cx: wx, cy: wy, r: 3.7, fill: paint('radialGradient', 'watch-case', { cx: 0.35, cy: 0.3, r: 0.85 }, ['0', '1']) }, watch);
    svg('circle', { class: 'ih-agent-watch-bezel', cx: wx, cy: wy, r: 3.15 }, watch);
    svg('path', {
      class: 'ih-agent-watch-marks',
      d: Array.from({ length: 12 }, (_, k) => k % 3 ? `M${dialAt(2.68, k).map((v) => v.toFixed(2)).join(' ')} L${dialAt(3.02, k).map((v) => v.toFixed(2)).join(' ')}` : '').join(' '),
    }, watch);
    svg('circle', { class: 'ih-agent-watch-pip', cx: wx, cy: wy - 2.85, r: 0.34 }, watch);
    svg('circle', { class: 'ih-agent-watch-dial', cx: wx, cy: wy, r: 2.45, fill: paint('radialGradient', 'watch-dial', { cx: 0.5, cy: 0.5, r: 0.5 }, ['0', '1']) }, watch);
    for (let k = 0; k < 12; k += 1) {
      const [x, y] = dialAt(1.95, k);
      svg('circle', { class: 'ih-agent-watch-index', cx: x.toFixed(2), cy: y.toFixed(2), r: k % 3 ? 0.15 : 0.24 }, watch);
    }
    const pointer = (clock, length) => `M${wx} ${wy} L${dialAt(length, clock).map((v) => v.toFixed(2)).join(' ')}`;
    svg('path', { class: 'ih-agent-watch-hour', d: pointer(10, 1.3) }, watch);
    svg('path', { class: 'ih-agent-watch-minute', d: pointer(2, 1.95) }, watch);
    svg('path', { class: 'ih-agent-watch-second', d: pointer(6.4, 2.05) }, watch);
    svg('circle', { class: 'ih-agent-watch-cap', cx: wx, cy: wy, r: 0.3 }, watch);
    svg('path', { class: 'ih-agent-watch-glare', d: `M${dialAt(2.05, 8.3).map((v) => v.toFixed(2)).join(' ')} A2.05 2.05 0 0 1 ${dialAt(2.05, 11.2).map((v) => v.toFixed(2)).join(' ')}` }, watch);
    svg('circle', { class: 'ih-agent-watch-glint', cx: 123.7, cy: 192.7, r: 0.5 }, watch);
    const hands = [hand(free), hand(martini)];

    const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
    // The upper arm's axis, shoulder to elbow (a unit vector), and its lean
    // from vertical.
    const AXIS = [7 / Math.hypot(7, 42), 42 / Math.hypot(7, 42)];
    const AXIS_LEAN = Math.atan2(7, 42) * 180 / Math.PI;
    const alongArm = (k) => `translate(${ARM.sx} ${ARM.sy}) rotate(${(-AXIS_LEAN).toFixed(3)}) scale(1 ${k.toFixed(3)}) rotate(${AXIS_LEAN.toFixed(3)}) translate(${-ARM.sx} ${-ARM.sy})`;
    // The upper arm's outline foreshortened by k: points move towards the
    // shoulder along the arm's axis, while the round head (at the shoulder's
    // level) keeps its shape.
    const upperArmPath = (k) => {
      const at = ([x, y]) => {
        const along = (x - ARM.sx) * AXIS[0] + (y - ARM.sy) * AXIS[1];
        return pt(x + (k - 1) * along * AXIS[0], y + (k - 1) * along * AXIS[1]);
      };
      return `M108.4 115.3 A7.71 7.71 0 0 1 123.6 112.7 Q${at([128, 133])} ${at([129.9, 154.85])} L${at([116.1, 157.15])} Q${at([113.8, 135])} 108.4 115.3 Z`;
    };
    const poseArm = (a, [up, fo, k = 1]) => {
      const shoulder = `rotate(${(-up).toFixed(1)} ${ARM.sx} ${ARM.sy})`;
      // Foreshortened, the elbow moves up the arm by `shift`.
      const shift = `translate(${(7 * (k - 1)).toFixed(2)} ${(42 * (k - 1)).toFixed(2)})`;
      const unshift = `translate(${(7 * (1 - k)).toFixed(2)} ${(42 * (1 - k)).toFixed(2)})`;
      a.upper.setAttribute('transform', shoulder);
      const outline = upperArmPath(k);
      for (const path of a.upperOutline) path.setAttribute('d', outline);
      a.armhole.sleeveShape.setAttribute('d', outline);
      a.upperDetail.setAttribute('transform', alongArm(k));
      for (const part of a.elbowParts) part.setAttribute('transform', shift);
      a.reach.setAttribute('transform', `${shoulder} ${shift}`);
      for (const sleeve of a.armhole.sleeves) sleeve.setAttribute('transform', shoulder);
      // Coming forward (foreshortened, or swung in across the body), the arm
      // is in front of the jacket: the socket that hides its root inside the
      // shoulder shrinks away to its pivot, so the whole sleeve shows, its
      // round head the shoulder, and the arm never seems to grow out of the
      // chest.
      const forward = Math.min(1, Math.max(0, (1 - k) / 0.25, (-up - 6) / 24));
      const keep = Math.max(0.001, 1 - forward);
      a.armhole.socket.turn.setAttribute('transform', `rotate(${up.toFixed(1)} ${ARM.sx} ${ARM.sy}) translate(${ARM.sx} ${ARM.sy}) scale(${keep.toFixed(3)}) translate(${-ARM.sx} ${-ARM.sy})`);
      const elbow = `rotate(${(up - fo).toFixed(1)} 123 156)`;
      a.fore.setAttribute('transform', elbow);
      a.foreInk.setAttribute('transform', `${shift} ${elbow}`);
      // The sleeves' cloth stays put while they turn (and foreshorten).
      const unturn = `rotate(${up.toFixed(1)} ${ARM.sx} ${ARM.sy})`;
      a.upperCloth.gradient.setAttribute('gradientTransform', unturn);
      a.elbowCloth.gradient.setAttribute('gradientTransform', `${unshift} ${unturn}`);
      a.foreCloth.gradient.setAttribute('gradientTransform', `rotate(${(fo - up).toFixed(1)} 123 156) ${unshift} ${unturn}`);
      shadeArm(a.upperShade, up, a.side);
      shadeArm(a.foreShade, fo, a.side);
    };
    // A wrist bends `bend` degrees about the middle of the shirt cuff; the
    // hand's skin light turns back by as much as the hand turns.
    const WRIST = [124.7, 191.65];
    const bendWrist = (a, bend, fo) => {
      a.grip.setAttribute('transform', `rotate(${bend.toFixed(1)} ${WRIST[0]} ${WRIST[1]})`);
      a.skin.gradient.setAttribute('gradientTransform', `rotate(${(fo - bend).toFixed(1)} .5 .5)`);
    };
    // The martini hand cocks so its curled fingers point in towards his
    // chest (LEVEL, SVG degrees in his own frame, a little below level): the
    // glass then stands upright with its stem across the fingers, whatever
    // the forearm does, as a person holds a glass up. The cock follows the
    // forearm exactly up to 56 degrees, eases to its limit of 76, and only
    // eases back to straight as the forearm turns to point outward, so it
    // never jumps, even while he tumbles.
    const LEVEL = 168;
    const cockFor = (forearmAt) => {
      const d = ((LEVEL - forearmAt + 540) % 360) - 180, a = Math.abs(d), sign = Math.sign(d);
      if (a <= 56) return d;
      if (a <= 110) return sign * (56 + 20 * Math.sin((a - 56) / 54 * Math.PI / 2));
      return sign * 76 * (180 - a) / 70;
    };
    function pose(p) {
      // A knee bend seen from the front: thighs and shins tilt towards the
      // viewer by `crouch` degrees, so they foreshorten and the hips drop;
      // the knees part only a little, the feet stay put.
      const bend = p.crouch * Math.PI / 180;
      const drop = 86 * (1 - Math.cos(bend));
      const a = 0.32 * bend;
      const hipY = 200 + drop, kneeX = 67 - 43 * Math.sin(a), kneeY = hipY + 43 * Math.cos(bend);
      // The satin braid runs down the outer side, mitred at the knee.
      const braid = 8.5, miter = braid / Math.max(0.3, Math.cos(a));
      for (const leg of legs) {
        for (const stroke of leg.strokes) stroke.setAttribute('d', `M67 ${(hipY - 8).toFixed(1)} L${pt(67, hipY)} L${pt(kneeX, kneeY)} L67 286`);
        const braidPath = `M${pt(67 - braid * Math.cos(a), hipY - braid * Math.sin(a))} L${pt(kneeX - miter, kneeY)} L${pt(67 - braid * Math.cos(a), 285 + braid * Math.sin(a))}`;
        leg.braid.setAttribute('d', braidPath);
        leg.braidSheen.setAttribute('d', braidPath);
        leg.shoe.setAttribute('transform', 'translate(66.5 286)');
      }
      trunk.setAttribute('transform', `translate(0 ${drop.toFixed(1)})`);
      poseArm(free, p.free);
      poseArm(martini, p.martini);
      const cock = cockFor(ARM.foreDir - p.martini[1]);
      bendWrist(martini, cock, p.martini[1]);
      bendWrist(free, p.freeWrist, p.free[1]);
      const reach = [p.finger, p.middle, 0, 0];
      FINGERS.forEach(([x0, x1, y0, y1], i) => {
        // A finger curled tight shows little more than its knuckle.
        const curl = i === 0 ? 0 : p.finger * (1 - reach[i]);
        const d = fingerPath([x0, x1, y0, y1 + FINGER_REACH * reach[i] - (y1 - y0 - (x1 - x0) - 0.6) * curl]);
        for (const path of hands[0].fingers[i]) path.setAttribute('d', d);
      });
      hands[0].creases.setAttribute('opacity', (1 - p.finger).toFixed(2));
      glass.setAttribute('transform', `rotate(${(p.martini[1] + p.glassTilt - cock).toFixed(1)} 125 198)`);
      bowTie.setAttribute('transform', `rotate(${p.tie.toFixed(1)} 80 99)`);
      // The head tilts about the chin, and dips in a nod. A worn head is
      // never mirrored, so its layers tilt in picture space, towards its
      // wink on the picture's right.
      const tilt = `translate(0 ${(1.6 * p.nod).toFixed(2)}) rotate(${p.tilt.toFixed(2)} 80 84.5)`;
      drawnHead.setAttribute('transform', tilt);
      for (const layer of [wornUnder, wornOver]) layer.setAttribute('transform', `${mirror(flip ? -1 : 1)} ${tilt}`);
      // The glint grows and shrinks as it turns a quarter turn.
      if (p.sparkle > 0 && p.sparkle < 1) {
        sparkle.removeAttribute('display');
        sparkle.setAttribute('transform', `translate(91.2 73.2) rotate(${(90 * p.sparkle).toFixed(1)}) scale(${Math.sin(Math.PI * p.sparkle).toFixed(3)})`);
      } else sparkle.setAttribute('display', 'none');
    }
    let worn;
    function face(time, p, reduced) {
      // The worn head is never mirrored, so a glance in figure space turns
      // around on a flipped figure.
      if (worn) {
        worn(time, { look: flip ? -p.look : p.look, down: p.down, wink: p.wink, brow: p.brow, hush: p.hush }, reduced);
        return;
      }
      mouth.setAttribute('opacity', (1 - p.hush).toFixed(2));
      pursed.setAttribute('opacity', p.hush.toFixed(2));
      brows[0].setAttribute('transform', `translate(0 ${(-2.4 * p.brow).toFixed(2)})`);
      brows[1].setAttribute('transform', `translate(0 ${(0.8 * p.wink).toFixed(2)})`);
      eyes.forEach((eye, i) => {
        const shut = i === 1 ? 1 - 0.85 * p.wink : 1;
        eye.setAttribute('transform', `translate(${(1.6 * p.look).toFixed(2)} ${(1.3 * p.down).toFixed(2)}) translate(${71 + 18 * i} 62) scale(1 ${shut.toFixed(3)}) translate(${-71 - 18 * i} -62)`);
      });
    }
    function wear(head) {
      // The hero's face sits where the drawn one was, its chin just above
      // the wing collar's tips; the hands take the hero's skin tones (CSS).
      worn = head.wear({ underCollar: wornUnder, overCollar: wornOver }, { x: 80, chin: 84.5, width: 38 });
      wornCollar.append(collar, bowTie);
      wornOver.append(sparkle);
      // The forearms cross the worn hair and face: their sides are inked
      // again in front, open at the elbow so the joint stays seamless.
      for (const { fore } of [free, martini]) fore.prepend(svg('path', { class: 'ih-agent-limb-ink', d: FOREARM_SIDES.join(' ') }));
      for (const [name, value] of head.tokens) fig.style.setProperty(name, value);
      fig.classList.add('ih-agent-art--hero');
      drawnNeck.setAttribute('display', 'none');
      drawnHead.setAttribute('display', 'none');
      // A very thin bright halo keeps very dark skin or hair readable on the
      // dark stage: around the worn head, and the hands when the skin is.
      // It is artwork, not an SVG filter: Safari redraws filtered artwork
      // that moves every frame inconsistently, so a filter halo flickered.
      // Behind the head goes a second copy of it as a light silhouette, its
      // outline grown by a hairline (CSS); the hands show their light edge.
      const tone = (name) => head.tokens.find(([token]) => token === name)?.[1];
      const darkSkin = sinksIntoStage(tone('--hero-skin-light'));
      if (darkSkin || sinksIntoStage(tone('--hero-hair'))) {
        const halos = [wornUnder, wornOver].map((layer) => {
          const halo = svg('g', { class: 'ih-agent-worn-halo', 'data-testid': 'ih-agent-worn-halo' });
          layer.prepend(halo);
          return halo;
        });
        head.wear({ underCollar: halos[0], overCollar: halos[1] }, { x: 80, chin: 84.5, width: 38 });
        // The silhouette is no face of its own.
        for (const halo of halos) halo.querySelectorAll('[data-testid]').forEach((node) => node.removeAttribute('data-testid'));
        if (darkSkin) fig.classList.add('ih-agent-art--dark-skin');
      }
    }
    pose(AT_EASE);
    return { glass, pose, face, wear };
  }

  /**
   * A secret agent with a name tag. look = 'trench' (fedora, trench coat,
   * sunglasses, briefcase) or 'tuxedo' (white dinner jacket, bow tie, slicked
   * hair, raised eyebrow, martini): the suave-spy-film look. With `code`,
   * role and code show as one name in the red split-flap cells of `digits`.
   * From `toastAt`, the tuxedo agent raises his martini into `toastPose`
   * (a key of TOAST_POSES). `rig(t)` may return AT_EASE fields to pose the
   * tuxedo agent at song time t; a martini it leaves out follows the toast.
   * `hero` (a promise of SongStudentAvatar's heroHead) gives the tuxedo
   * agent the viewer's saved human or Prof SE Gym face, or the Gym's
   * default face; when it resolves to null (no renderer), he keeps his
   * drawn face. `moves` = [[time, name]] plays MOVES at
   * those song times. He arrives with `entrance` 'rise', or glides in from
   * the 'left' or 'right' and settles. `toastHold` seconds after a toast,
   * he brings the glass down to his chest. With reduced motion he simply
   * fades in and out.
   */
  function agent(parent, { x, y, scale = 1, name, role, code, at, until, toastAt, toastPose = 'high', toastHold, rig, moves, hero, entrance = 'rise', tie = 'red', briefcase = true, flip = false, look = 'trench' }) {
    const wrap = place(el('div', 'ih-agent is-staged', parent), x, y);
    wrap.dataset.testid = 'ih-agent';
    wrap.style.width = `${160 * scale}px`;
    const fig = svg('svg', { class: `ih-agent-art ih-agent-art--${tie}`, viewBox: '0 0 160 300', width: 160 * scale, height: 300 * scale, 'aria-hidden': 'true' }, wrap);
    // Entrances and exits move this group, in stage directions.
    const travel = svg('g', {}, fig);
    const body = svg('g', { transform: flip ? 'translate(160 0) scale(-1 1)' : '' }, travel);
    // The floor shadow, with darker contact shadows under the tuxedo's shoes.
    const shadow = svg('g', { class: 'ih-agent-shadow' }, body);
    svg('ellipse', { cx: 80, cy: 292, rx: 60, ry: 7 }, shadow);
    if (look === 'tuxedo') for (const cx of [66.5, 93.5]) svg('ellipse', { class: 'ih-agent-contact', cx, cy: 292.6, rx: 12.5, ry: 2 }, shadow);
    const sway = svg('g', {}, body);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let glint, figure;
    if (look === 'tuxedo') {
      figure = tuxedoFigure(fig, sway, { flip });
      glint = svg('line', { class: 'ih-agent-glint ih-agent-glint--glass', x1: 0, y1: 0, x2: 2.2, y2: -3.8, opacity: 0 }, figure.glass);
      hero?.then((head) => {
        if (head && wrap.isConnected) figure.wear(head);
      }).catch(() => {
        // The saved face is optional; the drawn agent remains.
      });
    }
    if (look !== 'tuxedo') {
    svg('path', { class: 'ih-agent-leg', d: 'M58 262 L60 288 L74 288 L76 262 Z M86 262 L88 288 L102 288 L102 262 Z' }, sway);
    svg('path', { class: 'ih-agent-shoe', d: 'M54 286 H76 Q78 292 72 293 H52 Q50 289 54 286 Z M86 286 H108 Q112 289 110 293 H90 Q84 292 86 286 Z' }, sway);
    svg('path', { class: 'ih-agent-coat', d: 'M44 110 Q52 92 80 90 Q108 92 116 110 L134 266 Q80 278 26 266 Z' }, sway);
    svg('path', { class: 'ih-agent-coat-light', d: 'M80 90 Q108 92 116 110 L134 266 Q110 271 92 272 L88 128 Z' }, sway);
    svg('path', { class: 'ih-agent-lapel', d: 'M64 94 L80 140 L56 112 Z M96 94 L80 140 L104 112 Z' }, sway);
    svg('path', { class: 'ih-agent-shirt', d: 'M70 92 L80 122 L90 92 Z' }, sway);
    svg('path', { class: `ih-agent-tie ih-agent-tie--${tie}`, d: 'M78 98 L82 98 L84 120 L80 128 L76 120 Z' }, sway);
    svg('rect', { class: 'ih-agent-belt', x: 32, y: 182, width: 96, height: 12, rx: 3 }, sway);
    svg('rect', { class: 'ih-agent-buckle', x: 72, y: 180, width: 16, height: 16, rx: 2 }, sway);
    for (const by of [150, 170, 210, 230]) {
      svg('circle', { class: 'ih-agent-button', cx: 68, cy: by, r: 2.6 }, sway);
      svg('circle', { class: 'ih-agent-button', cx: 92, cy: by, r: 2.6 }, sway);
    }
    svg('path', { class: 'ih-agent-coat', d: 'M44 112 Q30 150 30 214 L44 216 Q46 160 56 128 Z' }, sway);
    svg('path', { class: 'ih-agent-coat-light', d: 'M116 112 Q130 150 132 210 L118 214 Q114 160 104 128 Z' }, sway);
    svg('circle', { class: 'ih-agent-hand', cx: 37, cy: 220, r: 7 }, sway);
    svg('circle', { class: 'ih-agent-hand', cx: 125, cy: 216, r: 7 }, sway);
    if (briefcase) {
      svg('path', { class: 'ih-agent-case-handle', d: 'M116 222 Q125 210 134 222' }, sway);
      svg('rect', { class: 'ih-agent-case', x: 104, y: 222, width: 48, height: 34, rx: 4 }, sway);
      svg('rect', { class: 'ih-agent-case-lock', x: 124, y: 228, width: 8, height: 6, rx: 1 }, sway);
    }
    svg('rect', { class: 'ih-agent-neck', x: 72, y: 80, width: 16, height: 14 }, sway);
    svg('path', { class: 'ih-agent-collar', d: 'M56 96 L70 84 L76 104 Z M104 96 L90 84 L84 104 Z' }, sway);
    svg('ellipse', { class: 'ih-agent-face', cx: 80, cy: 64, rx: 19, ry: 22 }, sway);
    svg('path', { class: 'ih-agent-face-shade', d: 'M61 58 Q80 64 99 58 L99 52 L61 52 Z' }, sway);
    svg('path', { class: 'ih-agent-mouth', d: 'M73 78 Q80 81 87 77' }, sway);
    const glasses = svg('g', {}, sway);
    svg('rect', { class: 'ih-agent-lens', x: 63, y: 58, width: 15, height: 9, rx: 3 }, glasses);
    svg('rect', { class: 'ih-agent-lens', x: 82, y: 58, width: 15, height: 9, rx: 3 }, glasses);
    svg('line', { class: 'ih-agent-bridge', x1: 78, y1: 61, x2: 82, y2: 61 }, glasses);
    glint = svg('line', { class: 'ih-agent-glint', x1: 0, y1: 0, x2: 4, y2: -7, opacity: 0 }, glasses);
    svg('ellipse', { class: 'ih-agent-brim', cx: 80, cy: 50, rx: 40, ry: 8 }, sway);
    svg('path', { class: 'ih-agent-hat', d: 'M56 49 Q56 22 80 20 Q104 22 104 49 Q92 44 80 44 Q68 44 56 49 Z' }, sway);
    svg('path', { class: 'ih-agent-dent', d: 'M70 24 Q80 32 90 24' }, sway);
    svg('path', { class: `ih-agent-band ih-agent-band--${tie}`, d: 'M56 42 Q80 37 104 42 L104 48 Q80 43 56 48 Z' }, sway);
    }
    if (name || role) {
      const tag = el('div', 'ih-agent-tag', wrap);
      if (code) {
        // The whole name, role and code, in one row of split-flap cells.
        const row = el('span', 'ih-agent-code', tag);
        for (const ch of `${role ?? ''} ${code}`.trim()) {
          el('span', ch === ' ' ? 'ih-agent-code-gap' : 'ih-digit ih-digit--bad', row, ch);
        }
      } else if (role) {
        el('span', 'ih-agent-role', tag, role);
      }
      if (name) el('span', 'ih-agent-name', tag, name);
    }
    const moveTrack = moves && poseTrack([[-Infinity, 0, MOVES_AT_REST], ...moves
      .flatMap(([when, move]) => MOVES[move].map(([delay, duration, fields]) => [when + delay, duration, fields]))
      .sort((a, b) => a[0] - b[0])], { turns: true });
    // Just after each wink, a glint flares off his smile.
    const smiles = (moves ?? []).filter(([, move]) => move === 'wink').map(([when]) => ({ at: when + 0.1 }));
    const side = entrance === 'left' ? -1 : 1;
    const GLIDE = 0.95;
    onFrame((t) => {
      const local = t - at;
      const reduced = reducedMotion.matches;
      // At ease: a slow, uneven shift of weight and a breath.
      const shift = reduced ? 0 : 0.6 * Math.sin(local * 0.9) + 0.3 * Math.sin(local * 2.1 + 0.7);
      const breath = reduced ? 1 : 1 + 0.004 * Math.sin(local * 1.6);
      sway.setAttribute('transform', `rotate(${shift.toFixed(2)} 80 290) translate(80 290) scale(1 ${breath.toFixed(4)}) translate(-80 -290)`);
      // He glides in leaning into the move, sways past upright, and settles
      // with a give of the knees.
      let glide = 0, lean = 0, settle = 0;
      if (!reduced && entrance !== 'rise' && local < GLIDE) {
        const u = progress(t, at, GLIDE);
        glide = side * 70 * (1 - u) ** 3;
        lean = -side * 8 * Math.exp(-3.5 * u) * Math.cos(2.6 * Math.PI * u);
        settle = 5 * Math.sin(Math.PI * progress(t, at + 0.5, 0.42));
      }
      travel.setAttribute('transform', `translate(${glide.toFixed(2)} 0) rotate(${lean.toFixed(2)} 80 290)`);
      const cycle = (local % 3.4) / 3.4;
      const on = cycle < 0.18 && local > 0.4;
      glint.setAttribute('opacity', on ? (Math.sin((cycle / 0.18) * Math.PI) * 0.9).toFixed(2) : '0');
      // The glint crosses the sunglasses, or the rim of the martini glass.
      const [gx0, gspan, gy] = look === 'tuxedo' ? [116.4, 17, 177.4] : [64, 32, 66];
      const gx = gx0 + gspan * (cycle / 0.18);
      glint.setAttribute('transform', `translate(${gx.toFixed(1)} ${gy})`);
      if (!figure) return;
      let pose = AT_EASE;
      if (toastAt !== undefined || rig || moveTrack || entrance !== 'rise') {
        // He stands at ease, the glass held at his chest (STANCE); the
        // caper's rig poses his limbs itself until he reaches his post.
        let martini = STANCE.martini, crouch = settle;
        if (toastAt !== undefined) {
          // The glass rises from his chest: the upper arm swings up and the
          // elbow follows a beat later, the forearm taking the shorter way
          // round, up across his chest. It sets off just before the word,
          // eases out of rest, lifts a touch past the pose and settles, so it
          // is up on the word. A small knee dip lends the raise its weight.
          // After `toastHold` seconds the glass comes back down the same way
          // to his chest.
          const toast = TOAST_POSES[toastPose];
          const raised = [toast[0], nearTurn(GLASS_HELD[1], toast[1]), toast[2]];
          const swing = (delay) => (reduced ? Number(t >= toastAt) : softBack(progress(t, toastAt - 0.12 + delay, 0.55)));
          martini = GLASS_HELD.map((held, i) => held + (raised[i] - held) * swing(0.08 * i));
          if (toastHold !== undefined) {
            const lower = reduced ? Number(t >= toastAt + toastHold) : easeInOutCubic(progress(t, toastAt + toastHold, 0.6));
            martini = martini.map((raise, i) => raise + (GLASS_HELD[i] - raise) * lower);
          }
          if (!reduced) crouch += 6 * Math.sin(Math.PI * progress(t, toastAt - 0.18, 0.42));
        }
        const smile = latest(smiles, t);
        const sparkle = smile && !reduced ? progress(t, smile.at, 0.45) : 0;
        pose = { ...STANCE, martini, crouch, sparkle, ...moveTrack?.(t, reduced), ...rig?.(t) };
        figure.pose(pose);
      }
      // His eyes (and a worn head's blinks) move only while he is on stage.
      if (local >= 0 && (until === undefined || t <= until + 0.3)) figure.face(local, pose, reduced);
    });
    if (entrance === 'rise') fx.rise(wrap, at, { distance: 24, duration: 0.45 });
    else fx.fadeIn(wrap, at, 0.22);
    if (until !== undefined) fx.fadeOut(wrap, until, 0.3);
    return wrap;
  }

  // ------------------------------------------------------------------
  // The spy caper: module agents on a mission (the intro instrumental)
  // ------------------------------------------------------------------

  /**
   * A module as a secret agent: a manila case file on legs with a fedora,
   * sunglasses, and white gloves. Drawn at its feet (60, 166)
   * in a 120×170 box; `prop` = 'envelope' (its sealed secret) or
   * 'magnifier' (a snoop). Returns the parts the caper poses each frame.
   */
  function folderAgent(parentSvg, { color, band, prop }) {
    const root = svg('g', { class: 'ih-fa' }, parentSvg);
    // A light from the upper left: a sheen over each folder cover.
    const sheen = `ih-fa-sheen-${++uid}`;
    const gradient = svg('linearGradient', { id: sheen, x1: 0, y1: 0, x2: 0.35, y2: 1 }, svg('defs', {}, root));
    for (const [index, offset] of ['0', '0.5', '1'].entries()) svg('stop', { offset, class: `ih-fa-sheen-stop-${index}` }, gradient);
    svg('ellipse', { class: 'ih-fa-shadow', cx: 60, cy: 166, rx: 34, ry: 5 }, root);
    // Legs: dark trousers with a white rim, as Agent 00 wears, and glossy
    // shoes with a shine.
    const leg = (hx) => {
      const g = svg('g', {}, root);
      svg('path', { class: 'ih-fa-leg-rim', d: `M${hx} 118 V156` }, g);
      svg('path', { class: 'ih-fa-leg', d: `M${hx} 118 V156` }, g);
      svg('path', { class: 'ih-agent-shoe ih-agent-shoe--gloss', d: `M${hx - 13} 155.5 H${hx + 3} Q${hx + 9} 156.5 ${hx + 9} 162 H${hx - 14} Q${hx - 15.5} 158 ${hx - 13} 155.5 Z` }, g);
      svg('path', { class: 'ih-agent-shoe-shine', d: `M${hx - 10} 158 Q${hx - 5} 157 ${hx} 158` }, g);
      return g;
    };
    const legL = leg(46);
    const legR = leg(74);
    const body = svg('g', {}, root);
    // Limbs carry an ink edge so they read on the dark stage; arms are
    // strips of the folder's own paper, ending in white gloves.
    const arm = (sx, hx) => {
      const g = svg('g', {}, body);
      svg('path', { class: 'ih-fa-limb-ink', d: `M${sx} 72 L${hx} 104` }, g);
      svg('path', { class: 'ih-fa-arm', d: `M${sx} 72 L${hx} 104`, style: `stroke: ${color}` }, g);
      svg('circle', { class: 'ih-fa-glove', cx: hx, cy: 106, r: 6 }, g);
      svg('path', { class: 'ih-fa-glove-thumb', d: `M${hx - 4.6} 102.6 Q${hx - 7.4} 106.4 ${hx - 4.4} 109.6` }, g);
      return g;
    };
    const armL = arm(22, 6);
    // The folder: a back panel with the tab, a sheet of paper peeking out,
    // and the front cover with a sheen, a rim of light, and a file label.
    svg('path', { class: 'ih-fa-tab', d: 'M20 42 V33 Q20 28 25 28 H52 Q57 28 59 33 L62 42Z', style: `fill: ${color}` }, body);
    svg('path', { class: 'ih-fa-tab-shade', d: 'M20 42 V33 Q20 28 25 28 H52 Q57 28 59 33 L62 42Z' }, body);
    svg('rect', { class: 'ih-fa-body-shadow', x: 23, y: 43, width: 84, height: 84, rx: 9 }, body);
    svg('rect', { class: 'ih-fa-back', x: 18, y: 34, width: 84, height: 88, rx: 9, style: `fill: ${color}` }, body);
    svg('rect', { class: 'ih-fa-back-shade', x: 18, y: 34, width: 84, height: 88, rx: 9 }, body);
    svg('path', { class: 'ih-fa-sheet', d: 'M27 46 V36.5 Q27 34.5 29 34.5 H93 Q95 34.5 95 36.5 V46 Z' }, body);
    svg('path', { class: 'ih-fa-sheet-lines', d: 'M33 39 H70 M33 43 H85' }, body);
    svg('rect', { class: 'ih-fa-body', x: 18, y: 40, width: 84, height: 82, rx: 9, style: `fill: ${color}` }, body);
    svg('rect', { class: 'ih-fa-cover', x: 18, y: 40, width: 84, height: 82, rx: 9, fill: `url(#${sheen})` }, body);
    svg('path', { class: 'ih-fa-shine', d: 'M24 64 V52 Q24 46 30 46 H72' }, body);
    svg('path', { class: 'ih-fa-crease', d: 'M24 115 H96' }, body);
    svg('rect', { class: 'ih-fa-label', x: 66, y: 99, width: 28, height: 12, rx: 2 }, body);
    svg('path', { class: 'ih-fa-label-stripe', d: 'M66 102.5 H94' }, body);
    svg('path', { class: 'ih-fa-label-lines', d: 'M69.5 106.5 H88' }, body);
    for (const gx of [34, 64]) {
      svg('rect', { class: 'ih-fa-lens', x: gx, y: 56, width: 22, height: 12, rx: 4 }, body);
      svg('path', { class: 'ih-fa-lens-glare', d: `M${gx + 4} 66 L${gx + 10} 58 H${gx + 14} L${gx + 8} 66 Z` }, body);
    }
    svg('path', { class: 'ih-fa-bridge', d: 'M56 61 H64' }, body);
    const glint = svg('path', { class: 'ih-fa-glint', d: 'M38 59 L43 59' }, body);
    const mouths = {
      smirk: svg('path', { class: 'ih-fa-mouth', d: 'M52 82 Q60 87 69 79' }, body),
      oh: svg('ellipse', { class: 'ih-fa-mouth-o', cx: 60, cy: 83, rx: 4, ry: 5 }, body),
      grin: svg('path', { class: 'ih-fa-mouth-o', d: 'M49 79 Q60 94 71 79Z' }, body),
    };
    // A fedora: a pinched crown with a light on its left, a band tied in a
    // bow, and a brim lit along its upper edge.
    const hat = svg('g', {}, body);
    svg('ellipse', { class: 'ih-fa-brim', cx: 60, cy: 37, rx: 37, ry: 6.5 }, hat);
    svg('path', { class: 'ih-fa-brim-light', d: 'M27 35.4 Q60 29.4 93 35.4' }, hat);
    svg('path', { class: 'ih-fa-crown', d: 'M37 37 Q37 13 60 12 Q83 13 83 37 Q72 32 60 32 Q48 32 37 37Z' }, hat);
    svg('path', { class: 'ih-fa-crown-light', d: 'M41.5 31 Q41 18 53 14.8' }, hat);
    svg('path', { class: 'ih-fa-dent', d: 'M51 15.5 Q60 22 69 15.5' }, hat);
    svg('path', { class: 'ih-fa-band', d: 'M37 31 Q60 26 83 31 V36 Q60 31 37 36Z', style: `fill: ${band}` }, hat);
    svg('path', { class: 'ih-fa-band', d: 'M74 29.6 L80.5 26.6 L80 33.6 Z M74 29.6 L79 36.4 L73 34.2 Z', style: `fill: ${band}` }, hat);
    const armR = arm(98, 114);
    if (prop === 'envelope') {
      const env = svg('g', { transform: 'translate(-8 100) rotate(-12)' }, armL);
      svg('rect', { class: 'ih-fa-env', x: 0, y: 0, width: 24, height: 16, rx: 2 }, env);
      svg('path', { class: 'ih-fa-env-flap', d: 'M1 1 L12 9 L23 1' }, env);
      svg('circle', { class: 'ih-fa-seal', cx: 12, cy: 10, r: 3 }, env);
    }
    if (prop === 'magnifier') {
      svg('path', { class: 'ih-fa-handle', d: 'M114 106 L124 92' }, armR);
      svg('circle', { class: 'ih-fa-lensglass', cx: 130, cy: 84, r: 11 }, armR);
      svg('path', { class: 'ih-fa-lensglass-glare', d: 'M123.6 82 Q125 77.4 129.6 76.4' }, armR);
    }
    const paper = svg('g', { class: 'ih-fa-paper', opacity: 0 }, body);
    svg('rect', { class: 'ih-fa-paper-sheet', x: 12, y: 44, width: 96, height: 66, rx: 2 }, paper);
    svg('rect', { class: 'ih-fa-paper-head', x: 20, y: 51, width: 80, height: 9 }, paper);
    svg('path', { class: 'ih-fa-paper-lines', d: 'M20 82 H56 M20 89 H56 M20 96 H56 M20 103 H50 M64 82 H100 M64 89 H100 M64 96 H94' }, paper);
    for (const ex of [46, 74]) svg('circle', { class: 'ih-fa-eyehole', cx: ex, cy: 70, r: 5 }, paper);
    for (const hx of [12, 108]) svg('circle', { class: 'ih-fa-glove', cx: hx, cy: 78, r: 6 }, paper);
    return { root, legL, legR, body, armL, armR, mouths, paper, glint, hat };
  }

  /**
   * A keyframed pose: keys = [[at, duration, fields]], each easing the pose
   * so far towards its fields over [at, at + duration]; the first key's
   * fields are the starting pose. Fields are numbers or [a, b] pairs. With
   * `hold` (reduced motion) each key snaps in at `at`. With `turns`, pairs
   * are arm raises in degrees, each eased the shorter way round (nearTurn).
   */
  function poseTrack(keys, { turns = false } = {}) {
    const mix = (a, b, u) => {
      if (!Array.isArray(a)) return a + (b - a) * u;
      // An arm pose's third value, its foreshortening, defaults to 1.
      return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => {
        const from = a[i] ?? 1, to = b[i] ?? 1;
        return from + ((turns && i < 2 ? nearTurn(from, to) : to) - from) * u;
      });
    };
    return (t, hold) => {
      let pose = { ...keys[0][2] };
      for (const [at, duration, fields] of keys.slice(1)) {
        if (t < at) break;
        const u = hold ? 1 : easeInOutCubic(progress(t, at, duration));
        for (const [name, value] of Object.entries(fields)) pose[name] = mix(pose[name], value, u);
      }
      return pose;
    };
  }

  /**
   * The intro instrumental as a beat-timed spy caper. T holds song times:
   * steps (three beats of tiptoeing in), freeze (a searchlight finds them;
   * newspapers up), clear (newspapers down), snoop (Payroll's two steps),
   * zap (a laser wall stops the snoop), ask (he calls year(date) instead),
   * reply (Dates answers), and Agent Payment Gateway's stunts: bondIn
   * (drops in, hanging upside down from a rope, straightening his bow tie),
   * bondFlip (rolls over in a half turn onto the barrier's spot, landing in
   * a crouch), build (sets down the floor emitter and flicks the ceiling
   * emitter up, then a gliding leap to his guard post right beside the
   * barrier as the lasers switch on at zap: he glances at the snoop and
   * straightens his tie, and salutes the reply), twirl, shh (he buttons his
   * jacket), toast (raises his martini, and winks), then stamp. His martini
   * stays level throughout. Characters move on the beat; legs, bobs, sways,
   * and sparkles hold still with reduced motion. `hero` may lend him the
   * viewer's saved face (see agent).
   */
  function spyCaper(parent, T, { hero } = {}) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Agent Payment Gateway's size: he stands with his feet on the floor
    // (y 405.4), and the laser barrier's ceiling detector sits high enough
    // (emitterTop) to guard someone his height.
    const BOND = 0.86;
    const bondY = 405.4 - 293 * BOND;
    const emitterTop = 180;
    const stage = svg('svg', { class: 'ih-caper', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const beam = svg('path', { class: 'ih-caper-beam' }, stage);
    const pool = svg('ellipse', { class: 'ih-caper-pool', cx: 0, cy: 424, rx: 120, ry: 20 }, stage);
    const lasers = svg('g', { class: 'ih-caper-lasers', opacity: 0 }, stage);
    for (const lx of [582, 600]) {
      svg('line', { class: 'ih-caper-laser-glow', x1: lx, y1: emitterTop + 6, x2: lx, y2: 420 }, lasers);
      svg('line', { class: 'ih-caper-laser', x1: lx, y1: emitterTop + 6, x2: lx, y2: 420 }, lasers);
    }
    // The laser detectors Agent Payment Gateway installs.
    const floorEmitter = svg('g', { opacity: 0 }, stage);
    svg('rect', { class: 'ih-caper-emitter', x: -19, y: -5, width: 38, height: 10, rx: 3 }, floorEmitter);
    svg('circle', { class: 'ih-caper-emitter-eye', cx: 0, cy: -5, r: 3 }, floorEmitter);
    const topEmitter = svg('g', { opacity: 0 }, stage);
    svg('rect', { class: 'ih-caper-emitter', x: -19, y: -6, width: 38, height: 12, rx: 3 }, topEmitter);
    svg('circle', { class: 'ih-caper-emitter-eye', cx: 0, cy: 6, r: 3 }, topEmitter);
    const rope = svg('line', { class: 'ih-caper-rope', x1: 590, y1: -20, x2: 590, y2: -20 }, stage);
    const users = folderAgent(stage, { color: '#ecd29a', band: '#0ea5c6', prop: 'envelope' });
    const dates = folderAgent(stage, { color: '#f3c97a', band: '#b3121b', prop: 'envelope' });
    const payroll = folderAgent(stage, { color: '#c9d8e8', band: '#7c3aed', prop: 'magnifier' });
    const spark = svg('g', { class: 'ih-caper-spark', opacity: 0 }, stage);
    svg('path', { d: 'M0 -26 L7 -8 L26 -10 L11 3 L18 22 L0 11 L-18 22 L-11 3 L-26 -10 L-7 -8Z' }, spark);
    const zapText = svg('text', { class: 'ih-caper-zap', x: 0, y: 0, 'text-anchor': 'middle', opacity: 0 }, stage);
    zapText.textContent = 'ZAP!';
    const smoke = [0, 1, 2].map((k) => svg('circle', { class: 'ih-caper-smoke', r: 9 + 3 * k, opacity: 0 }, stage));

    const ease = easeInOutCubic;
    const backOutSoft = (u) => { const c = 1.4; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
    const steps = (t, times, x0, x1) => {
      const d = (x1 - x0) / times.length;
      let x = x0;
      let lift = 0;
      let k = -1;
      times.forEach((bt, i) => {
        const u = progress(t, bt, 0.42);
        x += d * ease(u);
        if (u > 0 && u < 1) { lift = Math.sin(Math.PI * u); k = i; }
      });
      return { x, lift, k };
    };
    const pose = (a, { x, y = 420, dir = 1, lift = 0, k = 0, lean = 0, s = 1 }, reduce) => {
      const l = reduce ? 0 : lift;
      const swing = 30 * l * (k % 2 ? 1 : -1);
      a.legL.setAttribute('transform', `rotate(${swing.toFixed(1)} 46 118)`);
      a.legR.setAttribute('transform', `rotate(${(-swing).toFixed(1)} 74 118)`);
      const bob = -10 * l;
      a.body.setAttribute('transform', `translate(0 ${bob.toFixed(1)}) rotate(${(lean + 6 * l).toFixed(1)} 60 120)`);
      a.root.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(dir * s).toFixed(3)} ${s.toFixed(3)}) translate(-60 -166)`);
    };
    const face = (a, which) => Object.entries(a.mouths).forEach(([key, m]) => m.setAttribute('opacity', key === which ? '1' : '0'));
    const armTo = (g, deg, px, py) => g.setAttribute('transform', `rotate(${deg.toFixed(1)} ${px} ${py})`);

    onFrame((t) => {
      const reduce = reducedMotion.matches;
      const m = reduce ? 0 : t;
      // Act 1: tiptoe in on the beat, freeze behind newspapers in the light.
      const su = steps(t, T.steps, -190, 130);
      const sd = steps(t, T.steps, -50, 340);
      const hiding = t >= T.freeze - 0.12 && t < T.clear;
      const peek = hiding ? 0.5 + 0.5 * Math.sin(m * 6) : 0;
      pose(users, { ...su, lean: su.lift ? 8 : 0 }, reduce);
      pose(dates, { ...sd, lean: sd.lift ? 8 : 0 }, reduce);
      for (const [a, flip] of [[users, true], [dates, false]]) {
        const up = progress(t, T.freeze - 0.12, 0.12) * (1 - progress(t, T.clear, 0.18));
        a.paper.setAttribute('opacity', up.toFixed(2));
        // Users holds the paper upside down: the gag.
        a.paper.setAttribute('transform', flip ? `rotate(180 60 77) translate(0 ${(-4 * peek).toFixed(1)})` : `translate(0 ${(3 * peek).toFixed(1)})`);
      }
      // The searchlight: in fast, lingers over the hiding agents, then away.
      let sx;
      if (t < T.freeze) sx = 1080 - (1080 - 400) * ease(progress(t, T.freeze - 1, 1));
      else if (t < T.clear - 0.3) sx = 400 - 270 * progress(t, T.freeze, T.clear - 0.3 - T.freeze);
      else sx = 130 - 420 * ease(progress(t, T.clear - 0.3, 0.7));
      const lit = t > T.freeze - 1.1 && t < T.clear + 0.5;
      beam.setAttribute('d', `M${(sx * 0.6 + 380).toFixed(1)} -10 L${(sx - 120).toFixed(1)} 424 L${(sx + 120).toFixed(1)} 424Z`);
      beam.setAttribute('opacity', lit ? '1' : '0');
      pool.setAttribute('cx', sx.toFixed(1));
      pool.setAttribute('opacity', lit ? '1' : '0');

      // Act 2: Payroll snoops, gets zapped, then asks through the interface.
      const sp = steps(t, T.snoop, 1080, 740);
      const recoil = progress(t, T.zap, 0.45);
      const px = sp.x + 70 * ease(recoil);
      const hop = Math.sin(Math.PI * recoil) * 46 + (t > T.reply + 0.7 && t < T.reply + 1.2 ? Math.sin(Math.PI * progress(t, T.reply + 0.7, 0.5)) * 18 : 0);
      pose(payroll, { x: px, y: 420 - hop, dir: -1, lift: sp.lift, k: sp.k, lean: sp.lift ? 10 : 0 }, reduce);
      const reach = ease(progress(t, T.zap - 0.5, 0.35)) * (1 - ease(recoil));
      armTo(payroll.armR, -60 * reach, 98, 72);
      // Thumbs up for the answer, then the free hand hushes with the others.
      const thumbs = ease(progress(t, T.reply + 0.7, 0.25));
      const payrollHush = ease(progress(t, T.shh - 0.15, 0.25));
      armTo(payroll.armL, 140 * thumbs * (1 - payrollHush) - 99 * payrollHush, 22, 72);
      // Detectors: the floor one is planted at build, the ceiling one tossed
      // up into place; the beams switch on as the agent lands at his post.
      const plant = progress(t, T.build, 0.18);
      floorEmitter.setAttribute('opacity', plant > 0 ? '1' : '0');
      floorEmitter.setAttribute('transform', `translate(591 421) scale(${(0.4 + 0.6 * backOutSoft(plant)).toFixed(3)})`);
      const toss = progress(t, T.build + 0.08, 0.32);
      topEmitter.setAttribute('opacity', toss > 0 ? '1' : '0');
      topEmitter.setAttribute('transform', `translate(591 ${(300 - (300 - emitterTop) * ease(toss) - 30 * Math.sin(Math.PI * toss)).toFixed(1)}) rotate(${(toss < 1 ? 540 * toss : 0).toFixed(1)})`);
      lasers.setAttribute('opacity', progress(t, T.zap - 0.08, 0.08).toFixed(2));
      const z = progress(t, T.zap, 0.5);
      spark.setAttribute('opacity', z > 0 && z < 1 ? (1 - z).toFixed(2) : '0');
      spark.setAttribute('transform', `translate(590 330) scale(${(0.6 + 0.9 * z).toFixed(2)}) rotate(${(z * 40).toFixed(1)})`);
      const zt = progress(t, T.zap, 0.9);
      zapText.setAttribute('opacity', zt > 0 && zt < 1 ? Math.min(1, (1 - zt) * 3).toFixed(2) : '0');
      zapText.setAttribute('transform', `translate(720 ${(170 - 16 * zt).toFixed(1)}) rotate(-8) scale(${(0.8 + 0.3 * Math.min(1, zt * 4)).toFixed(2)})`);
      smoke.forEach((puff, k) => {
        const u = progress(t, T.zap + 0.25 + k * 0.08, 0.9);
        puff.setAttribute('opacity', u > 0 && u < 1 ? (0.7 * (1 - u)).toFixed(2) : '0');
        puff.setAttribute('cx', (px - 30 + k * 14).toFixed(1));
        puff.setAttribute('cy', (300 - 40 * u - k * 6).toFixed(1));
      });
      face(payroll, t >= T.zap && t < T.ask ? 'oh' : t >= T.reply + 0.5 ? 'grin' : 'smirk');
      face(dates, t >= T.reply ? 'grin' : 'smirk');
      face(users, hiding ? 'oh' : 'smirk');

      // Act 3: everyone hushes on the beat; glints sweep the sunglasses.
      const hush = ease(progress(t, T.shh - 0.15, 0.25));
      for (const a of [users, dates]) armTo(a.armR, 101 * hush, 98, 72);
      for (const [k, a] of [users, dates, payroll].entries()) {
        const g = ((m * 0.7 + k * 0.33) % 1);
        a.glint.setAttribute('opacity', g < 0.12 ? (Math.sin(g / 0.12 * Math.PI)).toFixed(2) : '0');
      }
    });

    // Agent Payment Gateway's stunts. His wrapper moves (so the name tag
    // travels with him), the figure turns and squashes, and the rig poses
    // his limbs. His guard post is x = 515, right beside the barrier at 590.
    const post = 515;
    const landAt = T.bondFlip + 0.55;
    const hopAt = T.build + 0.24;
    const postAt = T.zap - 0.08;
    // Hanging upside down from the rope, his feet are at y 40.
    const hangDy = (40 + 143 * BOND) - (bondY + 150 * BOND);
    const barrierDx = 590 - post;
    const motion = (t) => {
      const reduce = reducedMotion.matches;
      const m = reduce ? 0 : t;
      let dx = 0, dy = 0, r = 0, sx = 1, sy = 1;
      if (t < T.bondFlip) {
        // Drops in on a rope and hangs upside down over the barrier's spot.
        const e = reduce ? 1 : backOut(progress(t, T.bondIn, 0.55));
        dy = -620 + (620 + hangDy) * e;
        r = 180 + (reduce ? 0 : 5 * Math.sin(m * 2.3));
        dx = barrierDx + (reduce ? 0 : 7 * Math.sin(m * 2.3));
      } else if (t < landAt) {
        // Lets go and rolls over in one smooth half turn, onto his feet.
        const u = progress(t, T.bondFlip, landAt - T.bondFlip);
        dx = barrierDx;
        dy = hangDy * (1 - u) - 70 * Math.sin(Math.PI * u);
        r = 180 + 180 * ease(u);
      } else if (t < hopAt) {
        // Lands in a crouch (the rig bends his knees); a little squash.
        dx = barrierDx;
        const v = progress(t, landAt, 0.28);
        sy = 1 - 0.06 * Math.sin(Math.PI * v);
        sx = 1 + 0.04 * Math.sin(Math.PI * v);
      } else {
        // A low, gliding leap to his guard post beside the barrier, leaning
        // into it; the beams switch on as he lands.
        const u = progress(t, hopAt, postAt - hopAt);
        dx = barrierDx * (1 - ease(u));
        dy = -64 * Math.sin(Math.PI * u);
        r = -9 * Math.sin(Math.PI * u);
        // The finale twirl: a smooth spin on the spot.
        const w = progress(t, T.twirl, 0.7);
        if (w > 0 && w < 1) {
          sx = Math.cos(2 * Math.PI * ease(w));
          dy = -14 * Math.sin(Math.PI * w);
        }
      }
      return { dx, dy, r, sx, sy };
    };
    // His limbs, keyed to the stunts: unhurried, overlapping moves, the
    // martini always level. Hand targets are figure coordinates.
    const tieHand = TIE_HAND;
    const buttonHand = armReach([76, 182], -1, 'out');
    const levelGlass = TOAST_POSES.cheers;
    const glide = { free: armReach([74, 160], -1, 'out'), martini: levelGlass, crouch: 22 };
    const limbs = poseTrack([
      // Hanging upside down, he calmly straightens his crooked bow tie; the
      // martini arm hangs towards the floor.
      [-Infinity, 0, { ...AT_EASE, free: tieHand, martini: [170, 170], tie: -16 }],
      [T.bondIn + 0.25, 0.45, { tie: 0 }],
      // Gathers himself and rolls over, knees drawn up, glass held close:
      // the arms fold in as he lets go, not after.
      [T.bondFlip - 0.22, 0.46, { free: armReach([74, 150], -1, 'out'), martini: armReach([96, 146], 1, 'out'), crouch: 45 }],
      // Lands in a crouch, the free hand swept low out to the side for
      // balance, the martini held up level.
      [landAt - 0.26, 0.38, { free: [34, 26], martini: levelGlass, crouch: 38 }],
      // Rises and flicks the ceiling detector up.
      [T.build - 0.06, 0.28, { free: [150, 160], crouch: 0 }],
      // Glides to his post, knees softly drawn up, the free arm sweeping
      // down in front of him.
      [hopAt - 0.04, 0.36, glide],
      // Lands softly, rises, and glances at the snoop.
      [postAt - 0.06, 0.2, { crouch: 16 }],
      // He brings the glass down across his chest to hold it there (the
      // stance agent() keeps once the rig hands the martini over).
      [postAt + 0.1, 0.45, { free: ARM_RELAXED, martini: [GLASS_HELD[0], nearTurn(levelGlass[1], GLASS_HELD[1])], crouch: 0, look: 1 }],
      // Straightens his bow tie: tugged crooked, then square (the tie gleam).
      [postAt + 0.24, 0.32, { free: tieHand, tie: -10 }],
      [postAt + 0.56, 0.3, { tie: 0 }],
      [postAt + 0.9, 0.4, { free: ARM_RELAXED }],
      // A two-finger salute as the reply goes back.
      [T.reply - 0.18, 0.34, { free: armReach([62, 54], -1, 'out'), finger: 1, middle: 1 }],
      [T.reply + 0.42, 0.36, { free: ARM_RELAXED, finger: 0, middle: 0, look: 0 }],
      // After the twirl he buttons his jacket, and keeps his hand there; at
      // the toast, a wink.
      [T.shh - 0.2, 0.4, { free: buttonHand }],
      [T.toast + 0.35, 0.14, { wink: 1 }],
      [T.toast + 0.8, 0.18, { wink: 0 }],
    ]);
    // In the end he raises his martini (the toast); until his post the track
    // poses that arm too, handing it over only once it has eased down to rest
    // (postAt + 0.55), so it never jumps. Through every flip the glass stays
    // upright.
    const bond = agent(parent, {
      x: post - 80 * BOND, y: bondY, scale: BOND, role: 'Agent', code: '00', look: 'tuxedo', at: T.bondIn, toastAt: T.toast, hero,
      rig: (t) => {
        const { martini, ...rest } = limbs(t, reducedMotion.matches);
        return { ...rest, ...(t < postAt + 0.6 ? { martini } : {}), glassTilt: -motion(t).r };
      },
    });
    const figure = bond.querySelector('svg');
    figure.style.transformOrigin = `${80 * BOND}px ${150 * BOND}px`;
    const shadow = bond.querySelector('.ih-agent-shadow');
    const bondTag = bond.querySelector('.ih-agent-tag');
    if (bondTag) {
      bondTag.classList.add('is-staged');
      // The name tag joins him at his post, clear of the snoop's path.
      fx.fadeIn(bondTag, postAt, 0.3);
    }
    // Effects drawn over him: dust where he lands, gleams.
    const top = svg('svg', { class: 'ih-caper', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const dust = [0, 1, 2, 3, 4, 5].map((k) => svg('circle', { class: 'ih-caper-dust', r: 6 + (k % 3) * 3, opacity: 0 }, top));
    const gleam = () => {
      const g = svg('g', { class: 'ih-caper-gleam', opacity: 0 }, top);
      svg('path', { d: 'M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3Z' }, g);
      return g;
    };
    const snapGleam = gleam();
    const tieGleam = gleam();
    const glassGleam = gleam();
    const sparkle = (g, at, x, y, dur = 0.5) => {
      const u = progress(t0, at, dur);
      g.setAttribute('opacity', reduced || u <= 0 || u >= 1 ? '0' : Math.sin(Math.PI * u).toFixed(2));
      g.setAttribute('transform', `translate(${x} ${y}) rotate(${(u * 90).toFixed(1)}) scale(${(0.6 + 0.6 * Math.sin(Math.PI * u)).toFixed(2)})`);
    };
    let t0 = 0;
    let reduced = false;
    onFrame((t) => {
      t0 = t;
      reduced = reducedMotion.matches;
      const { dx, dy, r, sx, sy } = motion(t);
      bond.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      figure.style.transform = `rotate(${r.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      // His floor shadow only while he is on the floor.
      shadow?.setAttribute('opacity', (t >= landAt && t < hopAt) || t >= postAt ? '1' : '0');
      // The rope: tied to his feet while he hangs, whipped away when he lets go.
      const up = progress(t, T.bondFlip, 0.35);
      rope.setAttribute('y2', (t < T.bondFlip ? bondY + dy + 7 * BOND : (bondY + hangDy + 7 * BOND) * (1 - ease(up)) - 20 * ease(up)).toFixed(1));
      rope.setAttribute('x2', (post + dx).toFixed(1));
      rope.setAttribute('opacity', t >= T.bondIn && up < 1 ? '1' : '0');
      // Dust: a puff where he lands on the spot, and at his post.
      dust.forEach((puff, k) => {
        const first = k < 3;
        const u = progress(t, first ? landAt : postAt, 0.6);
        const baseX = (first ? 590 : post) + ((k % 3) - 1) * 26;
        puff.setAttribute('opacity', reduced || u <= 0 || u >= 1 ? '0' : (0.75 * (1 - u)).toFixed(2));
        puff.setAttribute('cx', (baseX + (k % 2 ? 1 : -1) * 18 * u).toFixed(1));
        puff.setAttribute('cy', (408 - 14 * u).toFixed(1));
      });
      // A snap of light as the beams switch on, a bow-tie gleam, a toast.
      sparkle(snapGleam, postAt, 591, emitterTop - 4, 0.45);
      sparkle(tieGleam, postAt + 0.45, post + 2, bondY + 99 * BOND);
      sparkle(glassGleam, T.toast + 0.3, post + 54 * BOND, bondY + 14 * BOND, 0.6);
    });
    return stage;
  }

  // ------------------------------------------------------------------
  // The decrypted transmission: Parnas's sentence, line by line
  // ------------------------------------------------------------------

  /**
   * A teleprinter sheet that decrypts each line as it is sung. lines =
   * [{ at, parts: [text | { text, tone, at }] }]: object parts are
   * highlighted with a marker (and underlined) from their own time.
   * Earlier lines dim (still readable) once the next one is sung.
   */
  function transmission(parent, { x, y, w, lines, header, origin, source, sourceAt, stampAt, at, until }) {
    const node = place(el('div', 'ih-trans is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ih-trans-head', node);
    const live = el('span', 'ih-trans-live', head);
    live.append(icon('file'));
    live.append(document.createTextNode(header));
    if (origin) el('span', 'ih-trans-origin', head, origin);
    lines.forEach((line, i) => {
      const row = el('div', 'ih-trans-line is-staged', node);
      let offset = 0;
      for (const part of line.parts) {
        const text = typeof part === 'string' ? part : part.text;
        const span = el('span', typeof part === 'string' ? null : `ih-mark ih-mark--${part.tone || 'gold'}`, row);
        decrypt(span, text, line.at, { offset, seed: i * 31 + offset });
        if (typeof part !== 'string') during(span, 'is-on', part.at ?? line.at);
        offset += text.length;
      }
      fx.fadeIn(row, line.at - 0.05, 0.15);
      const next = lines[i + 1];
      if (next) during(row, 'is-dim', next.at + 0.2, until ?? Infinity);
    });
    if (source) {
      const src = el('div', 'ih-trans-source is-staged', node, source);
      fx.fadeIn(src, sourceAt ?? at, 0.3);
    }
    if (stampAt !== undefined) {
      const stamp = el('div', 'ih-trans-stamp is-staged', node, 'Decrypted');
      fx.slam(stamp, stampAt, { from: 2.4, rotate: -10 });
    }
    fx.rise(node, at, { distance: 20, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // Code: a code card (dark), a CRT terminal (green), or a classified file
  // ------------------------------------------------------------------

  /**
   * lines = [{ at, parts: [text | { text, mark: 'red'|'gold'|'green', at, until, cls }] }].
   * variant = 'crt' draws a 1970s green-phosphor terminal; 'classified'
   * adds a red CLASSIFIED header.
   */
  function code(parent, { x, y, w, title, lines, at, until, variant }) {
    const node = place(el('div', `code-card ih-code${variant ? ` ih-code--${variant}` : ''} is-staged`, parent), x, y);
    node.style.width = `${w}px`;
    if (title) {
      const bar = el('div', 'code-card-title', node);
      if (variant === 'classified') el('span', 'ih-code-classified', bar, 'Classified');
      bar.append(document.createTextNode(title));
    }
    const rows = lines.map((line) => {
      const row = el('div', `code-line${line.at !== undefined ? ' is-staged' : ''}`, node);
      for (const part of line.parts) {
        if (typeof part === 'string') {
          row.append(document.createTextNode(part));
          continue;
        }
        const classes = [];
        if (part.cls) classes.push(`ih-${part.cls}`);
        if (part.mark) classes.push('ih-code-mark', part.mark === 'red' ? '' : `ih-code-mark--${part.mark}`);
        const span = el('span', classes.filter(Boolean).join(' '), row, part.text);
        if (part.mark && part.at !== undefined) during(span, 'is-on', part.at, part.until);
        if (part.ref) part.ref(span);
      }
      if (line.at !== undefined) fx.rise(row, line.at, { distance: 6, duration: 0.25 });
      return row;
    });
    if (variant === 'crt') el('div', 'ih-scanlines', node);
    fx.rise(node, at, { distance: 18, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, rows };
  }

  // ------------------------------------------------------------------
  // Intercept: a surveillance terminal searching for a word
  // ------------------------------------------------------------------

  /**
   * A green CRT "intercept" console: `query` types into its field, then
   * hits = [{ file, before, match, after }] print one by one while a
   * magnifier sweeps down them; count stamps a total on `countAt`.
   */
  function search(parent, { x, y, w, query, at, typedAt, hits, hitsAt, step = 0.12, count, countAt, until }) {
    const node = place(el('div', 'ih-intercept is-staged', parent), x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'ih-intercept-head', node);
    const rec = el('span', 'ih-intercept-rec', head);
    rec.append(icon('search'));
    rec.append(document.createTextNode('Intercept'));
    const field = el('span', 'ih-intercept-query', head);
    kit.typewriter(field, `"${query}"`, typedAt ?? at, 14);
    let countNode = null;
    if (count) {
      countNode = el('span', 'ih-intercept-count is-staged', head, count);
      fx.slam(countNode, countAt, { from: 2, rotate: -4 });
    }
    const box = el('div', 'ih-intercept-body', node);
    const rows = hits.map((hit, i) => {
      const row = el('div', 'ih-hit is-staged', box);
      el('span', 'ih-hit-file', row, hit.file);
      const codeNode = el('span', 'ih-hit-code', row);
      codeNode.append(document.createTextNode(hit.before));
      el('mark', null, codeNode, hit.match);
      codeNode.append(document.createTextNode(hit.after));
      fx.fadeIn(row, hitsAt + i * step, 0.08);
      return row;
    });
    el('div', 'ih-scanlines', node);
    // A magnifier sweeps down the hits as they print.
    const lens = svg('svg', { class: 'ih-lens is-staged', viewBox: '0 0 80 80', width: 80, height: 80, 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'ih-lens-glass', cx: 32, cy: 32, r: 22 }, lens);
    svg('path', { class: 'ih-lens-shine', d: 'M18 26 A16 16 0 0 1 30 14' }, lens);
    svg('line', { class: 'ih-lens-handle', x1: 49, y1: 49, x2: 72, y2: 72 }, lens);
    fx.fadeIn(lens, hitsAt, 0.2);
    const sweep = Math.max(0.6, hits.length * step + 0.3);
    onFrame((t) => {
      const p = easeInOutCubic(progress(t, hitsAt, sweep));
      lens.style.transform = `translate(${(w * 0.42 + 120 * Math.sin(p * Math.PI * 2)).toFixed(1)}px, ${(40 + p * (rows.length * 26 - 10)).toFixed(1)}px)`;
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, countNode };
  }

  /**
   * The bridge's contract scene in the song's case-file language: a Client
   * file talks only to a public Contract badge, which a Server file
   * implements. The server's database choice stays sealed in a top-secret
   * envelope; the protocol (stateless or stateful) is typed onto the badge,
   * because callers depend on it.
   */
  function contractExchange(parent, { at, actorsAt, contractAt, protocolAt, confirmedAt }) {
    const node = el('div', 'ih-contract-exchange', parent);
    heading(node, ['Show what ', 'callers', ' need to know'], { x: 64, y: 62, at });
    module(node, { x: 36, y: 286, w: 176, h: 80, name: 'Client', iconName: 'laptop', at: actorsAt });
    const server = module(node, { x: 684, y: 258, w: 248, h: 136, name: 'Server', iconName: 'stack', at: actorsAt + 0.15 });
    server.secret('SQL or NoSQL', { at: contractAt + 0.3, dx: 8, dy: 66 });
    const contract = module(node, {
      x: 278, y: 246, w: 320, h: 132, name: 'Contract', iconName: 'file', kind: 'interface', at: contractAt,
      lines: [{ text: 'Stateless or stateful?', at: protocolAt }],
    });
    contract.node.classList.add('ih-contract');
    courier(node, { from: [216, 326], to: [272, 326], tone: 'gold', at: contractAt + 0.2, period: 1.5 });
    // The server is not a caller: it implements the contract.
    implementsLink(node, { from: [680, 326], to: [604, 326], at: contractAt + 0.35 });
    contract.light(confirmedAt);
    contract.verdict('In the contract', { at: confirmedAt, dx: 140, dy: 116 });
    return node;
  }

  /**
   * Matching dependency diagrams for the change test. All six system modules
   * keep their positions; only the dependencies differ. Arrows point from
   * the dependent module to what it depends on. The external provider is
   * deliberately outside the system boundary and is not counted as a module.
   */
  function changeImpactGraph(parent, { x, y, mode, at, changeAt }) {
    const leaky = mode === 'leaky';
    const node = art(parent, { x, y, w: 440, h: 350, viewBox: '0 0 440 350', className: `ih-impact ih-impact--${mode}` });
    node.setAttribute('data-testid', 'ih-impact-graph');
    node.setAttribute('data-design', mode);
    const id = `ih-impact-${++uid}`;
    const defs = svg('defs', {}, node);
    for (const tone of ['neutral', 'changed']) {
      const marker = svg('marker', { id: `${id}-${tone}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto' }, defs);
      // UML dependency: a dashed line ending in an open arrowhead.
      svg('path', { class: `ih-impact-arrow ih-impact-arrow--${tone}`, d: 'M1 1 L9 5 L1 9' }, marker);
    }
    // The module cards are lit from above (gradient fill attribute).
    const cardLight = svg('linearGradient', { id: `${id}-card`, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    for (const [index, offset] of ['0', '1'].entries()) svg('stop', { offset, class: `ih-impact-card-stop-${index}` }, cardLight);
    function text(parentNode, value, tx, ty, className = '') {
      const label = svg('text', { class: `ih-impact-text ${className}`, x: tx, y: ty, 'text-anchor': 'middle' }, parentNode);
      label.textContent = value;
      return label;
    }
    svg('rect', { class: 'ih-impact-panel', x: 1, y: 1, width: 438, height: 348, rx: 16 }, node);
    text(node, leaky ? 'Leaky' : 'Hidden well', 220, 32, 'ih-impact-title');
    svg('rect', { class: 'ih-impact-system', x: 8, y: 70, width: 424, height: 200, rx: 9 }, node);

    // Edges are painted first, so arrow routes never cover module labels.
    // Each ends at its own point, so no two arrowheads overlap: along the
    // Gateway's left side, or (leaky) along the Provider's top, nested so
    // the routes never cross.
    const edgeLayer = svg('g', {}, node);
    const edges = [];
    const callers = ['Order', 'Refund', 'Wallet', 'Report', 'Admin'];
    callers.forEach((name, index) => {
      const sy = 93 + index * 38;
      const targetX = 362 - index * 24;
      const targetY = 145 + index * 13;
      const d = leaky
        ? `M132 ${sy} C${targetX - 34} ${sy} ${targetX} ${sy + 24} ${targetX} 284`
        : `M132 ${sy} C185 ${sy} 197 ${targetY} 249 ${targetY}`;
      edges.push({ node: svg('path', { class: 'ih-impact-edge', d, 'marker-end': `url(#${id}-neutral)` }, edgeLayer), affected: leaky });
    });
    // Only the hidden design has a Gateway; in the leaky design callers reach the provider directly.
    if (!leaky) edges.push({ node: svg('path', { class: 'ih-impact-edge', d: 'M325 211 V284', 'marker-end': `url(#${id}-neutral)` }, edgeLayer), affected: true });

    const modules = [];
    // A card: its shadow, the lit card, and a highlight along its top edge.
    function module(name, mx, my, width, height, affected) {
      const group = svg('g', { class: 'ih-impact-module', 'data-testid': 'ih-impact-module', 'data-module': name }, node);
      svg('rect', { class: 'ih-impact-card-shadow', x: mx + 2, y: my + 3, width, height, rx: 6 }, group);
      svg('rect', { class: 'ih-impact-card', x: mx, y: my, width, height, rx: 6, fill: `url(#${id}-card)` }, group);
      svg('path', { class: 'ih-impact-card-light', d: `M${mx + 6} ${my + 2.6} H${mx + width - 6}` }, group);
      const label = text(group, name, mx + width / 2, my + height / 2 + 7, 'ih-impact-name');
      modules.push({ group, label, name, affected });
    }
    callers.forEach((name, i) => module(name, 20, 78 + i * 38, 112, 30, leaky));
    if (!leaky) module('Gateway', 250, 136, 150, 74, true);
    // The external payment provider, outside the system, marked by a card.
    const provider = svg('g', { class: 'ih-impact-provider' }, node);
    svg('rect', { class: 'ih-impact-provider-card', x: 250, y: 285, width: 150, height: 36, rx: 6 }, provider);
    svg('rect', { class: 'ih-impact-provider-icon', x: 258, y: 296, width: 18, height: 13, rx: 2 }, provider);
    svg('path', { class: 'ih-impact-provider-stripe', d: 'M258 300.4 H276 M261 305.6 H266' }, provider);
    text(provider, 'Provider', 333, 310, 'ih-impact-name');
    const verdict = text(node, 'Count changed modules', 220, 344, 'ih-impact-verdict');

    onFrame((t) => {
      const changed = t >= changeAt;
      for (const item of modules) {
        const hit = changed && item.affected;
        item.group.classList.toggle('is-changed', hit);
        item.label.textContent = `${item.name}${hit ? ' *' : ''}`;
      }
      for (const edge of edges) {
        const hit = changed && edge.affected;
        edge.node.classList.toggle('is-changed', hit);
        edge.node.setAttribute('marker-end', `url(#${id}-${hit ? 'changed' : 'neutral'})`);
      }
      verdict.textContent = changed ? (leaky ? '* 5 modules must change' : '* Only Gateway changes') : 'Count changed modules';
      verdict.classList.toggle('is-changed', changed);
    });
    fx.fadeIn(node, at, 0.25);
    return node;
  }

  // Core-memory cutaway reference: ferrite rings retain bits on crossing wires.
  // https://www.computerhistory.org/storageengine/whirlwind-computer-debuts-core-memory/
  /** A vintage tape cabinet with a small, enlarged core-memory cutaway below. */
  function mainframeMemory(parent, { x, y, at, until }) {
    const node = art(parent, { x, y, w: 250, h: 230, viewBox: '0 0 250 230', className: 'ih-mainframe-memory' });
    node.setAttribute('data-testid', 'ih-mainframe-memory');
    const id = `ih-mainframe-${++uid}`;
    const defs = svg('defs', {}, node);
    const metal = svg('linearGradient', { id: `${id}-metal`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, defs);
    svg('stop', { class: 'ih-mainframe-metal--light', offset: '0%' }, metal);
    svg('stop', { class: 'ih-mainframe-metal--body', offset: '60%' }, metal);
    svg('stop', { class: 'ih-mainframe-metal--shade', offset: '100%' }, metal);
    const reelMetal = svg('linearGradient', { id: `${id}-reel`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, defs);
    svg('stop', { class: 'ih-mainframe-reel--light', offset: '0%' }, reelMetal);
    svg('stop', { class: 'ih-mainframe-reel--shade', offset: '100%' }, reelMetal);

    svg('ellipse', { class: 'ih-mainframe-shadow', cx: 126, cy: 219, rx: 112, ry: 8 }, node);
    svg('rect', { class: 'ih-mainframe-foot', x: 28, y: 204, width: 25, height: 15, rx: 3 }, node);
    svg('rect', { class: 'ih-mainframe-foot', x: 188, y: 204, width: 25, height: 15, rx: 3 }, node);
    svg('path', { class: 'ih-mainframe-side', d: 'M228 15 L241 8 V201 L228 212 Z' }, node);
    svg('path', { class: 'ih-mainframe-top', d: 'M12 15 L25 8 H241 L228 15 Z' }, node);
    svg('rect', { class: 'ih-mainframe-cabinet', x: 12, y: 15, width: 216, height: 197, rx: 5, fill: `url(#${id}-metal)` }, node);
    svg('path', { class: 'ih-mainframe-edge-light', d: 'M17 20 H222 M17 21 V204' }, node);
    svg('path', { class: 'ih-mainframe-edge-shade', d: 'M223 23 V206 H19' }, node);

    // Steady indicator lamps preserve the vintage face without visual flashing.
    svg('rect', { class: 'ih-mainframe-panel', x: 25, y: 28, width: 190, height: 25, rx: 3 }, node);
    for (let i = 0; i < 8; i++) {
      svg('circle', { class: `ih-mainframe-lamp${i === 0 || i === 3 || i === 6 ? ' is-lit' : ''}`, cx: 38 + i * 13, cy: 40.5, r: 3.4 }, node);
    }
    for (let i = 0; i < 3; i++) {
      svg('rect', { class: 'ih-mainframe-switch', x: 157 + i * 17, y: 35, width: 10, height: 11, rx: 1.5 }, node);
      svg('path', { class: 'ih-mainframe-switch-line', d: `M${160 + i * 17} 38 h4` }, node);
    }

    // The two large reels are tape storage, distinct from the lower memory inset.
    svg('path', { class: 'ih-mainframe-tape-route', d: 'M73 126 V141 Q73 150 85 150 H155 Q167 150 167 140 V126' }, node);
    const reels = [73, 167].map((cx) => {
      svg('rect', { class: 'ih-mainframe-window', x: cx - 42, y: 63, width: 84, height: 78, rx: 5 }, node);
      svg('path', { class: 'ih-mainframe-window-edge', d: `M${cx - 38} 67 H${cx + 37}` }, node);
      svg('circle', { class: 'ih-mainframe-tape-pack', cx, cy: 102, r: 31 }, node);
      const reel = svg('g', { class: 'ih-mainframe-reel', transform: `translate(${cx} 102)` }, node);
      svg('circle', { class: 'ih-mainframe-reel-rim', r: 35, fill: `url(#${id}-reel)` }, reel);
      svg('circle', { class: 'ih-mainframe-tape', r: 28 }, reel);
      svg('circle', { class: 'ih-mainframe-tape-groove', r: 24 }, reel);
      for (let i = 0; i < 3; i++) {
        svg('path', { class: 'ih-mainframe-spoke', d: 'M-4 -7 L-7 -31 Q0 -34 7 -31 L4 -7 Z', transform: `rotate(${i * 120})`, fill: `url(#${id}-reel)` }, reel);
      }
      svg('circle', { class: 'ih-mainframe-hub', r: 10, fill: `url(#${id}-reel)` }, reel);
      svg('circle', { class: 'ih-mainframe-spindle', r: 3.6 }, reel);
      return reel;
    });
    for (const cx of [73, 167]) {
      svg('circle', { class: 'ih-mainframe-guide', cx, cy: 146, r: 4.5 }, node);
      svg('circle', { class: 'ih-mainframe-spindle', cx, cy: 146, r: 1.6 }, node);
    }

    // A schematic cutaway: hollow ferrite cores threaded by crossing wires.
    // It is deliberately smaller than the tape mechanism and is not to scale.
    const memory = svg('g', { class: 'ih-mainframe-core', 'data-testid': 'ih-mainframe-core' }, node);
    svg('rect', { class: 'ih-mainframe-core-frame', x: 33, y: 160, width: 174, height: 42, rx: 3 }, memory);
    svg('rect', { class: 'ih-mainframe-core-bed', x: 39, y: 165, width: 162, height: 32, rx: 1.5 }, memory);
    for (let col = 0; col < 6; col++) {
      const cx = 50 + col * 28;
      svg('path', { class: 'ih-mainframe-core-wire-y', d: `M${cx} 162 V200` }, memory);
    }
    for (const cy of [174, 189]) {
      svg('path', { class: 'ih-mainframe-core-wire-x', d: `M36 ${cy} H204` }, memory);
      for (let col = 0; col < 6; col++) {
        const core = svg('g', { transform: `translate(${50 + col * 28} ${cy}) rotate(-34)` }, memory);
        svg('path', { class: 'ih-mainframe-ferrite', 'fill-rule': 'evenodd', d: 'M0 -6 A4.7 6 0 1 1 0 6 A4.7 6 0 1 1 0 -6 Z M0 -3.1 A2 3.1 0 1 0 0 3.1 A2 3.1 0 1 0 0 -3.1 Z' }, core);
        svg('path', { class: 'ih-mainframe-core-highlight', d: 'M-3.3 1.8 C-4.5 -2 -2.2 -5 0 -5' }, core);
      }
    }
    for (const [sx, sy] of [[19, 22], [220, 22], [19, 205], [220, 205]]) {
      svg('circle', { class: 'ih-mainframe-screw', cx: sx, cy: sy, r: 1.7 }, node);
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    onFrame((t) => {
      const elapsed = reducedMotion.matches ? 0 : Math.max(0, t - at);
      reels.forEach((reel, i) => {
        const angle = (elapsed * (i ? -35 : 42)) % 360;
        reel.setAttribute('transform', `translate(${i ? 167 : 73} 102) rotate(${angle.toFixed(1)})`);
      });
    });
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return node;
  }

  // ------------------------------------------------------------------
  // The detective's corkboard: modules as pinned cards, dependencies as
  // red string; with every pair connected, it knots into a ball of mud
  // ------------------------------------------------------------------

  /** Sculpted wet earth, lit from the upper left, in the existing 260px envelope. */
  function mudBall(parent, cx, cy) {
    const ball = svg('g', { class: 'ih-mud-ball', transform: `translate(${cx} ${cy})`, opacity: 0 }, parent);
    const id = `ih-mud-${++uid}`;
    const defs = svg('defs', {}, ball);
    const surfaceLight = svg('radialGradient', { id: `${id}-earth`, gradientUnits: 'userSpaceOnUse', cx: -46, cy: -62, r: 192 }, defs);
    for (const [offset, tone] of [['0%', 'light'], ['42%', 'middle'], ['78%', 'shade'], ['100%', 'edge']]) {
      svg('stop', { offset, class: `ih-mud-tone--${tone}` }, surfaceLight);
    }
    const foldLight = svg('linearGradient', { id: `${id}-fold`, x1: '0%', y1: '0%', x2: '35%', y2: '100%' }, defs);
    for (const [offset, tone] of [['0%', 'light'], ['48%', 'middle'], ['100%', 'shade']]) {
      svg('stop', { offset, class: `ih-mud-fold-tone--${tone}` }, foldLight);
    }
    ball.style.setProperty('--ih-mud-earth', `url(#${id}-earth)`);
    ball.style.setProperty('--ih-mud-fold', `url(#${id}-fold)`);
    svg('ellipse', { class: 'ih-mud-ground', cx: 5, cy: 113, rx: 119, ry: 13 }, ball);
    svg('ellipse', { class: 'ih-mud-contact', cx: 5, cy: 112, rx: 83, ry: 7 }, ball);
    const clods = svg('g', { class: 'ih-mud-clods' }, ball);
    for (const [x, y, turn, scale] of [[-114, 98, -12, 1], [119, 100, 20, 0.8], [-94, 116, 8, 0.7], [95, 115, -15, 0.9]]) {
      svg('path', { class: 'ih-mud-clod', d: 'M-9 2 C-11 -2 -7 -7 -2 -7 C2 -10 8 -6 10 -2 C14 3 7 6 2 5 C-3 7 -7 5 -9 2 Z', transform: `translate(${x} ${y}) rotate(${turn}) scale(${scale})` }, clods);
    }
    const silhouette = 'M-119 5 C-123 -13 -114 -35 -105 -49 C-105 -65 -90 -80 -74 -83 C-60 -102 -37 -110 -18 -106 C0 -115 22 -108 39 -103 C61 -105 79 -89 87 -75 C105 -69 115 -49 112 -32 C123 -15 124 5 118 24 C123 45 112 65 97 75 C89 94 70 107 49 105 C29 115 10 114 -8 111 C-29 117 -47 109 -61 103 C-83 102 -99 84 -102 68 C-117 54 -125 28 -119 5 Z';
    svg('path', { class: 'ih-mud-blob', d: silhouette }, ball);
    // Broad folds establish volume; the smaller creases follow their edges.
    const folds = [
      'M-103 -41 C-105 -62 -82 -78 -60 -77 C-42 -86 -23 -79 -19 -64 C-13 -45 -38 -32 -57 -35 C-78 -27 -94 -31 -103 -41 Z',
      'M-40 -88 C-22 -107 7 -105 26 -94 C45 -94 59 -76 52 -60 C43 -42 17 -45 4 -49 C-17 -47 -31 -61 -40 -88 Z',
      'M51 -69 C69 -79 91 -59 94 -42 C112 -28 110 -7 95 4 C77 12 63 0 60 -14 C43 -28 40 -51 51 -69 Z',
      'M-109 4 C-99 -15 -72 -20 -53 -6 C-33 0 -34 24 -46 39 C-53 56 -80 57 -94 42 C-111 34 -119 18 -109 4 Z',
      'M-24 -17 C-10 -34 17 -33 28 -16 C49 -12 59 8 46 26 C38 44 14 48 -1 35 C-22 33 -37 5 -24 -17 Z',
      'M50 40 C70 25 92 31 100 48 C98 68 78 87 61 89 C42 101 24 90 27 72 C29 57 36 48 50 40 Z',
      'M-77 69 C-62 54 -42 58 -29 73 C-10 74 5 90 -6 103 C-26 113 -47 105 -61 100 C-76 94 -86 82 -77 69 Z',
    ];
    folds.forEach((d) => svg('path', { class: 'ih-mud-fold', d }, ball));
    const creases = [
      'M-99 -40 C-82 -30 -68 -33 -55 -36 C-40 -32 -25 -41 -21 -51',
      'M-34 -87 C-30 -67 -16 -52 3 -51 C20 -43 39 -44 48 -54',
      'M61 -65 C46 -48 52 -29 64 -16 C66 -2 79 7 93 2',
      'M-106 17 C-106 35 -91 47 -75 47 C-62 56 -48 42 -44 32',
      'M-24 -9 C-31 11 -17 32 1 34 C18 46 37 35 44 22',
      'M95 46 C98 61 80 80 65 82 C51 94 32 86 30 76',
      'M-77 76 C-74 91 -59 96 -46 97 C-32 108 -16 103 -10 98',
    ];
    creases.forEach((d) => {
      svg('path', { class: 'ih-mud-crease-soft', d }, ball);
      svg('path', { class: 'ih-mud-ridge', d }, ball);
      svg('path', { class: 'ih-mud-crease-lip', d, transform: 'translate(-0.7 -2.2)' }, ball);
    });
    // Fixed clusters read as earth grain, rather than a uniform dotted texture.
    const grains = [[-80,-56],[-69,-61],[-64,-49],[-73,-45],[-29,-89],[-15,-82],[-7,-89],[2,-78],[26,-72],[31,-61],[69,-39],[79,-29],[75,-18],[-91,7],[-80,14],[-91,24],[-65,30],[-7,-4],[5,-13],[14,-3],[7,9],[26,17],[69,49],[78,55],[58,65],[-49,77],[-42,86],[-29,90]];
    grains.forEach(([x, y], index) => {
      svg('path', { class: index % 3 ? 'ih-mud-grain' : 'ih-mud-grain-light', d: 'M-1.8 0 Q-0.7 -2.1 1 -1 Q2.5 0 1 1 Q-0.9 1.6 -1.8 0 Z', transform: `translate(${x} ${y}) rotate(${index * 47 % 180})` }, ball);
    });
    svg('path', { class: 'ih-mud-wet', d: 'M-94 -55 C-86 -65 -75 -68 -66 -65 M-27 -92 C-17 -97 -6 -96 3 -92 M53 -57 Q58 -63 65 -59 M-101 0 Q-91 -8 -80 -5 M-18 -19 Q-6 -26 4 -21 M45 45 Q57 35 69 39 M-67 68 Q-58 64 -49 69' }, ball);
    svg('path', { class: 'ih-mud-rim-light', d: 'M-112 -19 C-109 -34 -101 -41 -100 -49 C-98 -62 -86 -73 -73 -76 M-65 -86 C-52 -98 -36 -103 -23 -100' }, ball);
    svg('path', { class: 'ih-mud-outline', d: silhouette }, ball);
    return ball;
  }

  /** Six partially buried dependency threads keep the existing draw timing. */
  function mudThreads(parent, cx, cy) {
    const id = `ih-mud-thread-${++uid}`;
    const gradient = svg('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: -70, y1: -95, x2: 90, y2: 95 }, svg('defs', {}, parent));
    for (const [offset, tone] of [['0%', 'light'], ['42%', 'middle'], ['67%', 'light'], ['100%', 'shade']]) {
      svg('stop', { offset, class: `ih-mud-thread-tone--${tone}` }, gradient);
    }
    return [
      'M-104 -24 C-92 -48 -65 -57 -43 -47 C-32 -43 -27 -31 -30 -21 M-15 -10 C12 8 63 3 89 -18',
      'M-75 -78 C-96 -47 -87 -17 -64 -6 M-47 0 C-24 5 -22 30 0 37 C32 48 77 39 104 18',
      'M-24 -99 C-44 -70 -28 -47 -9 -30 M0 -21 C18 -4 28 5 25 26 M27 42 C35 59 30 80 17 96',
      'M78 -67 C49 -74 25 -59 26 -39 M25 -26 C24 -9 2 5 -20 13 M-36 19 C-60 29 -75 43 -83 59',
      'M-106 22 C-83 4 -58 10 -46 26 M-35 35 C-9 55 12 55 38 44 M56 41 C75 39 93 47 97 60',
      'M-63 84 C-46 70 -35 58 -33 40 M-30 25 C-26 3 -5 -10 17 -7 M36 -2 C57 7 68 14 75 29',
    ].map((d) => {
      const path = svg('path', { class: 'ih-mud-thread', d, transform: `translate(${cx} ${cy})` }, parent);
      path.style.setProperty('--ih-mud-thread-paint', `url(#${id})`);
      return path;
    });
  }

  /** A compact, labeled-scene companion using the original mud illustration. */
  /**
   * A finished ball of mud. With `from` = [x, y] (stage point of a full-size
   * ball, 1 px per unit), it starts there at full size and moves to its own
   * place over `move` seconds: one ball carried from scene to scene.
   */
  function mud(parent, { x, y, size = 160, at, from, delay = 0.32, move = 0.6 }) {
    const node = art(parent, { x, y, w: size, h: size, viewBox: '-140 -130 280 280' });
    mudBall(node, 0, 0).setAttribute('opacity', '1');
    mudThreads(node, 0, 0).forEach((path) => {
      path.setAttribute('pathLength', '1');
      path.style.strokeDashoffset = '0';
    });
    if (!from) {
      fx.fadeIn(node, at, 0.2);
      return node;
    }
    const ox = size * 0.5;
    const oy = size * (130 / 280);
    node.style.transformOrigin = `${ox}px ${oy}px`;
    const start = { translate: `${(from[0] - x - ox).toFixed(1)}px ${(from[1] - y - oy).toFixed(1)}px`, scale: (280 / size).toFixed(3) };
    tween(node, [{ opacity: 0, ...start }, { opacity: 1, ...start }], at, 0.02, EASE.linear);
    tween(node, [{ opacity: 1, ...start }, { opacity: 1, translate: '0px 0px', scale: '1' }], at + delay, move, EASE.inOut);
    return node;
  }

  /**
   * A framed corkboard (w×h) with `names` pinned around an ellipse, every
   * pair joined by red string (n(n−1)/2 strings) drawn one after another,
   * and a sticky note counting them. mud(at) heaps the cards in the middle
   * and knots the string into a ball of mud.
   */
  function stringWeb(parent, { x, y, w, h, names, at, drawFor = 1.2, until, countLabel = 'connections', title }) {
    const node = place(el('div', 'ih-cork is-staged', parent), x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    if (title) el('div', 'ih-cork-title', node, title);
    const n = names.length;
    const cx = w / 2;
    const cy = h / 2 - 8;
    const rx = w / 2 - (n > 4 ? 76 : 86);
    const ry = h / 2 - (n > 4 ? 62 : 70);
    const cardW = n > 4 ? 100 : 118;
    const spots = names.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
    });
    // The string lies over the cards, pin to pin.
    const mud = svg('svg', { class: 'ih-cork-mud', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const ball = mudBall(mud, cx, cy + 6);
    const cards = names.map((name, i) => {
      const carrier = el('div', 'ih-pincard-carrier', node);
      const card = place(el('div', 'ih-pincard', carrier), spots[i].x - cardW / 2, spots[i].y - 26);
      card.style.width = `${cardW}px`;
      const tilt = (hash01(i * 13 + n) - 0.5) * 10;
      card.style.rotate = `${tilt.toFixed(1)}deg`;
      const photo = el('span', 'ih-pincard-photo', card);
      photo.append(icon(SERVICE_ICONS[name] || 'box'));
      el('span', 'ih-pincard-name', card, name);
      fx.pop(card, at + 0.05 + i * 0.06, { from: 0.6, rotate: tilt });
      return carrier;
    });
    const strings = svg('svg', { class: 'ih-cork-strings', viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' }, node);
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    const order = pairs.map((pair, k) => ({ pair, key: hash01(k * 7 + n * 3) })).sort((a, b) => a.key - b.key).map((o) => o.pair);
    const step = drawFor / order.length;
    const yarn = order.map(([i, j], k) => {
      const a = { x: spots[i].x, y: spots[i].y - 22 };
      const b = { x: spots[j].x, y: spots[j].y - 22 };
      const sag = 12 + Math.hypot(b.x - a.x, b.y - a.y) * 0.08;
      const d = `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 + sag).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      const shadow = svg('path', { class: 'ih-yarn-shadow', d, transform: 'translate(2 3)' }, strings);
      const path = svg('path', { class: 'ih-yarn', d }, strings);
      const starts = at + 0.35 + k * step;
      fx.draw(shadow, starts, Math.max(0.12, step * 1.6));
      fx.draw(path, starts, Math.max(0.12, step * 1.6));
      return { path, shadow, starts, i, j, sag };
    });
    const pins = spots.map((s, i) => {
      const pin = svg('g', { transform: `translate(${s.x.toFixed(1)} ${(s.y - 22).toFixed(1)})` }, strings);
      const head = svg('g', {}, pin);
      svg('circle', { class: 'ih-pin', r: 6.5 }, head);
      svg('circle', { class: 'ih-pin-shine', cx: -2, cy: -2, r: 2 }, head);
      fx.pop(head, at + 0.1 + i * 0.06, { from: 0.4 });
      return pin;
    });
    const knot = svg('g', { class: 'ih-knot', opacity: 0 }, strings);
    const loops = mudThreads(knot, cx, cy + 6);
    const note = place(el('div', 'ih-sticky is-staged', node), w - 140, n > 4 ? 0 : h - 88);
    const count = el('b', null, note, '0');
    el('span', null, note, countLabel);
    fx.pop(note, at + 0.3, { from: 0.5, rotate: 4 });
    onFrame((t) => {
      const shown = yarn.filter((s) => t >= s.starts).length;
      const text = String(shown);
      if (count.textContent !== text) count.textContent = text;
    });
    fx.fadeIn(node, at, 0.3);
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      /** Hides the finished ball at `at` (a carried copy takes its place). */
      handOff(at) {
        for (const part of [ball, knot]) tween(part, { opacity: 0 }, at, 0.03, EASE.linear);
        return this;
      },
      /**
       * Everything depends on everything, then it all collapses into one
       * ball of mud. From `strainFrom` the strings pull taut and the cards
       * tremble harder; at `when` the cards are yanked onto a growing ball,
       * which lands with a squash and splatter on `impact`; then the cards
       * sink in and the strings knot across its surface. Every pose is a
       * pure function of song time (reduced motion skips the trembling and
       * jumps from net to ball).
       */
      mud(when, { strainFrom = when } = {}) {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const IMPACT = 1.0;   // seconds after `when` that the ball lands
        const DURATION = 1.7;
        const ringX = 92;     // cards land on the ball's surface, not a dot
        const ringY = 70;
        const bx = cx;
        const by = cy + 6;
        tween(note, { opacity: 0 }, when, 0.25, EASE.in);
        loops.forEach((path) => path.setAttribute('pathLength', '1'));
        // Mud splatter: drops fly out on impact and stay on the cork as stains.
        const splats = Array.from({ length: 11 }, (_, i) => {
          const angle = -Math.PI + (i / 10) * Math.PI * 1.0 + (hash01(i * 19 + 4) - 0.5) * 0.5;
          const reach = 150 + hash01(i * 7 + 2) * 70;
          const drop = svg('ellipse', { class: 'ih-mud-splat', rx: 5 + hash01(i * 3) * 6, ry: 3.5 + hash01(i * 5) * 3, opacity: 0 }, mud);
          return { drop, angle, reach };
        });
        const ring = svg('ellipse', { class: 'ih-mud-shock', cx: bx, cy: by + 112, rx: 10, ry: 3, opacity: 0 }, mud);
        mud.insertBefore(ring, mud.firstChild);
        const easeIn = (p) => p * p * p;
        let previous;
        onFrame((t) => {
          const reduce = reducedMotion.matches;
          const elapsed = reduce ? (t >= when ? DURATION : 0) : Math.max(0, Math.min(DURATION, t - when));
          const strain = reduce || t < strainFrom ? 0 : Math.min(1, (t - strainFrom) / Math.max(0.01, when - strainFrom));
          const key = `${elapsed.toFixed(3)}|${elapsed > 0 || strain === 0 ? 0 : t.toFixed(3)}`;
          if (key === previous) return;
          previous = key;
          const gather = easeIn(progress(elapsed, 0.05, IMPACT - 0.05));
          const sink = easeInOutCubic(progress(elapsed, IMPACT + 0.1, 0.45));
          const shake = strain * strain * (1 - gather) * 3.2;
          const poses = spots.map((spot, i) => {
            const angle = -Math.PI / 2 + i * 2 * Math.PI / n + gather * 0.6;
            const pull = 1 - 0.05 * strain;
            const rX = (rx * pull) * (1 - gather) + ringX * (1 - 0.45 * sink) * gather;
            const rY = (ry * pull) * (1 - gather) + ringY * (1 - 0.45 * sink) * gather;
            return {
              x: bx + Math.cos(angle) * rX + shake * Math.sin(t * 37 + i * 1.7),
              y: (cy - 22) * (1 - gather) + by * gather + Math.sin(angle) * rY + shake * Math.cos(t * 31 + i * 2.3),
            };
          });
          cards.forEach((carrier, i) => {
            const pinX = spots[i].x;
            const pinY = spots[i].y - 22;
            const scale = (1 - 0.5 * gather) * (1 - 0.45 * sink);
            const rotation = gather * (24 + (hash01(i * 47) - 0.5) * 50) + shake * 1.4 * Math.sin(t * 23 + i);
            carrier.style.transform = `translate(${poses[i].x - pinX}px, ${poses[i].y - pinY}px) translate(${pinX}px, ${pinY}px) rotate(${rotation}deg) scale(${scale}) translate(${-pinX}px, ${-pinY}px)`;
            carrier.style.opacity = String(1 - sink);
            pins[i].setAttribute('transform', `translate(${poses[i].x} ${poses[i].y}) scale(${1 - 0.5 * gather})`);
            pins[i].setAttribute('opacity', String(1 - sink));
          });
          yarn.forEach(({ path, shadow, i, j, sag }, k) => {
            const a = poses[i];
            const b = poses[j];
            // Taut under strain, then wrapped around the ball as it forms.
            const curl = Math.sin(Math.PI * Math.min(1, gather * 1.2)) * (k % 2 ? 38 : -38);
            const bend = sag * (1 - 0.75 * strain) * (1 - gather);
            const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${((a.x + b.x) / 2 + curl).toFixed(1)} ${((a.y + b.y) / 2 + bend + curl * 0.6).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
            for (const strand of [path, shadow]) {
              strand.setAttribute('d', d);
              strand.style.opacity = String(1 - sink);
            }
          });
          // The ball grows under the incoming cards and lands with a squash.
          const size = 0.25 + 0.75 * easeInOutCubic(progress(elapsed, 0.15, IMPACT - 0.15));
          const after = progress(elapsed, IMPACT, 0.6);
          const wobble = elapsed < IMPACT ? 0 : Math.sin(after * Math.PI * 3) * Math.exp(-4 * after) * 0.12;
          ball.setAttribute('opacity', String(progress(elapsed, 0.15, 0.2)));
          ball.setAttribute('transform', `translate(${bx} ${by + 110 * (1 - size)}) scale(${(size * (1 + wobble)).toFixed(4)} ${(size * (1 - wobble)).toFixed(4)})`);
          knot.setAttribute('opacity', String(progress(elapsed, IMPACT, 0.3)));
          loops.forEach((path, k) => {
            path.style.strokeDashoffset = String(1 - easeInOutCubic(progress(elapsed, IMPACT + 0.05 + k * 0.03, 0.45)));
          });
          const fly = progress(elapsed, IMPACT, 0.45);
          splats.forEach(({ drop, angle, reach }) => {
            const r = 60 + (reach - 60) * easeInOutCubic(fly);
            const lift = Math.sin(fly * Math.PI) * 26;
            drop.setAttribute('cx', (bx + Math.cos(angle) * r).toFixed(1));
            drop.setAttribute('cy', (by + 40 + Math.sin(angle) * r * 0.55 - lift + 70 * fly).toFixed(1));
            drop.setAttribute('opacity', elapsed < IMPACT ? '0' : '0.85');
          });
          const wave = progress(elapsed, IMPACT, 0.5);
          ring.setAttribute('rx', (40 + 150 * wave).toFixed(1));
          ring.setAttribute('ry', (6 + 18 * wave).toFixed(1));
          ring.setAttribute('opacity', elapsed < IMPACT ? '0' : (0.5 * (1 - wave)).toFixed(2));
        });
        /** Song time the ball lands, and its centre in the board's own frame. */
        this.impact = when + IMPACT;
        this.ballCenter = [bx, by];
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // Aging backwards: born in '85, then 00 − 85 rewinds him out of existence
  // ------------------------------------------------------------------

  /**
   * A soft-flat person in a 120×200 box who rewinds through life: young man
   * → teen → kid → baby → swaddled newborn → egg cell → a puff of smoke with
   * a "?". stages = { teen, kid, baby, newborn, egg, gone } are song times:
   * from each one, the figure morphs on into the next stage, shrinking at a
   * steady rate as neighbouring stages dissolve into each other, so the
   * rewind runs continuously from the young man (at `teen`) through the
   * teen (fully there at `kid`), the kid (at `baby`), the baby (at
   * `newborn`), and the newborn (at `egg`) to the egg cell, which goes up in
   * smoke at `gone`. Pure function of song time; with reduced motion each
   * stage simply replaces the last at its time.
   */
  function agingPerson(parent, { x, y, scale = 1, at, stages, until, tag }) {
    const node = art(parent, { x, y, w: 120 * scale, h: 210 * scale, viewBox: '0 0 120 210', className: 'ih-aging' });
    const P = (g, cls, d, attrs = {}) => svg('path', { class: cls, d, ...attrs }, g);
    const C = (g, cls, cx, cy, r, attrs = {}) => svg('circle', { class: cls, cx, cy, r, ...attrs }, g);
    // Soft light from the upper left: gradients for skin, hair, and cloth,
    // each stop coloured by its class (CSS).
    const defs = svg('defs', {}, node);
    const paint = (kind, name, attrs, offsets) => {
      const id = `ih-aging-${name}-${++uid}`;
      const gradient = svg(kind, { id, ...attrs }, defs);
      offsets.forEach((offset, index) => svg('stop', { offset, class: `ih-aging-${name}-stop-${index}` }, gradient));
      return `url(#${id})`;
    };
    const skinLight = paint('radialGradient', 'skin', { cx: 0.38, cy: 0.32, r: 0.78 }, ['0', '0.6', '1']);
    const hairLight = paint('linearGradient', 'hair', { x1: 0, y1: 0, x2: 0.4, y2: 1 }, ['0', '1']);
    const lit = (name) => paint('linearGradient', name, { x1: 0, y1: 0, x2: 1, y2: 0.35 }, ['0', '0.55', '1']);
    const tee = lit('tee'), denim = lit('denim'), hoodie = lit('hoodie'), joggers = lit('joggers');
    /** Ears with their inner curl, head, hair with its light, brows, eyes with catchlights, nose, mouth (and cheeks). */
    function face(g, cx, cy, r, { hair, hairLight: strands, mouth, open = false, brows = true, cheeks = false, freckles = false }) {
      for (const side of [-1, 1]) {
        C(g, 'ih-aging-skin', cx + side * r * 0.96, cy + 2, r * 0.24, { fill: skinLight });
        P(g, 'ih-aging-ear', `M${cx + side * r * 1.02} ${cy + 0.6} Q${cx + side * r * 0.9} ${cy + 2.2} ${cx + side * r * 1.0} ${cy + 3.6}`);
      }
      C(g, 'ih-aging-skin ih-aging-head', cx, cy, r, { fill: skinLight });
      P(g, 'ih-aging-hair', hair, { fill: hairLight });
      if (strands) P(g, 'ih-aging-hair-light', strands);
      for (const side of [-1, 1]) {
        const ex = cx + side * r * 0.36;
        svg('ellipse', { class: 'ih-aging-eye', cx: ex, cy: cy + r * 0.08, rx: r * 0.11, ry: r * 0.15 }, g);
        C(g, 'ih-aging-catchlight', ex + r * 0.04, cy + r * 0.02, r * 0.045);
        if (brows) P(g, 'ih-aging-brow', `M${ex - r * 0.16} ${cy - r * 0.2} Q${ex} ${cy - r * 0.3} ${ex + r * 0.16} ${cy - r * 0.2}`);
        if (cheeks) C(g, 'ih-aging-cheek', cx + side * r * 0.58, cy + r * 0.38, r * 0.16);
        if (freckles) for (const [fx, fy] of [[0.5, 0.3], [0.62, 0.36], [0.54, 0.44]]) C(g, 'ih-aging-freckle', cx + side * r * fx, cy + r * fy, r * 0.035);
      }
      P(g, 'ih-aging-nose', `M${cx + r * 0.02} ${cy + r * 0.18} Q${cx - r * 0.12} ${cy + r * 0.38} ${cx + r * 0.08} ${cy + r * 0.4}`);
      P(g, open ? 'ih-aging-mouth ih-aging-mouth--open' : 'ih-aging-mouth', mouth);
    }
    /** A sneaker: the upper with a toe cap, laces, and a side stripe, on a rubber sole. */
    const sneaker = (g, x, y, w, cls) => {
      P(g, 'ih-aging-sole', `M${x - 2.6} ${y + 6} H${x + w + 0.6} Q${x + w + 1} ${y + 8.6} ${x + w - 0.6} ${y + 8.6} H${x - 2.2} Q${x - 3.2} ${y + 8.6} ${x - 2.6} ${y + 6} Z`);
      P(g, `ih-aging-shoe ${cls}`, `M${x} ${y} H${x + w * 0.62} Q${x + w} ${y + 2.6} ${x + w} ${y + 6.4} H${x - 2.4} Q${x - 3} ${y + 2.6} ${x} ${y}Z`);
      P(g, 'ih-aging-toecap', `M${x + w * 0.66} ${y + 0.6} Q${x + w * 0.62} ${y + 3.6} ${x + w * 0.74} ${y + 6.2}`);
      P(g, 'ih-aging-lace', `M${x + 1.4} ${y + 1.4} L${x + w * 0.42} ${y + 1} M${x + 1.8} ${y + 3} L${x + w * 0.46} ${y + 2.6}`);
      P(g, `ih-aging-stripe-side ${cls}-stripe`, `M${x - 1.6} ${y + 5} Q${x + w * 0.32} ${y + 2.6} ${x + w * 0.6} ${y + 5.2}`);
    };
    /** An arm in skin with its outline: the dark stroke under a narrower skin stroke. */
    const limb = (g, d, width) => {
      P(g, 'ih-aging-limb-ink', d, { 'stroke-width': width + 2.6 });
      P(g, 'ih-aging-limb', d, { 'stroke-width': width });
    };
    /** A hand: the palm and a thumb on the side towards the body. */
    const hand = (g, cx, cy, r, side) => {
      C(g, 'ih-aging-skin', cx, cy, r, { fill: skinLight });
      svg('ellipse', { class: 'ih-aging-skin', cx: cx - side * r * 0.72, cy: cy - r * 0.2, rx: r * 0.42, ry: r * 0.62, transform: `rotate(${side * 18} ${cx - side * r * 0.72} ${cy - r * 0.2})`, fill: skinLight }, g);
    };

    // Young man: a quiff, a crew-neck T-shirt with a code print, a belt with
    // loops, jeans with pockets, stitching and worn knees, white sneakers.
    const man = svg('g', { class: 'ih-aging-man' }, node);
    svg('ellipse', { class: 'ih-aging-shadow', cx: 60, cy: 189, rx: 30, ry: 4 }, man);
    P(man, 'ih-aging-jeans', 'M44 113 L76 113 L75.2 179 L63 179 L60 129 L57 179 L44.8 179 Z', { fill: denim });
    P(man, 'ih-aging-denim-shade', 'M70.4 116 L76 113 L75.2 179 L70 179 Q71.6 147 70.4 116 Z M60 129 L57 179 L54.2 179 Q56.8 150 60 129 Z');
    for (const kx of [51, 69.4]) svg('ellipse', { class: 'ih-aging-knee', cx: kx, cy: 152, rx: 3.4, ry: 7 }, man);
    P(man, 'ih-aging-stitch', 'M46.4 117 L45.8 177 M73.6 117 L74.2 177 M47.2 116.6 Q50.6 121.4 55.2 116.6 M72.8 116.6 Q69.4 121.4 64.8 116.6');
    P(man, 'ih-aging-pocket-edge', 'M46.2 115.4 Q50.6 121 55.6 115.4 M73.8 115.4 Q69.4 121 64.4 115.4');
    P(man, 'ih-aging-fly', 'M60.4 115.6 Q61.2 121.6 59.6 127.4');
    P(man, 'ih-aging-hem', 'M45.2 175.8 H56.6 M63.4 175.8 H74.8');
    sneaker(man, 44, 178, 15, 'ih-aging-shoe--man');
    sneaker(man, 62, 178, 15, 'ih-aging-shoe--man');
    limb(man, 'M39 73 Q35.2 91 35 108', 6);
    limb(man, 'M81 73 Q84.8 91 85 108', 6);
    P(man, 'ih-aging-elbow', 'M34.6 91.4 Q36.2 92.2 37.6 91.2 M85.4 91.4 Q83.8 92.2 82.4 91.2');
    hand(man, 35, 112, 4.6, -1);
    hand(man, 85, 112, 4.6, 1);
    svg('rect', { class: 'ih-aging-neck', x: 55, y: 41, width: 10, height: 9 }, man);
    P(man, 'ih-aging-neck-shade', 'M55 41.4 H65 V44.6 Q60 46.8 55 44.6 Z');
    P(man, 'ih-aging-tee', 'M40 54 Q48 48 60 48 Q72 48 80 54 L85 72 L77 75 L76 112 L44 112 L43 75 L35 72 Z', { fill: tee });
    P(man, 'ih-aging-tee-shade', 'M60 48 Q72 48 80 54 L85 72 L77 75 L76 112 L63 112 Z');
    P(man, 'ih-aging-hemline', 'M35.6 70.6 L43.4 73.4 M84.4 70.6 L76.6 73.4 M44.4 109.6 H75.6');
    P(man, 'ih-aging-fold', 'M44.6 79 Q46.8 83.4 45.4 88 M75.4 79 Q73.2 83.4 74.6 88 M46.4 101 Q51 104.4 49.2 108.6 M73.6 99.4 Q69.6 103.4 71.2 108');
    P(man, 'ih-aging-collar', 'M53 49 Q60 56.6 67 49');
    P(man, 'ih-aging-collar-rib', 'M54.4 49.8 Q60 55 65.6 49.8');
    const logo = svg('text', { class: 'ih-aging-logo', x: 60, y: 86, 'text-anchor': 'middle' }, man);
    logo.textContent = '</>';
    svg('rect', { class: 'ih-aging-belt', x: 44, y: 109, width: 32, height: 6, rx: 1.5 }, man);
    for (const lx of [47.6, 70.4]) svg('rect', { class: 'ih-aging-belt-loop', x: lx, y: 108.4, width: 2, height: 7.2, rx: 0.6 }, man);
    svg('rect', { class: 'ih-aging-buckle', x: 57, y: 109, width: 6, height: 6, rx: 1 }, man);
    P(man, 'ih-aging-buckle-pin', 'M60 110.6 V113.4');
    face(man, 60, 30, 15, {
      hair: 'M44 31 Q42 12 60 12 Q78 12 76 31 Q74 23 69 21 Q65 26 57 23 Q50 21 47 26 Q45 28 44 31Z',
      hairLight: 'M49 18.4 Q55 13.4 63 14.2 M47 23.6 Q49.4 18.6 54.4 16.4 M64.6 15.4 Q70.4 16.4 73 21.6',
      mouth: 'M55 35.5 Q60 39.5 65 35.5',
    });
    P(man, 'ih-aging-dimple', 'M54.2 34.8 Q54.6 35.8 55.4 36 M65.8 34.8 Q65.4 35.8 64.6 36');

    // Teen: messy fringe, a hoodie with ribbed cuffs and band, drawstrings
    // with metal tips, a stitched pocket, headphones, striped joggers.
    const teen = svg('g', { class: 'ih-aging-teen' }, node);
    svg('ellipse', { class: 'ih-aging-shadow', cx: 60, cy: 189, rx: 27, ry: 4 }, teen);
    P(teen, 'ih-aging-joggers', 'M43 129 L77 129 L75 180 L64 180 L60 144 L56 180 L45 180 Z', { fill: joggers });
    P(teen, 'ih-aging-jogger-stripe', 'M44.6 133 L45.8 175 M75.4 133 L74.2 175');
    P(teen, 'ih-aging-cuffband', 'M45 176 H56 M64 176 H75');
    sneaker(teen, 45, 179, 14, 'ih-aging-shoe--teen');
    sneaker(teen, 63, 179, 14, 'ih-aging-shoe--teen');
    P(teen, 'ih-aging-hood', 'M44 90 Q43 77 52 74 L68 74 Q77 77 76 90 Z');
    P(teen, 'ih-aging-hoodie', 'M42 90 Q50 84 60 84 Q70 84 78 90 L82 131 L38 131 Z', { fill: hoodie });
    P(teen, 'ih-aging-hoodie-shade', 'M60 84 Q70 84 78 90 L82 131 L62 131 Z');
    P(teen, 'ih-aging-hoodie', 'M42 91 Q34 109 36 129 L44 129 Q44 110 48 99Z', { fill: hoodie });
    P(teen, 'ih-aging-hoodie-shade', 'M78 91 Q86 109 84 129 L76 129 Q76 110 72 99Z');
    P(teen, 'ih-aging-rib', 'M36.4 125.6 L43.8 125.6 M76.2 125.6 L83.6 125.6 M38.6 127.6 H81.4');
    hand(teen, 40, 132, 4.2, -1);
    hand(teen, 80, 132, 4.2, 1);
    P(teen, 'ih-aging-pocket', 'M48 114 L72 114 L76 129 L44 129 Z');
    P(teen, 'ih-aging-pocket-stitch', 'M49.2 115.6 L70.8 115.6 L74.2 127.6 M45.8 127.6 L49.2 115.6');
    P(teen, 'ih-aging-string', 'M56 88 L55 104 M64 88 L65 104');
    for (const sx of [55, 65]) svg('rect', { class: 'ih-aging-aglet', x: sx - 0.9, y: 103.6, width: 1.8, height: 3.2, rx: 0.6 }, teen);
    svg('rect', { class: 'ih-aging-neck', x: 55.5, y: 76, width: 9, height: 8 }, teen);
    face(teen, 60, 64, 14, {
      hair: 'M45 65 Q44 49 60 49 Q76 49 75 65 Q71 58 67 61 Q64 55 59 59 Q54 55 50 60 Q47 60 45 65Z',
      hairLight: 'M50 54.4 Q55.6 50.6 62.4 51.2 M66 52.4 Q71 54 73 58.4',
      mouth: 'M55 69.5 Q60 71.5 66 68',
    });
    P(teen, 'ih-aging-headphones', 'M49 86 Q60 96 71 86');
    P(teen, 'ih-aging-headphones-light', 'M51.6 88.4 Q60 94.4 68.4 88.4');
    C(teen, 'ih-aging-earcup', 48.5, 85, 4);
    C(teen, 'ih-aging-earcup', 71.5, 85, 4);
    for (const ex of [48.5, 71.5]) C(teen, 'ih-aging-earcup-light', ex - 1.2, 83.8, 1.1);

    // Kid: cowlick, a striped T-shirt with a round neck, shorts with a
    // pocket, striped socks, sneakers with a strap, freckles, a big smile.
    const kid = svg('g', { class: 'ih-aging-kid' }, node);
    svg('ellipse', { class: 'ih-aging-shadow', cx: 60, cy: 189, rx: 22, ry: 3.5 }, kid);
    P(kid, 'ih-aging-shin', 'M51 175 V182 M69 175 V182');
    P(kid, 'ih-aging-sock', 'M51 180 V183 M69 180 V183');
    P(kid, 'ih-aging-sock-stripe', 'M48 180.6 H54 M66 180.6 H72');
    sneaker(kid, 46, 182, 11, 'ih-aging-shoe--kid');
    sneaker(kid, 64, 182, 11, 'ih-aging-shoe--kid');
    P(kid, 'ih-aging-shorts', 'M48 163 L72 163 L73 176 L62 176 L60 169 L58 176 L47 176 Z');
    P(kid, 'ih-aging-shorts-detail', 'M66 165 Q69.4 167.6 72.2 165.8 M60 164 V168.6 M47.6 174 H57.6 M62.4 174 H72.4');
    limb(kid, 'M44 149 Q41 157 42 163', 5);
    limb(kid, 'M76 149 Q79 157 78 163', 5);
    hand(kid, 42, 166, 3.8, -1);
    hand(kid, 78, 166, 3.8, 1);
    P(kid, 'ih-aging-stripes-shirt', 'M45 140 Q52 136 60 136 Q68 136 75 140 L78 151 L73 152 L72 165 L48 165 L47 152 L42 151 Z');
    P(kid, 'ih-aging-stripe', 'M45 144 H75 M47 150 H73 M48 156 H72 M48 162 H72');
    P(kid, 'ih-aging-kid-collar', 'M55 137 Q60 141.4 65 137');
    svg('rect', { class: 'ih-aging-neck', x: 56, y: 131, width: 8, height: 6 }, kid);
    face(kid, 60, 120, 15, {
      hair: 'M45 121 Q44 104 60 104 Q76 104 75 121 Q72 112 64 113 Q58 108 52 113 Q48 114 45 121Z',
      hairLight: 'M50 109.4 Q55.6 105.6 62 106.2',
      mouth: 'M54 125 Q60 132 66 125 Z', open: true, freckles: true,
    });
    P(kid, 'ih-aging-teeth', 'M55.6 125.6 H64.4');
    P(kid, 'ih-aging-cowlick', 'M60 104 Q61 97 66 99');

    // Baby: sitting in a onesie with a star, curl, rosy cheeks, pacifier, rattle.
    const baby = svg('g', { class: 'ih-aging-baby' }, node);
    svg('ellipse', { class: 'ih-aging-shadow', cx: 60, cy: 190, rx: 24, ry: 3.5 }, baby);
    svg('ellipse', { class: 'ih-aging-skin', cx: 46, cy: 187, rx: 6.5, ry: 4, fill: skinLight }, baby);
    svg('ellipse', { class: 'ih-aging-skin', cx: 74, cy: 187, rx: 6.5, ry: 4, fill: skinLight }, baby);
    P(baby, 'ih-aging-toes', 'M40.6 185.4 V186.8 M42.4 184.8 V186.4 M79.4 185.4 V186.8 M77.6 184.8 V186.4');
    P(baby, 'ih-aging-onesie', 'M44 186 Q41 169 50 163 Q60 159 70 163 Q79 169 76 186 Q60 191 44 186 Z');
    P(baby, 'ih-aging-onesie-shade', 'M60 160 Q70 162 70 163 Q79 169 76 186 Q68 189 62 189 Z');
    P(baby, 'ih-aging-onesie-star', 'M66 168.4 L66.9 170.4 L69 170.6 L67.4 172 L67.9 174.1 L66 173 L64.1 174.1 L64.6 172 L63 170.6 L65.1 170.4 Z');
    for (const by of [170, 177]) C(baby, 'ih-aging-snap', 60, by, 1.4);
    limb(baby, 'M48 168 Q41 172 40 177', 6.4);
    limb(baby, 'M72 168 Q79 172 80 176', 6.4);
    P(baby, 'ih-aging-rattle-handle', 'M80 177 L86 167');
    C(baby, 'ih-aging-rattle', 88, 164, 5);
    C(baby, 'ih-aging-rattle-light', 86.4, 162.4, 1.6);
    P(baby, 'ih-aging-rattle-band', 'M83.4 165.6 Q88 167.6 92.6 165.6');
    hand(baby, 40, 180, 4.3, -1);
    hand(baby, 80, 178, 4.3, 1);
    face(baby, 60, 146, 17, { hair: 'M58 129.5 Q56 125 60.5 124.5 Q65 125 62.5 129.5', mouth: 'M57 155 H63', brows: false, cheeks: true });
    C(baby, 'ih-aging-pacifier-ring', 60, 158.5, 3.6);
    svg('ellipse', { class: 'ih-aging-pacifier', cx: 60, cy: 155.5, rx: 6, ry: 3 }, baby);
    P(baby, 'ih-aging-pacifier-light', 'M56.2 154.4 Q58 153.4 60.4 153.6');

    // Newborn: swaddled in a knitted blanket with a satin edge, eyes closed,
    // a tuft of hair.
    const newborn = svg('g', { class: 'ih-aging-newborn' }, node);
    svg('ellipse', { class: 'ih-aging-shadow', cx: 60, cy: 190, rx: 20, ry: 3 }, newborn);
    P(newborn, 'ih-aging-swaddle', 'M44 188 Q38 165 46 150 Q60 140 74 150 Q82 165 76 188 Q60 193 44 188 Z');
    P(newborn, 'ih-aging-knit', 'M50 168 l2 2 l2 -2 M58 172 l2 2 l2 -2 M66 167 l2 2 l2 -2 M52 181 l2 2 l2 -2 M62 183 l2 2 l2 -2 M70 177 l2 2 l2 -2');
    P(newborn, 'ih-aging-swaddle-fold', 'M46 162 Q60 172 75 158 M48 176 Q61 184 74 171');
    P(newborn, 'ih-aging-swaddle-edge', 'M46.6 161.4 Q60 170.8 74.4 157.6');
    C(newborn, 'ih-aging-skin', 60, 150, 11.5, { fill: skinLight });
    P(newborn, 'ih-aging-swaddle-hood', 'M46 156 Q44 134 60 133 Q76 134 74 156 Q70 143 60 142 Q50 143 46 156 Z');
    for (const side of [-1, 1]) P(newborn, 'ih-aging-sleep', `M${60 + side * 4.5 - 2.4} 150.5 Q${60 + side * 4.5} 152.6 ${60 + side * 4.5 + 2.4} 150.5`);
    for (const side of [-1, 1]) C(newborn, 'ih-aging-cheek', 60 + side * 7, 154.5, 2);
    P(newborn, 'ih-aging-mouth', 'M58.6 157 Q60 158 61.4 157');
    P(newborn, 'ih-aging-cowlick', 'M60 143.5 Q61 140 63.5 141');

    // Egg cell: a ring of follicle cells (the corona) around the clear outer
    // shell, the cytoplasm with its granules, and the nucleus.
    const egg = svg('g', { class: 'ih-aging-egg' }, node);
    for (let k = 0; k < 14; k += 1) {
      const a = (k / 14) * 2 * Math.PI;
      C(egg, 'ih-aging-egg-corona', (60 + 24.6 * Math.cos(a)).toFixed(2), (168 + 24.6 * Math.sin(a)).toFixed(2), 3.4);
    }
    C(egg, 'ih-aging-egg-zona', 60, 168, 21);
    C(egg, 'ih-aging-egg-cell', 60, 168, 15.5);
    C(egg, 'ih-aging-egg-shine', 54.6, 162.4, 4.6);
    for (const [gx, gy] of [[51, 163], [66, 160], [69, 174], [54, 177], [62, 170], [65, 166], [57, 173]]) C(egg, 'ih-aging-egg-granule', gx, gy, 1.2);
    C(egg, 'ih-aging-egg-nucleus', 57, 166, 5.2);
    C(egg, 'ih-aging-egg-nucleolus', 58.5, 165, 1.6);

    const frames = [man, teen, kid, baby, newborn, egg];
    const puff = svg('g', { class: 'ih-aging-puff' }, node);
    for (const [cx, cy, r] of [[42, 172, 18], [62, 162, 22], [82, 174, 17], [58, 184, 18]]) svg('circle', { cx, cy, r }, puff);
    const mark = svg('text', { class: 'ih-aging-question', x: 60, y: 120, 'text-anchor': 'middle' }, node);
    mark.textContent = '?';
    const label = tag ? el('div', 'ih-aging-tag is-staged', parent, tag) : null;
    if (label) place(label, x + 8 * scale, y + 214 * scale);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Standing height of each stage above the floor (y = 190).
    const heights = [178, 141, 93, 66, 57, 44];
    // When each stage is fully there: the man as the rewind starts, each
    // younger stage at the next stage time, and the egg cell a little before
    // it goes up in smoke.
    const keys = [stages.teen, stages.kid, stages.baby, stages.newborn, stages.egg, stages.egg + 0.6 * (stages.gone - stages.egg)];
    // The rewind's progress, 0 (man) to 5 (egg), at a steady rate between keys.
    const progressAt = (t) => {
      if (t <= keys[0]) return 0;
      for (let i = 1; i < keys.length; i += 1) if (t < keys[i]) return i - 1 + (t - keys[i - 1]) / (keys[i] - keys[i - 1]);
      return keys.length - 1;
    };
    const sizeAt = (g, factor) => g.setAttribute('transform', `translate(60 190) scale(${factor.toFixed(3)}) translate(-60 -190)`);
    onFrame((t) => {
      const reduce = reducedMotion.matches;
      const gone = t >= stages.gone;
      // With reduced motion, each stage replaces the last at its time.
      const c = reduce ? keys.reduce((k, key, i) => (t >= key ? i : k), 0) : progressAt(t);
      const i = Math.min(frames.length - 2, Math.floor(c));
      const f = c - i;
      // Both neighbours stand at the shrinking height between theirs; the
      // younger dissolves in over the middle of the step while the older
      // fades out a moment later, so the figure never looks hollow, and the
      // double exposure stays brief.
      const height = heights[i] + (heights[i + 1] - heights[i]) * f;
      const fadeIn = smooth((f - 0.3) / 0.32);
      const fadeOut = 1 - smooth((f - 0.42) / 0.32);
      const vanish = gone ? Math.max(0, 1 - (t - stages.gone) / 0.14) : 1;
      frames.forEach((g, k) => {
        let opacity = 0;
        if (k === i) opacity = fadeOut;
        else if (k === i + 1) opacity = fadeIn;
        if (k === frames.length - 1) opacity *= vanish;
        g.setAttribute('opacity', opacity.toFixed(3));
        sizeAt(g, height / heights[k]);
      });
      const puffAge = gone ? t - stages.gone : 0;
      puff.setAttribute('opacity', gone ? Math.max(0, Math.min(1, puffAge / 0.12) * (1 - Math.max(0, puffAge - 0.25) / 0.6)).toFixed(2) : '0');
      puff.setAttribute('transform', `translate(60 175) scale(${(0.6 + 0.5 * easeInOutCubic(Math.min(1, puffAge / 0.5))).toFixed(3)}) translate(-60 -175)`);
      mark.setAttribute('opacity', gone ? Math.min(1, puffAge / 0.25).toFixed(2) : '0');
      mark.setAttribute('transform', `translate(0 ${(gone && !reduce ? 10 * (1 - easeInOutCubic(Math.min(1, puffAge / 0.35))) : 0).toFixed(1)})`);
      if (label) label.textContent = gone ? `${tag} → ?` : tag;
    });
    fx.rise(node, at, { distance: 16, duration: 0.35 });
    if (label) fx.fadeIn(label, at + 0.2, 0.25);
    if (until !== undefined) {
      fx.fadeOut(node, until, 0.25);
      if (label) fx.fadeOut(label, until, 0.25);
    }
    return node;
  }

  // ------------------------------------------------------------------
  // Cash: dollar bills spent on memory, and money flying away
  // ------------------------------------------------------------------

  /** A layer of `count` bill <svg>s that all reuse one bill <symbol>. */
  function billLayer(parent, count, tone) {
    const id = `ih-bill-${++uid}`;
    const node = el('div', `ih-cash ih-cash--${tone}`, parent);
    const defs = svg('svg', { class: 'ih-cash-defs', 'aria-hidden': 'true' }, node);
    const bill = svg('symbol', { id, viewBox: '0 0 64 30' }, defs);
    svg('rect', { class: 'ih-bill-paper', x: 1, y: 1, width: 62, height: 28, rx: 3 }, bill);
    svg('rect', { class: 'ih-bill-frame', x: 5, y: 4.5, width: 54, height: 21, rx: 2 }, bill);
    svg('path', { class: 'ih-bill-guilloche', d: 'M13 10.5H23M13 15H23M13 19.5H23M41 10.5H51M41 15H51M41 19.5H51' }, bill);
    svg('ellipse', { class: 'ih-bill-seal', cx: 32, cy: 15, rx: 7.5, ry: 8.5 }, bill);
    svg('path', { class: 'ih-bill-sign', d: 'M35 10.6C34 9.6 30.6 9.4 29.6 11C28.4 13 31.4 13.9 32.4 14.3C33.8 14.9 35.6 15.9 34.4 18.2C33.4 20 29.8 19.7 28.6 18.4M32 8.4V21.6' }, bill);
    for (const [cx, cy] of [[9.5, 9], [54.5, 9], [9.5, 21], [54.5, 21]]) svg('circle', { class: 'ih-bill-corner', cx, cy, r: 2.4 }, bill);
    const arts = Array.from({ length: count }, () => {
      const art = svg('svg', { class: 'ih-bill', viewBox: '0 0 64 30', width: 64, height: 30, 'aria-hidden': 'true' }, node);
      svg('use', { href: `#${id}` }, art);
      return art;
    });
    // Outside its flight window a layer hides every bill once, so none is
    // left unposed in the corner or frozen where a seek left it.
    let parked = false;
    const park = (active) => {
      if (active) parked = false;
      else if (!parked) {
        for (const art of arts) art.style.opacity = '0';
        parked = true;
      }
      return active;
    };
    return { node, arts, park };
  }

  function poseBill(art, x, y, rotate, scale, opacity) {
    art.style.opacity = opacity.toFixed(2);
    art.style.transform = `translate(${(x - 32).toFixed(1)}px, ${(y - 15).toFixed(1)}px) rotate(${rotate.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
  }

  /**
   * Money spent on memory: from `at`, `count` bills fly in from off stage
   * and shrink into the slot `into` = { x, y, w, h } (the core-memory bed),
   * which glows brighter as it fills. At `refundAt` a few bills (`dropCount`)
   * fall out of the bottom of the slot and drop off the stage: some of the
   * money was not needed after all. With reduced motion the bills stay
   * hidden and only the glow fills and dims a little.
   */
  function cashIntoMemory(parent, { into, count = 36, at, spread = 2, refundAt, dropCount = 7, until }) {
    const glow = place(el('div', 'ih-core-glow', parent), into.x, into.y);
    glow.style.width = `${into.w}px`;
    glow.style.height = `${into.h}px`;
    const { node, arts, park } = billLayer(parent, count, 'green');
    const tx = into.x + into.w / 2, ty = into.y + into.h / 2;
    const bills = arts.map((art, i) => {
      // Start off stage, to the right of and below the mainframe.
      const angle = (-70 + 180 * hash01(i * 31 + 7)) * Math.PI / 180;
      const reach = 470 + 160 * hash01(i * 17 + 3);
      return {
        art,
        sx: tx + Math.cos(angle) * reach, sy: ty + Math.sin(angle) * reach,
        bend: (hash01(i * 23 + 1) - 0.5) * 180,
        spin: (hash01(i * 29 + 6) - 0.5) * 720,
        inAt: at + hash01(i * 13 + 2) * spread,
        inFor: 1 + hash01(i * 19 + 4) * 0.35,
        refunded: refundAt !== undefined && i % Math.max(1, Math.floor(count / dropCount)) === 0 && i / Math.max(1, Math.floor(count / dropCount)) < dropCount,
        outAt: (refundAt ?? 0) + hash01(i * 37 + 8) * 0.7,
        dropX: (hash01(i * 43 + 2) - 0.5) * into.w * 0.8,
        drift: (hash01(i * 47 + 5) - 0.5) * 60,
        tumble: (hash01(i * 53 + 1) - 0.5) * 360,
      };
    });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // A point on the curved path from the start (p = 0) into the slot (p = 1).
    const along = (b, p) => {
      const nx = -(ty - b.sy), ny = tx - b.sx, len = Math.hypot(nx, ny) || 1;
      const arc = Math.sin(p * Math.PI) * b.bend;
      return [b.sx + (tx - b.sx) * p + (nx / len) * arc, b.sy + (ty - b.sy) * p + (ny / len) * arc];
    };
    const activeTo = until ?? Infinity;
    onFrame((t) => {
      if (!park(t >= at - 0.2 && t <= activeTo)) return;
      let inside = 0;
      for (const b of bills) {
        let p = 0, visible = false;
        if (t >= b.inAt) {
          const q = progress(t, b.inAt, b.inFor);
          p = q * q;  // speeds up as it is pulled into the slot
          visible = q < 1;
          if (q >= 1) inside += 1;
        }
        if (b.refunded && t >= b.outAt) {
          // Slips out of the bottom of the core and falls off the stage.
          inside -= 1;
          const age = t - b.outAt;
          const py = ty + into.h / 2 + 260 * age * age;
          if (py > 600 || reducedMotion.matches) { b.art.style.opacity = '0'; continue; }
          const grow = Math.min(1, age / 0.5);
          poseBill(b.art, tx + b.dropX + b.drift * age + 8 * Math.sin(age * 9), py, b.tumble * age + 14 * Math.sin(age * 7), 0.2 + 0.6 * grow, Math.min(1, age / 0.08));
          continue;
        }
        if (!visible || reducedMotion.matches) { b.art.style.opacity = '0'; continue; }
        const [px, py] = along(b, p);
        poseBill(b.art, px, py, b.spin * (1 - p), 1 - 0.82 * p, p > 0.85 ? (1 - p) / 0.15 : 1);
      }
      glow.style.opacity = (0.9 * Math.max(0, inside) / count).toFixed(3);
    });
    return node;
  }

  /**
   * Money flying away: from `at` to `until`, `count` bills burst out from
   * behind (x, y) in every direction, tumbling as they leave the frame.
   * Reduced motion shows nothing moving.
   */
  function cashBurst(parent, { x, y, count = 200, at, until, tone = 'red' }) {
    const { node, arts, park } = billLayer(parent, count, tone);
    const span = Math.max(0.5, until - at - 1.1);
    const bills = arts.map((art, i) => {
      const angle = hash01(i * 31 + 7) * Math.PI * 2;
      const speed = 280 + 300 * hash01(i * 17 + 3);
      return {
        art, angle, speed,
        ox: (hash01(i * 23 + 1) - 0.5) * 300, oy: (hash01(i * 41 + 5) - 0.5) * 160,
        launch: at + hash01(i * 13 + 2) * span,
        spin: (hash01(i * 29 + 6) - 0.5) * 1100,
        tilt: (hash01(i * 11 + 9) - 0.5) * 60,
      };
    });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Bills launched last keep flying after `until`, so a scene that fades
    // out over them never freezes them mid-air.
    onFrame((t) => {
      if (!park(t >= at - 0.2 && t <= until + 3.2)) return;
      for (const b of bills) {
        const age = t - b.launch;
        if (age < 0 || age > 3 || reducedMotion.matches) { b.art.style.opacity = '0'; continue; }
        // Thrown outward, then carried up and away by a draft.
        const px = x + b.ox + Math.cos(b.angle) * b.speed * age + 30 * age * age;
        const py = y + b.oy + Math.sin(b.angle) * b.speed * age - 70 * age * age;
        poseBill(b.art, px, py, b.tilt + b.spin * 0.55 * age, 0.8 + 0.35 * Math.min(1, age / 0.6), Math.min(1, age / 0.08));
      }
    });
    return node;
  }

  // ------------------------------------------------------------------
  // Bugs: a ladybird that crawls in, and the rubber stamp that squashes it
  // ------------------------------------------------------------------

  // Points on the ladybird's outline (leg and feeler tips, head, shell, and
  // shadow) in its own frame, head up, for finding its extent once turned;
  // and its shell's centre.
  const BUG_OUTLINE = [
    [48.6, 9.8], [54.8, 36.8], [50.2, 57.4], [15.4, 9.8], [9.2, 36.8], [13.8, 57.4], [42.5, 4], [21.5, 4],
    [32, 10.8], [18, 38], [46, 38], [32, 58.2], [33.4, 59.2], [16.8, 40.6], [50, 40.6],
  ];
  const BUG_SHELL_CENTRE = [32, 40.8];

  /**
   * A ladybird, seen from above, in a 64×64 box, turned `rotate` degrees from
   * head up: a glossy red shell of two wing cases with seven spots, the
   * black shield behind its head with white patches, round eyes with
   * catchlights, clubbed feelers, and six jointed legs. It crawls in from
   * `from` over 0.9 s, legs scurrying, then idles (feelers twitch, legs
   * shift). Reduced motion stills its legs and feelers.
   *
   * Returns { node, footprint, pressedBy }. footprint is where it rests, in
   * stage px: its shell's centre x, its top and floor (its highest and
   * lowest points), and how thin it is once squashed. pressedBy(padAt,
   * landAt) puts it under a stamp: padAt(t) is the pad's bottom edge (stage
   * y) at song time t. From the moment the pad meets its back, the bug
   * flattens onto its floor with its top edge under the pad, spreading as
   * it flattens, and it lies flat from `landAt` on.
   */
  function bug(parent, { x, y, at, until, size = 64, rotate = 0, from }) {
    const id = `ih-bug-${++uid}`;
    const node = art(parent, { x, y, w: size, h: size, viewBox: '0 0 64 64' });
    const P = (g, cls, d, attrs = {}) => svg('path', { class: cls, d, ...attrs }, g);
    const defs = svg('defs', {}, node);
    // The shell's lacquer, lit from the upper left.
    const lacquer = svg('radialGradient', { id: `${id}-shell`, cx: 0.34, cy: 0.3, r: 0.8 }, defs);
    for (const [index, offset] of ['0', '0.55', '1'].entries()) svg('stop', { offset, class: `ih-bug-shell-stop-${index}` }, lacquer);
    // It flattens in the stage's axes, down onto its floor; it is turned
    // inside that, and everything squashes together, its shadow too.
    const squash = svg('g', {}, node);
    const body = svg('g', { transform: `rotate(${rotate} 32 32)` }, squash);
    svg('ellipse', { class: 'ih-bug-ground', cx: 33.4, cy: 40.6, rx: 16.6, ry: 18.6 }, body);
    // Legs: femur, knee, shin, and foot, each pair mirrored about the middle.
    const legs = [];
    for (const side of [-1, 1]) {
      const pair = svg('g', { transform: `translate(32 0) scale(${side} 1) translate(-32 0)` }, body);
      for (const [k, [hip, d]] of [
        [[36, 25], 'M36 25 L43.4 19.6 L46.6 11.6 L48.6 9.8'],
        [[38.4, 33.6], 'M38.4 33.6 L47.6 31.4 L52.4 35.6 L54.8 36.8'],
        [[37.6, 42], 'M37.6 42 L45.8 46.8 L48.6 54.6 L50.2 57.4'],
      ].entries()) {
        const g = svg('g', {}, pair);
        P(g, 'ih-bug-leg', d);
        P(g, 'ih-bug-leg-light', d);
        legs.push({ g, side, k, hip });
      }
    }
    const feelers = [-1, 1].map((side) => {
      const g = svg('g', { transform: `translate(32 0) scale(${side} 1) translate(-32 0)` }, body);
      const twitch = svg('g', {}, g);
      P(twitch, 'ih-bug-antenna', 'M34.2 12 C35.4 8.6 37.8 6.2 40.8 5.4');
      svg('circle', { class: 'ih-bug-antenna-tip', cx: 41.2, cy: 5.3, r: 1.3 }, twitch);
      return twitch;
    });
    // Head with round, friendly eyes.
    P(body, 'ih-bug-head', 'M25.6 19.4 C25.2 14.2 28.2 10.8 32 10.8 C35.8 10.8 38.8 14.2 38.4 19.4 Z');
    for (const side of [-1, 1]) {
      svg('ellipse', { class: 'ih-bug-eye', cx: 32 + side * 3.6, cy: 15, rx: 2.2, ry: 2.5 }, body);
      svg('circle', { class: 'ih-bug-pupil', cx: 32 + side * 3.3, cy: 15.6, r: 1.25 }, body);
      svg('circle', { class: 'ih-bug-catchlight', cx: 32 + side * 3.3 + 0.5, cy: 15, r: 0.5 }, body);
    }
    // The black shield behind the head, with its white patches.
    P(body, 'ih-bug-shield', 'M21.4 24.8 C21.2 20.4 25.8 17.8 32 17.8 C38.2 17.8 42.8 20.4 42.6 24.8 C38.6 26.6 25.4 26.6 21.4 24.8 Z');
    P(body, 'ih-bug-patch', 'M22.6 23.8 C22.5 21.8 23.8 20.3 25.8 19.6 C25.3 21.2 25.3 23 25.9 24.7 C24.6 24.6 23.5 24.3 22.6 23.8 Z M41.4 23.8 C41.5 21.8 40.2 20.3 38.2 19.6 C38.7 21.2 38.7 23 38.1 24.7 C39.4 24.6 40.5 24.3 41.4 23.8 Z');
    // Two wing cases meeting down the middle, each shaded at its far edge.
    const shell = svg('g', {}, body);
    P(shell, 'ih-bug-body', 'M32 23.4 C24.4 23.2 18.2 28.8 18 38 C17.8 47.6 23.6 56.4 32 58.2 C40.4 56.4 46.2 47.6 46 38 C45.8 28.8 39.6 23.2 32 23.4 Z', { fill: `url(#${id}-shell)` });
    P(shell, 'ih-bug-shadow', 'M41.4 27.4 C45.4 32 46.6 40.6 44.2 47.4 C41.8 53.4 37.4 57 32.6 58 L32.6 56.2 C37 54.8 40.6 50.8 42.2 45.6 C43.8 40.2 43.4 32.8 41.4 27.4 Z');
    P(shell, 'ih-bug-shadow ih-bug-shadow--soft', 'M31.4 56.8 C26.8 55.6 22.8 52 20.6 47 C22.8 50.6 26.6 53.6 31.4 54.6 Z');
    for (const [cx, cy, r] of [[32, 26.8, 2.7], [25.4, 33.4, 3], [38.6, 33.4, 3], [23.4, 44.6, 2.6], [40.6, 44.6, 2.6], [28.4, 51.2, 2.2], [35.6, 51.2, 2.2]]) {
      svg('circle', { class: 'ih-bug-spot', cx, cy, r }, shell);
      svg('circle', { class: 'ih-bug-spot-light', cx: cx - r * 0.35, cy: cy - r * 0.4, r: r * 0.32 }, shell);
    }
    P(shell, 'ih-bug-shell-line', 'M32 24.2 C31.8 36 31.8 47.4 32 57.4');
    P(shell, 'ih-bug-seam-light', 'M33.2 26.4 C33 37 33 46.8 33.2 55.4');
    P(shell, 'ih-bug-shine', 'M21.4 35.6 C21.4 30.6 24.4 27 28 26 C25.8 28.6 24.6 31.8 24.2 35.6 C23.6 37 21.8 37 21.4 35.6 Z');
    P(shell, 'ih-bug-shine-line', 'M36.6 26.4 C39 26.8 41 28.2 42.2 30.4');
    show(node, at, until, { from: 0.3 });

    // Where it rests: its outline turned by `rotate`, in box units, then in
    // stage px.
    const turn = (rotate * Math.PI) / 180;
    const turned = ([px, py]) => [
      32 + Math.cos(turn) * (px - 32) - Math.sin(turn) * (py - 32),
      32 + Math.sin(turn) * (px - 32) + Math.cos(turn) * (py - 32),
    ];
    const heights = BUG_OUTLINE.map((point) => turned(point)[1]);
    const topY = Math.min(...heights), floorY = Math.max(...heights);
    const [centreX] = turned(BUG_SHELL_CENTRE);
    const FLAT = 4;  // its thickness squashed, in box units
    const unit = size / 64;
    const footprint = { x: x + centreX * unit, top: y + topY * unit, floor: y + floorY * unit, flat: FLAT * unit };
    let press = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // How flat it is under the stamp, 0 (untouched) to 1 (flat): its top
    // edge follows the pad down from where they meet to the floor.
    const flattened = (t) => {
      if (!press) return 0;
      if (t >= press.landAt) return 1;
      if (reducedMotion.matches) return 0;
      const pad = press.padAt(t);
      return Math.min(1, Math.max(0, (pad - footprint.top) / (footprint.floor - footprint.flat - footprint.top)));
    };
    onFrame((t) => {
      const flat = flattened(t);
      const sy = 1 - flat * (1 - FLAT / (floorY - topY));
      squash.setAttribute('transform', flat > 0
        ? `translate(${centreX.toFixed(2)} ${floorY.toFixed(2)}) scale(${(1 + 0.4 * flat).toFixed(3)} ${sy.toFixed(3)}) translate(${(-centreX).toFixed(2)} ${(-floorY).toFixed(2)})`
        : '');
      const still = reducedMotion.matches || t < at || flat > 0;
      // Scurrying while it travels, then only small shifts of weight.
      const scurry = from ? 1 - progress(t, at + 0.75, 0.3) : 0.35;
      legs.forEach(({ g, side, k, hip }) => {
        const phase = t * 16 + k * 2.1 + (side > 0 ? Math.PI : 0);
        const swing = still ? 0 : 13 * scurry * Math.sin(phase) + 2.5 * (1 - scurry) * Math.sin(t * 2.3 + k * 1.7 + side);
        g.setAttribute('transform', `rotate(${swing.toFixed(1)} ${hip[0]} ${hip[1]})`);
      });
      feelers.forEach((g, i) => {
        const twitch = still ? 0 : 7 * Math.sin(t * 5.3 + i * 1.9) * Math.max(0, Math.sin(t * 1.3 + i));
        g.setAttribute('transform', `rotate(${twitch.toFixed(1)} 34.2 12)`);
      });
      if (from) {
        const p = easeInOutCubic(progress(t, at, 0.9));
        node.style.translate = `${((from[0] - x) * (1 - p)).toFixed(1)}px ${((from[1] - y) * (1 - p)).toFixed(1)}px`;
      }
    });
    return { node, footprint, pressedBy: (padAt, landAt) => { press = { padAt, landAt }; } };
  }

  /**
   * A rubber stamp brought down on `onto`, a bug(): pushed down from above,
   * it speeds up all the way, meets the bug's back, flattens it onto its
   * floor, and stops dead there at `at` with a slight rebound. It holds a
   * moment, then lifts away and fades. The pad's bottom edge is a pure
   * function of song time, and the bug flattens under it. With reduced
   * motion the stamp appears pressed home at `at` and fades without moving.
   */
  function stampTool(parent, { onto, at, label = 'FIXED' }) {
    const { x, top, floor, flat } = onto.footprint;
    // The pad's bottom edge pressed home, on the squashed bug.
    const home = floor - flat;
    const node = art(parent, { x: x - 45, y: home - 102, w: 90, h: 120, viewBox: '0 0 90 120' });
    svg('ellipse', { class: 'ih-stamp-knob', cx: 45, cy: 16, rx: 16, ry: 12 }, node);
    svg('rect', { class: 'ih-stamp-neck', x: 39, y: 24, width: 12, height: 40 }, node);
    svg('rect', { class: 'ih-stamp-block', x: 14, y: 62, width: 62, height: 30, rx: 4 }, node);
    svg('rect', { class: 'ih-stamp-rubber', x: 16, y: 92, width: 58, height: 10, rx: 2 }, node);
    const text = svg('text', { class: 'ih-stamp-label', x: 45, y: 82, 'text-anchor': 'middle' }, node);
    text.textContent = label;
    const DROP = 0.3, HOLD = 0.32, LIFT = 0.45;
    // It starts 70 px above the bug's back.
    const height = home - top + 70;
    const padAt = (t) => {
      if (t < at) return home - height * (1 - progress(t, at - DROP, DROP) ** 2);
      return home - 2.5 * Math.sin(Math.PI * progress(t, at, 0.14)) - 110 * easeInOutCubic(progress(t, at + HOLD, LIFT));
    };
    onto.pressedBy(padAt, at);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    onFrame((t) => {
      const reduced = reducedMotion.matches;
      node.style.translate = `0 ${(reduced ? 0 : padAt(t) - home).toFixed(1)}px`;
      const shown = reduced ? progress(t, at, 0.15) : progress(t, at - DROP, 0.06);
      const gone = progress(t, at + HOLD + 0.15, LIFT - 0.15);
      node.style.opacity = (shown * (1 - gone)).toFixed(3);
    });
    return node;
  }

  // ------------------------------------------------------------------
  // A grid of small case files (the programs or files a change touches)
  // ------------------------------------------------------------------

  /**
   * names in a grid of small manila files. tag = text of a red tab every
   * file carries from tagAt (a copied secret). light(at, indices, { tone,
   * stamp }) marks the files a change touches: tone = hit (red) | change
   * (gold) | good (green), with an optional rubber-stamp word.
   */
  function grid(parent, { x, y, cols, cellW = 150, cellH = 40, gap = 10, names, at, step = 0.04, until, tag, tagAt, tagStep = 0.06 }) {
    const cells = names.map((name, i) => {
      const cell = place(el('div', 'ih-cell is-staged', parent), x + (i % cols) * (cellW + gap), y + Math.floor(i / cols) * (cellH + gap));
      cell.style.width = `${cellW}px`;
      cell.style.height = `${cellH}px`;
      el('span', 'ih-cell-tab', cell);
      el('span', 'ih-cell-name', cell, name);
      if (tag) {
        const chip = el('span', 'ih-cell-secret is-staged', cell);
        chip.append(icon('lock'));
        chip.append(document.createTextNode(tag));
        fx.pop(chip, tagAt + i * tagStep, { from: 1.8, rotate: -6 });
      }
      fx.pop(cell, at + i * step, { from: 0.7 });
      if (until !== undefined) fx.fadeOut(cell, until, 0.25);
      return cell;
    });
    return {
      cells,
      light(when, indices, { tone = 'hit', until: gone, step: s = 0.05, stamp } = {}) {
        indices.forEach((index, k) => {
          const t0 = when + k * s;
          during(cells[index], `is-${tone}`, t0, gone);
          if (stamp) {
            const mark = el('span', `ih-cell-stamp ih-cell-stamp--${tone} is-staged`, cells[index], stamp);
            fx.slam(mark, t0, { from: 2, rotate: -8 });
            if (gone !== undefined) fx.fadeOut(mark, gone, 0.2);
          }
        });
        return this;
      },
    };
  }

  // ------------------------------------------------------------------
  // The vault: a module whose nameplate (what) hides its contents (how)
  // ------------------------------------------------------------------

  /**
   * One module drawn as a steel vault. Its brass nameplate is the interface
   * (what callers may read, gold); an X-ray window shows the secret inside
   * (how it keeps that promise, blue). hows = [{ at, text }] changes the
   * secret: the dial spins and the new secret decrypts in place; the
   * nameplate never changes.
   */
  function vault(parent, { x, y, w = 440, name, what, hows, at, whatAt, howAt, until }) {
    const node = place(el('div', 'ih-vault is-staged', parent), x, y);
    node.style.width = `${w}px`;
    for (const corner of ['tl', 'tr', 'bl', 'br']) el('span', `ih-vault-rivet ih-vault-rivet--${corner}`, node);
    const head = el('div', 'ih-vault-head', node);
    head.append(icon(SERVICE_ICONS[name] || 'box'));
    el('span', 'ih-module-name', head, name);
    el('span', 'ih-vault-class', head, 'Module');
    const dial = svg('svg', { class: 'ih-vault-dial', viewBox: '-50 -50 100 100', width: 96, height: 96, 'aria-hidden': 'true' }, node);
    svg('circle', { class: 'ih-dial-ring', r: 46 }, dial);
    const face = svg('g', {}, dial);
    svg('circle', { class: 'ih-dial-face', r: 36 }, face);
    for (let i = 0; i < 24; i++) svg('line', { class: 'ih-dial-tick', x1: 0, y1: -36, x2: 0, y2: i % 6 ? -31 : -27, transform: `rotate(${i * 15})` }, face);
    svg('circle', { class: 'ih-dial-knob', r: 14 }, face);
    svg('line', { class: 'ih-dial-pointer', x1: 0, y1: -12, x2: 0, y2: -22 }, face);
    svg('path', { class: 'ih-dial-mark', d: 'M-4 -48 L4 -48 L0 -41 Z' }, dial);
    const handle = svg('svg', { class: 'ih-vault-handle', viewBox: '0 0 20 90', width: 20, height: 90, 'aria-hidden': 'true' }, node);
    svg('rect', { x: 6, y: 0, width: 8, height: 90, rx: 4 }, handle);
    const plate = el('div', 'ih-vault-plate', node);
    const whatTag = el('div', 'ih-vault-tag ih-vault-tag--what is-staged', plate);
    whatTag.append(icon('eye'));
    whatTag.append(document.createTextNode('What · the interface'));
    el('div', 'ih-vault-what', plate, what);
    const windowNode = el('div', 'ih-vault-window', node);
    const howTag = el('div', 'ih-vault-tag ih-vault-tag--how is-staged', windowNode);
    howTag.append(icon('lock'));
    howTag.append(document.createTextNode('How · the secret'));
    const howRow = el('div', 'ih-vault-how', windowNode);
    howRow.append(icon('envelope'));
    const steps = [...hows].sort((a, b) => a.at - b.at);
    steps.forEach((step, i) => {
      const span = el('span', 'ih-vault-secret', howRow);
      decrypt(span, step.text, i ? step.at : -1, { cps: 40, seed: 77 + i });
      const next = steps[i + 1];
      onFrame((t) => { span.hidden = t < (i ? step.at : -Infinity) || (next && t >= next.at); });
    });
    onFrame((t) => {
      let angle = 12 * Math.sin(t * 0.8);
      for (const step of steps.slice(1)) angle += 540 * easeInOutCubic(progress(t, step.at - 0.45, 0.8));
      face.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
    });
    for (const step of steps.slice(1)) fx.bump(windowNode, step.at, 0.05);
    fx.pop(whatTag, whatAt ?? at, { from: 0.6, rotate: -2 });
    fx.pop(howTag, howAt ?? at, { from: 0.6, rotate: 2 });
    fx.rise(node, at, { distance: 18, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return {
      node,
      /** A check on the nameplate: the interface stayed the same. */
      keep(when, text = 'kept') {
        const tag = el('div', 'ih-verdict ih-verdict--ok ih-vault-keep is-staged', plate);
        tag.append(icon('check'));
        tag.append(document.createTextNode(text));
        show(tag, when, undefined, { rotate: 4, from: 1.5 });
        return tag;
      },
      light(when, gone) {
        const glow = el('div', 'ih-module-glow is-staged', node);
        tween(glow, [{ opacity: 0 }, { opacity: 1 }], when, 0.18, EASE.out);
        fx.bump(node, when, 0.04);
        if (gone !== undefined) tween(glow, { opacity: 0 }, gone, 0.3, EASE.in);
      },
    };
  }

  // ------------------------------------------------------------------
  // A sonar submarine that reveals what is below the waterline
  // ------------------------------------------------------------------

  function submarineBody(node) {
    const id = `ih-sub-${++uid}`;
    const defs = svg('defs', {}, node);
    // Keep the cylindrical lighting attached to each surface as the boat moves.
    for (const [material, x2, y2, stops] of [
      ['gold', '0%', '100%', ['0%', '22%', '55%', '100%']],
      ['metal', '100%', '0%', ['0%', '28%', '62%', '100%']],
      ['glass', '100%', '100%', ['0%', '35%', '70%', '100%']],
    ]) {
      const gradient = svg('linearGradient', { id: `${id}-${material}`, x1: '0%', y1: '0%', x2, y2 }, defs);
      stops.forEach((offset, i) => svg('stop', { offset, class: `ih-sub-${material}-stop-${i}` }, gradient));
      node.style.setProperty(`--ih-sub-${material}`, `url(#${id}-${material})`);
    }
    const rings = svg('g', {}, node);
    const ringNodes = [0, 1, 2].map(() => svg('circle', { class: 'ih-sonar', cx: 10, cy: 48, r: 4 }, rings));
    // The conning tower with its hatch, a porthole, and rivets; the
    // periscope with its lens.
    svg('rect', { class: 'ih-sub-hatch', x: 70, y: 15, width: 14, height: 4, rx: 1.5 }, node);
    svg('rect', { class: 'ih-sub-tower', x: 64, y: 18, width: 26, height: 20, rx: 6 }, node);
    svg('circle', { class: 'ih-sub-tower-port', cx: 71.6, cy: 26.6, r: 2.6 }, node);
    svg('path', { class: 'ih-sub-highlight', d: 'M67.4 22.4 Q68.6 20.4 71.4 20.2' }, node);
    for (const rx of [68.4, 74.6, 80.8, 87]) svg('circle', { class: 'ih-sub-rivet', cx: rx, cy: 33.6, r: 0.75 }, node);
    svg('path', { class: 'ih-sub-scope', d: 'M80 18 V4 H92' }, node);
    svg('rect', { class: 'ih-sub-scope-lens', x: 90.6, y: 1.4, width: 4, height: 5.2, rx: 1.2 }, node);
    svg('path', { class: 'ih-sub-fin', d: 'M114 36 L131 25 L127 45 L132 70 L113 60 Z' }, node);
    svg('path', { class: 'ih-sub-seam', d: 'M118.4 38.4 L126.8 45 M118 57.6 L127.4 52.4' }, node);
    // The hull: plates with their seams and rivets, a band along the
    // waterline, a light along the top, and the keel's shadow.
    svg('rect', { class: 'ih-sub-hull', x: 14, y: 34, width: 120, height: 30, rx: 15 }, node);
    svg('path', { class: 'ih-sub-band', d: 'M16.6 55.4 H131.4 V58.4 Q131 59.4 129.6 59.4 H18.4 Q17 59.4 16.6 58.4 Z' }, node);
    svg('path', { class: 'ih-sub-seam', d: 'M31 34.6 V63.4 M57 34.2 V63.8 M83 34.2 V63.8 M109 34.2 V63.8' }, node);
    for (const rx of [24, 36, 51, 63, 77, 89, 103, 115, 125]) svg('circle', { class: 'ih-sub-rivet', cx: rx, cy: 37.6, r: 0.7 }, node);
    svg('path', { class: 'ih-sub-highlight', d: 'M24 38.6 Q74 35.6 124 38.6' }, node);
    svg('path', { class: 'ih-sub-keel', d: 'M26 62.2 Q74 64.6 122 62.2' }, node);
    for (const px of [44, 70, 96]) {
      svg('circle', { class: 'ih-sub-port-rim', cx: px, cy: 49, r: 6.5 }, node);
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * 2 * Math.PI + 0.5;
        svg('circle', { class: 'ih-sub-bolt', cx: (px + 5.6 * Math.cos(a)).toFixed(2), cy: (49 + 5.6 * Math.sin(a)).toFixed(2), r: 0.5 }, node);
      }
      svg('circle', { class: 'ih-sub-port', cx: px, cy: 49, r: 4.5 }, node);
      svg('path', { class: 'ih-sub-glass', d: `M${px - 2} 50 l3 -3` }, node);
    }
    // The propeller on its shaft and hub.
    svg('path', { class: 'ih-sub-shaft', d: 'M132.6 49 H137' }, node);
    const prop = svg('g', { transform: 'translate(138 49)' }, node);
    svg('path', { class: 'ih-sub-prop', d: 'M0 -11 L4 0 L0 11 L-4 0 Z' }, prop);
    svg('circle', { class: 'ih-sub-hub', cx: 138, cy: 49, r: 2.2 }, node);
    return { prop, ringNodes };
  }

  function submarine(parent, { x, y, at, until, pingFrom }) {
    const node = art(parent, { x, y, w: 150, h: 80, viewBox: '0 0 150 80' });
    const { prop, ringNodes } = submarineBody(node);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    onFrame((t) => {
      const motionTime = reducedMotion.matches ? 0 : t;
      prop.setAttribute('transform', `translate(138 49) scale(1 ${Math.cos(motionTime * 9).toFixed(2)})`);
      ringNodes.forEach((ring, i) => {
        const age = t - (pingFrom ?? at) - i * 0.9;
        const p = reducedMotion.matches || age < 0 ? -1 : (age % 2.7) / 2.7;
        ring.setAttribute('r', p < 0 ? '0' : (6 + p * 120).toFixed(1));
        ring.setAttribute('opacity', p < 0 ? '0' : (0.55 * (1 - p)).toFixed(2));
      });
      node.style.translate = `0 ${(3 * Math.sin(motionTime * 1.1)).toFixed(1)}px`;
    });
    show(node, at, until, { from: 0.6 });
    return node;
  }

  /** A paper slip sliding out of `parent` along (dx, dy): something that leaks. */
  function slip(parent, { x, y, text, at, dx, dy, rotate = 12 }) {
    const node = place(el('div', 'ih-slip is-staged', parent), x, y);
    node.append(icon('file'));
    node.append(document.createTextNode(text));
    tween(node, [
      { opacity: 0, translate: '0 0', rotate: '0deg' },
      { opacity: 1, translate: `${dx * 0.2}px ${dy * 0.2}px`, rotate: `${rotate / 3}deg`, offset: 0.25 },
      { opacity: 1, translate: `${dx}px ${dy}px`, rotate: `${rotate}deg` },
    ], at, 0.9, EASE.out);
    return node;
  }

  // ------------------------------------------------------------------
  // The spy-film ending: an iris that closes on the hero
  // ------------------------------------------------------------------

  /**
   * A black stage-sized mask with a circular opening centred on (cx, cy)
   * that shrinks from `startR` to 0 over [from, to]. One smooth darkening,
   * never a flash (WCAG 2.3.1). A thin gold ring traces the opening.
   */
  function iris(parent, { cx, cy, from, to, startR = 640 }) {
    const node = svg('svg', { class: 'ih-iris', viewBox: '0 0 960 540', 'aria-hidden': 'true' }, parent);
    const mask = svg('path', { class: 'ih-iris-mask', 'fill-rule': 'evenodd' }, node);
    const ring = svg('circle', { class: 'ih-iris-ring', cx, cy }, node);
    onFrame((t) => {
      if (t < from) {
        node.style.display = 'none';
        return;
      }
      node.style.display = '';
      const r = startR * (1 - easeInOutCubic(progress(t, from, to - from)));
      mask.setAttribute('d', `M-10 -10H970V550H-10Z M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z`);
      ring.setAttribute('r', Math.max(0, r).toFixed(1));
      ring.setAttribute('opacity', r > 2 ? '1' : '0');
    });
    return node;
  }

  window.InfoHidingKit = {
    latest, show, during, note, heading, paper, list, bubble, publicTag, implementsLink, spyCaper, digits, clock, counter, cashIntoMemory, cashBurst, agingPerson, apolloCount,
    apolloPortrait, car, overflowingHead, steps, systemSplit, calendar, iceberg, toggle, waterline, outlet, dossier,
    decrypt, module, envelope, courier, laser, spotlight, lamp, agent, armReach, armVia, transmission, code, search,
    contractExchange, changeImpactGraph, mainframeMemory, stringWeb, mud, bug, stampTool, grid, vault, submarine, slip, iris,
  };
})();
