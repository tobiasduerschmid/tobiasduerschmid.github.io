/** Scored output predictions shared by SEBook quizzes and SE Gym.
 * The puzzle renderer owns matching, output, and Python trace feedback;
 * callers own quiz progress, review queues, and optional performance storage.
 */
(function () {
  'use strict';

  function create(host, question, { onAnswer, onNext, nextLabel = 'Next Question' }) {
    host.classList.add('quiz-write-in');
    const puzzle = document.createElement('div');
    const result = document.createElement('p');
    result.className = 'quiz-write-in-result';
    result.setAttribute('role', 'status');
    function nextButton() {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'next-btn quiz-write-in-next is-hidden';
      button.textContent = nextLabel;
      button.addEventListener('click', onNext);
      return button;
    }
    const next = nextButton();
    const nextAfterTrace = nextButton();
    host.replaceChildren(puzzle);

    const controller = window.ProgramOutputLab.create(puzzle, {
      ...question.program,
      predict: true,
      predictPrompt: question.answer_prompt || 'Output (use spaces):',
      output: { stdout: question.answer },
      notice: question.explanation
    }, {
      answerMode: 'quiz',
      onPredictionResult({ matchTarget, feedbackContainer }) {
        const correct = Boolean(matchTarget);
        input.setAttribute('aria-invalid', String(!correct));
        result.textContent = correct ? 'Correct.' : 'Not quite.';
        feedbackContainer.before(result);
        const trace = feedbackContainer.querySelector('[data-object-reference-lab]');
        feedbackContainer.insertBefore(next, trace);
        next.classList.remove('is-hidden');
        if (trace) {
          feedbackContainer.appendChild(nextAfterTrace);
          nextAfterTrace.classList.remove('is-hidden');
        }
        if (correct && typeof window.spawnConfettiIfMore === 'function') {
          window.spawnConfettiIfMore(input);
        }
        onAnswer(correct);
        // Dismiss the mobile keyboard and keep the focused Next control visible.
        // This button precedes the trace, so it never jumps past the lab.
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'nearest' });
      }
    });
    const input = puzzle.querySelector('.unix-lab__predict-input');

    return {
      reset() {
        input.value = '';
        input.removeAttribute('aria-invalid');
        controller.reset();
        result.textContent = '';
        next.classList.add('is-hidden');
        nextAfterTrace.classList.add('is-hidden');
      }
    };
  }

  window.WriteInQuiz = { create };
}());
