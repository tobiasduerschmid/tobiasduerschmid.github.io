/*
 * The hands of the "Design It In Before They Break In" figures: the sheriff (sheriff.js) and the
 * outlaw (outlaw.js). A hand is seen from the thumb's side and built from
 * its joints with SongFigure.finger (figure-geometry.js), so a pose blends
 * from one grip to another joint by joint. In a hand's own frame the wrist
 * is at (0, 0), the fingers point down (+y), and the palm faces −x; the far
 * fingers sit a little behind and higher, the index is nearest, and the
 * thumb is drawn last, over the curled fingers. Styles:
 * css/song-video-western-kit.css (`.sh-hand-*`, `.sh-finger*`, `.sh-nail`).
 */
(function () {
  'use strict';

  const { finger, clamp } = window.SongFigure;
  const { svg } = window.SongKit;

  // Each finger's root on the knuckle line, its phalanx lengths, and its
  // half-widths at root, knuckles, and tip. Stagger the four roots across
  // the palm instead of stacking them on one point; this keeps their
  // overlapping silhouettes readable in both open and curled poses.
  const FINGERS = [
    { root: [-1.4, 10.2], bones: [5.5, 3.4, 2.6], w: [1.55, 1.4, 1.2, 1.0] },
    { root: [0.8, 11.1], bones: [5.6, 3.6, 2.7], w: [1.6, 1.5, 1.3, 1.05] },
    { root: [2.6, 10.4], bones: [5.2, 3.4, 2.5], w: [1.5, 1.4, 1.2, 0.95] },
    { root: [4.0, 9.0], bones: [4.0, 2.7, 2.1], w: [1.3, 1.2, 1.0, 0.85] },
  ];
  const THUMB = { root: [-2.5, 5], bones: [3.5, 2.8], w: [1.9, 1.6, 1.15] };
  // A pointing hand rolls to show its back: the index meets the dorsal
  // edge of the palm, with the folded knuckles below it, not above it.
  const POINT_ROOTS = [[3.4, 10.8], [1.5, 11.1], [-0.2, 10.4], [-1.6, 9]];
  const smoothWeight = (value) => { const u = clamp(value, 0, 1); return u * u * (3 - 2 * u); };

  /**
   * Hand shapes as curls in degrees: for each finger [knuckle, middle, tip]
   * joint, bending towards the palm, then the thumb [spread, bend] (its
   * spread swings it away from the palm). Interpolating them blends shapes.
   * In a fist and a point the thumb lies along the curled middle finger,
   * inside the fist's outline, as a real thumb does; it never sticks out
   * past the knuckles.
   */
  const SHAPES = {
    rest: [12, 26, 14, 16, 34, 18, 20, 40, 20, 24, 44, 22, 12, 20],
    fist: [75, 85, 45, 78, 88, 48, 80, 88, 46, 82, 86, 44, -2, 6],
    point: [0, 1, 3, 70, 82, 42, 76, 85, 44, 80, 84, 42, 2, 25],
    open: [6, 8, 4, 4, 6, 4, 8, 8, 4, 12, 10, 6, -18, 6],
    grip: [42, 65, 35, 46, 68, 38, 50, 70, 38, 54, 70, 36, 10, 18],
    pinch: [55, 60, 30, 62, 76, 40, 68, 78, 42, 72, 78, 40, 18, 20],
    // A gunslinger's hand over the grip: fingers half curled, thumb out.
    claw: [30, 40, 22, 34, 44, 24, 38, 46, 26, 42, 48, 26, -14, 12],
  };

  /** Joint centres along a chain of bones from `root`, turning `curls` towards the palm. */
  function chain(root, bones, curls, start = 90) {
    const joints = [root];
    let angle = start, [x, y] = root;
    bones.forEach((length, i) => {
      angle += curls[i];
      x += length * Math.cos(angle * Math.PI / 180);
      y += length * Math.sin(angle * Math.PI / 180);
      joints.push([x, y]);
    });
    return joints;
  }

  /**
   * Draws one hand into `g`, filled with `fill` (a skin gradient, or a
   * glove's leather), and returns { shape(curls), grip }. The grip layer
   * sits between the palm and the near fingers for held handles. A shared
   * silhouette rim joins the parts; fine contours describe their overlap.
   */
  function hand(g, fill) {
    // All silhouette ink sits behind all skin fills. Overlapping fingers
    // therefore share one outer rim instead of accumulating thick seams.
    const silhouette = svg('g', {}, g);
    const add = (cls) => {
      const backing = svg('path', { class: 'sh-hand-backing' }, silhouette);
      const rim = svg('path', { class: 'sh-hand-rim' }, silhouette);
      const part = svg('g', {}, g);
      const body = svg('path', { class: `sh-skin ${cls}`, fill }, part);
      const ink = svg('path', { class: 'sh-hand-contour' }, part);
      return { ink, fill: body, backing, rim };
    };
    // The far fingers go first, then the palm, the index, and the thumb.
    const far = [3, 2, 1].map(() => add('sh-finger sh-finger--far'));
    const palm = add('sh-palm');
    const grip = svg('g', {}, g);
    const index = add('sh-finger');
    const thumb = add('sh-thumb');
    const nail = svg('ellipse', { class: 'sh-nail', rx: 0.7, ry: 1 }, g);
    const PALM = 'M-3.2 -0.8 C-3.4 1.4 -4 3.6 -3.8 6 C-3.8 8.4 -3.2 10.4 -1.8 11.6 C0 12.8 3.8 12.6 5.1 10.8 C5.6 8.6 5 6.2 4.4 4 C3.9 2 3.6 0.6 3.6 -0.8 Z';
    // Only the exposed silhouette outlines the palm; its knuckle line
    // merges with the fingers, and the wrist remains open to the forearm.
    palm.backing.setAttribute('d', PALM);
    palm.rim.setAttribute('d', PALM.replace(/ Z$/, ''));
    palm.fill.setAttribute('d', PALM);
    const draw = (part, joints, widths, open = [2, 2]) => {
      // Leave the root open where a finger merges into the palm; drawing
      // that hidden edge makes a detached, stacked-on finger seam.
      const drawn = finger(joints, widths, 1, [], open);
      part.backing.setAttribute('d', drawn.fill);
      part.rim.setAttribute('d', drawn.fill);
      part.ink.setAttribute('d', drawn.ink);
      part.fill.setAttribute('d', drawn.fill);
    };
    function shape(c) {
      const pointing = smoothWeight(1 - c[0] / 35) * smoothWeight((c[3] - 35) / 35);
      const fingerAt = (i, part) => {
        const f = FINGERS[i];
        const root = f.root.map((v, axis) => v + (POINT_ROOTS[i][axis] - v) * pointing);
        const joints = chain(root, f.bones, c.slice(i * 3, i * 3 + 3));
        draw(part, joints, f.w);
        return joints;
      };
      far.forEach((part, k) => fingerAt(3 - k, part));
      const tip = fingerAt(0, index);
      const tj = chain(THUMB.root, THUMB.bones, [c[12], c[13]], 112);
      draw(thumb, tj, THUMB.w, [1, 1]);
      const [nx, ny] = tj[tj.length - 1];
      nail.setAttribute('cx', nx.toFixed(2));
      nail.setAttribute('cy', ny.toFixed(2));
      const previous = tj[tj.length - 2];
      const angle = Math.atan2(ny - previous[1], nx - previous[0]) * 180 / Math.PI - 90;
      nail.setAttribute('transform', `rotate(${angle.toFixed(2)} ${nx.toFixed(2)} ${ny.toFixed(2)})`);
      return tip[tip.length - 1];
    }
    return { shape, grip };
  }

  window.FrontierHand = { hand, chain, SHAPES };
})();
