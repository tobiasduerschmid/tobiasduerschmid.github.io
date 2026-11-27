/*
 * Artwork for the Layers video narration (choreography:
 * js/video-narration/layered-style.js; styles: css/video-narration-layered-
 * style.css). It builds on the wall kit, the UML kit, and the architecture
 * kit, and adds the lesson's own objects:
 *
 *   a layered design is a module view: each layer a UML package stereotyped
 *     «layer», its modules inside as small packages, stacked with the most
 *     abstract on top and the device's drivers at the bottom; the
 *     allowed-to-use relation is a dashed dependency arrow between them;
 *   an interface a lower layer defines is a box stereotyped «interface»;
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

  const { fx, onFrame, progress, easeInOutCubic, hash01 } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, icon } = kit;
  const wall = window.WallKit;
  const { staged } = wall;
  const arch = window.ArchKit;
  const uml = window.UmlKit;
  const { show } = arch;

  // ------------------------------------------------------------------
  // The module view: layers as packages
  // ------------------------------------------------------------------

  /** The space between one layer's body and the next layer's tab. */
  const LAYER_GAP = 10;

  /**
   * One layer: a UML package stereotyped «layer», with chips for the modules
   * inside it. `y` is its body's top; its tab stands above. states = [{ at,
   * state }] repaints it (changed, same, new, lit). `tone` thin draws it
   * without its contents (a small blank tab, the name inside); slim does the
   * same but keeps «layer» before the name; wrong edges it in red.
   */
  function floor(parent, { x, y, w, h = 54, name, items = [], at, until, how = 'rise', states = [], tone }) {
    // A thin layer leaves out the stereotype too, to fit a narrow stack.
    const blank = tone === 'thin' || tone === 'slim';
    return uml.pkg(parent, {
      x, y, w, h, name, stereotype: tone === 'thin' ? undefined : 'layer', items, states, at, until, how,
      tab: blank ? 'blank' : 'name', variant: tone === 'wide' ? 'wrong' : undefined,
    });
  }

  /**
   * A stack of layers from the top down (floors = [{ name, items, tone, at,
   * until, states, x, w }]): `y` is the top of the first layer's tab. A layer
   * may give its own `x` and `w`, so a straight arrow can pass beside a
   * shorter one. Returns the layers and their geometry: top(i) and bottom(i)
   * of each body, mid(i), left(i) and right(i), and the stack's height.
   * `thin` (or `slim`) draws every layer without its contents.
   */
  function building(parent, { x, y, w, floors, h = 54, gap = LAYER_GAP, at, until, step = 0.15, thin = false, slim = false }) {
    const tab = thin || slim ? uml.BLANK_TAB : uml.TAB;
    const pitch = tab + h + gap;
    const top = (i) => y + tab + i * pitch;
    const tone = slim ? 'slim' : thin ? 'thin' : undefined;
    const nodes = floors.map((spec, i) => floor(parent, {
      x, y: top(i), w, h, at: spec.at ?? at + 0.1 + i * step, until: spec.until ?? until, ...spec, tone: spec.tone ?? tone,
    }));
    const left = (i) => floors[i].x ?? x;
    return {
      floors: nodes, x, y, w, h, gap, tab, pitch,
      top, mid: (i) => top(i) + h / 2, bottom: (i) => top(i) + h,
      left, right: (i) => left(i) + (floors[i].w ?? w),
      height: floors.length * pitch - gap,
    };
  }

  // ------------------------------------------------------------------
  // Pearl Dash: the squirrel, the screen, and the devices
  // ------------------------------------------------------------------

  /*
   * The squirrel: a game sprite seen from the side, leaping up and to the
   * right toward the next pearl, lit by the moon at the upper right. Drawn
   * back to front: the tail plume, its far side in shade and a lit band
   * inside its curl; the far hind foot in shadow; body, head, and tufted ear
   * as one outline, with a lit back and crown and a cream chin, throat, and
   * chest; the near haunch, shin, and long hind foot; the near foreleg; then
   * the face. Each ink line is drawn over the fills it edges. Rows are
   * [part, path], styled as .ls-squirrel-<part>, facing right in the scene's
   * units; squirrelArt() tilts them into the leap.
   */
  // Outlines that are both filled and inked.
  const TAIL = 'M-18 3.6 C-19.5 5.7 -21.9 4.7 -24 4.6 C-26.1 4.5 -29.5 3.6 -30.4 3.2 C-31.3 2.8 -34 0.7 -35.6 -1 C-37.2 -2.7 -39.3 -5.8 -39.8 -6.8 C-40.3 -7.8 -41.8 -11.7 -42.4 -14.2 C-43 -16.7 -43.3 -20.8 -43.2 -22 C-43.1 -23.2 -42.4 -27.3 -41.4 -29.6 C-40.4 -31.9 -37.8 -35 -37 -35.8 C-36.2 -36.6 -32.9 -39.1 -30.6 -40 C-28.3 -40.9 -24.1 -41.5 -23 -41.4 C-21.9 -41.3 -17.7 -40.1 -15.8 -39 C-13.9 -37.9 -12.5 -36.2 -11.6 -34.6 C-10.7 -33 -10.4 -31.1 -10.4 -29.6 C-10.4 -28.1 -11.2 -26.3 -11.4 -25.8 C-11.6 -25.3 -13.4 -23.2 -13.4 -23.2 C-13.4 -23.2 -15 -24.9 -15.4 -25.2 C-15.8 -25.5 -17.4 -26.2 -18.6 -26.8 C-19.8 -27.4 -21.2 -28.8 -22.8 -28.8 C-24.4 -28.8 -26.8 -28.1 -28.2 -26.6 C-29.6 -25.1 -30.6 -22.4 -31 -20 C-31.4 -17.6 -31.1 -14.6 -30.4 -12.4 C-29.7 -10.2 -28.4 -7.9 -26.8 -6.8 C-25.2 -5.7 -22.5 -5.8 -20.6 -6 C-18.7 -6.2 -15.6 -9.8 -15.2 -8.2 C-14.8 -6.6 -16.5 1.5 -18 3.6 Z';
  const BODY = 'M-19 -3.5 C-18.1 -5 -17 -7.8 -15 -9.5 C-13 -11.2 -9.7 -12.9 -7 -13.8 C-4.3 -14.8 -1.3 -14.7 1 -15.2 C3.3 -15.7 5.6 -15.8 7 -16.6 C8.4 -17.4 8.8 -18.9 9.2 -20.2 C9.6 -21.5 9.4 -23.3 9.6 -24.6 C9.8 -25.9 10.2 -27 10.4 -27.8 C10.7 -28.6 11.1 -28.8 11.1 -29.6 C11.1 -30.4 10.6 -32.4 10.6 -32.4 C10.6 -32.4 12 -31 12.6 -30.2 C13.2 -29.4 13.4 -28.5 13.9 -27.6 C14.4 -26.7 14.8 -25.2 15.6 -24.6 C16.4 -24 17.8 -24.6 19 -24.2 C20.2 -23.8 21.8 -23.1 23 -22.2 C24.2 -21.3 25.5 -19.7 26.4 -18.6 C27.2 -17.5 28 -16.6 28.1 -15.6 C28.2 -14.6 27.7 -13.4 26.8 -12.6 C25.9 -11.8 24 -11.3 22.6 -10.6 C21.2 -9.9 20 -9.4 18.6 -8.2 C17.2 -7 16.3 -5.2 14.2 -3.6 C12.1 -2 8.9 0.2 6 1.6 C3.1 3 0 4.2 -3 5 C-6 5.8 -9.5 6.4 -12 6.2 C-14.5 6 -16.6 4.7 -18 3.6 C-19.4 2.5 -20.2 0.8 -20.4 -0.4 C-20.6 -1.6 -19.9 -2 -19 -3.5 Z';
  const FAR_FOOT = 'M-13 5 C-13.8 4.8 -16.8 7.4 -18.4 8.2 C-20 9 -21.3 9.3 -22.6 9.6 C-23.9 9.9 -25.4 9.7 -26.2 10 C-27 10.3 -27.5 10.8 -27.4 11.2 C-27.3 11.6 -26.6 12.2 -25.6 12.4 C-24.6 12.6 -22.9 12.4 -21.6 12.2 C-20.3 12 -18.9 11.7 -17.6 11.2 C-16.3 10.7 -14.4 10.2 -13.6 9.2 C-12.8 8.2 -12.2 5.2 -13 5 Z';
  const SQUIRREL_PATHS = [
    ['tail', TAIL],
    ['tail-shade', 'M-19.6 3.2 C-20.1 3.7 -22.7 3.9 -24.4 3.8 C-26.1 3.7 -28.3 3.3 -30 2.4 C-31.7 1.5 -33.4 0.2 -34.8 -1.4 C-36.2 -3 -37.6 -4.9 -38.6 -7 C-39.6 -9.1 -40.5 -11.7 -41 -14.2 C-41.5 -16.7 -41.9 -19.3 -41.8 -21.8 C-41.7 -24.3 -40.9 -28.2 -40.2 -29 C-39.5 -29.8 -37.8 -27.9 -37.4 -26.6 C-37 -25.3 -38 -23.4 -38 -21.4 C-38 -19.4 -38 -16.9 -37.6 -14.8 C-37.2 -12.7 -36.4 -10.6 -35.4 -8.8 C-34.4 -7 -33.2 -5.4 -31.8 -4 C-30.4 -2.6 -28.5 -1.4 -26.8 -0.6 C-25.1 0.2 -22.8 0 -21.6 0.6 C-20.4 1.2 -19.1 2.7 -19.6 3.2 Z'],
    ['tail-light', 'M-28.6 -7.8 C-28.3 -8.2 -30.7 -11 -31.4 -13 C-32.1 -15 -32.7 -17.5 -32.6 -19.8 C-32.5 -22.1 -31.8 -24.8 -30.6 -26.6 C-29.4 -28.4 -26.9 -30 -25.2 -30.6 C-23.5 -31.2 -21.5 -30.5 -20.2 -30.4 C-18.9 -30.3 -17.9 -29.5 -17.6 -29.8 C-17.3 -30.1 -17.4 -31.3 -18.6 -32 C-19.8 -32.7 -22.4 -33.9 -24.6 -33.8 C-26.8 -33.7 -30.1 -32.8 -31.8 -31.2 C-33.5 -29.6 -34.4 -26.4 -35 -24 C-35.6 -21.6 -35.5 -18.8 -35.2 -16.6 C-34.9 -14.4 -34.5 -12.1 -33.4 -10.6 C-32.3 -9.1 -28.9 -7.4 -28.6 -7.8 Z'],
    ['ink', TAIL],
    ['far', FAR_FOOT],
    ['ink', FAR_FOOT],
    ['fur', BODY],
    ['light', 'M-17.4 -5 C-17.4 -5.3 -15.4 -8.3 -13.6 -9.6 C-11.8 -10.9 -8.8 -11.9 -6.4 -12.6 C-4 -13.3 -1.1 -13.5 1 -13.9 C3.1 -14.3 5.2 -14.6 6.4 -15.2 C7.6 -15.8 8.1 -17.3 8 -17.4 C7.9 -17.5 7 -16.6 5.6 -15.8 C4.2 -15 1.6 -13.5 -0.6 -12.6 C-2.8 -11.7 -5.3 -11.4 -7.4 -10.6 C-9.5 -9.8 -11.7 -8.5 -13.4 -7.6 C-15.1 -6.7 -17.4 -4.7 -17.4 -5 Z'],
    ['light', 'M16.4 -22.6 C17 -22.8 19.1 -23 20.4 -22.6 C21.7 -22.2 23.1 -21.1 24 -20.4 C24.9 -19.7 25.7 -18.3 25.5 -18.2 C25.3 -18.1 23.9 -19.1 22.8 -19.6 C21.8 -20.1 20.2 -20.7 19.2 -21 C18.2 -21.3 17.1 -21.1 16.6 -21.4 C16.1 -21.7 15.8 -22.4 16.4 -22.6 Z'],
    ['cream', 'M24.6 -11.3 C24.4 -11 22.6 -10.6 21.6 -10.1 C20.6 -9.6 19.8 -9.3 18.6 -8.2 C17.4 -7.1 16.3 -5.2 14.2 -3.6 C12.1 -2 8.9 0.2 6 1.6 C3.1 3 -1.8 4.9 -3 5 C-4.2 5.1 -2.7 3.5 -1 2.4 C0.7 1.3 5 -0.2 7.4 -1.6 C9.8 -3 11.6 -4.7 13.2 -6 C14.8 -7.3 15.6 -8.5 16.8 -9.4 C18 -10.3 19.4 -11 20.4 -11.4 C21.4 -11.8 22.3 -12.1 23 -12.1 C23.7 -12.1 24.8 -11.6 24.6 -11.3 Z'],
    ['inner-ear', 'M11.2 -25.2 C11.1 -25.9 12 -28.6 12 -28.6 C12 -28.6 12.8 -27.2 13.2 -26.6 C13.6 -26 14.3 -25.2 14.2 -24.8 C14.1 -24.4 13.1 -24.1 12.6 -24.2 C12.1 -24.3 11.3 -24.5 11.2 -25.2 Z'],
    ['ink', BODY],
    ['fur', 'M-5 -7.2 C-3.7 -6.1 -2.1 -4.1 -1.8 -2.2 C-1.5 -0.3 -2.1 2.3 -3.2 4.2 C-4.3 6.1 -6.6 8.1 -8.4 9.4 C-10.2 10.7 -12.5 11.4 -14.2 12.2 C-15.9 13 -17.2 13.9 -18.8 14.4 C-20.4 14.9 -22.2 15.1 -23.8 15.2 C-25.4 15.3 -28 15.4 -28.4 15.2 C-28.8 15 -29.5 13.4 -28.8 12.8 C-28.1 12.2 -25.8 12 -24.4 11.6 C-23 11.2 -21.5 11.1 -20.2 10.6 C-18.9 10.1 -16.8 9.6 -16.4 8.6 C-16 7.6 -17.5 6.1 -17.8 4.4 C-18.1 2.7 -18.8 0.5 -18.2 -1.4 C-17.6 -3.3 -15.9 -5.8 -14.4 -7 C-12.9 -8.2 -11 -8.8 -9.4 -8.8 C-7.8 -8.8 -6.3 -8.3 -5 -7.2 Z'],
    ['ink', 'M-5 -7.2 C-4.5 -6.4 -2.1 -4.1 -1.8 -2.2 C-1.5 -0.3 -2.1 2.3 -3.2 4.2 C-4.3 6.1 -6.6 8.1 -8.4 9.4 C-10.2 10.7 -12.5 11.4 -14.2 12.2 C-15.9 13 -17.2 13.9 -18.8 14.4 C-20.4 14.9 -22.2 15.1 -23.8 15.2 C-25.4 15.3 -28 15.4 -28.4 15.2 C-28.8 15 -29.5 13.4 -28.8 12.8 C-28.1 12.2 -25.8 12 -24.4 11.6 C-23 11.2 -21.5 11.1 -20.2 10.6 C-18.9 10.1 -16.8 9.5 -16.4 8.6 C-16 7.7 -17.4 5.6 -17.6 5'],
    ['strand', 'M-26.2 12.2 C-26.1 12.4 -25.8 13.1 -25.8 13.6 C-25.8 14.1 -26.3 14.8 -26.4 15.1'],
    ['fur', 'M11.6 -8.6 C12.3 -8.8 13.5 -6.8 14.4 -6 C15.3 -5.2 16 -4.4 17 -4 C18 -3.6 19.3 -3.5 20.2 -3.4 C21.1 -3.3 21.9 -3.6 22.6 -3.4 C23.3 -3.2 24.2 -2.9 24.6 -2.4 C25 -1.9 25.2 -1.1 25 -0.6 C24.8 -0.1 24.2 0.5 23.6 0.6 C23 0.7 22.4 0.2 21.6 0.2 C20.8 0.2 19.8 0.6 18.8 0.6 C17.8 0.6 16.5 0.7 15.4 0.4 C14.3 0.1 13.2 -0.6 12.4 -1.4 C11.6 -2.2 10.5 -3.4 10.4 -4.6 C10.3 -5.8 10.9 -8.4 11.6 -8.6 Z'],
    ['ink', 'M14.4 -6 C14.8 -5.7 16 -4.4 17 -4 C18 -3.6 19.3 -3.5 20.2 -3.4 C21.1 -3.3 21.9 -3.6 22.6 -3.4 C23.3 -3.2 24.2 -2.9 24.6 -2.4 C25 -1.9 25.2 -1.1 25 -0.6 C24.8 -0.1 24.2 0.5 23.6 0.6 C23 0.7 22.4 0.2 21.6 0.2 C20.8 0.2 19.8 0.6 18.8 0.6 C17.8 0.6 16.4 0.7 15.4 0.4 C14.4 0.1 13.2 -0.8 12.8 -1'],
    ['strand', 'M22.8 -3.1 C22.9 -2.9 23.4 -2.1 23.4 -1.6 C23.4 -1.1 22.8 -0.4 22.7 -0.2'],
  ];

  /** Draws the squirrel at (x, y), turned `tilt` degrees and scaled by `scale`. */
  function squirrelArt(parent, { x = 0, y = 0, scale = 1, tilt = 0 } = {}) {
    const g = svg('g', { class: 'ls-squirrel', transform: `translate(${x} ${y}) rotate(${tilt}) scale(${scale})` }, parent);
    for (const [part, d] of SQUIRREL_PATHS) svg('path', { d, class: `ls-squirrel-${part}` }, g);
    svg('circle', { cx: 20.5, cy: -17.5, r: 2.6, class: 'ls-squirrel-eye' }, g);
    svg('circle', { cx: 21.4, cy: -18.4, r: 0.9, class: 'ls-squirrel-catchlight' }, g);
    svg('circle', { cx: 27.6, cy: -15.4, r: 1.35, class: 'ls-squirrel-nose' }, g);
    return g;
  }

  /*
   * The game's night scene in its 400 x 220 view: a starry sky, the moon
   * with its glow, a far skyline of campus towers, and the near rooftops the
   * squirrel runs on (flat tops lit along their ledges, lit and dark windows,
   * a gabled house with a chimney, a water tower, an antenna), boba pearls in
   * an arc, and the squirrel mid-leap.
   */
  const SCENE = {
    roofs: 'M0 170 H70 V138 H110 V170 H150 V180 H190 V124 L220 104 L250 124 V180 H300 V150 H360 V170 H400 V220 H0 Z',
    /** Each flat building: x from, x to, and its roof's height. */
    blocks: [[0, 70, 170], [70, 110, 138], [110, 150, 170], [150, 190, 180], [190, 250, 124], [250, 300, 180], [300, 360, 150], [360, 400, 170]],
    skyline: 'M0 176 V150 H18 V138 H34 V146 H48 V118 H54 V104 L58 96 L62 104 V118 H68 V140 H96 V128 C96 116 120 116 120 128 V142 H140 V130 H156 V150 H176 V136 H188 V150 H262 V132 H276 V120 H282 V132 H292 V146 H316 V138 H332 V128 H344 V142 H372 V132 H388 V146 H400 V176 Z',
    pearls: [[120, 96], [168, 82], [212, 70], [262, 92], [306, 118]],
  };
  const { circle, box } = arch.shape;
  /** Stars, away from the moon: [x, y, radius] from a fixed seed. */
  const STARS = Array.from({ length: 34 }, (_, i) => [hash01(i * 5 + 1) * 400, 4 + hash01(i * 5 + 2) * 96, 0.6 + 0.8 * hash01(i * 5 + 3)])
    .filter(([sx, sy]) => Math.hypot(sx - 330, sy - 46) > 36);

  /** Windows on each flat building's face, every few rows lit: [lit paths, dark paths]. */
  function windows() {
    const lit = [];
    const dark = [];
    SCENE.blocks.forEach(([x1, x2, top], b) => {
      if (x2 - x1 < 36) return;
      const startY = (b === 4 ? top + 2 : top) + 10;
      for (let wy = startY, row = 0; wy < 212; wy += 14, row += 1) {
        for (let wx = x1 + 8, col = 0; wx + 7 <= x2 - 6; wx += 13, col += 1) {
          (hash01(b * 97 + row * 13 + col) < 0.3 ? lit : dark).push(box(wx, wy, 7, 8));
        }
      }
    });
    return [lit.join(' '), dark.join(' ')];
  }
  const [WINDOWS_LIT, WINDOWS_DARK] = windows();

  function sceneArt(parent) {
    const art = svg('svg', { class: 'ls-scene-art', viewBox: '0 0 400 220', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, parent);
    const path = (d, part) => svg('path', { d, class: `ls-scene-${part}` }, art);
    path(box(0, 0, 400, 220), 'sky');
    path(box(0, 110, 400, 110), 'horizon');
    path(STARS.filter((_, i) => i % 3).map(([x, y, r]) => circle(x, y, r * 0.8)).join(' '), 'star-dim');
    path(STARS.filter((_, i) => !(i % 3)).map(([x, y, r]) => circle(x, y, r)).join(' '), 'star');
    path(`${circle(330, 46, 34)}`, 'glow-far');
    path(`${circle(330, 46, 27)}`, 'glow');
    path(circle(330, 46, 20), 'moon');
    path(`${circle(322, 40, 3.6)} ${circle(338, 53, 2.6)} ${circle(335, 35, 1.8)} ${circle(318, 54, 1.6)}`, 'crater');
    path(SCENE.skyline, 'skyline');
    path(SCENE.roofs, 'roofs');
    path(WINDOWS_DARK, 'window');
    path(WINDOWS_LIT, 'window-lit');
    // The gabled house: roof planes, ridge, chimney, and a round attic window.
    path('M190 124 L220 104 L250 124 L246 126 L220 109 L194 126 Z', 'gable');
    path('M232 116 V100 H240 V121', 'chimney');
    path(`${circle(220, 120, 5)}`, 'window-lit');
    // The water tower and the antenna, with its light.
    path('M322 150 L326 138 M342 150 L338 138 M324 144 H340', 'tower-legs');
    path('M318 126 C318 122 346 122 346 126 V138 C346 141 318 141 318 138 Z', 'tank');
    path('M30 170 V146 M24 152 H36', 'antenna');
    path(circle(30, 145, 1.8), 'beacon');
    // Moonlit ledges along every rooftop.
    path(SCENE.blocks.map(([x1, x2, top], i) => (i === 4 ? '' : `M${x1 + 1} ${top + 1} H${x2 - 1}`)).join(' '), 'ledge');
    // Boba pearls: dark and glossy, a shaded underside and a highlight.
    path(SCENE.pearls.map(([cx, cy]) => circle(cx, cy, 6)).join(' '), 'pearl');
    path(SCENE.pearls.map(([cx, cy]) => `M${cx - 5.4} ${cy + 1.6} A6 6 0 0 0 ${cx + 5.4} ${cy + 1.6} A7 7 0 0 1 ${cx - 5.4} ${cy + 1.6} Z`).join(' '), 'pearl-shade');
    path(SCENE.pearls.map(([cx, cy]) => circle(cx - 2, cy - 2.2, 1.7)).join(' '), 'pearl-gloss');
    squirrelArt(art, { x: 76, y: 116, tilt: -12 });
    return art;
  }

  /** The handheld's controls: a D-pad in its well, or two face buttons. */
  function padArt(parent, kind) {
    const art = svg('svg', { viewBox: '0 0 56 56', class: 'ls-pad-art', 'aria-hidden': 'true' }, parent);
    svg('path', { d: circle(28, 28, 27), class: 'ls-pad-well' }, art);
    if (kind === 'dpad') {
      const cross = 'M22 10 H34 V22 H46 V34 H34 V46 H22 V34 H10 V22 H22 Z';
      svg('path', { d: cross, class: 'ls-pad-cross' }, art);
      svg('path', { d: 'M23.4 11.4 H32.6 V13 H23.4 Z M11.4 23.4 H21 V25 H11.4 Z', class: 'ls-pad-cross-light' }, art);
      svg('path', { d: circle(28, 28, 3.2), class: 'ls-pad-dimple' }, art);
    } else {
      svg('path', { d: circle(20, 33, 8.5), class: 'ls-pad-button ls-pad-button--b' }, art);
      svg('path', { d: circle(36, 22, 8.5), class: 'ls-pad-button ls-pad-button--a' }, art);
      svg('path', { d: `${circle(17.4, 30.2, 2.4)} ${circle(33.4, 19.2, 2.4)}`, class: 'ls-pad-gloss' }, art);
    }
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
      padArt(el('span', 'ls-pad ls-pad--dpad', node), 'dpad');
      padArt(el('span', 'ls-pad ls-pad--buttons', node), 'buttons');
      const grille = svg('svg', { viewBox: '0 0 30 10', class: 'ls-speaker', 'aria-hidden': 'true' }, node);
      svg('path', { d: [3, 9, 15, 21, 27].flatMap((gx) => [circle(gx, 2.5, 1.5), circle(gx, 7.5, 1.5)]).join(' '), class: 'ls-speaker-hole' }, grille);
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

  /** An interface a lower layer defines for the layers above: a box stereotyped «interface» with its operations. */
  function socket(parent, { x, y, w, name, text, at, until }) {
    return uml.classBox(parent, { x, y, w, name, stereotype: 'interface', lines: text ? [text] : [], at, until });
  }

  window.LayersKit = { floor, building, squirrelArt, gameScreen, fileGrid, mudBall, frameBar, socket };
})();
