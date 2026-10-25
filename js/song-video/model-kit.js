/*
 * Model kit for "Draw It Out" (the UML song): real UML notation drawn by
 * ArchUML (js/ArchUML/uml-bundle.js) on paper sheets, plus the emphasis the
 * choreography lays over it.
 *
 *   diagram()     renders an ArchUML spec (class, sequence, state, or
 *                 component) onto a sheet; the returned object finds boxes,
 *                 messages, transitions, and characters in the drawing and
 *                 rings, dims, crosses, traces, or labels them;
 *   code()        a few lines of source beside the notation, where a line
 *                 can be marked or rewritten.
 *
 * ArchUML draws each diagram once, in an off-screen host that is laid out
 * even while the player keeps the stage hidden. The kit records the geometry
 * of every drawn element there (in the SVG's own user units), then moves the
 * SVG onto its sheet. Emphasis lives in an overlay group inside the same
 * SVG, so it scales with the notation it points at. Every pose is a pure
 * function of song time (Timeline tweens and frame updaters).
 *
 * Coordinates of sheets and cards are CSS pixels on the 960×540 stage; the
 * diagram methods take ArchUML labels or boxes in diagram units. The
 * pictures beside the notation come from js/song-video/sketch-kit.js.
 * Styles: css/song-video-model-kit.css.
 */
