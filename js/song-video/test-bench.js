/*
 * The "test bench" stage theme, for lessons on testing and quality
 * assurance: a page of a lab notebook lying open on a laboratory bench. A
 * test is a small experiment (state what you expect, run it, record what
 * you observe), so the lesson is drawn on the page where experiments are
 * written down: graph paper with a red margin line and three punched holes
 * that show the bench beneath. Faint ink sketches on the page record
 * earlier experiments: a flask clamped to a stand with two notes, a results
 * table whose third check failed, and a plot of observed points along a
 * dashed expected line, with the one point that missed it circled. The
 * sketches are all in one faint ink, so none of their ticks or crosses
 * reads as a verdict on the lesson's words.
 *
 * The only color lies at the page's right edge, where the lesson's pictures
 * rarely reach: a petri dish whose colonies grew green, all but one red;
 * three stoppered test tubes of red, green, and blue liquid (the colors of
 * the red-green-refactor cycle); and a pH test strip beside the color key
 * it is read against, the way a test's result is read against what it
 * expects. A desk lamp lights the page from the upper left.
 *
 * Storyboards select it with `theme: test-bench`; css/song-video-test-bench.css
 * holds its look, and css/video-narration-stage.css its light palette (also
 * used in print). The backdrop holds still: nothing moves, and nothing large
 * changes brightness (WCAG 2.3.1). Its linework is faint on purpose, so it
 * never competes with the words and pictures on top of it. Its drawing is
 * flat lines and fills with no ids or paint servers, one path per paint, so
 * the notes' copies of the stage (one per cue) stay valid and light; only
 * the paper's lamp light and darker edges are CSS gradients.
 */
