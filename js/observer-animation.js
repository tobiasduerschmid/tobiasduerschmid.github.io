/* Observer lesson visuals. All state is derived from the current cue and language. */
(function () {
  'use strict';

  function renderEditor(editor, state) {
    const values = { document: state.text || '(empty)', preview: state.preview || '(empty)', count: state.count,
      save: `Save · ${state.enabled ? 'enabled' : 'disabled'}`,
      'preview-status': state.detached ? 'Detached · pane closed · last stored text' : 'Registered' };
    Object.entries(values).forEach(([name, text]) => {
      editor.querySelector(`[data-ui="${name}"]`).textContent = text;
    });
    editor.querySelector('[data-widget="preview"]').classList.toggle('is-detached', state.detached);
    editor.setAttribute('aria-label', `Text editor: document ${state.text || 'empty'}, character count ${state.count}, Save ${state.enabled ? 'enabled' : 'disabled'}. Preview ${state.detached ? 'is detached and retains' : 'displays'} ${state.preview || 'empty text'}.`);
  }

  function cloneDiagram(source, prefix) {
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

  function renderDiagram(container, readingStep, source, focus) {
    // Reuse the finished ArchUML geometry from the HTML reading version. A cue
    // changes emphasis, never the layout or intermediate fitting scale.
    const svg = cloneDiagram(readingStep.querySelector('.observer-diagram svg'), `player-${readingStep.dataset.readingScene}`);
    container.dataset.umlRendered = 'true';
    container.dataset.umlType = 'class';
    container.dataset.umlSpec = source;
    window.UMLShared.prepareDiagramContainer(container, 'class');
    container.replaceChildren(svg);
    window.UMLShared.autoFitSVG(container);
    window.UMLShared.applySvgAccessibility(container, 'class', source);
    const label = Array.from(svg.querySelectorAll('text')).find(text => text.textContent === focus);
    if (label) {
      const bounds = label.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      // Only pan when necessary; moving emphasis must not recenter a readable diagram.
      if (bounds.left < viewport.left || bounds.right > viewport.right) {
        container.scrollLeft += bounds.left - viewport.left - (container.clientWidth - bounds.width) / 2;
      }
    }
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
    const story = JSON.parse(root.querySelector('[data-observer-storyboard]').textContent);
    const examples = JSON.parse(root.querySelector('[data-observer-examples]').textContent);
    const timing = JSON.parse(root.querySelector('[data-observer-timing]').textContent);
    const quizzes = JSON.parse(root.querySelector('[data-observer-quizzes]').textContent);
    const uiStates = JSON.parse(root.querySelector('[data-observer-ui-states]').textContent);
    const quizPanel = root.querySelector('.observer-quiz');
    const quizHost = quizPanel.querySelector('[data-quiz-host]');
    const languageSelect = root.querySelector('[data-setting="language"]');
    let lastCue = null;
    let lastLanguage = null;
    let lastDiagramKey = null;

    function render(scene, storyScene, cue) {
      const language = languageSelect.value;
      if (cue === lastCue && language === lastLanguage) return;
      lastCue = cue;
      lastLanguage = language;
      scene.querySelector('.nja-step').textContent = cue.step;
      scene.querySelector('.nja-note').textContent = cue.note;
      scene.querySelector('.nja-takeaway').hidden = Boolean(cue.prediction);
      if (storyScene.code) {
        highlightCode(scene, examples[language].blocks[storyScene.code], cue.focus);
      }
      if (storyScene.ui) renderEditor(scene.querySelector('.observer-editor'), uiStates[cue.ui_state]);
      const diagramKey = `${storyScene.id}:${cue.diagram_focus}`;
      if (storyScene.diagram && diagramKey !== lastDiagramKey) {
        const cueIndex = storyScene.cues.indexOf(cue);
        const readingStep = root.querySelector(`[data-reading-scene="${storyScene.id}"][data-reading-cue="${cueIndex}"]`);
        renderDiagram(scene.querySelector('[data-observer-diagram]'), readingStep, story.diagrams[storyScene.diagram].source, cue.diagram_focus);
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
      mountedQuizzes.forEach((host) => { host.hidden = true; });
      if (!mountedQuizzes.has(index)) {
        const host = document.createElement('div');
        quizHost.appendChild(host);
        window.SebookQuiz.mount({
          hostEl: host, controlsEl: quizPanel, stepIndex: index,
          quiz: { min_score: 0.8, questions: [quizzes[scene.id]] },
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
      quizPanel.querySelector('.tvm-quiz-status').textContent = 'Narration paused for one question.';
      const heading = quizPanel.querySelector('h3');
      heading.textContent = `${index + 1}. ${scene.label} — Knowledge check`;
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

  function init() { document.querySelectorAll('.observer-animation').forEach(enhance); }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
