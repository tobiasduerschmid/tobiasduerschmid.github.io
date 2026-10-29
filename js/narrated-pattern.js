/* Narrated design-pattern lessons. All visual state is derived from the current
   cue and language: code marks change in place, while diagrams and topic
   illustrations are copied from the build-time reading step for the same cue. */
(function () {
  'use strict';

  function cloneSvg(source, prefix) {
    const svg = source.cloneNode(true);
    const ids = new Map(Array.from(svg.querySelectorAll('[id]'), element => [element.id, `${prefix}-${element.id}`]));
    svg.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
        if (attribute.name === 'id') value = ids.get(value) || value;
        if (['href', 'xlink:href'].includes(attribute.name) && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
        if (['aria-labelledby', 'aria-describedby'].includes(attribute.name)) value = value.split(' ').map(id => ids.get(id) || id).join(' ');
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    return svg;
  }

  function renderDiagram(container, settled, type, focus, prefix) {
    // Reuse the finished ArchUML geometry from the HTML reading version. A cue
    // changes emphasis or adds steps, never the fitting scale of a drawn step.
    const source = settled.dataset.npDiagramSource;
    container.dataset.umlRendered = 'true';
    container.dataset.umlType = type;
    container.dataset.umlSpec = source;
    window.UMLShared.prepareDiagramContainer(container, type);
    container.replaceChildren(cloneSvg(settled.querySelector('svg'), prefix));
    window.UMLShared.autoFitSVG(container);
    window.UMLShared.applySvgAccessibility(container, type, source);
    // An anonymous lifeline (`participant x as : Cls`) displays its label, not its id.
    const alias = focus && source.match(new RegExp(`^participant ${focus} as (.+)$`, 'm'));
    const shown = alias ? alias[1].trim() : focus;
    const label = focus && Array.from(container.querySelectorAll('svg text')).find(text =>
      text.textContent.trim() === shown || text.textContent.split(':')[0].trim() === shown);
    if (label) {
      const bounds = label.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      // Only pan when necessary; moving emphasis must not recenter a readable diagram.
      if (bounds.left < viewport.left || bounds.right > viewport.right) {
        container.scrollLeft += bounds.left - viewport.left - (container.clientWidth - bounds.width) / 2;
      }
    }
  }

  // A topic script may keep a live illustration in a slot: it cancels this
  // event and moves the illustration to the cue's state from `settled` itself.
  function renderVisuals(scene, readingStep) {
    scene.querySelectorAll('[data-np-visual]').forEach(slot => {
      const settled = readingStep.querySelector(`[data-np-visual="${slot.dataset.npVisual}"]`);
      const cue = new CustomEvent('narrated-pattern:cue', { cancelable: true, detail: { settled } });
      if (slot.dispatchEvent(cue)) slot.replaceChildren(...Array.from(settled.childNodes, node => node.cloneNode(true)));
    });
  }

  function highlightCode(scene, block, focus) {
    const lines = block.focus[focus] || [];
    const active = scene.querySelector('[data-code-language]:not([hidden])');
    active.querySelectorAll('[data-line]').forEach(line => {
      const highlighted = lines.includes(Number(line.dataset.line));
      line.classList.toggle('is-highlighted', highlighted);
      if (highlighted) line.setAttribute('aria-current', 'true');
      else line.removeAttribute('aria-current');
    });
    const codeWindow = active.querySelector('pre');
    const firstLine = active.querySelector('.is-highlighted');
    codeWindow.scrollTop = firstLine ? firstLine.offsetTop - codeWindow.offsetTop - 20 : 0;
    scene.querySelector('[data-focus-lines]').textContent = lines.length ? lines.join(', ') : 'Whole example';
  }

  function enhance(root) {
    if (root.classList.contains('is-enhanced')) return;
    const topic = root.dataset.npTopic;
    const story = JSON.parse(root.querySelector('[data-np-storyboard]').textContent);
    const examples = JSON.parse(root.querySelector('[data-np-examples]').textContent);
    const timing = JSON.parse(root.querySelector('[data-np-timing]').textContent);
    const quizzes = JSON.parse(root.querySelector('[data-np-quizzes]').textContent);
    const quizPanel = root.querySelector('.np-quiz');
    const quizHost = quizPanel.querySelector('[data-quiz-host]');
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

    const mountedQuizzes = new Map();
    function closeQuiz() {
      quizPanel.hidden = true;
      root.querySelector('.nja-stage').hidden = false;
      root.querySelector('.nja-narration').hidden = false;
      root.querySelector('[data-action="play"]').disabled = false;
    }

    function continueNarration(index) {
      closeQuiz();
      if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        root.querySelector('[data-action="play"]').focus();
        player.play();
      } else {
        root.querySelector('.nja-status').textContent = 'Narration and final knowledge check finished. Revisit any section to review.';
        root.querySelector('[data-action="restart"]').focus();
      }
    }

    function openQuiz(index) {
      root.querySelector('audio').pause();
      const scene = story.scenes[index];
      // A section has one question, or a summary quiz lists several.
      const check = quizzes[scene.id];
      const questions = check.questions || [check];
      mountedQuizzes.forEach((host) => { host.hidden = true; });
      if (!mountedQuizzes.has(index)) {
        const host = document.createElement('div');
        quizHost.appendChild(host);
        window.SebookQuiz.mount({
          hostEl: host, controlsEl: quizPanel, stepIndex: index,
          // A summary follows the pattern description's order; options still shuffle.
          quiz: { min_score: 0.8, questions, shuffle_questions: false },
          allowSkip: true, isFinalQuiz: index === story.scenes.length - 1,
          onPass: () => continueNarration(index),
          onSkip: () => continueNarration(index),
        });
        // Adapt the tutorial transport label to this narrated surface.
        host.querySelector('.tvm-quiz-continue-btn').textContent = index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review';
        mountedQuizzes.set(index, host);
      }
      mountedQuizzes.get(index).hidden = false;
      root.querySelector('.nja-stage').hidden = true;
      root.querySelector('.nja-narration').hidden = true;
      root.querySelector('[data-action="play"]').disabled = true;
      quizPanel.querySelector('.tvm-quiz-status').textContent = questions.length > 1
        ? `Narration paused for ${questions.length} questions.` : 'Narration paused for one question.';
      const heading = quizPanel.querySelector('h3');
      heading.textContent = `${index + 1}. ${scene.label} — ${questions.length > 1 ? 'Summary quiz' : 'Knowledge check'}`;
      quizPanel.hidden = false;
      heading.focus({ preventScroll: true });
      quizPanel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    const player = window.NarratedExplainer.enhance(root, {
      storyboard: story, timing, render, onSectionEnd: openQuiz,
      onSeek: closeQuiz, canPlay: () => quizPanel.hidden,
    });
    root.querySelector('[data-review-check]').addEventListener('click', () => openQuiz(player.currentScene()));
    languageSelect.addEventListener('sebook:languagechange', () => {
      player.refresh();
      root.querySelector('.nja-status').textContent = `Code language: ${examples[languageSelect.value].label}. Narration position unchanged.`;
    });
  }

  function init() { document.querySelectorAll('section.narrated-pattern').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
