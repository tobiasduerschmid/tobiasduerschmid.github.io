/*
 * The hands of the "Design It In" figures: the sheriff (sheriff.js) and the
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

  const { finger } = window.SongFigure;
  const { svg } = window.SongKit;

  // Each finger's root on the knuckle line, its phalanx lengths, and its
  // half-widths at root, knuckles, and tip.
  const FINGERS = [
    { root: [1.2, 10.4], bones: [5.2, 3.4, 2.6], w: [1.9, 1.75, 1.6, 1.45] },
    { root: [0.4, 10.9], bones: [5.6, 3.6, 2.7], w: [1.9, 1.75, 1.6, 1.45] },
    { root: [-0.2, 10.6], bones: [5.2, 3.4, 2.5], w: [1.8, 1.65, 1.5, 1.35] },
    { root: [-0.6, 10.0], bones: [4.2, 2.8, 2.2], w: [1.6, 1.5, 1.35, 1.2] },
  ];
  const THUMB = { root: [-2.6, 3.4], bones: [4.4, 3.2], w: [2.2, 1.9, 1.6] };

  /**
   * Hand shapes as curls in degrees: for each finger [knuckle, middle, tip]
   * joint, bending towards the palm, then the thumb [spread, bend] (its
   * spread swings it away from the palm). Interpolating them blends shapes.
   * In a fist and a point the thumb lies along the curled middle finger,
   * inside the fist's outline, as a real thumb does; it never sticks out
   * past the knuckles.
   */
  const SHAPES = {
    rest: [22, 32, 20, 26, 36, 22, 30, 38, 24, 34, 40, 26, 18, 20],
    fist: [84, 96, 62, 86, 98, 64, 88, 98, 62, 90, 96, 60, -2, 6],
    point: [2, 4, 2, 84, 98, 64, 88, 98, 62, 90, 96, 60, -2, 8],
    open: [6, 8, 4, 4, 6, 4, 8, 8, 4, 12, 10, 6, -18, 6],
    grip: [62, 78, 46, 64, 80, 48, 66, 80, 46, 68, 78, 44, 40, 22],
    pinch: [44, 52, 30, 70, 84, 52, 76, 86, 52, 80, 84, 50, 34, 30],
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
   * glove's leather), and returns { shape(curls) }, which redraws its
   * fingers and returns the index fingertip.
   */
  function hand(g, fill) {
    const halo = svg('g', {}, g);
    const parts = [];
    const add = (cls) => {
      const ink = svg('path', { class: 'sh-hand-ink' }, halo);
      const body = svg('path', { class: `sh-skin ${cls}`, fill }, g);
      const line = svg('path', { class: 'sh-hand-line' }, g);
      parts.push({ ink, fill: body, line });
      return parts[parts.length - 1];
    };
    // The far fingers go first, then the palm, the index, and the thumb.
    const far = [3, 2, 1].map(() => add('sh-finger sh-finger--far'));
    const palm = add('sh-palm');
    const index = add('sh-finger');
    const thumb = add('sh-thumb');
    const nail = svg('ellipse', { class: 'sh-nail', rx: 0.7, ry: 1 }, g);
    const PALM = 'M-3.4 -0.6 C-3.9 3 -3.8 7.4 -2.6 10.6 C-1.4 12.2 1.8 12.4 3.2 11 C4.2 7.6 4.2 3 3.6 -0.6 Z';
    palm.ink.setAttribute('d', PALM);
    palm.fill.setAttribute('d', PALM);
    palm.line.setAttribute('d', 'M3.6 -0.6 C4.2 3 4.2 7.6 3.2 11');
    const draw = (part, joints, widths) => {
      const drawn = finger(joints, widths, 1, [], [1, 1]);
      part.ink.setAttribute('d', drawn.fill);
      part.fill.setAttribute('d', drawn.fill);
      part.line.setAttribute('d', drawn.ink);
    };
    function shape(c) {
      const fingerAt = (i, part) => {
        const f = FINGERS[i];
        const joints = chain(f.root, f.bones, c.slice(i * 3, i * 3 + 3));
        draw(part, joints, f.w);
        return joints;
      };
      far.forEach((part, k) => fingerAt(3 - k, part));
      const tip = fingerAt(0, index);
      const tj = chain(THUMB.root, THUMB.bones, [c[12], c[13]], 112);
      draw(thumb, tj, THUMB.w);
      const [nx, ny] = tj[tj.length - 1];
      nail.setAttribute('cx', nx.toFixed(2));
      nail.setAttribute('cy', ny.toFixed(2));
      return tip[tip.length - 1];
    }
    return { shape };
  }

  window.FrontierHand = { hand, chain, SHAPES };
})();
