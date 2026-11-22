/* Narration-specific completion over the shared question renderer. Individual
   answers still use SebookQuiz's grading, feedback, and keyboard handling. */
(function () {
  'use strict';

  function mount({ continueLabel, onContinue, ...options }) {
    window.SebookQuiz.mount({ ...options, onPass: onContinue, onSkip: onContinue });
    const host = options.hostEl;
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

  window.NarrationQuiz = { mount };
})();
