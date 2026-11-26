/*
 * Artwork for the Pipes and Filters video narration (choreography:
 * js/video-narration/pipes-and-filters.js; styles: css/video-narration-
 * pipes-and-filters.css). It builds on the wall kit and the architecture kit
 * and adds the lesson's own objects:
 *
 *   the game photo, a receiver leaping for the catch in front of the stands,
 *     drawn so every filter's work is visible: sensor grain, darkness, a
 *     crop to the catch, fans' faces pixelated, and the paper's logo;
 *   a filter is a box with an input port and an output port and a light that
 *     says busy or idle in words; a pipe is a tube with an arrowhead that
 *     photos slide through; a batch is a timeline of bars that fill one
 *     after another; the website is a gallery that fills with photos.
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
  const { show } = arch;

  // ------------------------------------------------------------------
  // The photo
  // ------------------------------------------------------------------

  /*
   * The catch as the sideline camera saw it under the stadium lights: three
   * tiers of fans behind the wall, the yard lines running away from the
   * camera, and the receiver in the air with his gloves on the ball. It is
   * drawn in the photo's own units (160 x 110) with flat fills, so it prints
   * as vectors, and each filter's work shows even at a token's size.
   */
  const PHOTO = { w: 160, h: 110, wall: 40.5, field: 46 };

  /** The fans, back row first: where each sits, how large, and its skin, hair, hair style, and shirt. */
  const FANS = [[9.5, 0.82], [21, 0.9], [32.5, 1]].flatMap(([y, s], row) => {
    const step = 15 * s;
    return Array.from({ length: Math.ceil(170 / step) }, (_, i) => {
      const seed = row * 101 + i * 13;
      return {
        x: -3 + i * step + (row % 2) * (step / 2) + (hash01(seed) - 0.5) * 2.4 * s,
        y: y + (hash01(seed + 1) - 0.5) * 1.6,
        s,
        skin: Math.floor(hash01(seed + 2) * 5),
        hair: Math.floor(hash01(seed + 3) * 4),
        style: Math.floor(hash01(seed + 4) * 3),
        shirt: Math.floor(hash01(seed + 5) * 4),
        cheer: hash01(seed + 6) < 0.3,
      };
    });
  });

  const { round, circle, box } = arch.shape;

  /**
   * The crowd as one path per paint, painted in this order: shirts, raised
   * arms and hands, long hair, faces, hair and caps, eyes, and cheering
   * mouths; blurred faces become a 3 x 3 mosaic of their colors. Within a
   * paint the rows overlap back to front, so every fan stays whole.
   */
  function crowd(blurred) {
    const layers = new Map(['shirt', 'arm', 'hand', 'long', 'face', 'top', 'eyes', 'mouth'].map((name) => [name, new Map()]));
    const add = (layer, paint, d) => {
      const paints = layers.get(layer);
      paints.set(paint, `${paints.get(paint) || ''}${d} `);
    };
    for (const { x, y, s, skin, hair, style, shirt, cheer } of FANS) {
      const at = (lx, ly) => `${round(x + lx * s)} ${round(y + ly * s)}`;
      add('shirt', `pf-shirt-${shirt}`, `M${at(-6, 12)} C${at(-6, 5)} ${at(-4, 3.2)} ${at(0, 3.2)} C${at(4, 3.2)} ${at(6, 5)} ${at(6, 12)} Z`);
      if (cheer) {
        add('arm', `pf-fan-arm pf-sleeve-${shirt}`, `M${at(-4.2, 5.4)} L${at(-6.4, -4.2)} M${at(4.2, 5.4)} L${at(6.4, -4.2)}`);
        add('hand', `pf-skin-${skin}`, circle(x - 6.4 * s, y - 4.6 * s, 1.2 * s) + circle(x + 6.4 * s, y - 4.6 * s, 1.2 * s));
      }
      if (blurred) {
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const paint = row === 0 ? `pf-hair-${hair}` : (row + col) % 2 ? `pf-skin-${skin}` : `pf-pixel-${skin}`;
            add('face', paint, box(x + (-3.45 + col * 2.3) * s, y + (-3.45 + row * 2.3) * s, 2.3 * s, 2.3 * s));
          }
        }
        continue;
      }
      if (style === 2) add('long', `pf-hair-${hair}`, `M${at(-3.7, -0.4)} C${at(-3.9, 3)} ${at(-3.4, 5.4)} ${at(-2.2, 6.2)} L${at(2.2, 6.2)} C${at(3.4, 5.4)} ${at(3.9, 3)} ${at(3.7, -0.4)} Z`);
      add('face', `pf-skin-${skin}`, circle(x, y, 3.3 * s));
      if (style === 1) add('top', `pf-shirt-${shirt}`, `M${at(-3.6, -0.2)} C${at(-3.6, -4.8)} ${at(3.6, -4.8)} ${at(3.6, -0.2)} Z ${box(x - 3.9 * s, y - 0.9 * s, 7.8 * s, 1.2 * s)}`);
      else add('top', `pf-hair-${hair}`, `M${at(-3.4, -0.3)} C${at(-3.5, -4.5)} ${at(3.5, -4.5)} ${at(3.4, -0.3)} C${at(2.4, -2)} ${at(-2.4, -2)} ${at(-3.4, -0.3)} Z`);
      add('eyes', 'pf-fan-eyes', `M${at(-1.2, 0.5)} h0.01 M${at(1.2, 0.5)} h0.01`);
      if (cheer) add('mouth', 'pf-fan-mouth', circle(x, y + 1.8 * s, 0.7 * s));
    }
    return [...layers.values()].flatMap((paints) => [...paints]);
  }

  /** The crowd's paths depend only on whether faces are blurred, so each kind is built once. */
  const crowds = new Map();
  const crowdOf = (blurred) => crowds.get(blurred) || crowds.set(blurred, crowd(blurred)).get(blurred);

  /** A field line `x` along the photo's bottom edge meets row `y` here: the lines run to a point far beyond the stands. */
  const VANISH = { x: 80, y: -150 };
  const onField = (x, y) => VANISH.x + ((x - VANISH.x) * (y - VANISH.y)) / (PHOTO.h - VANISH.y);
  const YARD_LINES = [-60, -20, 20, 60, 100, 140, 180, 220];
  const strip = (x1, x2) => `M${round(onField(x1, PHOTO.field))} ${PHOTO.field} L${round(onField(x2, PHOTO.field))} ${PHOTO.field} L${x2} ${PHOTO.h} L${x1} ${PHOTO.h} Z`;
  /** Every other gap between yard lines, mown a shade darker; then the lines themselves. */
  const FIELD_BANDS = YARD_LINES.slice(1).filter((_, i) => i % 2).map((x) => strip(x - 40, x)).join(' ');
  const FIELD_LINES = YARD_LINES.map((x) => strip(x - 0.7, x + 0.7)).join(' ');

  /** The receiver, back to front: shadow on the turf, legs, arms, jersey, helmet, ball, gloves, then ink. */
  const RECEIVER = [
    ['shadow', 'M66 98.5 C66 96.8 74 95.6 82 95.6 C90 95.6 98 96.8 98 98.5 C98 100.2 90 101.2 82 101.2 C74 101.2 66 100.2 66 98.5 Z'],
    ['sock', 'M85.4 68.2 C86.1 67.5 88.93 67.37 89.8 68 C90.67 68.63 90.53 70.57 90.6 72 C90.67 73.43 90.37 75.23 90.2 76.6 C90.03 77.97 90.2 79.57 89.6 80.2 C89 80.83 87.17 81.03 86.6 80.4 C86.03 79.77 86.37 77.77 86.2 76.4 C86.03 75.03 85.73 73.57 85.6 72.2 C85.47 70.83 84.7 68.9 85.4 68.2 Z'],
    ['sock-stripe', 'M85.5 71.4 C86.3 71.13 89.67 71 90.5 71.2 C91.33 71.4 91.3 72.33 90.5 72.6 C89.7 72.87 86.53 73 85.7 72.8 C84.87 72.6 84.7 71.67 85.5 71.4 Z'],
    ['cleat', 'M86.2 79.6 C86.97 79.17 89.37 79.03 90.2 79.4 C91.03 79.77 91.1 80.9 91.2 81.8 C91.3 82.7 91.01 84.5 90.8 84.8 C90.59 85.1 89.17 85.8 88.4 85.8 C87.63 85.8 86.41 85.08 86.2 84.8 C85.99 84.52 85.6 82.87 85.6 82 C85.6 81.13 85.43 80.03 86.2 79.6 Z'],
    ['pants', 'M80.6 57.4 C81.5 56.77 85.87 56.03 87.4 56.6 C88.93 57.17 89.3 59.3 89.8 60.8 C90.3 62.3 90.47 64.27 90.4 65.6 C90.33 66.93 89.76 68.53 89.4 68.8 C89.04 69.07 85.97 69.52 85.6 69.2 C85.22 68.89 85 66.07 84.4 64.6 C83.8 63.13 82.63 61.6 82 60.4 C81.37 59.2 79.7 58.03 80.6 57.4 Z'],
    ['pants-shade', 'M87.4 57.2 C87.73 57.4 88.98 59.43 89.4 60.8 C89.82 62.17 89.97 64.13 89.9 65.4 C89.83 66.67 89.28 68.7 89 68.4 C88.72 68.1 88.47 65.07 88.2 63.6 C87.93 62.13 87.53 60.67 87.4 59.6 C87.27 58.53 87.07 57 87.4 57.2 Z'],
    ['sock', 'M69.2 65.6 C70.13 65.03 73.93 65.13 75 65.8 C76.07 66.47 75.63 68.3 75.6 69.6 C75.57 70.9 75 72.37 74.8 73.6 C74.6 74.83 74.97 76.4 74.4 77 C73.83 77.6 72.03 77.87 71.4 77.2 C70.77 76.53 70.93 74.33 70.6 73 C70.27 71.67 69.63 70.43 69.4 69.2 C69.17 67.97 68.27 66.17 69.2 65.6 Z'],
    ['sock-stripe', 'M69.6 68.4 C70.53 68.2 74.43 68.33 75.4 68.6 C76.37 68.87 76.33 69.8 75.4 70 C74.47 70.2 70.77 70.07 69.8 69.8 C68.83 69.53 68.67 68.6 69.6 68.4 Z'],
    ['cleat', 'M70.8 76.2 C71.57 75.83 74.17 75.83 75 76.2 C75.83 76.57 75.73 77.57 75.8 78.4 C75.87 79.23 75.59 80.92 75.4 81.2 C75.21 81.48 73.93 82.2 73.2 82.2 C72.47 82.2 71.21 81.48 71 81.2 C70.79 80.92 70.43 79.23 70.4 78.4 C70.37 77.57 70.03 76.57 70.8 76.2 Z'],
    ['pants', 'M72.6 56.6 C74.13 56.47 78.3 56.53 79.4 57.4 C80.5 58.27 79.63 60.47 79.2 61.8 C78.77 63.13 77.9 64.5 76.8 65.4 C75.7 66.3 73.2 67.17 72.6 67.2 C72 67.23 69.11 66.22 68.8 65.8 C68.48 65.38 68.17 62.87 68.4 61.6 C68.63 60.33 69.5 59.03 70.2 58.2 C70.9 57.37 71.07 56.73 72.6 56.6 Z'],
    ['pants-light', 'M70.6 58.4 C71.33 57.57 73.27 57.07 73.4 57.4 C73.53 57.73 71.97 59.23 71.4 60.4 C70.83 61.57 70.4 64.07 70 64.4 C69.6 64.73 68.9 63.4 69 62.4 C69.1 61.4 69.87 59.23 70.6 58.4 Z'],
    ['sole', 'M71.4 81.4 C72 81.38 74.4 81.32 75 81.3 M86.6 85 C87.23 84.98 89.77 84.92 90.4 84.9'],
    ['skin', 'M68.6 40.2 C67.55 39.17 67.4 35.3 66.9 33 C66.4 30.7 65.72 27.87 65.6 26.4 C65.48 24.93 65.86 24.63 66.2 24.2 C66.55 23.77 68.8 21.87 70.2 20.6 C71.6 19.33 73.5 17 74.6 16.6 C75.7 16.2 77.13 17.2 76.8 18.2 C76.47 19.2 73.77 21.23 72.6 22.6 C71.43 23.97 69.91 25.66 69.8 26.4 C69.69 27.13 70.63 30.27 71.2 32.4 C71.77 34.53 73.63 37.9 73.2 39.2 C72.77 40.5 69.65 41.23 68.6 40.2 Z'],
    ['skin-light', 'M67.6 38.2 C67.23 37.57 66.68 34.47 66.4 32.6 C66.12 30.73 65.87 28.27 65.9 27 C65.93 25.73 66.22 25.27 66.6 25 C66.98 24.73 67.98 24.43 68.2 25.4 C68.42 26.37 67.83 28.97 67.9 30.8 C67.97 32.63 68.65 35.17 68.6 36.4 C68.55 37.63 67.97 38.83 67.6 38.2 Z'],
    ['skin', 'M91.4 40.2 C92.45 39.17 92.6 35.3 93.1 33 C93.6 30.7 94.28 27.87 94.4 26.4 C94.52 24.93 94.14 24.63 93.8 24.2 C93.45 23.77 91.2 21.87 89.8 20.6 C88.4 19.33 86.5 17 85.4 16.6 C84.3 16.2 82.87 17.2 83.2 18.2 C83.53 19.2 86.23 21.23 87.4 22.6 C88.57 23.97 90.09 25.66 90.2 26.4 C90.31 27.13 89.37 30.27 88.8 32.4 C88.23 34.53 86.37 37.9 86.8 39.2 C87.23 40.5 90.35 41.23 91.4 40.2 Z'],
    ['skin-shade', 'M88.6 38.6 C88.83 37.9 89.27 34.33 89.6 32.4 C89.93 30.47 90.7 28.3 90.6 27 C90.5 25.7 89.63 25.4 89 24.6 C88.37 23.8 86.77 22.03 86.8 22.2 C86.83 22.37 88.77 24.2 89.2 25.6 C89.63 27 89.57 28.77 89.4 30.6 C89.23 32.43 88.33 35.27 88.2 36.6 C88.07 37.93 88.37 39.3 88.6 38.6 Z'],
    ['jersey', 'M70.2 43 C69.83 41.07 68.8 39.07 69.2 38 C69.6 36.93 71.37 36.67 72.6 36.6 C73.83 36.53 75.37 37.23 76.6 37.6 C77.83 37.97 78.87 38.8 80 38.8 C81.13 38.8 82.17 37.97 83.4 37.6 C84.63 37.23 86.17 36.53 87.4 36.6 C88.63 36.67 90.4 36.93 90.8 38 C91.2 39.07 90.17 41.07 89.8 43 C89.43 44.93 88.97 47.57 88.6 49.6 C88.23 51.63 88.37 54.07 87.6 55.2 C86.83 56.33 84.57 56.28 84 56.4 C83.43 56.52 81.33 56.8 80 56.8 C78.67 56.8 76.57 56.52 76 56.4 C75.43 56.28 73.17 56.33 72.4 55.2 C71.63 54.07 71.77 51.63 71.4 49.6 C71.03 47.57 70.57 44.93 70.2 43 Z'],
    ['jersey-light', 'M70.6 42.4 C70.3 40.6 69.63 39.43 70 38.6 C70.37 37.77 71.87 37.5 72.8 37.4 C73.73 37.3 75.57 37.7 75.6 38 C75.63 38.3 73.63 38.53 73 39.2 C72.37 39.87 71.93 40.53 71.8 42 C71.67 43.47 72.03 45.9 72.2 48 C72.37 50.1 72.87 54.37 72.8 54.6 C72.73 54.83 72.17 51.43 71.8 49.4 C71.43 47.37 70.9 44.2 70.6 42.4 Z'],
    ['jersey-shade', 'M89.4 43.2 C89.37 44.43 88.73 47.67 88.4 49.6 C88.07 51.53 88.03 53.75 87.4 54.8 C86.77 55.85 84.77 56.47 84.6 55.9 C84.43 55.33 85.93 53.18 86.4 51.4 C86.87 49.62 87.03 46.73 87.4 45.2 C87.77 43.67 88.27 42.53 88.6 42.2 C88.93 41.87 89.43 41.97 89.4 43.2 Z'],
    ['jersey', 'M67.4 41.6 C66.23 41.1 66.88 38.47 66.8 37.4 C66.72 36.33 66.72 35.44 66.9 35.2 C67.08 34.96 68.4 34.33 69.2 34.2 C70 34.07 71.43 34.17 71.7 34.4 C71.97 34.62 72.45 36.2 72.8 37.2 C73.15 38.2 74.7 39.67 73.8 40.4 C72.9 41.13 68.57 42.1 67.4 41.6 Z'],
    ['jersey-light', 'M67.9 41.1 C67.62 40.47 67.52 38.32 67.5 37.4 C67.48 36.48 67.52 35.97 67.8 35.6 C68.08 35.23 69.03 34.83 69.2 35.2 C69.37 35.57 68.8 36.8 68.8 37.8 C68.8 38.8 69.35 40.65 69.2 41.2 C69.05 41.75 68.18 41.73 67.9 41.1 Z'],
    ['jersey', 'M92.6 41.6 C93.77 41.1 93.12 38.47 93.2 37.4 C93.28 36.33 93.28 35.44 93.1 35.2 C92.92 34.96 91.6 34.33 90.8 34.2 C90 34.07 88.57 34.17 88.3 34.4 C88.03 34.62 87.55 36.2 87.2 37.2 C86.85 38.2 85.3 39.67 86.2 40.4 C87.1 41.13 91.43 42.1 92.6 41.6 Z'],
    ['trim', 'M67.1 36.8 C67.95 36.65 71.35 36.05 72.2 35.9 M92.9 36.8 C92.05 36.65 88.65 36.05 87.8 35.9'],
    ['belt', 'M72.2 55.2 C73.48 55.12 77.4 56.4 80 56.4 C82.6 56.4 86.52 55.12 87.8 55.2 C89.08 55.28 89 56.4 87.7 56.9 C86.4 57.4 82.57 58.2 80 58.2 C77.43 58.2 73.6 57.4 72.3 56.9 C71 56.4 70.92 55.28 72.2 55.2 Z'],
    ['number', 'M76.2 44.4 C76.43 44.23 77.37 42.27 77.6 43.4 C77.83 44.53 77.6 49.9 77.6 51.2 M80.4 44.8 C80.63 44.57 81.3 43.6 81.8 43.4 C82.3 43.2 83 43.3 83.4 43.6 C83.8 43.9 84.23 44.57 84.2 45.2 C84.17 45.83 83.83 46.4 83.2 47.4 C82.57 48.4 80.2 50.57 80.4 51.2 C80.6 51.83 83.73 51.2 84.4 51.2'],
    ['trim', 'M76.6 37.8 C77.17 38.13 78.87 39.8 80 39.8 C81.13 39.8 82.83 38.13 83.4 37.8'],
    ['helmet', 'M73 31.6 C72.97 30.3 72.9 28.6 73.4 27.4 C73.9 26.2 74.9 25.07 76 24.4 C77.1 23.73 78.67 23.4 80 23.4 C81.33 23.4 82.9 23.73 84 24.4 C85.1 25.07 86.1 26.2 86.6 27.4 C87.1 28.6 87.03 30.3 87 31.6 C86.97 32.9 86.8 34.2 86.4 35.2 C86 36.2 85.67 37.03 84.6 37.6 C83.53 38.17 81.53 38.6 80 38.6 C78.47 38.6 76.47 38.17 75.4 37.6 C74.33 37.03 74 36.2 73.6 35.2 C73.2 34.2 73.03 32.9 73 31.6 Z'],
    ['helmet-shade', 'M85.6 27.6 C85.93 27.93 86.7 30.17 86.8 31.4 C86.9 32.63 86.6 34 86.2 35 C85.8 36 84.67 37.67 84.4 37.4 C84.13 37.13 84.53 34.73 84.6 33.4 C84.67 32.07 84.63 30.37 84.8 29.4 C84.97 28.43 85.27 27.27 85.6 27.6 Z'],
    ['skin', 'M75.6 29.8 C76.37 28.97 78.53 29 80 29 C81.47 29 83.63 28.97 84.4 29.8 C85.17 30.63 84.83 32.73 84.6 34 C84.37 35.27 83.77 36.7 83 37.4 C82.23 38.1 81 38.2 80 38.2 C79 38.2 77.77 38.1 77 37.4 C76.23 36.7 75.63 35.27 75.4 34 C75.17 32.73 74.83 30.63 75.6 29.8 Z'],
    ['helmet-light', 'M74.4 30.4 C74.23 30.3 74.4 28.63 74.8 27.8 C75.2 26.97 76.03 25.93 76.8 25.4 C77.57 24.87 79.3 24.47 79.4 24.6 C79.5 24.73 78 25.57 77.4 26.2 C76.8 26.83 76.3 27.7 75.8 28.4 C75.3 29.1 74.57 30.5 74.4 30.4 Z'],
    ['stripe', 'M79 23.5 C79.33 22.65 80.67 22.65 81 23.5 C81.33 24.35 81.33 27.75 81 28.6 C80.67 29.45 79.33 29.45 79 28.6 C78.67 27.75 78.67 24.35 79 23.5 Z'],
    ['eyes', 'M77.3 30.4 h1.3 M81.4 30.4 h1.3'],
    ['brows', 'M77 29.6 C77.3 29.57 78.5 29.43 78.8 29.4 M81.2 29.4 C81.5 29.43 82.7 29.57 83 29.6'],
    ['strap', 'M75.6 35.6 C75.93 35.97 76.87 37.33 77.6 37.8 C78.33 38.27 79.6 38.3 80 38.4 M84.4 35.6 C84.07 35.97 83.13 37.33 82.4 37.8 C81.67 38.27 80.4 38.3 80 38.4'],
    ['mask', 'M75.4 32.6 C76.93 32.6 83.07 32.6 84.6 32.6 M75.8 35.2 C77.2 35.2 82.8 35.2 84.2 35.2 M80 31.2 C80 32.33 80 36.87 80 38'],
    ['ball', 'M73.8 13.6 C73.78 13.15 74.57 11.07 75.6 10.2 C76.63 9.33 78.53 8.47 80 8.4 C81.47 8.33 83.33 9.13 84.4 9.8 C85.47 10.47 86.39 11.96 86.4 12.4 C86.42 12.84 85.63 14.8 84.6 15.6 C83.57 16.4 81.67 17.1 80.2 17.2 C78.73 17.3 76.87 16.8 75.8 16.2 C74.73 15.6 73.81 14.05 73.8 13.6 Z'],
    ['ball-shade', 'M75.4 15.2 C75.73 15.45 78.67 16.37 80.2 16.3 C81.73 16.23 83.7 15.32 84.6 14.8 C85.5 14.28 85.97 13.23 85.6 13.2 C85.23 13.17 83.63 14.33 82.4 14.6 C81.17 14.87 79.37 14.7 78.2 14.8 C77.03 14.9 75.07 14.95 75.4 15.2 Z'],
    ['laces', 'M77.4 11.2 C78.27 11.1 81.73 10.7 82.6 10.6 M78.4 10.19 C78.43 10.46 78.57 11.52 78.6 11.79 M79.6 10.06 C79.63 10.32 79.77 11.39 79.8 11.66 M80.8 9.93 C80.83 10.19 80.97 11.26 81 11.53 M82 9.79 C82.03 10.06 82.17 11.13 82.2 11.39'],
    ['gleam', 'M77 10.6 C77.07 10.47 78.73 9.77 79.4 9.6 C80.07 9.43 81.07 9.47 81 9.6 C80.93 9.73 79.67 10.23 79 10.4 C78.33 10.57 76.93 10.73 77 10.6 Z'],
    ['glove', 'M73.6 16.8 C73.4 16.15 73.53 15.03 73.8 14.2 C74.07 13.37 74.63 12.4 75.2 11.8 C75.77 11.2 76.6 10.77 77.2 10.6 C77.8 10.43 78.6 10.53 78.8 10.8 C79 11.07 78.67 11.8 78.4 12.2 C78.13 12.6 77.2 12.9 77.2 13.2 C77.2 13.5 78.23 13.6 78.4 14 C78.57 14.4 78.47 15.1 78.2 15.6 C77.93 16.1 77.33 16.58 76.8 17 C76.27 17.42 75.53 18.13 75 18.1 C74.47 18.07 73.8 17.45 73.6 16.8 Z'],
    ['glove', 'M86.4 16.8 C86.6 16.15 86.47 15.03 86.2 14.2 C85.93 13.37 85.37 12.4 84.8 11.8 C84.23 11.2 83.4 10.77 82.8 10.6 C82.2 10.43 81.4 10.53 81.2 10.8 C81 11.07 81.33 11.8 81.6 12.2 C81.87 12.6 82.8 12.9 82.8 13.2 C82.8 13.5 81.77 13.6 81.6 14 C81.43 14.4 81.53 15.1 81.8 15.6 C82.07 16.1 82.67 16.58 83.2 17 C83.73 17.42 84.47 18.13 85 18.1 C85.53 18.07 86.2 17.45 86.4 16.8 Z'],
    ['finger', 'M75.4 12.8 C75.7 12.6 76.9 11.8 77.2 11.6 M75.8 14.6 C76.13 14.4 77.47 13.6 77.8 13.4 M76.2 16.2 C76.48 16.02 77.62 15.28 77.9 15.1'],
    ['finger', 'M84.6 12.8 C84.3 12.6 83.1 11.8 82.8 11.6 M84.2 14.6 C83.87 14.4 82.53 13.6 82.2 13.4 M83.8 16.2 C83.52 16.02 82.38 15.28 82.1 15.1'],
    ['ink', 'M85.4 68.2 C86.1 67.5 88.93 67.37 89.8 68 C90.67 68.63 90.53 70.57 90.6 72 C90.67 73.43 90.37 75.23 90.2 76.6 C90.03 77.97 90.2 79.57 89.6 80.2 C89 80.83 87.17 81.03 86.6 80.4 C86.03 79.77 86.37 77.77 86.2 76.4 C86.03 75.03 85.73 73.57 85.6 72.2 C85.47 70.83 84.7 68.9 85.4 68.2 Z'],
    ['ink', 'M86.2 79.6 C86.97 79.17 89.37 79.03 90.2 79.4 C91.03 79.77 91.1 80.9 91.2 81.8 C91.3 82.7 91.01 84.5 90.8 84.8 C90.59 85.1 89.17 85.8 88.4 85.8 C87.63 85.8 86.41 85.08 86.2 84.8 C85.99 84.52 85.6 82.87 85.6 82 C85.6 81.13 85.43 80.03 86.2 79.6 Z'],
    ['ink', 'M80.6 57.4 C81.5 56.77 85.87 56.03 87.4 56.6 C88.93 57.17 89.3 59.3 89.8 60.8 C90.3 62.3 90.47 64.27 90.4 65.6 C90.33 66.93 89.76 68.53 89.4 68.8 C89.04 69.07 85.97 69.52 85.6 69.2 C85.22 68.89 85 66.07 84.4 64.6 C83.8 63.13 82.63 61.6 82 60.4 C81.37 59.2 79.7 58.03 80.6 57.4 Z'],
    ['ink', 'M69.2 65.6 C70.13 65.03 73.93 65.13 75 65.8 C76.07 66.47 75.63 68.3 75.6 69.6 C75.57 70.9 75 72.37 74.8 73.6 C74.6 74.83 74.97 76.4 74.4 77 C73.83 77.6 72.03 77.87 71.4 77.2 C70.77 76.53 70.93 74.33 70.6 73 C70.27 71.67 69.63 70.43 69.4 69.2 C69.17 67.97 68.27 66.17 69.2 65.6 Z'],
    ['ink', 'M70.8 76.2 C71.57 75.83 74.17 75.83 75 76.2 C75.83 76.57 75.73 77.57 75.8 78.4 C75.87 79.23 75.59 80.92 75.4 81.2 C75.21 81.48 73.93 82.2 73.2 82.2 C72.47 82.2 71.21 81.48 71 81.2 C70.79 80.92 70.43 79.23 70.4 78.4 C70.37 77.57 70.03 76.57 70.8 76.2 Z'],
    ['ink', 'M72.6 56.6 C74.13 56.47 78.3 56.53 79.4 57.4 C80.5 58.27 79.63 60.47 79.2 61.8 C78.77 63.13 77.9 64.5 76.8 65.4 C75.7 66.3 73.2 67.17 72.6 67.2 C72 67.23 69.11 66.22 68.8 65.8 C68.48 65.38 68.17 62.87 68.4 61.6 C68.63 60.33 69.5 59.03 70.2 58.2 C70.9 57.37 71.07 56.73 72.6 56.6 Z'],
    ['ink', 'M68.6 40.2 C67.55 39.17 67.4 35.3 66.9 33 C66.4 30.7 65.72 27.87 65.6 26.4 C65.48 24.93 65.86 24.63 66.2 24.2 C66.55 23.77 68.8 21.87 70.2 20.6 C71.6 19.33 73.5 17 74.6 16.6 C75.7 16.2 77.13 17.2 76.8 18.2 C76.47 19.2 73.77 21.23 72.6 22.6 C71.43 23.97 69.91 25.66 69.8 26.4 C69.69 27.13 70.63 30.27 71.2 32.4 C71.77 34.53 73.63 37.9 73.2 39.2 C72.77 40.5 69.65 41.23 68.6 40.2 Z'],
    ['ink', 'M91.4 40.2 C92.45 39.17 92.6 35.3 93.1 33 C93.6 30.7 94.28 27.87 94.4 26.4 C94.52 24.93 94.14 24.63 93.8 24.2 C93.45 23.77 91.2 21.87 89.8 20.6 C88.4 19.33 86.5 17 85.4 16.6 C84.3 16.2 82.87 17.2 83.2 18.2 C83.53 19.2 86.23 21.23 87.4 22.6 C88.57 23.97 90.09 25.66 90.2 26.4 C90.31 27.13 89.37 30.27 88.8 32.4 C88.23 34.53 86.37 37.9 86.8 39.2 C87.23 40.5 90.35 41.23 91.4 40.2 Z'],
    ['ink', 'M70.2 43 C69.83 41.07 68.8 39.07 69.2 38 C69.6 36.93 71.37 36.67 72.6 36.6 C73.83 36.53 75.37 37.23 76.6 37.6 C77.83 37.97 78.87 38.8 80 38.8 C81.13 38.8 82.17 37.97 83.4 37.6 C84.63 37.23 86.17 36.53 87.4 36.6 C88.63 36.67 90.4 36.93 90.8 38 C91.2 39.07 90.17 41.07 89.8 43 C89.43 44.93 88.97 47.57 88.6 49.6 C88.23 51.63 88.37 54.07 87.6 55.2 C86.83 56.33 84.57 56.28 84 56.4 C83.43 56.52 81.33 56.8 80 56.8 C78.67 56.8 76.57 56.52 76 56.4 C75.43 56.28 73.17 56.33 72.4 55.2 C71.63 54.07 71.77 51.63 71.4 49.6 C71.03 47.57 70.57 44.93 70.2 43 Z'],
    ['ink', 'M67.4 41.6 C66.23 41.1 66.88 38.47 66.8 37.4 C66.72 36.33 66.72 35.44 66.9 35.2 C67.08 34.96 68.4 34.33 69.2 34.2 C70 34.07 71.43 34.17 71.7 34.4 C71.97 34.62 72.45 36.2 72.8 37.2 C73.15 38.2 74.7 39.67 73.8 40.4 C72.9 41.13 68.57 42.1 67.4 41.6 Z'],
    ['ink', 'M92.6 41.6 C93.77 41.1 93.12 38.47 93.2 37.4 C93.28 36.33 93.28 35.44 93.1 35.2 C92.92 34.96 91.6 34.33 90.8 34.2 C90 34.07 88.57 34.17 88.3 34.4 C88.03 34.62 87.55 36.2 87.2 37.2 C86.85 38.2 85.3 39.67 86.2 40.4 C87.1 41.13 91.43 42.1 92.6 41.6 Z'],
    ['ink', 'M73 31.6 C72.97 30.3 72.9 28.6 73.4 27.4 C73.9 26.2 74.9 25.07 76 24.4 C77.1 23.73 78.67 23.4 80 23.4 C81.33 23.4 82.9 23.73 84 24.4 C85.1 25.07 86.1 26.2 86.6 27.4 C87.1 28.6 87.03 30.3 87 31.6 C86.97 32.9 86.8 34.2 86.4 35.2 C86 36.2 85.67 37.03 84.6 37.6 C83.53 38.17 81.53 38.6 80 38.6 C78.47 38.6 76.47 38.17 75.4 37.6 C74.33 37.03 74 36.2 73.6 35.2 C73.2 34.2 73.03 32.9 73 31.6 Z'],
    ['ink', 'M73.8 13.6 C73.78 13.15 74.57 11.07 75.6 10.2 C76.63 9.33 78.53 8.47 80 8.4 C81.47 8.33 83.33 9.13 84.4 9.8 C85.47 10.47 86.39 11.96 86.4 12.4 C86.42 12.84 85.63 14.8 84.6 15.6 C83.57 16.4 81.67 17.1 80.2 17.2 C78.73 17.3 76.87 16.8 75.8 16.2 C74.73 15.6 73.81 14.05 73.8 13.6 Z'],
    ['ink', 'M73.6 16.8 C73.4 16.15 73.53 15.03 73.8 14.2 C74.07 13.37 74.63 12.4 75.2 11.8 C75.77 11.2 76.6 10.77 77.2 10.6 C77.8 10.43 78.6 10.53 78.8 10.8 C79 11.07 78.67 11.8 78.4 12.2 C78.13 12.6 77.2 12.9 77.2 13.2 C77.2 13.5 78.23 13.6 78.4 14 C78.57 14.4 78.47 15.1 78.2 15.6 C77.93 16.1 77.33 16.58 76.8 17 C76.27 17.42 75.53 18.13 75 18.1 C74.47 18.07 73.8 17.45 73.6 16.8 Z'],
    ['ink', 'M86.4 16.8 C86.6 16.15 86.47 15.03 86.2 14.2 C85.93 13.37 85.37 12.4 84.8 11.8 C84.23 11.2 83.4 10.77 82.8 10.6 C82.2 10.43 81.4 10.53 81.2 10.8 C81 11.07 81.33 11.8 81.6 12.2 C81.87 12.6 82.8 12.9 82.8 13.2 C82.8 13.5 81.77 13.6 81.6 14 C81.43 14.4 81.53 15.1 81.8 15.6 C82.07 16.1 82.67 16.58 83.2 17 C83.73 17.42 84.47 18.13 85 18.1 C85.53 18.07 86.2 17.45 86.4 16.8 Z'],
  ];

  /** Sensor noise: grains of four kinds (light, dark, and two color casts), one path per kind. */
  const GRAIN = [0, 1, 2, 3].map((kind) => Array.from({ length: 65 }, (_, i) => {
    const seed = (i * 4 + kind) * 3;
    return circle(hash01(seed + 1) * PHOTO.w, hash01(seed + 2) * PHOTO.h, 0.5 + 0.45 * hash01(seed + 3));
  }).join(' '));
  /** Repeated lossy encoding: 8-unit blocks in a checkerboard of two faint tints. */
  const BLOCKS = [0, 1].map((alt) => {
    const cells = [];
    for (let bx = 0; bx < PHOTO.w; bx += 8) for (let by = 0; by < PHOTO.h; by += 8) if (((bx + by) % 16 === 0) === Boolean(alt)) cells.push(box(bx, by, 8, 8));
    return cells.join(' ');
  });
  /**
   * The photo at a token's size (about 26 pixels), in ten paths: the stands,
   * the crowd's heads and shirts, the field and its lines, and the receiver
   * in five flat paints. A stream draws many tokens, and the notes page copies
   * the stage once per cue, so a token stays this light.
   */
  const TOKEN_PAINTS = [['skin', ['skin']], ['jersey', ['jersey', 'sock', 'belt']], ['helmet', ['helmet', 'pants']], ['ball', ['ball', 'cleat']], ['glove', ['glove']]];
  const TOKEN = {
    heads: FANS.map(({ x, y, s }) => circle(x, y, 3.3 * s)).join(' '),
    shirts: FANS.map(({ x, y, s }) => box(x - 6 * s, y + 3.2 * s, 12 * s, 8.8 * s)).join(' '),
    receiver: TOKEN_PAINTS.map(([paint, parts]) => [paint, RECEIVER.filter(([part]) => parts.includes(part)).map(([, d]) => d).join(' ')]),
  };

  function photoGlyph(parent, look) {
    const art = svg('svg', { class: 'pf-photo-art', viewBox: look.crop ? '36 4 88 60.5' : `0 0 ${PHOTO.w} ${PHOTO.h}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, parent);
    const path = (d, cls) => svg('path', { d, class: cls }, art);
    path(box(0, 0, PHOTO.w, PHOTO.field), 'pf-stands');
    path(TOKEN.shirts, 'pf-shirt-0');
    path(TOKEN.heads, 'pf-skin-1');
    path(box(0, PHOTO.field, PHOTO.w, PHOTO.h - PHOTO.field), 'pf-field');
    path(FIELD_LINES, 'pf-yard-line');
    TOKEN.receiver.forEach(([paint, d]) => path(d, `pf-r-${paint}`));
    if (look.dark) path(box(0, 0, PHOTO.w, PHOTO.h), 'pf-veil');
    return art;
  }

  /**
   * The catch as a picture. look = { noise, dark, crop, blur, blocky }:
   * sensor grain, an underexposed veil, a crop to the catch, the fans' faces
   * pixelated, and the blocks that repeated lossy encoding leaves.
   */
  function photoArt(parent, look = {}) {
    const view = look.crop ? '36 4 88 60.5' : `0 0 ${PHOTO.w} ${PHOTO.h}`;
    const art = svg('svg', { class: 'pf-photo-art', viewBox: view, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, parent);
    const path = (d, cls) => svg('path', { d, class: cls }, art);
    path(box(0, 0, PHOTO.w, PHOTO.field), 'pf-stands');
    path(`${box(0, 15.6, PHOTO.w, 1.3)} ${box(0, 27.2, PHOTO.w, 1.3)}`, 'pf-tier');
    crowdOf(Boolean(look.blur)).forEach(([cls, d]) => path(d, cls));
    path(box(0, PHOTO.wall, PHOTO.w, PHOTO.field - PHOTO.wall), 'pf-wall');
    path(box(0, PHOTO.wall + 1.8, PHOTO.w, 1.1), 'pf-wall-stripe');
    path(box(0, PHOTO.field, PHOTO.w, PHOTO.h - PHOTO.field), 'pf-field');
    path(FIELD_BANDS, 'pf-field-band');
    path(box(0, PHOTO.field, PHOTO.w, 3), 'pf-field-shade');
    path(FIELD_LINES, 'pf-yard-line');
    RECEIVER.forEach(([part, d]) => path(d, `pf-r-${part}`));
    if (look.dark) path(box(0, 0, PHOTO.w, PHOTO.h), 'pf-veil');
    if (look.noise) GRAIN.forEach((d, kind) => path(d, `pf-grain-${kind}`));
    if (look.blocky) BLOCKS.forEach((d, alt) => path(d, alt ? 'pf-block pf-block--alt' : 'pf-block'));
    return art;
  }

  /**
   * A photo on paper: the picture, the paper's logo when `mark` is set
   * (`markCut` crops it in half), and an optional caption under it.
   */
  function photo(parent, { x, y, w = 200, look = {}, caption, at, until, how = 'pop', states = [] }) {
    const node = staged(parent, 'pf-photo', x, y);
    node.style.width = `${w}px`;
    const frame = el('div', 'pf-photo-frame', node);
    photoArt(frame, look);
    if (look.mark) el('span', `pf-logo${look.markCut ? ' pf-logo--cut' : ''}`, frame, 'PAPER');
    if (caption) el('span', 'pf-photo-caption', node, caption);
    if (states.length) arch.track(node, 'is-', states);
    return show(node, at, until, how);
  }

  /** A token's art: the photo in miniature, for photos sliding down pipes. */
  const photoToken = (look) => (node) => {
    node.classList.add('pf-token');
    photoGlyph(node, look);
  };

  // ------------------------------------------------------------------
  // Filters and pipes
  // ------------------------------------------------------------------

  /**
   * A filter: its name in a box with an input port on its left and an output
   * port on its right. states = [{ at, state, light }] sets its light (busy,
   * idle, waiting, crashed) and says it in words; `dial` adds a parameter on
   * its side.
   */
  function filter(parent, { x, y, w = 140, h = 84, name, at, until, how = 'pop', states = [], dial, ports = true }) {
    const node = staged(parent, 'pf-filter', x, y);
    node.style.width = `${w}px`;
    node.style.height = `${h}px`;
    el('b', 'pf-filter-name', node, name);
    if (ports) {
      el('span', 'ak-port ak-port--in', node);
      el('span', 'ak-port ak-port--out', node);
    }
    if (states.length) {
      const light = el('span', 'pf-light', node, '');
      arch.track(node, 'is-', states.map(({ at: when, state, light: words }) => ({ at: when, state, words: words ?? state })), light);
    }
    if (dial) {
      const knob = el('span', 'pf-dial', node);
      knob.append(icon('gear'));
      el('span', 'ak-mono', knob, dial);
    }
    return show(node, at, until, how);
  }

  /** A pipe: a tube from `from` to `to` ([x, y] points on its center line) with an arrowhead at `to`. */
  function pipe(parent, { from: [x1, y1], to: [x2, y2], at, until, tone }) {
    const node = staged(parent, `pf-pipe${tone ? ` pf-pipe--${tone}` : ''}`, x1, y1);
    node.style.width = `${Math.max(0, Math.hypot(x2 - x1, y2 - y1))}px`;
    node.style.rotate = `${((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI).toFixed(2)}deg`;
    fx.fadeIn(node, at, 0.35);
    if (until !== undefined) fx.fadeOut(node, until - 0.25, 0.25);
    return node;
  }

  /**
   * A line of filters left to right (names = filter names), joined by pipes:
   * x0 is the first box's left edge, `w` each box's width, `gap` each pipe's
   * length. Returns the boxes, the pipes, and each box's ports, for streams.
   */
  function line(parent, { x0 = 42, y, w = 140, h = 84, gap = 44, names, at, step = 0.15, specs = [], until }) {
    const boxes = names.map((name, i) => filter(parent, { x: x0 + i * (w + gap), y, w, h, name, at: at + i * step, until, ...(specs[i] || {}) }));
    const pipes = names.slice(1).map((_, i) => {
      const from = [x0 + i * (w + gap) + w + 10, y + h / 2];
      const to = [x0 + (i + 1) * (w + gap) - 10, y + h / 2];
      return { node: pipe(parent, { from, to, at: at + (i + 1) * step - 0.05, until }), from, to };
    });
    const inPort = (i) => [x0 + i * (w + gap) - 10, y + h / 2];
    const outPort = (i) => [x0 + i * (w + gap) + w + 10, y + h / 2];
    return { boxes, pipes, inPort, outPort, center: (i) => x0 + i * (w + gap) + w / 2 };
  }

  /** Photos sliding through a pipe: a stream of photo tokens from `from` to `to`. */
  function flow(parent, { from, to, at, until, every = 0.8, duration = 0.7, look = {} }) {
    return arch.stream(parent, { path: [from, to], at, until, every, duration, size: 26, kind: 'photo', art: photoToken(look) });
  }

  // ------------------------------------------------------------------
  // Batches, the gallery, and the editor's tools
  // ------------------------------------------------------------------

  /**
   * A batch as a timeline: one bar per step that fills from `at` over
   * `duration` (rows = [{ label, at, duration }]), with a clock that shows the
   * time each bar finishes (times = [{ at, text }]).
   */
  function bars(parent, { x, y, w, rows, at, until, clock }) {
    const node = staged(parent, 'pf-bars', x, y);
    node.style.width = `${w}px`;
    rows.forEach(({ label, at: barAt, duration }) => {
      const row = el('div', 'pf-bars-row', node);
      el('span', 'pf-bars-label', row, label);
      const fill = el('span', 'pf-bars-fill', el('span', 'pf-bars-track', row));
      onFrame((t) => { fill.style.width = `${(100 * progress(t, barAt, duration)).toFixed(1)}%`; });
    });
    if (clock) {
      const readout = el('p', 'pf-bars-clock', node, clock[0].text);
      arch.track(readout, 'is-', clock.map(({ at: when, text }) => ({ at: when, state: '', words: text })), readout);
    }
    return show(node, at, until, 'rise');
  }

  /** The paper's website gallery: photos that appear one by one (items = [{ at, look, caption }]). */
  function gallery(parent, { x, y, w = 300, title = 'Game photos', empty, items = [], at, until }) {
    const node = staged(parent, 'pf-gallery', x, y);
    node.style.width = `${w}px`;
    const head = el('div', 'pf-gallery-head', node);
    head.append(icon('globe'));
    el('b', null, head, title);
    const grid = el('div', 'pf-gallery-grid', node);
    if (empty) {
      const note = el('p', 'pf-gallery-empty', node, empty.text);
      if (empty.until !== undefined) fx.fadeOut(note, empty.until, 0.25);
    }
    items.forEach(({ at: itemAt, look, caption }) => {
      const cell = el('span', 'pf-gallery-cell is-staged', grid);
      photoArt(cell, look);
      if (caption) el('span', 'pf-gallery-caption', cell, caption);
      fx.pop(cell, itemAt, { from: 0.5 });
    });
    return show(node, at, until, 'slide');
  }

  /** The editor's slider: a track and a knob that slides to each { at, p } (0 to 1). */
  function slider(parent, { x, y, w = 360, label, at, until, moves = [] }) {
    const node = staged(parent, 'pf-slider', x, y);
    node.style.width = `${w}px`;
    el('span', 'pf-slider-label', node, label);
    const track = el('span', 'pf-slider-track', node);
    const knob = el('span', 'pf-slider-knob', track);
    const sorted = [{ at: -Infinity, p: 0.3 }, ...moves].sort((a, b) => a.at - b.at);
    onFrame((t) => {
      let p = sorted[0].p;
      for (let i = 1; i < sorted.length; i += 1) {
        if (t >= sorted[i].at + 0.6) p = sorted[i].p;
        else if (t > sorted[i].at) p = sorted[i - 1].p + (sorted[i].p - sorted[i - 1].p) * easeInOutCubic(progress(t, sorted[i].at, 0.6));
      }
      knob.style.left = `${(p * 100).toFixed(1)}%`;
    });
    return show(node, at, until, 'rise');
  }

  /** A tray that collects photos, counting them in words (counts = [{ at, n }]) until it holds `of`. */
  function tray(parent, { x, y, w = 300, title, of, counts, at, until }) {
    const node = staged(parent, 'pf-tray', x, y);
    node.style.width = `${w}px`;
    el('b', 'pf-tray-title', node, title);
    const slots = el('div', 'pf-tray-slots', node);
    const cells = Array.from({ length: of }, () => {
      const cell = el('span', 'pf-tray-cell', slots);
      photoArt(cell, {});
      return cell;
    });
    const readout = el('span', 'pf-tray-count', node, `0 of ${of}`);
    const sorted = [{ at: -Infinity, n: 0 }, ...counts].sort((a, b) => a.at - b.at);
    let shown = -1;
    onFrame((t) => {
      const { n } = arch.latest(sorted, t);
      if (n === shown) return;
      cells.forEach((cell, i) => cell.classList.toggle('is-full', i < n));
      readout.textContent = `${n} of ${of}`;
      shown = n;
    });
    return show(node, at, until, 'rise');
  }

  window.PipesKit = { photoArt, photo, photoToken, filter, pipe, line, flow, bars, gallery, slider, tray };
})();
