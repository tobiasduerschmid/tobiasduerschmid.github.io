/* Narrated design-pattern lessons. All visual state is derived from the current
   cue and language: code marks change in place, while diagrams and topic
   illustrations are copied from the build-time reading step for the same cue
   (NarrationPlayer owns the shared lesson lifecycle). */
(function () {
  'use strict';

  // A topic script may keep a live illustration in a slot: it cancels this
  // event and moves the illustration to the cue's state from `settled` itself.
  function renderVisuals(scene, readingStep) {
    scene.querySelectorAll('[data-np-visual]').forEach(slot => {
      const settled = readingStep.querySelector(`[data-np-visual="${slot.dataset.npVisual}"]`);
      const cue = new CustomEvent('narrated-pattern:cue', { cancelable: true, detail: { settled } });
      if (slot.dispatchEvent(cue)) slot.replaceChildren(...Array.from(settled.childNodes, node => node.cloneNode(true)));
    });
  }

  // Marks a cue's focus lines in the visible language of a code panel and
  // scrolls them into view. When the marked lines do not all fit, the block's
  // `scroll` map may name the line that matters most for this focus; that line
  // is shown instead of the first. `scope` holds the per-language panels.
  function highlightCode(scope, block, focus) {
    const lines = block.focus[focus] || [];
    const active = scope.querySelector('[data-code-language]:not([hidden])');
    active.querySelectorAll('[data-line]').forEach(line => {
      const highlighted = lines.includes(Number(line.dataset.line));
      line.classList.toggle('is-highlighted', highlighted);
      if (highlighted) line.setAttribute('aria-current', 'true');
      else line.removeAttribute('aria-current');
    });
    const codeWindow = active.querySelector('pre');
    const marked = active.querySelectorAll('.is-highlighted');
    let target = marked[0];
    // Focus names such as `constructor` must not find inherited properties.
    const keyLine = block.scroll && Object.hasOwn(block.scroll, focus) ? block.scroll[focus] : null;
    if (target && keyLine) {
      const last = marked[marked.length - 1];
      const span = last.offsetTop + last.offsetHeight - target.offsetTop;
      if (span > codeWindow.clientHeight - 20) target = active.querySelector(`[data-line="${keyLine}"]`) || target;
    }
    codeWindow.scrollTop = target ? target.offsetTop - codeWindow.offsetTop - 20 : 0;
    scope.querySelector('[data-focus-lines]').textContent = lines.length ? lines.join(', ') : 'Whole example';
  }

  function createRenderer(root, { story, examples }) {
    const topic = root.dataset.npTopic;
    const languageSelect = root.querySelector('[data-setting="language"]');
    let lastCue = null;
    let lastLanguage = null;
    let lastDiagramKey = null;

    function render({ element: scene, scene: storyScene, cue }) {
      // A lesson without code has no language selector.
      const language = languageSelect ? languageSelect.value : '';
      if (cue === lastCue && language === lastLanguage) return;
      const cueChanged = cue !== lastCue;
      lastCue = cue;
      lastLanguage = language;
      const cueIndex = storyScene.cues.indexOf(cue);
      const readingStep = root.querySelector(`[data-reading-scene="${storyScene.id}"][data-reading-cue="${cueIndex}"]`);
      scene.querySelector('.nja-step').textContent = cue.step;
      scene.querySelector('.nja-note').textContent = cue.note;
      scene.querySelector('[data-np-source]').textContent = cue.source || '';
      scene.querySelector('.np-source').hidden = !cue.source;
      scene.querySelector('.nja-takeaway').hidden = Boolean(cue.prediction);
      if (storyScene.code) {
        highlightCode(scene, examples[language].blocks[storyScene.code], cue.focus);
      }
      if (cueChanged) renderVisuals(scene, readingStep);
      // A cue may switch the scene to another diagram, with its own label and caption.
      const diagramName = cue.diagram || storyScene.diagram;
      const diagramKey = `${storyScene.id}:${diagramName}:${cue.diagram_focus}:${cue.diagram_steps}`;
      if (diagramName && diagramKey !== lastDiagramKey) {
        const diagram = story.diagrams[diagramName];
        const container = scene.querySelector('[data-np-diagram]');
        window.NarrationDiagram.showReadingStep(container, readingStep.querySelector('.np-diagram'),
          { type: diagram.type || 'class', focus: cue.diagram_focus, prefix: `player-${topic}-${storyScene.id}-${diagramName}` });
        container.setAttribute('aria-label', diagram.label);
        const caption = scene.querySelector('.np-diagram-caption');
        if (caption) caption.textContent = diagram.caption || '';
        lastDiagramKey = diagramKey;
      }
    }

    return render;
  }

  window.NarratedPatternVisuals = { createRenderer };
})();