(function () {
  'use strict';

  const { tween, fx, onFrame, EASE, progress, easeInOutCubic } = window.Timeline;
  const kit = window.SongKit;
  const { el, svg, place } = kit;

  const RENDERERS = {
    class: 'UMLClassDiagram',
    sequence: 'UMLSequenceDiagram',
    state: 'UMLStateDiagram',
    component: 'UMLComponentDiagram',
  };
  const DRAWN = 'rect, text, line, polyline, polygon, path, circle, ellipse';
  const SHAPES = 'rect, ellipse, polygon';

  /**
   * How long a label or highlight must stay up for a viewer to find and read
   * it while the song goes on: 1.5 s at least, else 0.6 s to find it plus
   * three words a second (about caption reading speed). A planning estimate
   * for this song's pacing, not a research constant.
   */
  function readTime(text = '') {
    const words = String(text).trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1.5, 0.6 + words / 3);
  }

  /** An `until` pushed back, if needed, so the emphasis stays up for its reading time. */
  const holdUntil = (at, until, text) => (until === undefined ? undefined : Math.max(until, at + readTime(text)));

  // ------------------------------------------------------------------
  // Off-screen rendering and geometry
  // ------------------------------------------------------------------

  let measuringHost = null;

  function host() {
    if (!measuringHost || !measuringHost.isConnected) measuringHost = el('div', 'mk-measure', document.body);
    return measuringHost;
  }

  /** A rectangle { x, y, w, h } in the root SVG's user units. */
  function boundsIn(root, node) {
    const box = node.getBBox();
    const matrix = root.getScreenCTM().inverse().multiply(node.getScreenCTM());
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
      .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  /** The x-extent of each character of a text element, in root units. */
  function characterSpans(root, node) {
    const matrix = root.getScreenCTM().inverse().multiply(node.getScreenCTM());
    const spans = [];
    for (let i = 0; i < node.getNumberOfChars(); i++) {
      const extent = node.getExtentOfChar(i);
      const a = new DOMPoint(extent.x, extent.y).matrixTransform(matrix);
      const b = new DOMPoint(extent.x + extent.width, extent.y + extent.height).matrixTransform(matrix);
      spans.push({ x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y });
    }
    return spans;
  }

  /** Points of a drawn connector (line or polyline), in root units. */
  function connectorPoints(root, node) {
    const matrix = root.getScreenCTM().inverse().multiply(node.getScreenCTM());
    let points;
    if (node.tagName === 'line') {
      points = [[+node.getAttribute('x1'), +node.getAttribute('y1')], [+node.getAttribute('x2'), +node.getAttribute('y2')]];
    } else if (node.tagName === 'polyline') {
      points = node.getAttribute('points').trim().split(/\s+/).map((pair) => pair.split(',').map(Number));
    } else {
      return null;
    }
    return points.map(([x, y]) => {
      const point = new DOMPoint(x, y).matrixTransform(matrix);
      return [point.x, point.y];
    });
  }

  /**
   * Every drawn element with its bounds, route, and text. ArchUML marks
   * message and transition routes with data-layout-route-id; an arrowhead
   * drawn right after its line inherits that route.
   */
  function indexDrawing(root) {
    const items = [];
    let lastRoute = null;
    for (const node of root.querySelectorAll(DRAWN)) {
      if (node.closest('defs')) continue;
      let route = node.getAttribute('data-layout-route-id');
      const isHead = node.tagName === 'polygon' || (node.tagName === 'polyline' && !route && lastRoute);
      if (!route && isHead && lastRoute) route = lastRoute.id;
      const item = {
        node,
        tag: node.tagName,
        box: boundsIn(root, node),
        route,
        source: node.getAttribute('data-layout-source') || (route && lastRoute && lastRoute.id === route ? lastRoute.source : null),
        target: node.getAttribute('data-layout-target') || (route && lastRoute && lastRoute.id === route ? lastRoute.target : null),
        layoutId: node.getAttribute('data-layout-id'),
        label: node.tagName === 'text' ? node.textContent.trim() : null,
        chars: node.tagName === 'text' ? characterSpans(root, node) : null,
        points: connectorPoints(root, node),
      };
      if (node.getAttribute('data-layout-route-id')) lastRoute = { id: route, source: item.source, target: item.target };
      else if (node.tagName === 'text' || node.tagName === 'rect') lastRoute = null;
      items.push(item);
    }
    return items;
  }

  const CROP_MARGIN = 10;

  function render(kind, spec) {
    const renderer = window[RENDERERS[kind]];
    if (!renderer) throw new Error(`model-kit.js cannot render "${kind}" diagrams; is uml-bundle.js loaded?`);
    const container = el('div', 'mk-render', host());
    renderer.render(container, spec);
    const root = container.querySelector('svg');
    if (!root) throw new Error(`ArchUML drew no ${kind} diagram:\n${spec}`);
    const items = indexDrawing(root);
    // Crop ArchUML's page margins so a sheet hugs its drawing; user units
    // (and so every recorded bound) stay the same.
    const drawn = union(items.map((item) => item.box));
    const [vx, vy, vw, vh] = [drawn.x - CROP_MARGIN, drawn.y - CROP_MARGIN, drawn.w + 2 * CROP_MARGIN, drawn.h + 2 * CROP_MARGIN];
    root.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    // Keep ArchUML's inline font-family (its layout measured that face);
    // the sheet sets the drawing's size instead of its responsive width.
    root.removeAttribute('width');
    root.removeAttribute('height');
    root.style.maxWidth = 'none';
    container.remove();
    return { root, items, view: { x: vx, y: vy, w: vw, h: vh } };
  }

  // ------------------------------------------------------------------
  // Geometry helpers (diagram units)
  // ------------------------------------------------------------------

  const centerOf = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
  const contains = (outer, x, y, pad = 0) => x >= outer.x - pad && x <= outer.x + outer.w + pad && y >= outer.y - pad && y <= outer.y + outer.h + pad;
  const inside = (outer, inner, pad = 1) => inner.x >= outer.x - pad && inner.y >= outer.y - pad
    && inner.x + inner.w <= outer.x + outer.w + pad && inner.y + inner.h <= outer.y + outer.h + pad;
  const grow = (box, pad) => ({ x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad });
  const union = (boxes) => {
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
  };

  /** Points along a polyline at fraction p of its length. */
  function along(points, p) {
    const lengths = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      lengths.push(length);
      total += length;
    }
    let distance = p * total;
    for (let i = 1; i < points.length; i++) {
      if (distance <= lengths[i - 1] || i === points.length - 1) {
        const f = lengths[i - 1] ? Math.min(1, distance / lengths[i - 1]) : 1;
        return [points[i - 1][0] + f * (points[i][0] - points[i - 1][0]), points[i - 1][1] + f * (points[i][1] - points[i - 1][1])];
      }
      distance -= lengths[i - 1];
    }
    return points[points.length - 1];
  }

  // ------------------------------------------------------------------
  // Sheets: the paper every view is drawn on
  // ------------------------------------------------------------------

  /** A sheet of paper at (x, y); `title` labels the view in a tab on top. */
  function sheet(parent, { x, y, w, h, title, at, until, tone = 'paper', tilt = 0 }) {
    const node = place(el('div', `mk-sheet mk-sheet--${tone} is-staged`, parent), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (h !== undefined) node.style.height = `${h}px`;
    if (tilt) node.style.rotate = `${tilt}deg`;
    if (title) el('div', 'mk-sheet-title', node, title);
    const body = el('div', 'mk-sheet-body', node);
    if (at !== undefined) fx.rise(node, at, { distance: 24, duration: 0.4 });
    if (until !== undefined) fx.fadeOut(node, until, 0.3);
    return { node, body };
  }

  const SHEET_PADDING = 14;

  /**
   * An ArchUML diagram on a sheet. `scale` is stage pixels per diagram unit
   * (1 keeps ArchUML's own text size). `fit: { w, h }` instead scales the
   * drawing down (never up past `scale`) to fit that box. `w` fixes the
   * sheet's width and centers the drawing on it.
   */
  const SHEET_TITLE_HEIGHT = 22;

  function diagram(parent, { kind, spec, x, y, scale: maxScale = 1, fit, w, title, at, until, tone, tilt }) {
    const { root, items, view } = render(kind, spec);
    const scale = fit ? Math.min(maxScale, fit.w / view.w, fit.h / view.h) : maxScale;
    const paper = sheet(parent, { x, y, w, title, at, until, tone, tilt });
    root.classList.add('mk-diagram');
    root.style.width = `${(view.w * scale).toFixed(1)}px`;
    root.style.height = `${(view.h * scale).toFixed(1)}px`;
    const originX = w === undefined ? 0 : Math.max(0, (w - 2 * SHEET_PADDING - view.w * scale) / 2);
    root.style.marginLeft = `${originX.toFixed(1)}px`;
    paper.body.append(root);
    const overlay = svg('g', { class: 'mk-overlay' }, root);
    const textItems = items.filter((item) => item.tag === 'text');
    const shapeItems = items.filter((item) => item.node.matches(SHAPES));

    function textItem(label, nth = 0) {
      const matches = textItems.filter((item) => item.label === label || item.label.replace(/^[+\-#~]/, '') === label);
      const found = matches[nth] || textItems.filter((item) => item.label.includes(label))[nth];
      if (!found) throw new Error(`The ${kind} diagram has no text "${label}". It has: ${textItems.map((item) => item.label).join(' | ')}`);
      return found;
    }

    /**
     * Bounds of the box (class, state, lifeline head, entity…) around a
     * label, including the compartments stacked under a class's name.
     */
    function box(label, nth = 0) {
      const text = textItem(label, nth);
      const { x: cx, y: cy } = centerOf(text.box);
      const around = shapeItems.filter((item) => item !== text && contains(item.box, cx, cy) && item.box.w > text.box.w * 0.6)
        .sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h);
      if (!around.length) throw new Error(`No box surrounds "${label}" in the ${kind} diagram.`);
      let bounds = around[0].box;
      const column = shapeItems.filter((item) => item.tag === 'rect' && Math.abs(item.box.x - bounds.x) < 1.5 && Math.abs(item.box.w - bounds.w) < 1.5);
      for (let grew = true; grew;) {
        grew = false;
        for (const item of column) {
          const touches = item.box.y <= bounds.y + bounds.h + 1.5 && item.box.y + item.box.h >= bounds.y - 1.5;
          if (touches && !inside(bounds, item.box, 0.5)) {
            bounds = union([bounds, item.box]);
            grew = true;
          }
        }
      }
      return bounds;
    }

    /** Bounds of a whole text, or of the characters `part` inside it. */
    function textBox(label, part, nth = 0) {
      const item = textItem(label, nth);
      if (part === undefined) return item.box;
      const start = item.node.textContent.indexOf(part);
      if (start < 0) throw new Error(`"${label}" does not contain "${part}".`);
      const spans = item.chars.slice(start, start + part.length);
      return { x: spans[0].x, y: item.box.y, w: spans[spans.length - 1].x + spans[spans.length - 1].w - spans[0].x, h: item.box.h };
    }

    const resolve = (target, pad) => grow(typeof target === 'string' ? box(target) : target, pad);

    const api = {
      node: paper.node,
      body: paper.body,
      root,
      view,
      scale,
      box,
      textBox,
      union,

      /** Bounds of drawn elements that satisfy `where(box, item)` (item.tag, item.node…). */
      boxes(where) {
        return items.filter((item) => where(item.box, item)).map((item) => item.box);
      },
      /** Every drawn element inside a box (the box itself, its texts and compartments). */
      within(target, pad = 2) {
        const bounds = typeof target === 'string' ? box(target) : target;
        return items.filter((item) => inside(bounds, item.box, pad)).map((item) => item.node);
      },
      /** The route that carries a label (a message name or transition label). */
      routeOf(label, nth = 0) {
        const item = textItem(label, nth);
        if (!item.route) throw new Error(`"${label}" is not a route label.`);
        return item.route;
      },
      /** The points of a route's connector, from its source to its target. */
      path(id) {
        const line = items.find((item) => item.route === id && item.points);
        if (!line) throw new Error(`The ${kind} diagram has no connector for route "${id}".`);
        return line.points;
      },

      /**
       * A ring around a box or text: a soft glow appears at `at` and the
       * outline draws itself around it like a marker. It stays up for at
       * least its reading time.
       */
      ring(target, { at, until, tone = 'amber', pad = 5, round = 8 } = {}) {
        const b = resolve(target, pad);
        const group = svg('g', { class: `mk-ring mk-ring--${tone} is-staged` }, overlay);
        svg('rect', { class: 'mk-ring-glow', x: b.x, y: b.y, width: b.w, height: b.h, rx: round }, group);
        const line = svg('rect', { class: 'mk-ring-line', x: b.x, y: b.y, width: b.w, height: b.h, rx: round, pathLength: 1 }, group);
        fx.fadeIn(group, at, 0.12);
        tween(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], at, 0.4, EASE.out);
        if (until !== undefined) fx.fadeOut(group, holdUntil(at, until), 0.25);
        return group;
      },
      /** A cross over a box or text (an outcome that does not hold): two strokes, one after the other. */
      cross(target, { at, until, pad = 4 } = {}) {
        const b = resolve(target, pad);
        const group = svg('g', { class: 'mk-cross is-staged' }, overlay);
        [`M${b.x} ${b.y}L${b.x + b.w} ${b.y + b.h}`, `M${b.x + b.w} ${b.y}L${b.x} ${b.y + b.h}`].forEach((d, i) => {
          const stroke = svg('path', { class: 'mk-cross-line', d, pathLength: 1 }, group);
          tween(stroke, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], at + i * 0.12, 0.2, EASE.out);
        });
        fx.fadeIn(group, at, 0.05);
        if (until !== undefined) fx.fadeOut(group, until, 0.25);
        return group;
      },
      /**
       * A highlighter stroke behind part of the drawing (a bracket of waiting
       * time, a lane, a column of signs): it sweeps along its long side.
       */
      band(b, { at, until, tone = 'amber', round = 4 } = {}) {
        const tall = b.h > b.w;
        const node = svg('rect', { class: `mk-band mk-band--${tone}${tall ? ' mk-band--tall' : ''} is-staged`, x: b.x, y: b.y, width: b.w, height: b.h, rx: round }, overlay);
        overlay.prepend(node);
        tween(node, [{ opacity: 0, transform: tall ? 'scaleY(0)' : 'scaleX(0)' }, { opacity: 1, transform: 'none' }], at, 0.35, EASE.out);
        if (until !== undefined) fx.fadeOut(node, holdUntil(at, until), 0.25);
        return node;
      },
      /** Fades elements to a faint trace from `from`; `to` brings them back. */
      dim(nodes, { from, to, level = 0.18 }) {
        for (const node of nodes) {
          tween(node, [{ opacity: 1 }, { opacity: level }], from, 0.3, EASE.inOut);
          if (to !== undefined) tween(node, { opacity: 1 }, to, 0.3, EASE.inOut);
        }
        return nodes;
      },
      /** A dot that travels a route (or any list of points) from `at` for `duration`. */
      token(route, { at, duration = 0.6, until, tone = 'amber', r = 7, label }) {
        const points = typeof route === 'string' ? api.path(route) : route;
        const group = svg('g', { class: `mk-token mk-token--${tone} is-staged` }, overlay);
        svg('circle', { r }, group);
        if (label) svg('text', { class: 'mk-token-label', y: -r - 5 }, group).textContent = label;
        tween(group, [{ opacity: 0 }, { opacity: 1 }], at, 0.12);
        if (until !== undefined) tween(group, { opacity: 0 }, until, 0.2);
        onFrame((t) => {
          const [px, py] = along(points, easeInOutCubic(progress(t, at, duration)));
          group.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
        });
        return group;
      },
      /**
       * A marker that rests in one place after another: stops = [{ at, to, via }],
       * where `to` is a box (or label) to sit on (at its top-right corner, or
       * at dx/dy inside it) and `via` an optional route to travel on the way.
       */
      marker(stops, { until, tone = 'amber', label, r = 9, offset = { x: 0, y: 0 } } = {}) {
        const group = svg('g', { class: `mk-token mk-token--${tone} is-staged` }, overlay);
        svg('circle', { r }, group);
        if (label) svg('text', { class: 'mk-token-label', y: -r - 5 }, group).textContent = label;
        const legs = stops.map((stop) => {
          const b = typeof stop.to === 'string' ? box(stop.to) : stop.to;
          const end = [b.x + (stop.dx ?? b.w - 4) + offset.x, b.y + (stop.dy ?? 4) + offset.y];
          return { ...stop, end, points: stop.via ? api.path(stop.via) : null };
        });
        tween(group, [{ opacity: 0 }, { opacity: 1 }], legs[0].at, 0.2);
        if (until !== undefined) tween(group, { opacity: 0 }, until, 0.2);
        onFrame((t) => {
          let position = legs[0].end;
          for (let i = 1; i < legs.length; i++) {
            const leg = legs[i];
            const duration = leg.duration ?? 0.9;
            if (t < leg.at) break;
            const p = easeInOutCubic(progress(t, leg.at, duration));
            const path = [legs[i - 1].end, ...(leg.points || []), leg.end];
            position = along(path, p);
          }
          group.setAttribute('transform', `translate(${position[0].toFixed(1)} ${position[1].toFixed(1)})`);
        });
        return group;
      },

      /** Where a point of the drawing lands on the stage: a box's side ('right', 'left', 'top', 'bottom', 'center'). */
      stagePoint(target, side = 'center') {
        const b = typeof target === 'string' ? box(target) : target;
        const [px, py] = {
          right: [b.x + b.w, b.y + b.h / 2], left: [b.x, b.y + b.h / 2],
          top: [b.x + b.w / 2, b.y], bottom: [b.x + b.w / 2, b.y + b.h], center: [b.x + b.w / 2, b.y + b.h / 2],
        }[side];
        const top = y + SHEET_PADDING + (title ? SHEET_TITLE_HEIGHT : 0);
        return [x + SHEET_PADDING + originX + (px - view.x) * scale, top + (py - view.y) * scale];
      },
      /**
       * A label on the sheet next to a box or text: side is 'right', 'left',
       * 'above', or 'below'. Labels sit on the thing they name (split-attention).
       */
      callout(target, text, { side = 'right', at, until, tone = 'amber', gap = 10, dx = 0, dy = 0 } = {}) {
        const b = typeof target === 'string' ? box(target) : target;
        const node = el('div', `mk-callout mk-callout--${tone} mk-callout--${side} is-staged`, paper.body, text);
        const anchor = {
          right: [b.x + b.w, b.y + b.h / 2],
          left: [b.x, b.y + b.h / 2],
          above: [b.x + b.w / 2, b.y],
          below: [b.x + b.w / 2, b.y + b.h],
        }[side];
        // The SVG sits at the body's top, `originX` from its left edge. The
        // label's CSS translate puts its near edge's midpoint on (left, top).
        const left = originX + (anchor[0] - view.x) * scale + dx + (side === 'right' ? gap : side === 'left' ? -gap : 0);
        const top = (anchor[1] - view.y) * scale + dy + (side === 'below' ? gap : side === 'above' ? -gap : 0);
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        const end = [view.x + (left - originX) / scale, view.y + top / scale];
        const hold = holdUntil(at, until, text);
        // A leader from the named part to its label, so the two read as one.
        if (Math.hypot(end[0] - anchor[0], end[1] - anchor[1]) * scale >= 6) {
          const leader = svg('g', { class: `mk-leader mk-leader--${tone} is-staged` }, overlay);
          for (const kind of ['halo', 'line']) {
            svg('line', { class: `mk-leader-${kind}`, x1: anchor[0], y1: anchor[1], x2: end[0], y2: end[1], 'vector-effect': 'non-scaling-stroke' }, leader);
          }
          svg('circle', { class: 'mk-leader-dot', cx: anchor[0], cy: anchor[1], r: 3.2 / scale }, leader);
          fx.fadeIn(leader, at, 0.2);
          if (hold !== undefined) fx.fadeOut(leader, hold, 0.2);
        }
        fx.pop(node, at, { from: 0.6, rotate: 0 });
        if (hold !== undefined) fx.popOut(node, hold);
        return node;
      },
    };
    return api;
  }

  // ------------------------------------------------------------------
  // Code beside the notation
  // ------------------------------------------------------------------

  /** A short Python listing in the mono face and the shared syntax colours. */
  function code(parent, { x, y, w, title, lines, at, until }) {
    const node = place(el('div', 'mk-code is-staged', parent), x, y);
    if (w !== undefined) node.style.width = `${w}px`;
    if (title) el('div', 'mk-code-title', node, title);
    const body = el('div', 'mk-code-body', node);
    const codeLine = (text, className = 'mk-code-line') => kit.writeCode(el('div', className, body), kit.highlightPython(text));
    const lineNodes = lines.map((text) => codeLine(text));
    fx.pop(node, at, { from: 0.8 });
    if (until !== undefined) fx.popOut(node, until);
    return {
      node,
      lines: lineNodes,
      /** Marks line i (a bar beside it) from `time` until `end`. */
      mark(i, time, end, tone = 'amber') {
        const bar = el('span', `mk-code-mark mk-code-mark--${tone} is-staged`, lineNodes[i]);
        fx.fadeIn(bar, time, 0.2);
        if (end !== undefined) fx.fadeOut(bar, end, 0.2);
        return bar;
      },
      /** Rewrites line i at `time`; the new text rises in place of the old. */
      rewrite(i, text, time) {
        const old = lineNodes[i];
        const next = codeLine(text, 'mk-code-line mk-code-line--new is-staged');
        old.after(next);
        tween(old, { opacity: 0 }, time - 0.05, 0.15, EASE.in);
        tween(old, { height: '0px', marginTop: '0px', marginBottom: '0px' }, time + 0.1, 0.01);
        fx.rise(next, time + 0.1, { distance: 6, duration: 0.25 });
        lineNodes[i] = next;
        return next;
      },
    };
  }

  window.ModelKit = { diagram, code };
})();
