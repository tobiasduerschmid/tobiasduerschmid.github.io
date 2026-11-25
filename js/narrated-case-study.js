/* Case-study visuals. The shared NarrationPlayer owns playback, stepping,
   knowledge checks, and continuation; this module only presents each cue. */
(function () {
  'use strict';

  function showDiagram(container, readingStep, diagram, prefix) {
    const settled = readingStep.querySelector('.case-diagram svg');
    if (!settled) {
      // A missing static render must leave the meaning available, never raw UML.
      container.textContent = diagram.description;
      return;
    }
    window.NarrationDiagram.show(container, settled, diagram, prefix);
    // The site's automatic describer supplies a structural breakdown; this
    // authored caption and description supply the case-specific interpretation.
    const image = container.querySelector('svg');
    image.setAttribute('aria-label', diagram.label);
    image.setAttribute('aria-describedby', `${prefix}-description`);
  }

  function createRenderer(root, { story }) {
    let lastCue = null;

    function render({ element: sceneElement, scene, cue, sceneIndex, cueIndex }) {
      if (cue === lastCue) return;
      lastCue = cue;
      sceneElement.querySelector('.nja-step').textContent = cue.step;
      sceneElement.querySelector('.nja-note').textContent = cue.note || '';
      const takeaway = sceneElement.querySelector('.nja-takeaway');
      if (takeaway) takeaway.hidden = Boolean(cue.prediction);
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      const readingStep = root.querySelector(`[data-case-reading-scene="${scene.id}"][data-case-reading-cue="${cueIndex}"]`);
      const diagramId = `${root.id}-player-${sceneIndex}-${cueIndex}`;
      const description = sceneElement.querySelector('[data-case-description]');
      description.id = `${diagramId}-description`;
      description.textContent = diagram.description;
      showDiagram(sceneElement.querySelector('[data-case-diagram]'), readingStep, diagram, diagramId);
      const caption = sceneElement.querySelector('[data-case-caption]');
      caption.textContent = diagram.caption || '';
      caption.hidden = !diagram.caption;
    }

    return render;
  }

  window.NarratedCaseStudyVisuals = { createRenderer };
})();
