/*
 * Fixed, reusable artwork for the six consequences in My Teammate.
 * Geometry lives here; materials live in song-video-aftermath.css. The
 * aftermath controller owns visibility, placement, timing, and layer order;
 * local shape updates keep fire rooted and liquid trails attached to splashes.
 */
(function () {
  'use strict';

  const { svg } = window.SongKit;
  let instanceCount = 0;

  function path(parent, className, d) {
    return svg('path', { class: className, d }, parent);
  }

  function group(parent, name) {
    return svg('g', {
      class: `ta-art ta-${name}`,
      'data-aftermath-art': name,
      'aria-hidden': 'true'
    }, parent);
  }

  function gradient(defs, prefix, name, attrs, offsets, kind = 'linearGradient') {
    const id = `${prefix}-${name}`;
    const node = svg(kind, { id, ...attrs }, defs);
    offsets.forEach((offset, index) => {
      svg('stop', { offset, class: `ta-${name}-stop-${index}` }, node);
    });
    return `url(#${id})`;
  }

  function materials(root) {
    const prefix = `teammate-aftermath-${++instanceCount}`;
    const defs = svg('defs', {}, root);
    const metal = gradient(defs, prefix, 'metal', {
      gradientUnits: 'userSpaceOnUse', x1: -30, y1: 0, x2: 31, y2: 12
    }, [0, 0.24, 0.56, 1]);
    const interior = gradient(defs, prefix, 'interior', {
      gradientUnits: 'userSpaceOnUse', x1: 0, y1: -8, x2: 0, y2: 11
    }, [0, 1]);
    const paper = gradient(defs, prefix, 'paper', {
      gradientUnits: 'userSpaceOnUse', x1: -28, y1: -40, x2: 28, y2: 40
    }, [0, 0.55, 1]);
    const coffee = gradient(defs, prefix, 'coffee', {
      cx: '44%', cy: '43%', r: '58%'
    }, [0, 0.68, 1], 'radialGradient');
    const soot = gradient(defs, prefix, 'soot', {
      cx: '48%', cy: '60%', r: '64%'
    }, [0, 0.55, 1], 'radialGradient');
    const plume = gradient(defs, prefix, 'plume', {
      gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: 180
    }, [0, 0.2, 0.64, 1]);
    const filters = {};
    for (const [name, blur] of [['haze', 6], ['soft-soot', 2.2]]) {
      const id = `${prefix}-${name}`;
      const filter = svg('filter', { id, x: '-24%', y: '-18%', width: '148%', height: '136%' }, defs);
      svg('feGaussianBlur', { stdDeviation: blur }, filter);
      filters[name] = `url(#${id})`;
    }
    return { metal, interior, paper, coffee, soot, plume, ...filters };
  }

  // Only these instance-specific resource references use inline properties.
  // The CSS module owns their fill/filter application and every static color.
  function bindMaterial(node, name, resource) {
    node.style.setProperty(`--ta-${name}`, resource);
  }

  /** A tapered cylinder: shared projection for the rim, hoops, mesh and foot. */
  function bin(root, paints) {
    const back = group(root, 'bin-back');
    bindMaterial(back, 'interior', paints.interior);
    svg('ellipse', { class: 'ta-contact-shadow', cx: 3, cy: 65, rx: 35, ry: 6 }, back);
    svg('ellipse', { class: 'ta-bin-rim-back', cx: 0, cy: 0, rx: 34, ry: 10.6 }, back);
    svg('ellipse', { class: 'ta-bin-interior', cx: 0, cy: 0, rx: 30, ry: 8.8 }, back);
    path(back, 'ta-bin-interior-seam', 'M-27 0 A27 7.6 0 0 1 27 0');
    path(back, 'ta-metal-glint', 'M-28-5.8 A34 10.6 0 0 1 23-7.8');

    const front = group(root, 'bin-front');
    bindMaterial(front, 'metal', paints.metal);
    const body = 'M-32 1 A32 10 0 0 0 32 1 L24 57 A24 7.5 0 0 1 -24 57 Z';
    path(front, 'ta-bin-body', body);
    const meshId = `bin-mesh-${++instanceCount}`;
    const clip = svg('clipPath', { id: meshId }, svg('defs', {}, front));
    path(clip, '', body);
    const mesh = svg('g', { 'clip-path': `url(#${meshId})` }, front);
    path(front, 'ta-bin-side-shade', 'M20 8.8 A32 10 0 0 0 32 1 L24 57 A24 7.5 0 0 1 14 63.1 Z');
    path(front, 'ta-bin-side-light', 'M-26 6.8 Q-22 9-17 9.5 L-13 63.3 Q-17 62.8-20 61.1 Z');
    // Project diagonal wires around the curved front surface. Their spacing
    // compresses at the sides and their radius narrows toward the floor.
    const projection = .3125, turn = 1.8;
    const surface = (h, angle, direction) => {
      const radius = 32 - 8 * h;
      return {
        x: radius * Math.sin(angle), y: 1 + 56 * h + projection * radius * Math.cos(angle),
        dx: -8 * Math.sin(angle) + radius * Math.cos(angle) * direction * turn,
        dy: 56 + projection * (-8 * Math.cos(angle) - radius * Math.sin(angle) * direction * turn)
      };
    };
    const point = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    for (const direction of [-1, 1]) {
      for (let offset = -3; offset <= 3; offset += .48) {
        const limits = [(-Math.PI / 2 - offset) / (direction * turn), (Math.PI / 2 - offset) / (direction * turn)].sort((a, b) => a - b);
        const start = Math.max(.16, limits[0]), end = Math.min(.94, limits[1]);
        if (end <= start) continue;
        let previous = surface(start, offset + direction * turn * start, direction);
        let d = `M${point(previous.x, previous.y)}`;
        const step = (end - start) / 6;
        for (let i = 1; i <= 6; i++) {
          const h = start + step * i, next = surface(h, offset + direction * turn * h, direction);
          d += ` C${point(previous.x + previous.dx * step / 3, previous.y + previous.dy * step / 3)} ${point(next.x - next.dx * step / 3, next.y - next.dy * step / 3)} ${point(next.x, next.y)}`;
          previous = next;
        }
        path(mesh, 'ta-bin-mesh', d);
      }
    }
    path(front, 'ta-bin-hoop', 'M-30.72 9.96 A30.72 9.6 0 0 0 30.72 9.96 M-24.48 53.64 A24.48 7.65 0 0 0 24.48 53.64');
    path(front, 'ta-bin-outline', body);
    path(front, 'ta-bin-rim-front', 'M-34 0 A34 10.6 0 0 0 34 0 L33 3 A33 10.3 0 0 1 -33 3 Z');
    path(front, 'ta-metal-glint', 'M-29 5.5 A34 10.6 0 0 0 25 7.2');
    path(front, 'ta-bin-foot', 'M-24 57 A24 7.5 0 0 0 24 57');
    path(front, 'ta-bin-base-light', 'M-21 60 Q0 70 21 60');
    path(front, 'ta-bin-rim-seam', 'M-32 3 Q0 23 32 3');
    for (const x of [-28, 28]) {
      svg('ellipse', { class: 'ta-bin-rivet', cx: x, cy: 13, rx: .8, ry: 1.2 }, front);
    }
    return { binBack: back, binFront: front };
  }

  /** Crumpled report: x=-30..30, y=-40..40, three large error marks. */
  function report(root, paints) {
    const node = group(root, 'report');
    bindMaterial(node, 'paper', paints.paper);
    path(node, 'ta-paper-thickness', 'M-28-34 L16-37 L29-25 L26 30 L18 41 L-25 36 L-30 8 Z');
    path(node, 'ta-report-sheet', 'M-27-37 L15-40 L29-27 L25 27 L17 38 L-24 33 L-29 5 Z');
    path(node, 'ta-paper-fold-shade', 'M-27-37 L-11-6 L-24 33 L-29 5 Z M-11-6 L13 8 L17 38 L6 21 Z M15-40 L29-27 L14-25 Z');
    path(node, 'ta-paper-fold-light', 'M-27-37 L-11-6 L-5-28 Z M-11-6 L13 8 L25 27 L19 3 Z');
    path(node, 'ta-paper-crease', 'M-27-37 L-11-6 L-24 33 M-11-6 L13 8 L17 38 M-11-6 L22-18 M13 8 L25 27');
    path(node, 'ta-report-fold', 'M15-40 L14-25 L29-27');
    path(node, 'ta-report-cross', 'M-15-28 L-4-18 M-4-29 L-15-17 M4-11 L16 0 M16-11 L4 0 M-12 10 L-1 22 M-1 11 L-13 21');
    path(node, 'ta-report-rule', 'M1-22 L7-22 M-18-1 L-11 1 M5 28 L12 29');
    path(node, 'ta-paper-edge-light', 'M-24-35 L11-38 M-21 31 L15 36');
    return node;
  }

  /** Palette impact at (0, 0): fixed 72×65 splash; trails grow to y=139. */
  function paint(root) {
    const node = group(root, 'paint');
    // Share the held palette's five CSS fills so the impact retains its colors.
    const pools = [
      ['red', 'M-7-11 C-11-17-10-26-14-27 C-18-28-15-20-20-20 C-25-20-29-29-32-26 C-35-23-24-18-26-15 C-28-12-34-15-35-11 C-36-7-28-9-26-5 C-24-1-29 3-25 6 C-20 10-17 3-12 6 C-6 10 3 4 3-3 C3-7-1-10-7-11 Z'],
      ['gold', 'M-6-19 C-7-24-11-28-8-31 C-4-34-2-23 1-25 C4-26 3-33 7-32 C11-31 7-24 11-23 C15-22 21-28 23-24 C25-20 15-18 16-13 C17-9 21-7 18-3 C13 3 8-1 4 2 C-2 5-10 0-11-7 C-12-12-4-14-6-19 Z'],
      ['blue', 'M14-13 C19-18 21-13 25-15 C29-18 31-20 33-17 C35-13 26-9 29-6 C31-3 37-4 36 0 C35 4 26 1 27 6 C28 11 34 11 31 15 C28 19 24 12 20 15 C14 19 5 15 3 9 C0 3 5-1 7-5 C9-10 10-10 14-13 Z'],
      ['green', 'M8 9 C13 6 18 10 22 12 C26 14 31 17 29 20 C27 23 23 18 21 21 C19 24 26 28 22 30 C18 32 17 25 14 26 C10 27 11 33 7 31 C3 29 7 23 3 22 C-1 22-5 24-6 20 C-8 15 2 9 8 9 Z'],
      ['violet', 'M-11 2 C-5-1 3 4 4 10 C6 16 1 20-4 20 C-8 20-7 28-11 28 C-16 28-10 20-15 20 C-20 19-24 27-27 24 C-30 20-19 16-22 13 C-24 10-31 12-32 9 C-33 5-24 6-23 3 C-22-1-15-1-11 2 Z']
    ];
    // Only the lower y coordinates change; the splash roots and every x
    // coordinate remain fixed as the thick paint runs down the wall.
    const trails = [
      ['red', 45, y => `M-21 1 C-21 14-18 ${y(21,.2)}-19 ${y(32,.5)} C-20 ${y(39,.7)}-22 ${y(44,.9)}-21 ${y(47,1)} C-20 ${y(51,1)}-16 ${y(50,1)}-16 ${y(46,1)} C-16 ${y(42,.85)}-18 ${y(38,.65)}-17 ${y(32,.5)} C-16 ${y(21,.2)}-18 14-17 3 Z`],
      ['green', 64, y => `M10 21 C9 33 12 ${y(43,.3)} 10 ${y(54,.6)} C8 ${y(62,.8)} 8 ${y(68,.95)} 9 ${y(72,1)} C10 ${y(77,1)} 15 ${y(75,1)} 14 ${y(71,1)} C12 ${y(67,.95)} 12 ${y(62,.8)} 13 ${y(55,.6)} C15 ${y(42,.3)} 12 33 14 23 Z`],
      ['violet', 55, y => `M-9 16 C-9 29-6 ${y(36,.3)}-7 ${y(45,.6)} C-8 ${y(50,.8)}-9 ${y(55,.95)}-8 ${y(58,1)} C-7 ${y(62,1)}-3 ${y(60,1)}-4 ${y(57,1)} C-5 ${y(53,.9)}-5 ${y(50,.8)}-4 ${y(45,.6)} C-3 ${y(34,.3)}-7 29-5 18 Z`]
    ];
    const relief = svg('g', { class: 'ta-paint-relief', transform: 'translate(0.6 1.2)' }, node);
    const flowing = trails.map(([tone, extension, draw]) => {
      const d = draw(value => value);
      return { extension, draw, shadow: path(relief, '', d), body: path(node, `ta-paint-body ta-paint-drip oc-dab--${tone}`, d) };
    });
    pools.forEach(([, d]) => path(relief, '', d));
    const defs = svg('defs', {}, node);
    const sheen = gradient(defs, `paint-${++instanceCount}`, 'wet-paint', { x1: 0, y1: 0, x2: 0.8, y2: 1 }, [0, .45, 1]);
    pools.forEach(([tone, d]) => {
      path(node, `ta-paint-body ta-paint-pool oc-dab--${tone}`, d);
      const volume = path(node, 'ta-paint-volume', d);
      bindMaterial(volume, 'wet-paint', sheen);
    });
    // Short curved highlights describe thick wet ridges, not a flat confetti mark.
    path(node, 'ta-paint-ridge', 'M-23-14 C-20-17-16-16-14-12 M-7-16 C-4-21 1-22 5-20 M17-9 C20-11 24-10 25-7 M10 14 C15 11 20 15 21 17 M-20 10 C-17 6-12 6-8 8');
    path(node, 'ta-paint-glint', 'M-21-14 l2-0.5 M-4-18 l2-1 M20-8 l2 1 M12 15 l2 0 M-16 9 l2-0.5');
    const dripGlints = path(node, 'ta-paint-glint', '');
    path(node, 'ta-paint-lowlight', 'M-21-3 Q-17 1-13 1 M4-6 Q8-4 11-7 M17 6 Q21 8 24 6 M4 20 Q7 23 10 21 M-17 16 Q-13 18-10 15');
    for (const [tone, cx, cy, rx, ry, turn] of [
      ['red', -35, -22, 1.4, 2.3, -40], ['gold', 17, -32, 1.1, 1.7, 25],
      ['blue', 36, -11, 1.2, 1.8, 45], ['green', 31, 27, 1.2, 1.7, -30],
      ['violet', -34, 19, 1.4, 1, 0]
    ]) {
      svg('ellipse', { class: `ta-paint-body oc-dab--${tone}`, cx, cy, rx, ry, transform: `rotate(${turn} ${cx} ${cy})` }, node);
    }
    function updatePaintDrips(elapsed, { growthDuration = 120 } = {}) {
      const u = Math.max(0, Math.min(1, elapsed / growthDuration));
      for (const { extension, draw, shadow, body } of flowing) {
        const d = draw((value, fraction) => (value + extension * u * fraction).toFixed(2));
        shadow.setAttribute('d', d);
        body.setAttribute('d', d);
      }
      const y = (value, amount) => (value + u * amount).toFixed(2);
      dripGlints.setAttribute('d', `M11 ${y(35,12.8)} C12 ${y(41,22.4)} 12 ${y(45,28.8)} 11 ${y(48,35.2)} M-6 ${y(36,16.5)} L-5 ${y(42,22)} M-19 ${y(34,22.5)} L-19 ${y(39,27)}`);
    }
    updatePaintDrips(0);
    return { paint: node, updatePaintDrips };
  }

  /** Wall impact at (0, 0); fixed splatter ±27×25, drips grow to y=133. */
  function coffee(root, paints) {
    const stain = group(root, 'coffee');
    bindMaterial(stain, 'coffee', paints.coffee);
    const outline = 'M-8-20 C-6-24-4-24-3-20 C0-16 6-16 11-20 C14-23 16-22 15-18 C14-13 18-12 23-13 C28-14 29-11 25-9 C19-5 22-2 25 0 C28 3 26 5 23 5 C18 5 19 10 21 13 C22 17 18 17 15 15 C11 13 10 21 6 20 C2 19-1 18-5 21 C-9 23-10 19-11 16 C-13 12-17 14-19 10 C-20 7-18 5-23 3 C-28 0-25-3-22-3 C-17-3-18-8-21-10 C-25-14-23-16-19-14 C-14-11-12-14-12-18 C-12-22-10-24-8-20 Z';
    path(stain, 'ta-coffee-wash', outline);
    path(stain, 'ta-coffee-drying-edge', outline);
    path(stain, 'ta-coffee-pooling', 'M-11 5 C-6 10 0 7 4 11 C8 15 14 10 17 9 C12 21 7 17 1 18 C-6 21-10 14-11 5 Z');
    for (const [cx, cy, r] of [[-27, -14, 2.4], [23, -18, 1.7], [29, 3, 2.1], [-22, 22, 1.5], [14, 25, 1.7]]) {
      svg('circle', { class: 'ta-coffee-satellite', cx, cy, r }, stain);
    }
    path(stain, 'ta-coffee-tide', 'M-18-8 C-13-5-16 1-12 5 M-9 12 Q0 19 7 15 M15-9 Q20-5 18 0');
    for (let i = 0; i < 18; i++) {
      const angle = i * 2.39996, r = 22 + (i % 4) * 1.6;
      svg('ellipse', { class: 'ta-coffee-speck', cx: Math.cos(angle) * r, cy: Math.sin(angle) * r * .8, rx: .3 + (i % 3) * .15, ry: .6 + (i % 4) * .2, transform: `rotate(${angle * 180 / Math.PI})` }, stain);
    }
    const drips = group(root, 'drips');
    const trails = path(drips, 'ta-coffee-drip', '');
    const longDrop = svg('ellipse', { class: 'ta-coffee-drop', cx: -5, cy: 72, rx: 1.9, ry: 3 }, drips);
    const shortDrop = svg('ellipse', { class: 'ta-coffee-drop', cx: 11, cy: 55, rx: 1.4, ry: 2.2 }, drips);
    function updateCoffeeDrips(elapsed, { growthDuration = 76 } = {}) {
      const u = Math.max(0, Math.min(1, elapsed / growthDuration));
      const y = (value, amount) => (value + u * amount).toFixed(2);
      trails.setAttribute('d', `M-5 16 C-6 27-3 ${y(35,11.6)}-4 ${y(47,31.9)} C-5 ${y(57,46.4)}-6 ${y(66,55.1)}-5 ${y(72,58)} M11 16 C10 25 12 ${y(32,12.6)} 11 ${y(41,25.2)} C10 ${y(47,33.6)} 11 ${y(52,39.9)} 11 ${y(55,42)}`);
      longDrop.setAttribute('cy', y(72,58));
      shortDrop.setAttribute('cy', y(55,42));
    }
    updateCoffeeDrips(0);
    return { coffee: stain, drips, updateCoffeeDrips };
  }

  /** Ceramic cluster: x=-23..24, y=-9..9; wet patch is in the floor plane. */
  function fragments(root) {
    const node = group(root, 'fragments');
    path(node, 'ta-coffee-floor', 'M-23 7 C-21 3-11 4-6 3 C2 1 9 6 16 4 C22 3 27 7 22 10 C17 13 8 10 1 12 C-8 13-17 11-23 10 Z');
    path(node, 'ta-fragment-shadow', 'M-22 6 L-10 0 L3 7 L-3 10 Z M7 5 L18 1 L25 8 L13 10 Z');
    path(node, 'ta-ceramic', 'M-21 3 L-16-6 L-7-2 L-2 5 L-9 8 Z');
    path(node, 'ta-ceramic-band', 'M-20 1 L-18-3 L-7 1 L-4 5 L-10 5 Z');
    path(node, 'ta-ceramic-edge', 'M-16-6 L-7-2 L-2 5 M-21 3 L-9 8');
    path(node, 'ta-ceramic', 'M1 3 L6-7 L12-3 L15 6 L8 8 Z');
    path(node, 'ta-ceramic-band', 'M3-1 L6-5 L11-2 L12 1 Z');
    path(node, 'ta-ceramic-edge', 'M6-7 L12-3 L15 6');
    path(node, 'ta-ceramic-handle-shadow', 'M15 1 C22-8 29 1 21 6');
    path(node, 'ta-ceramic-handle', 'M15-1 C22-10 27-1 21 4');
    path(node, 'ta-ceramic-chip', 'M-2-1 L0-5 L3-1 Z M-20 9 L-17 6 L-14 9 Z');
    return node;
  }

  /** A broad 180×280 soot deposit, centred on (0, 0), tapered at its top. */
  function scorch(root, paints) {
    const node = group(root, 'scorch');
    bindMaterial(node, 'soot', paints.soot);
    bindMaterial(node, 'haze', paints.haze);
    bindMaterial(node, 'soft-soot', paints['soft-soot']);
    const envelope = 'M-4-140 C-17-119-10-109-25-94 C-39-79-24-68-43-47 C-55-34-44-20-63-5 C-79 8-66 24-78 41 C-92 61-75 75-87 91 C-96 109-69 114-57 125 C-39 139-18 129-1 138 C17 143 31 129 51 130 C73 131 69 111 83 101 C96 85 77 73 83 54 C88 35 67 24 67 8 C68-10 50-18 48-37 C45-57 29-62 30-79 C31-94 16-98 15-113 C14-128 6-130-4-140 Z';
    path(node, 'ta-scorch-warm-haze', envelope);
    path(node, 'ta-scorch-soot', envelope);
    path(node, 'ta-scorch-core', 'M-3-115 C-17-84-9-67-27-39 C-37-23-27-5-46 18 C-63 43-43 62-58 84 C-71 107-36 111-18 117 C4 127 28 113 45 114 C69 108 57 87 65 69 C69 49 45 34 46 15 C45-9 27-18 27-38 C26-59 12-66 13-85 C12-100 3-104-3-115 Z');
    path(node, 'ta-scorch-char', 'M-5-77 C-21-39-3-23-23 10 C-37 34-20 52-33 80 C-41 95-11 102 2 100 C23 106 20 80 33 68 C40 51 22 26 23 10 C22-17 7-28 8-48 C8-62 1-68-5-77 Z');
    path(node, 'ta-soot-streak', 'M-31-14 C-43 19-34 43-50 65 M-13-75 C-24-43-15-24-28-3 M26-30 C31-8 39 7 36 29 M-3 10 C-10 37 2 53-8 77 M48 58 C50 77 39 87 39 100');
    path(node, 'ta-soot-grain', 'M-54 34 Q-67 42-57 54 Q-47 51-54 34 Z M-46 83 Q-55 97-40 104 Q-30 96-46 83 Z M-22 103 Q-34 111-21 116 Q-10 110-22 103 Z M17 80 Q7 93 18 98 Q29 88 17 80 Z M46 77 Q37 90 49 95 Q59 86 46 77 Z M-18-49 Q-26-39-18-30 Q-10-40-18-49 Z M19-13 Q11-3 22 7 Q30-3 19-13 Z M34 37 Q24 47 37 55 Q46 48 34 37 Z');
    return node;
  }

  /** Small rooted flames in stage coordinates, bounded by the existing scorch. */
  function flames(root) {
    const node = group(root, 'flames');
    const tongues = [
      [620, 178, 1, 1, 0], [648, 150, 1.1, .9, 1.7], [663, 203, .9, .85, 3.9],
      [602, 208, 12, .8, 2.6], [674, 236, 24, .7, 5.1],
      [629, 125, 30, .65, 4.5], [678, 176, 36, .75, 6.2]
    ].map(([x, y, from, size, phase], index) => {
      const anchor = svg('g', { transform: `translate(${x} ${y})` }, node);
      const flame = svg('g', {}, anchor);
      path(flame, 'ta-flame-root', 'M-5 0 C-2-2 3-2 6 0 C4 2-2 3-5 0 Z');
      const shell = path(flame, 'ta-flame-shell', '');
      const fold = path(flame, 'ta-flame-fold', '');
      const core = path(flame, 'ta-flame-core', '');
      const edge = path(flame, 'ta-flame-edge', '');
      return { anchor, flame, shell, fold, core, edge, from, size, phase, mirror: index % 2 ? -1 : 1 };
    });
    const ease = value => {
      const u = Math.max(0, Math.min(1, value));
      return u * u * (3 - 2 * u);
    };
    function updateFlames(elapsed, { reducedMotion = false, growthDuration = 44 } = {}) {
      // Rooted fire spreads until the curtain closes. Independent curls and
      // tips move through the silhouette, rather than rotating a rigid flame.
      const growth = .5 + .4 * Math.max(0, Math.min(1, elapsed / growthDuration));
      const n = value => Number(value.toFixed(2));
      for (const { anchor, flame, shell, fold, core, edge, from, size, phase, mirror } of tongues) {
        anchor.classList.toggle('tm-aftermath-hidden', elapsed < from);
        const ignition = ease((elapsed - from) / (from > 2 ? 5 : .7));
        const scale = size * growth * ignition;
        const wave = (frequency, offset = 0) => reducedMotion ? 0 : Math.sin(elapsed * frequency + phase + offset);
        const tip = 2.8 * wave(3.3) + .9 * wave(5.7, .6);
        const rise = 2.5 * wave(4.1, 1.3);
        const curl = 1.8 * wave(3.8, 2.1);
        const inner = 1.4 * wave(4.6, .8) + .4 * wave(6.2, 2.4);
        const heart = 1.7 * wave(3.1, 3.2);
        flame.setAttribute('transform', `scale(${(scale * mirror).toFixed(4)} ${scale.toFixed(4)})`);
        shell.setAttribute('d', `M-4 0 C-7-4 ${n(-5+curl*.2)}-9 ${n(-2+tip*.3)}-13 C${n(tip*.6)}-16 ${n(-1+tip)} ${n(-20+rise*.7)} ${n(1+tip)} ${n(-24+rise)} C${n(2+tip)} ${n(-18+rise*.6)} ${n(5+curl)}-16 ${n(4+curl*.2)}-11 C${n(6+curl)}-13 ${n(7+curl)} ${n(-16-rise*.3)} ${n(7+curl)} ${n(-18-rise*.4)} C${n(10+curl*.2)}-9 8-3 4 0 C1 2-2 2-4 0 Z`);
        fold.setAttribute('d', `M-3 0 C-6-5 ${n(-2+inner*.4)}-10 ${n(-1+inner)} ${n(-13+heart)} C${n(inner)}-8 ${n(3+inner*.5)}-8 3-4 C5-6 ${n(6+curl*.5)}-9 ${n(6+curl*.5)} ${n(-12-heart*.4)} C8-7 6-2 3 0 C1 2-1 2-3 0 Z`);
        core.setAttribute('d', `M-1 0 C-3-3 ${n(-1+inner)}-6 ${n(1+inner)} ${n(-10+heart)} C${n(1+inner*.4)}-6 5-4 3-1 C2 1 0 2-1 0 Z`);
        edge.setAttribute('d', `M-3-7 C${n(-2+tip*.2)}-10 ${n(1+tip*.4)}-13 ${n(1+tip*.6)} ${n(-17+rise*.4)}`);
      }
    }
    updateFlames(-1, { reducedMotion: true });
    return { flames: node, updateFlames };
  }

  /** Nozzle at (0, 0); a soft plume widens downward to y=180, x=±54. */
  function exhaust(root, paints) {
    const node = group(root, 'exhaust');
    bindMaterial(node, 'plume', paints.plume);
    bindMaterial(node, 'haze', paints.haze);
    path(node, 'ta-exhaust-haze', 'M-6 0 C-14 29-17 44-23 65 C-32 90-24 105-39 128 C-52 146-43 162-54 180 L54 180 C42 153 47 137 32 117 C22 96 31 79 19 54 C12 34 13 16 6 0 Z');
    path(node, 'ta-exhaust-plume', 'M-5 0 C-12 33-7 48-18 70 C-28 94-15 105-30 128 C-41 145-29 167-39 180 L42 180 C31 161 37 144 26 122 C13 96 24 80 14 56 C6 37 10 17 5 0 Z');
    path(node, 'ta-exhaust-core', 'M-3 0 C-8 27-2 38-8 55 C-14 75-4 91-13 111 C-17 125-8 143-10 158 C3 148 10 135 6 119 C1 103 13 89 8 72 C2 53 9 38 4 22 L3 0 Z');
    return node;
  }

  /**
   * Append one bounded prop set to an SVG. Callers may reparent the returned
   * groups into persistent scene layers; the resource IDs remain unique.
   * The bin back and front share one origin and must bracket falling paper.
   */
  function create(svgRoot) {
    const paints = materials(svgRoot);
    return {
      ...bin(svgRoot, paints),
      report: report(svgRoot, paints),
      ...paint(svgRoot),
      ...coffee(svgRoot, paints),
      fragments: fragments(svgRoot),
      scorch: scorch(svgRoot, paints),
      ...flames(svgRoot),
      exhaust: exhaust(svgRoot, paints)
    };
  }

  window.TeammateAftermathArt = { create };
})();
