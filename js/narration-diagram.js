/* Players show diagrams the build already drew. Each cue's finished ArchUML
   picture lives in the HTML reading version; a player shows a copy whose ids
   carry the player's prefix, so the page never repeats an id. Callers add
   only what their kind needs, such as panning to a focus or a description. */
(function () {
  'use strict';

  // Renames every id in the copy, the root included, and each reference to it.
  function prefixIds(svg, prefix) {
    const elements = [svg, ...svg.querySelectorAll('*')];
    const ids = new Map(elements.filter(element => element.id)
      .map(element => [element.id, `${prefix}-${element.id}`]));
    elements.forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value.replace(/url\(#([^)]*)\)/g,
          (match, id) => (ids.has(id) ? `url(#${ids.get(id)})` : match));
        if (attribute.name === 'id') value = ids.get(value);
        if (['href', 'xlink:href'].includes(attribute.name) && ids.has(value.slice(1))) {
          value = `#${ids.get(value.slice(1))}`;
        }
        if (['aria-labelledby', 'aria-describedby'].includes(attribute.name)) {
          value = value.split(' ').map(id => ids.get(id) || id).join(' ');
        }
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    return svg;
  }

  /**
   * Shows a copy of `settled`, a drawn ArchUML <svg>, in `container`, fitted and
   * named like a diagram the page renders itself. `type` and `source` are the
   * diagram's UML type and text; `label`, when given, is its accessible name.
   */
  function show(container, settled, { type, source, label }, prefix) {
    container.dataset.umlRendered = 'true';
    container.dataset.umlType = type;
    container.dataset.umlSpec = source;
    window.UMLShared.prepareDiagramContainer(container, type);
    container.replaceChildren(prefixIds(settled.cloneNode(true), prefix));
    window.UMLShared.autoFitSVG(container);
    window.UMLShared.applySvgAccessibility(container, type, source, label);
  }

  window.NarrationDiagram = { show };
})();
