/* Diagram case studies adapt the shared narration clock and quiz engine. */
(function () {
  'use strict';

  function cloneDiagram(source, prefix) {
    const svg = source.cloneNode(true);
    const elements = [svg, ...svg.querySelectorAll('*')];
    const ids = new Map(elements.filter(element => element.id)
      .map(element => [element.id, `${prefix}-${element.id}`]));
    elements.forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value.replace(/url\(#([^)]*)\)/g,
          (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
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

  function showDiagram(container, readingStep, diagram, prefix) {
    const source = readingStep.querySelector('.case-diagram svg');
    if (!source) {
      // A missing static render must leave the meaning available, never raw UML.
      container.textContent = diagram.description;
      return;
    }
    container.dataset.umlRendered = 'true';
    container.dataset.umlType = diagram.type;
    container.dataset.umlSpec = diagram.source;
    window.UMLShared.prepareDiagramContainer(container, diagram.type);
    container.replaceChildren(cloneDiagram(source, prefix));
    window.UMLShared.autoFitSVG(container);
    window.UMLShared.applySvgAccessibility(container, diagram.type, diagram.source, diagram.label);
    // The site's automatic describer supplies a structural breakdown; this
    // authored caption and description supply the case-specific interpretation.
    const image = container.querySelector('svg');
    image.setAttribute('aria-label', diagram.label);
    image.setAttribute('aria-describedby', `${prefix}-description`);
  }

  function enhance(root) {
    if (root.classList.contains('is-enhanced')) return;
    const story = JSON.parse(root.querySelector('[data-case-storyboard]').textContent);
    const timing = JSON.parse(root.querySelector('[data-case-timing]').textContent);
    // The readable version remains fully available while narration is unbuilt.
    if (!timing || !window.NarratedExplainer || !window.SebookQuiz) return;
    const audio = root.querySelector('audio');
    const stage = root.querySelector('.nja-stage');
    const quizPanel = root.querySelector('.case-quiz');
    const quizHost = root.querySelector('[data-quiz-host]');
    const nextStep = root.querySelector('[data-case-action="next-step"]');
    const previousStep = root.querySelector('[data-case-action="previous-step"]');
    const transcript = root.querySelector('.nja-transcript');
    const status = root.querySelector('.nja-status');
    const mountedQuizzes = new Map();
    let currentScene = 0;
    let currentCue = 0;
    let lastCue = null;
    let resumeNarration = false;

    function render(sceneElement, scene, cue) {
      if (cue === lastCue) return;
      lastCue = cue;
      currentScene = story.scenes.indexOf(scene);
      currentCue = scene.cues.indexOf(cue);
      sceneElement.querySelector('.nja-step').textContent = cue.step;
      sceneElement.querySelector('.nja-note').textContent = cue.note || '';
      const takeaway = sceneElement.querySelector('.nja-takeaway');
      if (takeaway) takeaway.hidden = Boolean(cue.prediction);
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      const readingStep = root.querySelector(`[data-case-reading-scene="${scene.id}"][data-case-reading-cue="${currentCue}"]`);
      const diagramId = `${root.id}-player-${currentScene}-${currentCue}`;
      const description = sceneElement.querySelector('[data-case-description]');
      description.id = `${diagramId}-description`;
      description.textContent = diagram.description;
      showDiagram(sceneElement.querySelector('[data-case-diagram]'), readingStep, diagram, diagramId);
      const caption = sceneElement.querySelector('[data-case-caption]');
      caption.textContent = diagram.caption || '';
      caption.hidden = !diagram.caption;
      previousStep.disabled = currentScene === 0 && currentCue === 0;
      const isLastCue = currentCue === scene.cues.length - 1;
      nextStep.textContent = !isLastCue ? 'Next step' : scene.checkpoint
        ? 'Choose next action' : currentScene < story.scenes.length - 1 ? 'Next scene' : 'Finish case study';
      root.querySelector('[data-case-progress]').textContent = `Scene ${currentScene + 1} of ${story.scenes.length} · Step ${currentCue + 1} of ${scene.cues.length}`;
    }

    function closeQuiz() {
      quizPanel.hidden = true;
      stage.hidden = false;
      root.querySelector('.nja-narration').hidden = false;
      root.querySelector('.case-step-actions').hidden = false;
      root.querySelector('[data-action="play"]').disabled = false;
    }

    function continueScene(index, playNarration) {
      closeQuiz();
      if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        stage.querySelector('.nja-scene:not([hidden]) h3').focus({ preventScroll: true });
        if (playNarration) player.play();
      } else {
        status.textContent = 'Case study complete. Revisit any scene to review your reasoning.';
        root.querySelector('[data-action="restart"]').focus({ preventScroll: true });
      }
    }

    function mountQuiz(index) {
      const host = document.createElement('div');
      quizHost.appendChild(host);
      window.SebookQuiz.mount({
        hostEl: host, controlsEl: quizPanel, stepIndex: index,
        quiz: { min_score: 1, questions: [story.scenes[index].checkpoint] },
        allowSkip: true, isFinalQuiz: index === story.scenes.length - 1,
        onPass: () => continueScene(index, resumeNarration),
        onSkip: () => continueScene(index, resumeNarration),
      });
      host.querySelector('.tvm-quiz-continue-btn').textContent = index + 1 < story.scenes.length
        ? 'Continue to next evidence' : 'Finish case study';
      host.querySelector('.tvm-quiz-skip-btn').textContent = index + 1 < story.scenes.length
        ? 'Skip decision and reveal next evidence' : 'Skip decision and finish';
      mountedQuizzes.set(index, host);
      return host;
    }

    function finishScene(index, playNarration = false) {
      resumeNarration = playNarration;
      audio.pause();
      if (!story.scenes[index].checkpoint) {
        // The transport first seeks back to the completed section. Allow that
        // seek to finish before seeking forward and resuming an ungated scene.
        if (playNarration && audio.seeking) {
          audio.addEventListener('seeked', () => {
            if (player.currentScene() === index && quizPanel.hidden) continueScene(index, true);
          }, { once: true });
        } else continueScene(index, playNarration);
        return;
      }
      mountedQuizzes.forEach(host => { host.hidden = true; });
      const host = mountedQuizzes.get(index) || mountQuiz(index);
      host.hidden = false;
      stage.hidden = true;
      root.querySelector('.nja-narration').hidden = true;
      root.querySelector('.case-step-actions').hidden = true;
      root.querySelector('[data-action="play"]').disabled = true;
      quizPanel.querySelector('.tvm-quiz-status').textContent = 'Make a prediction before revealing the next evidence. You can retry or continue after feedback.';
      const heading = quizPanel.querySelector('h3');
      heading.textContent = `${index + 1}. ${story.scenes[index].label} — Choose the next action`;
      quizPanel.hidden = false;
      // The shared quiz queues first-answer focus on mount. The host's scene
      // transition owns the final focus so the new question receives context.
      setTimeout(() => {
        if (!quizPanel.hidden) heading.focus({ preventScroll: true });
      }, 0);
      quizPanel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    const player = window.NarratedExplainer.enhance(root, {
      storyboard: story, timing, render,
      onSectionEnd: index => finishScene(index, true),
      onSeek: closeQuiz,
      canPlay: () => quizPanel.hidden,
    });

    function selectStep(sceneIndex, cueIndex) {
      audio.pause();
      const seek = root.querySelector('.nja-seek');
      // A range input quantizes to hundredths; round forward so it cannot
      // place a requested cue just before its own start boundary.
      seek.value = String(Math.ceil(timing.scenes[sceneIndex].cues[cueIndex].start * 100) / 100);
      seek.dispatchEvent(new Event('input', { bubbles: true }));
      status.textContent = `Step ${cueIndex + 1}: ${story.scenes[sceneIndex].cues[cueIndex].step}`;
    }

    nextStep.addEventListener('click', () => {
      if (currentCue + 1 < story.scenes[currentScene].cues.length) selectStep(currentScene, currentCue + 1);
      else finishScene(currentScene);
    });
    previousStep.addEventListener('click', () => {
      if (currentCue > 0) selectStep(currentScene, currentCue - 1);
      else if (currentScene > 0) selectStep(currentScene - 1, story.scenes[currentScene - 1].cues.length - 1);
    });
    root.querySelector('[data-case-action="review-evidence"]').addEventListener('click', () => {
      closeQuiz();
      nextStep.focus({ preventScroll: true });
    });
    root.querySelector('[data-case-action="read"]').addEventListener('click', () => {
      audio.pause();
      transcript.open = true;
      transcript.querySelector('summary').focus();
      transcript.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    root.querySelector('[data-case-action="print"]').addEventListener('click', () => window.print());
    root.querySelector('.case-reading-actions').hidden = false;
    transcript.open = false;
    let openBeforePrint = [];
    window.addEventListener('beforeprint', () => {
      openBeforePrint = Array.from(transcript.querySelectorAll('details'), details => ({ details, open: details.open }));
      openBeforePrint.forEach(({ details }) => { details.open = true; });
    });
    window.addEventListener('afterprint', () => {
      openBeforePrint.forEach(({ details, open }) => { details.open = open; });
    });
  }

  function init() { document.querySelectorAll('.narrated-case-study').forEach(enhance); }
  // ArchUML is another deferred script later in the chapter layout.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
