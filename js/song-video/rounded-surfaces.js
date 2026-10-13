/* Keep transformed, rounded CSS borders intact in Firefox's compositor.
 * This is scene preparation, not per-frame work. See Mozilla bug 2076078.
 */
(function (root) {
  'use strict';

  const CORNERS = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

  function hasRoundedBorder(style) {
    return CORNERS.some((corner) => parseFloat(style[`border${corner}Radius`]) > 0)
      && SIDES.some((side) => parseFloat(style[`border${side}Width`]) > 0
        && ['solid', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(style[`border${side}Style`]));
  }

  /** Call after a scene's artwork and styles are attached, before its first frame. */
  function prepare(stage) {
    if (!root.CSS.supports('-moz-appearance', 'none')) return;
    const surfaces = [];
    // SVG paths already paint as continuous shapes. Only their outer SVG box
    // can have a CSS border; inspecting thousands of inner paths is unnecessary.
    for (const node of stage.querySelectorAll(':not(svg *)')) {
      for (const [pseudo, suffix] of [[null, ''], ['::before', '-before'], ['::after', '-after']]) {
        const className = `song-rounded-surface${suffix}`;
        if (node.classList.contains(className)) continue;
        const style = root.getComputedStyle(node, pseudo);
        if (pseudo && (style.content === 'none' || style.content === 'normal')) continue;
        if (hasRoundedBorder(style)) {
          surfaces.push({ node, className, suffix, filter: style.filter === 'none' ? 'opacity(1)' : style.filter });
        }
      }
    }
    // Batch writes after all style reads; no layout queries or observers run
    // while the audio clock advances. Preserve any authored filter effect.
    for (const { node, className, suffix, filter } of surfaces) {
      node.style.setProperty(`--song-surface-filter${suffix}`, filter);
      node.classList.add(className);
    }
  }

  root.SongRoundedSurfaces = { prepare };
})(window);
