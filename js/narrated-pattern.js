/* Narrated design-pattern lessons. All visual state is derived from the current
   cue and language: code marks change in place, while diagrams and topic
   illustrations are copied from the build-time reading step for the same cue
   (js/narrated-lesson.js holds the parts every narrated lesson shares). */
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

  function enhance(root) {
    if (root.classList.contains('is-enhanced')) return;
    const { story, timing, examples, quizzes } = window.NarratedExplainer.readData(root);
    const { renderDiagram, highlightCode, mount } = window.NarratedLesson;
    const topic = root.dataset.npTopic;
    const languageSelect = root.querySelector('[data-setting="language"]');
    let lastCue = null;
    let lastLanguage = null;
    let lastDiagramKey = null;

    function render(scene, storyScene, cue) {
      const language = languageSelect.value;
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
        renderDiagram(container, readingStep.querySelector('.np-diagram'),
          diagram.type || 'class', cue.diagram_focus, `player-${topic}-${storyScene.id}-${diagramName}`);
        container.setAttribute('aria-label', diagram.label);
        const caption = scene.querySelector('.np-diagram-caption');
        if (caption) caption.textContent = diagram.caption || '';
        lastDiagramKey = diagramKey;
      }
    }

    mount(root, { story, timing, quizzes, examples, render });
  }

  function init() { document.querySelectorAll('section.narrated-pattern').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
