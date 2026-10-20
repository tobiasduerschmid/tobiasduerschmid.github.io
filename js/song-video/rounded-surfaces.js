/* Paint rounded CSS frames as single shapes in Firefox's compositor.
 *
 * Firefox's WebRender draws a rounded CSS border as separate corner and edge
 * pieces, and a scaled or transformed stage can show their joins as thin
 * L-shaped lines inside each corner (Mozilla bug 2076078). prepare() repaints
 * every rounded box that has a solid border without using a border at all:
 *
 *  - a box with a (nearly) opaque fill keeps its border width for layout,
 *    makes the border transparent, and paints the border colour as a
 *    border-box background layer under a padding-box copy of its fill (the
 *    technique of the TDD kit's seam-free frames);
 *  - a box with a translucent or empty interior draws the same ring with a
 *    free ::after or ::before, masked to the border area.
 *
 * Each repaint copies the box's computed border and fill. When a state class
 * changes (a lamp lights, a cell turns new), the boxes inside the changed
 * element are repainted from their new computed style, and boxes added
 * later are repainted as they arrive; boxes whose border or fill is animated
 * keep their border. Dashed and dotted borders keep their gaps, which
 * already hide the joins. Other engines draw these borders intact and are
 * left alone.
 */
(function (root) {
  'use strict';

  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const CORNERS = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
  const PSEUDOS = [null, 'before', 'after'];
  // A border-colour layer under a translucent fill tints the interior by
  // (fill transparency × border opacity); up to this much is invisible.
  const MAX_TINT = 0.03;
  // Class changes that never change a box's paint: scene visibility and this
  // module's own markers.
  const IGNORED_CLASSES = /^(song-picture-inactive|song-frame-(ring|layers)-(before|after))$/;
  // A state class on a large container repaints only the container itself.
  const MAX_SUBTREE = 200;

  function alphaOf(color) {
    if (!color || color === 'transparent') return 0;
    const match = color.match(/rgba?\(([^)]*)\)/);
    if (!match) return 1;
    const parts = match[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? parseFloat(parts[3]) : 1;
  }

  /** Splits a computed comma-separated list, keeping commas inside functions. */
  function splitList(value) {
    const items = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) {
        items.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    items.push(value.slice(start).trim());
    return items;
  }

  /** The least opaque part of one background image (unknown images count as clear). */
  function leastAlpha(image) {
    if (!/gradient\(/.test(image) || /transparent/.test(image)) return 0;
    const colors = image.match(/rgba?\([^)]*\)/g) || [];
    return colors.length ? Math.min(...colors.map(alphaOf)) : 1;
  }

  /** The box's solid border, as one colour and four widths, or null. */
  function frameOf(style) {
    if (!CORNERS.some((corner) => parseFloat(style[`border${corner}Radius`]) > 0)) return null;
    const drawn = SIDES.filter((side) => parseFloat(style[`border${side}Width`]) > 0
      && !['none', 'hidden'].includes(style[`border${side}Style`]));
    if (!drawn.length || drawn.some((side) => style[`border${side}Style`] !== 'solid')) return null;
    const colors = new Set(drawn.map((side) => style[`border${side}Color`]));
    const [color] = colors;
    if (colors.size !== 1 || alphaOf(color) === 0) return null;
    return { color, widths: SIDES.map((side) => (drawn.includes(side) ? style[`border${side}Width`] : '0px')) };
  }

  function interiorAlpha(style) {
    let clear = 1 - alphaOf(style.backgroundColor);
    for (const image of splitList(style.backgroundImage)) {
      if (image !== 'none') clear *= 1 - leastAlpha(image);
    }
    return 1 - clear;
  }

  /** True when an animation of this box (or this pseudo-element) moves its border or fill. */
  function animatesPaint(node, pseudoElement) {
    return node.getAnimations().some(({ effect }) => effect
      && (effect.pseudoElement || null) === pseudoElement
      && effect.getKeyframes().some((frame) => Object.keys(frame).some((key) => /^(border|background)/.test(key))));
  }

  const flat = (color) => `linear-gradient(${color}, ${color})`;

  /**
   * The background that paints the frame: the box's own images, then a
   * padding-box copy of its fill colour, then the border colour over the
   * whole border box, as background longhands.
   */
  function layeredBackground(style, frame) {
    const images = splitList(style.backgroundImage).filter((image) => image !== 'none');
    const own = (property) => {
      const values = splitList(style[property]);
      return images.map((_, i) => values[i % values.length]);
    };
    const fill = alphaOf(style.backgroundColor) > 0 ? [style.backgroundColor] : [];
    const added = (forFill, forFrame) => [...fill.map(() => forFill), forFrame];
    // The border used to paint over the box's own images; clipped to the
    // padding box, they now leave the border area to the frame layer.
    const insideBorder = own('backgroundClip').map((clip) => (clip === 'border-box' ? 'padding-box' : clip));
    return {
      image: [...images, ...fill.map(flat), flat(frame.color)],
      clip: [...insideBorder, ...added('padding-box', 'border-box')],
      origin: [...own('backgroundOrigin'), ...added('padding-box', 'border-box')],
      size: [...own('backgroundSize'), ...added('100% 100%', '100% 100%')],
      position: [...own('backgroundPosition'), ...added('0% 0%', '0% 0%')],
      repeat: [...own('backgroundRepeat'), ...added('no-repeat', 'no-repeat')],
    };
  }

  /** Which pseudo-element can carry a ring for this box, if any. */
  function freeSlot(node) {
    return ['after', 'before'].find((slot) => {
      const { content } = root.getComputedStyle(node, `::${slot}`);
      return content === 'none' || content === 'normal';
    }) || null;
  }

  /** How to repaint one box or one of its pseudo-elements, or null to leave it. */
  function plan(node, pseudo) {
    const style = root.getComputedStyle(node, pseudo ? `::${pseudo}` : null);
    if (pseudo && (style.content === 'none' || style.content === 'normal')) return null;
    const frame = frameOf(style);
    if (!frame || animatesPaint(node, pseudo ? `::${pseudo}` : null)) return null;
    const tint = (1 - interiorAlpha(style)) * alphaOf(frame.color);
    if (tint <= MAX_TINT) return { pseudo, kind: 'layers', background: layeredBackground(style, frame) };
    if (pseudo || style.position === 'static' || !/visible/.test(style.overflow)) return null;
    const slot = freeSlot(node);
    return slot ? { pseudo, kind: 'ring', slot, frame } : null;
  }

  /**
   * Applies the plans for one box and returns how to undo them: the inline
   * properties it set (with their previous values) and the classes it added.
   */
  function apply(node, steps) {
    const undo = { properties: new Map(), classes: [] };
    const set = (property, value) => {
      if (!undo.properties.has(property)) {
        undo.properties.set(property, [node.style.getPropertyValue(property), node.style.getPropertyPriority(property)]);
      }
      node.style.setProperty(property, value);
    };
    const mark = (className) => {
      node.classList.add(className);
      undo.classes.push(className);
    };
    for (const step of steps) {
      if (step.kind === 'ring') {
        set('--song-frame-line', step.frame.color);
        SIDES.forEach((side, i) => set(`--song-frame-${side.toLowerCase()}`, step.frame.widths[i]));
        set('border-color', 'transparent');
        mark(`song-frame-ring-${step.slot}`);
      } else if (step.pseudo) {
        // Inline styles cannot reach a pseudo-element: hand it the layers as
        // custom properties that the stage stylesheet applies to it.
        for (const [part, values] of Object.entries(step.background)) set(`--song-frame-${step.pseudo}-${part}`, values.join(', '));
        mark(`song-frame-layers-${step.pseudo}`);
      } else {
        for (const [part, values] of Object.entries(step.background)) set(`background-${part}`, values.join(', '));
        set('background-color', 'transparent');
        set('border-color', 'transparent');
      }
    }
    return undo;
  }

  function restore(node, undo) {
    for (const [property, [value, priority]] of undo.properties) {
      if (value) node.style.setProperty(property, value, priority);
      else node.style.removeProperty(property);
    }
    node.classList.remove(...undo.classes);
  }

  /**
   * Repaints the given boxes: undoes their earlier repaints, reads every
   * computed style, then writes, so one style recalculation serves the batch.
   */
  function repaint(nodes, painted) {
    for (const node of nodes) {
      const undo = painted.get(node);
      if (undo) restore(node, undo);
      painted.delete(node);
    }
    const plans = [];
    for (const node of nodes) {
      const steps = PSEUDOS.map((pseudo) => plan(node, pseudo)).filter(Boolean);
      if (steps.length) plans.push([node, steps]);
    }
    for (const [node, steps] of plans) painted.set(node, apply(node, steps));
    return plans;
  }

  /** True when a class mutation changed a class that can change paint. */
  function changesState(record) {
    const before = new Set((record.oldValue || '').split(/\s+/).filter(Boolean));
    const after = new Set(record.target.classList);
    const changed = [...before].filter((c) => !after.has(c)).concat([...after].filter((c) => !before.has(c)));
    return changed.some((className) => !IGNORED_CLASSES.test(className));
  }

  /** The HTML boxes a state change on `target` can repaint. */
  function affectedBy(target) {
    const boxes = [target];
    const inside = target.querySelectorAll(':not(svg, svg *)');
    if (inside.length <= MAX_SUBTREE) boxes.push(...inside);
    return boxes;
  }

  const observers = new WeakMap();

  /**
   * Call after a scene's artwork and styles are attached, before its first
   * frame (again after every rebuild). `force` repaints in other engines too,
   * for comparison tests. Returns how many boxes were repainted each way.
   */
  function prepare(stage, { force = false } = {}) {
    const counts = { layers: 0, rings: 0 };
    if (!force && !root.CSS.supports('-moz-appearance', 'none')) return counts;
    observers.get(stage)?.disconnect();
    // Weak, so a disposed scene's boxes can be collected while the stage is
    // still observed (lyrics-only mode disposes the scene without a rebuild).
    const painted = new WeakMap();
    // SVG paths already paint as continuous shapes. Only their outer SVG box
    // can have a CSS border; inspecting thousands of inner paths is unnecessary.
    for (const [, steps] of repaint(stage.querySelectorAll(':not(svg *)'), painted)) {
      for (const step of steps) counts[step.kind === 'ring' ? 'rings' : 'layers'] += 1;
    }
    // Later changes: a state class that can change paint, or boxes added
    // after the scene was built (GitGraph's status rows, for example).
    const observer = new MutationObserver((records) => {
      const boxes = new Set();
      const collect = (node) => affectedBy(node).forEach((box) => boxes.add(box));
      for (const record of records) {
        if (record.type === 'childList') {
          record.addedNodes.forEach((node) => { if (node instanceof HTMLElement) collect(node); });
        } else if (record.target instanceof HTMLElement && changesState(record)) {
          collect(record.target);
        }
      }
      if (boxes.size) repaint([...boxes].filter((box) => box.isConnected), painted);
    });
    observer.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    observers.set(stage, observer);
    return counts;
  }

  root.SongRoundedSurfaces = { prepare };
})(window);