(function () {
  'use strict';

  const { el, svg } = window.SongKit;
  const W = 960;
  const H = 540;
  const round = (value) => +value.toFixed(1);

  /** Graph-paper rulings every `step` px across the page, leaving out multiples of `skip`. */
  function rulings(step, skip = 0) {
    const lines = [];
    for (let x = step; x < W; x += step) if (!skip || x % skip) lines.push(`M${x} 0V${H}`);
    for (let y = step; y < H; y += step) if (!skip || y % skip) lines.push(`M0 ${y}H${W}`);
    return lines.join('');
  }

  /**
   * Moves path data drawn around its own origin to (dx, dy): absolute
   * commands shift, relative ones follow. Each sketch is drawn in its own
   * coordinates, yet all shapes of one ink share one path, so the many
   * copies of the stage (one per cue in the notes) stay light.
   */
  function shift(d, dx, dy) {
    return d.replace(/([A-Za-z])([^A-Za-z]*)/g, (match, command, args) => {
      const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
      const moved = n.map((value, i) => {
        if ('MLQT'.includes(command)) return value + (i % 2 ? dy : dx);
        if (command === 'H') return value + dx;
        if (command === 'V') return value + dy;
        if (command === 'A' && i % 7 > 4) return value + (i % 7 === 5 ? dx : dy);
        return value;
      });
      return command + moved.map(round).join(' ');
    });
  }

  /** A wavy line that reads as handwriting, never as text; `seed` varies its rhythm. */
  function scribble(x, y, w, seed) {
    let d = `M${x} ${y}`;
    for (let s = 1; s <= 6; s += 1) {
      const lift = (s % 2 ? -1 : 1) * (1 + ((seed * 7 + s * 3) % 5) / 4);
      d += `L${round(x + (w * s) / 6)} ${round(y + lift)}`;
    }
    return d;
  }

  const circle = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const box = (x, y, w, h, r) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;

  /** The page's ruling: graph paper, a red margin line, and three punched holes. */
  function page(parent) {
    svg('path', { class: 'tb-rule', d: rulings(20, 100) }, parent);
    svg('path', { class: 'tb-rule tb-rule--major', d: rulings(100) }, parent);
    svg('path', { class: 'tb-margin', d: `M38 0V${H}M42 0V${H}` }, parent);
    svg('path', { class: 'tb-hole', d: [104, 270, 436].map((y) => circle(15, y, 8)).join('') }, parent);
  }

  /**
   * Ink sketches of earlier experiments: an Erlenmeyer flask clamped to a
   * stand with leader lines to two notes (top right); a results table of
   * four checks, the third crossed out as failed (bottom left); and observed
   * points along a dashed expected line, the one point that missed it
   * circled (bottom right). One path per stroke weight.
   */
  function sketches(parent) {
    let table = 'M0 0H178V100H0ZM82 0V100M140 0V100';
    let words = '';
    for (let r = 1; r < 5; r += 1) table += `M0 ${r * 20}H178`;
    for (let r = 0; r < 5; r += 1) words += scribble(9, r * 20 + 10, r ? 62 : 44, r + 1) + scribble(91, r * 20 + 10, r ? 38 : 30, r + 9);
    table += 'M152 30l5 5l9 -10M152 50l5 5l9 -10M152 90l5 5l9 -10M154 65l10 10M164 65l-10 10';
    const flask = 'M-74 0H98M66 0V-178M58 -178H74M66 -120H9M58 -126V-114M-9 -126V-86L-38 -12Q-42 0 -30 0H30Q42 0 38 -12L9 -86V-126M-13 -126H13';
    const flaskFine = `M-28 -34Q0 -29 28 -34M-22 -52h7M-26 -40h7M-30 -28h7M-34 -16h7M-20 -26L-64 -54M-6 -108L-64 -132${scribble(-152, -54, 82, 2)}${scribble(-152, -132, 82, 5)}`;
    const plot = `M0 0V-98M-4 -90L0 -98L4 -90M0 0H158M150 -4L158 0L150 4M0 -24h-5M0 -48h-5M0 -72h-5M36 0v5M72 0v5M108 0v5M91 -31l6 6m0 -6l-6 6${circle(94, -28, 9)}`;
    const points = [[22, -24], [46, -35], [70, -48], [120, -74], [138, -84]].map(([x, y]) => `M${x - 3} ${y - 3}l6 6m0 -6l-6 6`).join('');
    svg('path', { class: 'tb-ink', d: shift(flask, 804, 212) + shift(table, 70, 396) + shift(plot, 744, 494) }, parent);
    svg('path', { class: 'tb-ink tb-ink--fine', d: shift(flaskFine, 804, 212) + shift(words, 70, 396) + shift(points, 744, 494) }, parent);
    svg('path', { class: 'tb-ink tb-ink--dash', d: shift('M8 -14L146 -86', 744, 494) }, parent);
  }

  /** A petri dish in the top right corner: a culture whose colonies grew green, all but one red. */
  function petriDish(parent) {
    const [x, y] = [926, 34];
    const colonies = [[-14, -8, 4.5], [4, -20, 3], [-4, 10, 5.5], [17, 8, 3.5], [-21, 14, 3], [8, 24, 2.5], [-6, -28, 2.5]];
    svg('path', { class: 'tb-agar', d: circle(x, y, 36) }, parent);
    svg('path', { class: 'tb-glass', d: circle(x, y, 40) + circle(x, y, 36) }, parent);
    svg('path', { class: 'tb-colony tb-colony--green', d: colonies.map(([cx, cy, r]) => circle(x + cx, y + cy, r)).join('') }, parent);
    svg('path', { class: 'tb-colony tb-colony--red', d: circle(x + 20, y - 10, 4) }, parent);
    svg('path', { class: 'tb-glint', d: shift('M-28 -20A34 34 0 0 1 -10 -32', x, y) }, parent);
  }

  /**
   * Three stoppered test tubes lying side by side along the right edge, the
   * same slant for all, their liquids in the cycle's colors: red, green,
   * and blue. One path per paint across the three tubes.
   */
  function testTubes(parent) {
    const [w, length] = [15, 170];
    const r = w / 2;
    const inner = r - 1.6;
    const tubes = [{ x: 0, y: 0, color: 'red', fill: 0.5 }, { x: 19, y: 10, color: 'green', fill: 0.62 }, { x: 38, y: -6, color: 'blue', fill: 0.42 }];
    const g = svg('g', { class: 'tb-tubes', transform: 'translate(892 146) rotate(-4)' }, parent);
    tubes.forEach(({ x, y, color, fill }) => {
      const level = round(y + length * (1 - fill));
      const bottom = y + length - r;
      svg('path', { class: `tb-liquid tb-liquid--${color}`, d: `M${x + 1.6} ${level}Q${x + r} ${level + 3} ${x + w - 1.6} ${level}V${bottom}A${inner} ${inner} 0 0 1 ${x + 1.6} ${bottom}Z` }, g);
    });
    svg('path', { class: 'tb-glass', d: tubes.map(({ x, y }) => `M${x} ${y}V${y + length - r}A${r} ${r} 0 0 0 ${x + w} ${y + length - r}V${y}M${x - 2} ${y}H${x + w + 2}`).join('') }, g);
    svg('path', { class: 'tb-glint', d: tubes.map(({ x, y }) => `M${x + 3.8} ${y + 12}V${y + length - 16}`).join('') }, g);
    svg('path', { class: 'tb-stopper', d: tubes.map(({ x, y }) => box(x + 0.5, y - 15, w - 1, 17, 3)).join('') }, g);
  }

  /** A pH test strip, its pad turned green, beside the color key it is read against, red to violet. */
  function colorKey(parent) {
    const [x, y] = [934, 352];
    svg('path', { class: 'tb-strip', d: box(x - 22, y + 12, 7, 112, 1.5) }, parent);
    for (let i = 0; i < 7; i += 1) {
      const pad = i === 3 ? `M${x - 22} ${y + 108}h7v16h-7Z` : '';
      svg('path', { class: `tb-swatch tb-swatch--${i}`, d: box(x, y + i * 22, 15, 18, 2.5) + pad }, parent);
    }
  }

  function testBench(stage) {
    const layer = el('div', 'layer tb-room', stage);
    el('div', 'tb-paper', layer);
    const art = svg('svg', { class: 'tb-art', viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, layer);
    page(art);
    sketches(art);
    petriDish(art);
    testTubes(art);
    colorKey(art);
    el('div', 'tb-vignette', layer);
    return layer;
  }

  window.SongKit.themes['test-bench'] = { build: testBench };
})();
