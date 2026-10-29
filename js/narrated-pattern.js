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
    const { renderDiagram, highlightCode, sectionChecks } = window.NarratedLesson;
    const topic = root.dataset.npTopic;
    const story = JSON.parse(root.querySelector('[data-np-storyboard]').textContent);
    const examples = JSON.parse(root.querySelector('[data-np-examples]').textContent);
    const timing = JSON.parse(root.querySelector('[data-np-timing]').textContent);
    const quizzes = JSON.parse(root.querySelector('[data-np-quizzes]').textContent);
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

    const checks = sectionChecks(root, story, quizzes);
    const player = window.NarratedExplainer.enhance(root, {
      storyboard: story, timing, render, onSectionEnd: checks.sectionEnded,
      onSeek: checks.close, canPlay: checks.isClosed,
    });
    checks.attach(player);
    languageSelect.addEventListener('sebook:languagechange', () => {
      player.refresh();
      root.querySelector('.nja-status').textContent = `Code language: ${examples[languageSelect.value].label}. Narration position unchanged.`;
    });
  }

  function init() { document.querySelectorAll('section.narrated-pattern').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
