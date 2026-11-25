/* Knowledge-check presentation for every narration. SebookQuiz owns grading
   and answer feedback; NarrationPlayer supplies continuation/replay actions. */
(function () {
  'use strict';
  if (window.NarrationQuiz) return;

  function replayButton(replay, sceneIndex) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'narration-replay';
    button.textContent = 'Re-listen to segment';
    button.hidden = true;
    button.addEventListener('click', async () => { await replay(sceneIndex); });
    return button;
  }

  function replayFeedback(host, replay, sceneIndex) {
    const wrongAnswers = new Set();
    const resultsButton = replayButton(replay, sceneIndex);
    host.querySelector('.results-actions').appendChild(resultsButton);
    return ({ card, isCorrect }) => {
      if (isCorrect) wrongAnswers.delete(card);
      else wrongAnswers.add(card);
      resultsButton.hidden = wrongAnswers.size === 0;
      let button = card.querySelector('.narration-replay');
      if (!button && !isCorrect) {
        button = replayButton(replay, sceneIndex);
        const next = card.querySelector('.next-btn');
        const actions = document.createElement('div');
        actions.className = 'narration-quiz-actions';
        next.before(actions);
        actions.append(next, button);
        card.querySelector('.quiz-next-shortcut-hint').lastChild.textContent = ' activates the focused button.';
      }
      if (button) button.hidden = isCorrect;
    };
  }

  function mount({ continueLabel, onContinue, onReplay, ...options }) {
    const host = options.hostEl;
    let onAnswer;
    window.SebookQuiz.mount({ ...options, onPass: onContinue, onSkip: onContinue,
      onAnswer: result => { if (onAnswer) onAnswer(result); },
    });
    if (onReplay) onAnswer = replayFeedback(host, onReplay, options.stepIndex);
    host.querySelector('.tvm-quiz-continue-btn').textContent = continueLabel;
    if (options.quiz.questions.length !== 1) return;

    const next = host.querySelector('.next-btn');
    next.textContent = continueLabel;
    const hint = host.querySelector('.quiz-next-shortcut-hint');
    hint.lastChild.textContent = ' continues.';
    // The lesson owns continuation. Capture the shared next action (also used
    // by Enter) before it opens a redundant one-question results screen.
    next.addEventListener('click', event => {
      event.stopImmediatePropagation();
      void onContinue();
    }, { capture: true });
  }

  /** Create the check view for one player. Checks are indexed by scene and
   * are null for unchecked scenes. Reopening a check retains its answers. */
  function create(root, { scenes, checks, continueLabel, finishLabel, onContinue, onReplay }) {
    const panel = root.querySelector('.narration-check');
    const host = panel.querySelector('[data-quiz-host]');
    const stage = root.querySelector('.nja-stage');
    const captions = root.querySelector('.nja-narration');
    const playButton = root.querySelector('[data-action="play"]');
    const mounted = new Map();

    function close() {
      panel.hidden = true;
      stage.hidden = false;
      captions.hidden = false;
      if (playButton) playButton.disabled = false;
    }

    function mountCheck(index) {
      const quizHost = document.createElement('div');
      host.appendChild(quizHost);
      mount({
        hostEl: quizHost, controlsEl: panel, stepIndex: index,
        quiz: checks[index], allowSkip: true, isFinalQuiz: index === scenes.length - 1,
        continueLabel: index + 1 < scenes.length ? continueLabel : finishLabel,
        onContinue: () => onContinue(index), onReplay,
      });
      mounted.set(index, quizHost);
      return quizHost;
    }

    function open(index) {
      const questions = checks[index].questions;
      mounted.forEach(quizHost => { quizHost.hidden = true; });
      (mounted.get(index) || mountCheck(index)).hidden = false;
      stage.hidden = true;
      captions.hidden = true;
      if (playButton) playButton.disabled = true;
      panel.querySelector('.tvm-quiz-status').textContent = questions.length > 1
        ? `Pause for ${questions.length} questions. Continue after reading the feedback.`
        : 'Pause for one question. Continue after reading the feedback.';
      const heading = panel.querySelector('h3');
      heading.textContent = `${index + 1}. ${scenes[index].label} — ${questions.length > 1 ? 'Summary quiz' : 'Knowledge check'}`;
      panel.hidden = false;
      // The shared question renderer queues first-answer focus when mounting.
      // The player transition supplies context before the learner answers.
      setTimeout(() => { if (!panel.hidden) heading.focus({ preventScroll: true }); }, 0);
      panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    return { open, close, isOpen: () => !panel.hidden };
  }

  window.NarrationQuiz = { create };
})();
