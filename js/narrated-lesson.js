/* Shared behavior of narrated lessons (the design-pattern lessons and video
   narrations). Players never draw diagrams or code marks themselves: each cue's
   settled picture is built at build time in the reading step for that cue,
   and the player copies it. Section knowledge checks pause the narration. */
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

  // Marks a cue's focus lines in the visible language of a code panel and
  // scrolls the first one into view. `scope` holds the per-language panels.
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
    const firstLine = active.querySelector('.is-highlighted');
    codeWindow.scrollTop = firstLine ? firstLine.offsetTop - codeWindow.offsetTop - 20 : 0;
    scope.querySelector('[data-focus-lines]').textContent = lines.length ? lines.join(', ') : 'Whole example';
  }

  /*
   * The knowledge check that ends each section: one question, or a summary
   * quiz that lists several. A section without a check continues to the next
   * one without moving focus. Call attach(player) once the transport exists.
   */
  function sectionChecks(root, story, quizzes) {
    const panel = root.querySelector('.np-quiz');
    const host = panel.querySelector('[data-quiz-host]');
    const playButton = root.querySelector('[data-action="play"]');
    const status = root.querySelector('.nja-status');
    const mounted = new Map();
    let player = null;

    const checkOf = index => quizzes[story.scenes[index].id];

    function close() {
      panel.hidden = true;
      root.querySelector('.nja-stage').hidden = false;
      root.querySelector('.nja-narration').hidden = false;
      playButton.disabled = false;
    }

    function continueAfter(index) {
      close();
      if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        playButton.focus();
        player.play();
      } else {
        status.textContent = 'Narration and final knowledge check finished. Revisit any section to review.';
        root.querySelector('[data-action="restart"]').focus();
      }
    }

    function mount(index, questions) {
      const quizHost = document.createElement('div');
      host.appendChild(quizHost);
      window.SebookQuiz.mount({
        hostEl: quizHost, controlsEl: panel, stepIndex: index,
        // A summary follows the lesson's order; options still shuffle.
        quiz: { min_score: 0.8, questions, shuffle_questions: false },
        allowSkip: true, isFinalQuiz: index === story.scenes.length - 1,
        onPass: () => continueAfter(index),
        onSkip: () => continueAfter(index),
      });
      // Adapt the tutorial transport label to this narrated surface.
      quizHost.querySelector('.tvm-quiz-continue-btn').textContent = index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review';
      mounted.set(index, quizHost);
    }

    function open(index) {
      const scene = story.scenes[index];
      const check = checkOf(index);
      if (!check) {
        status.textContent = `${index + 1}. ${scene.label} has no knowledge check.`;
        return;
      }
      root.querySelector('audio').pause();
      const questions = check.questions || [check];
      mounted.forEach(quizHost => { quizHost.hidden = true; });
      if (!mounted.has(index)) mount(index, questions);
      mounted.get(index).hidden = false;
      root.querySelector('.nja-stage').hidden = true;
      root.querySelector('.nja-narration').hidden = true;
      playButton.disabled = true;
      panel.querySelector('.tvm-quiz-status').textContent = questions.length > 1
        ? `Narration paused for ${questions.length} questions.` : 'Narration paused for one question.';
      const heading = panel.querySelector('h3');
      heading.textContent = `${index + 1}. ${scene.label} — ${questions.length > 1 ? 'Summary quiz' : 'Knowledge check'}`;
      panel.hidden = false;
      heading.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    // At a section's end: its check, or straight on when it has none.
    function sectionEnded(index) {
      if (checkOf(index)) open(index);
      else if (index + 1 < story.scenes.length) {
        player.selectScene(index + 1);
        player.play();
      }
    }

    return {
      sectionEnded,
      close,
      isClosed: () => panel.hidden,
      attach(transport) {
        player = transport;
        root.querySelector('[data-review-check]').addEventListener('click', () => open(player.currentScene()));
      },
    };
  }

  window.NarratedLesson = { renderDiagram, highlightCode, sectionChecks };
})();
