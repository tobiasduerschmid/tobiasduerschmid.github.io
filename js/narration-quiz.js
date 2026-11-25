/* Narration-specific completion over the shared question renderer. Individual
   answers still use SebookQuiz's grading, feedback, and keyboard handling. */
(function () {
  'use strict';
  if (window.NarrationQuiz) return;
  const replayByRoot = new WeakMap();

  // Every audio transport registers once. The authored check order determines
  // the segment, even when the learner jumps directly to a later check.
  function bindReplay(root, { player, checkScenes = [] }) {
    replayByRoot.set(root, async sceneIndex => {
      const previousCheck = checkScenes.findLast(index => index < sceneIndex);
      player.selectScene((previousCheck ?? -1) + 1);
      const focusTarget = player.isFullscreen() ? root.querySelector('[data-vn-video]')
        : root.querySelector('[data-action="play"]');
      focusTarget.focus({ preventScroll: true });
      await player.play();
    });
  }

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

  function mount({ continueLabel, onContinue, ...options }) {
    const root = options.controlsEl.closest('.narrated-explainer');
    if (options.isFinalQuiz && window.NarrationSong.hasSong(root)) continueLabel = 'Continue to song';
    const host = options.hostEl;
    const replay = replayByRoot.get(root);
    let onAnswer;
    window.SebookQuiz.mount({ ...options, onPass: onContinue, onSkip: onContinue,
      onAnswer: result => { if (onAnswer) onAnswer(result); },
    });
    if (replay) onAnswer = replayFeedback(host, replay, options.stepIndex);
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
      onContinue();
    }, { capture: true });
  }

  window.NarrationQuiz = { mount, bindReplay };
})();
