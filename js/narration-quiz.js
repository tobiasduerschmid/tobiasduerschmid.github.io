/* Knowledge-check presentation for every narration. SebookQuiz owns grading
   and answer feedback; NarrationPlayer supplies continuation/replay actions. */
(function () {
  'use strict';
  if (window.NarrationQuiz) return;

  function feedbackActions(card) {
    let actions = card.querySelector('.narration-quiz-actions');
    if (actions) return actions;
    actions = document.createElement('div');
    actions.className = 'narration-quiz-actions';
    const next = card.querySelector('.next-btn');
    next.before(actions);
    actions.appendChild(next);
    card.querySelector('.quiz-next-shortcut-hint').lastChild.textContent = ' activates the focused button.';
    return actions;
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
        feedbackActions(card).appendChild(button);
      }
      if (button) button.hidden = isCorrect;
    };
  }

  function mount({ continueLabel, onContinue, onReplay, onAnswer, ...options }) {
    const host = options.hostEl;
    let showReplay;
    // IDs survive the shared renderer's shuffle. These are local identities
    // for companion metadata; the authored questions and original score stay intact.
    const quiz = { ...options.quiz, questions: options.quiz.questions.map((question, index) => ({ ...question, id: String(index) })) };
    window.SebookQuiz.mount({ ...options, quiz, onPass: onContinue, onSkip: onContinue,
      onAnswer(result) {
        if (showReplay) showReplay(result);
        if (onAnswer) onAnswer({ ...result, questionIndex: Number(result.card.dataset.questionId) });
      },
    });
    if (onReplay) showReplay = replayFeedback(host, onReplay, options.stepIndex);
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
   * are null for unchecked scenes. Each encounter starts a fresh attempt;
   * explanation/practice detours return to the same in-progress attempt. */
  function create(root, { scenes, checks, reviews = {}, continueLabel, finishLabel, onContinue, onReplay, onReview, onReviewReturn }) {
    const panel = root.querySelector('.narration-check');
    const host = panel.querySelector('[data-quiz-host]');
    const stage = root.querySelector('.nja-stage');
    const captions = root.querySelector('.nja-narration');
    const playButton = root.querySelector('[data-action="play"]');
    const reviewPanel = root.querySelector('[data-narration-question-review]');
    const mounted = new Map();
    let returnToQuestion = null;
    let retryHost = null;

    function close() {
      panel.hidden = true;
      stage.hidden = false;
      captions.hidden = false;
      if (playButton) playButton.disabled = false;
    }

    function returnFromReview(index, trigger) {
      onReviewReturn();
      show(index, trigger);
    }

    function reviewQuestion(index, questionIndex, reference, trigger) {
      close();
      onReview(reference);
      returnToQuestion = () => returnFromReview(index, trigger);
      reviewPanel.querySelector('[data-narration-review-description]').textContent =
        `Review the explanation for question ${questionIndex + 1} in ${scenes[index].label}. Your answer is unchanged.`;
      reviewPanel.hidden = false;
      reviewPanel.querySelector('h3').focus({ preventScroll: true });
      reviewPanel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    function retryQuestion(index, reference, trigger) {
      mounted.forEach(quizHost => { quizHost.hidden = true; });
      if (retryHost) retryHost.remove();
      retryHost = document.createElement('div');
      retryHost.className = 'narration-retry';
      host.appendChild(retryHost);
      const returnToOriginal = () => returnFromReview(index, trigger);
      mount({
        hostEl: retryHost, controlsEl: panel, stepIndex: `${root.id}-practice`,
        quiz: { questions: [reference.retry] }, allowSkip: true,
        continueLabel: 'Return to question', onContinue: returnToOriginal,
        onAnswer({ isCorrect }) {
          panel.querySelector('.tvm-quiz-status').textContent = `${isCorrect ? 'Correct.' : 'Not yet.'} This practice answer is separate; your original answer and score are unchanged.`;
        },
      });
      retryHost.querySelector('.tvm-quiz-skip-btn').textContent = 'Leave practice';
      panel.querySelector('h3').textContent = `${index + 1}. ${scenes[index].label} — Similar question`;
      panel.querySelector('.tvm-quiz-status').textContent = 'Try a fresh question. This practice is graded separately from your original answer.';
      focusPanel();
    }

    function questionFeedback(index, { card, questionIndex, isCorrect }) {
      root.dispatchEvent(new CustomEvent('narration:answer', { detail: { sceneIndex: index, questionIndex, isCorrect } }));
      const reference = reviews[scenes[index].id]?.[questionIndex];
      if (!reference || card.querySelector('.narration-review-explanation')) return;
      const review = document.createElement('button');
      review.type = 'button';
      review.className = 'narration-review-explanation';
      review.textContent = 'Review this explanation';
      review.addEventListener('click', () => reviewQuestion(index, questionIndex, reference, review));
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'narration-try-similar';
      retry.textContent = 'Try a similar question';
      retry.addEventListener('click', () => retryQuestion(index, reference, retry));
      feedbackActions(card).append(review, retry);
    }

    function mountCheck(index) {
      const quizHost = document.createElement('div');
      host.appendChild(quizHost);
      mount({
        hostEl: quizHost, controlsEl: panel, stepIndex: index,
        quiz: checks[index], allowSkip: true, isFinalQuiz: index === scenes.length - 1,
        continueLabel: index + 1 < scenes.length ? continueLabel : finishLabel,
        onContinue: () => onContinue(index), onReplay,
        onAnswer: result => questionFeedback(index, result),
      });
      mounted.set(index, quizHost);
      return quizHost;
    }

    function focusPanel(target = panel.querySelector('h3')) {
      // The shared quiz queues answer focus. Supply the transition's context
      // afterwards, or return to the exact action that opened the review.
      setTimeout(() => { if (!panel.hidden) target.focus({ preventScroll: true }); }, 0);
      panel.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }

    function open(index) {
      mounted.forEach(quizHost => { quizHost.remove(); });
      mounted.clear();
      returnToQuestion = null;
      show(index);
    }

    function show(index, focusTarget) {
      const questions = checks[index].questions;
      if (reviewPanel) reviewPanel.hidden = true;
      if (retryHost) { retryHost.remove(); retryHost = null; }
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
      focusPanel(focusTarget);
    }

    if (reviewPanel) {
      reviewPanel.querySelector('[data-narration-action="return-question"]').addEventListener('click', () => {
        if (returnToQuestion) returnToQuestion();
      });
      reviewPanel.addEventListener('keydown', event => { if (event.key !== 'Escape') event.stopPropagation(); });
    }

    return { open, close, isOpen: () => !panel.hidden };
  }

  window.NarrationQuiz = { create };
})();
