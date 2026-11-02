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

  // A text-only story (no media yet) has no audio clock. This transport shows
  // the same cues and scene choices directly, with the player's interface.
  function silentTransport(root, story, render, onSeek) {
    const scenes = Array.from(root.querySelectorAll('[data-scene]'));
    const sceneSelect = root.querySelector('[data-setting="scene"]');
    const narration = root.querySelector('.nja-narration p');
    const status = root.querySelector('.nja-status');
    let sceneIndex = -1;
    function showCue(index, cueIndex) {
      onSeek();
      const scene = story.scenes[index];
      const cue = scene.cues[cueIndex];
      scenes.forEach((element, number) => { element.hidden = number !== index; });
      sceneSelect.value = String(index);
      narration.textContent = cue.text;
      scenes[index].querySelector('.nja-art').setAttribute('aria-label', cue.visual);
      sceneIndex = index;
      render(scenes[index], scene, cue);
    }
    function selectScene(index) {
      showCue(index, 0);
      status.textContent = `${index + 1}. ${story.scenes[index].label}`;
    }
    sceneSelect.addEventListener('change', () => selectScene(Number(sceneSelect.value)));
    root.classList.add('is-enhanced');
    root.querySelectorAll('.nja-controls').forEach((controls) => { controls.hidden = false; });
    showCue(0, 0);
    return { showCue, selectScene, play() {}, pause() {}, currentScene: () => sceneIndex };
  }

  function enhance(root) {
    if (root.classList.contains('is-enhanced') || !window.NarratedExplainer || !window.SebookQuiz) return;
    const { story, timing } = window.NarratedExplainer.readData(root);
    // The readable version remains fully available while rendered narration is incomplete.
    if (story.audio && !timing) return;
    const audio = root.querySelector('audio');
    const playButton = root.querySelector('[data-action="play"]');
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
      if (playButton) playButton.disabled = false;
    }

    function continueScene(index, playNarration) {
      closeQuiz();
      if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        stage.querySelector('.nja-scene:not([hidden]) h3').focus({ preventScroll: true });
        if (playNarration) player.play();
      } else {
        status.textContent = 'Case study complete. Revisit any scene to review your reasoning.';
        // A text-only story has no restart button; scene review stays available.
        (root.querySelector('[data-action="restart"]') || root.querySelector('[data-setting="scene"]')).focus({ preventScroll: true });
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
      player.pause();
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
      if (playButton) playButton.disabled = true;
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

    // With rendered speech, the shared transport's audio clock selects each cue.
    function audioTransport() {
      const transport = window.NarratedExplainer.enhance(root, {
        storyboard: story, timing, render,
        onSectionEnd: index => finishScene(index, true),
        onSeek: closeQuiz,
        canPlay: () => quizPanel.hidden,
      });
      return {
        ...transport,
        pause: () => audio.pause(),
        showCue(sceneIndex, cueIndex) {
          audio.pause();
          const seek = root.querySelector('.nja-seek');
          // A range input quantizes to hundredths; round forward so it cannot
          // place a requested cue just before its own start boundary.
          seek.value = String(Math.ceil(timing.scenes[sceneIndex].cues[cueIndex].start * 100) / 100);
          seek.dispatchEvent(new Event('input', { bubbles: true }));
        },
      };
    }
    const player = story.audio ? audioTransport() : silentTransport(root, story, render, closeQuiz);

    function selectStep(sceneIndex, cueIndex) {
      player.showCue(sceneIndex, cueIndex);
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
      player.pause();
      transcript.open = true;
      transcript.querySelector('summary').focus();
      transcript.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    root.querySelector('[data-case-action="print"]').addEventListener('click', () => window.print());
    root.querySelector('.case-reading-actions').hidden = false;
    transcript.open = false;
    let openBeforePrint = [];
    window.addEventListener('beforeprint', () => {
      // The transcript itself must open too: a text-only story has no transport to open it.
      openBeforePrint = [transcript, ...transcript.querySelectorAll('details')].map(details => ({ details, open: details.open }));
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
