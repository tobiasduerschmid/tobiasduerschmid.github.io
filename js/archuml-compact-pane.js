/**
 * Tells a bare `layout compact` directive the pane its drawing will be shown
 * in, for hosts ArchUML cannot measure itself: the song sheets (a fixed
 * `fit` box) and the tutorial's off-screen render staging. ArchUML lays out
 * `layout compact WxH` for that pane; see js/ArchUML/REFERENCE.md.
 *
 *   withCompactPane(spec, { width, height }) → spec
 *
 * Only a `layout compact` line without a size changes. A spec that already
 * names a size (valid or not), has no compact line, or receives a pane that
 * rounds to zero is returned unchanged, so ArchUML falls back to measuring
 * its container. Narrated lessons apply the same rule in Liquid
 * (_includes/archuml-compact-pane.html).
 */
(function (global) {
  'use strict';

  const BARE_COMPACT = /^([ \t]*)layout[ \t]+compact[ \t]*$/i;

  function paneSize(pane) {
    if (!pane) return null;
    const width = Math.round(Number(pane.width));
    const height = Math.round(Number(pane.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return width + 'x' + height;
  }

  function withCompactPane(spec, pane) {
    const size = paneSize(pane);
    if (!spec || !size) return spec;
    return spec.split('\n').map(line => {
      const ending = line.endsWith('\r') ? '\r' : '';
      const match = BARE_COMPACT.exec(ending ? line.slice(0, -1) : line);
      return match ? match[1] + 'layout compact ' + size + ending : line;
    }).join('\n');
  }

  const api = { withCompactPane };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.ArchUMLCompactPane = api;
})(typeof window !== 'undefined' ? window : globalThis);
