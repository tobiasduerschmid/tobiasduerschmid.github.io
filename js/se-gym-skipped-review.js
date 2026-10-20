(function () {
  'use strict';

  function renderSkippedQuestions() {
    const section = document.getElementById('skipped-questions');
    if (!section || !window.PersonalGym || !window.ALL_CARD_DATA) return;

    const list = document.getElementById('skipped-questions-list');
    const empty = document.getElementById('skipped-questions-empty');
    const count = document.getElementById('skipped-questions-count');
    const status = document.getElementById('skipped-questions-status');
    const template = document.getElementById('skipped-question-template');
    const cards = window.PersonalGym.getSkippedCards(window.ALL_CARD_DATA);

    function updateCount() {
      const remaining = window.PersonalGym.getSkippedCards(window.ALL_CARD_DATA).length;
      count.textContent = '(' + remaining + ')';
    }

    function restoreCard(card, row, label) {
      const button = row.querySelector('button');
      if (button.getAttribute('aria-disabled') === 'true') return;
      if (!window.PersonalGym.restoreQuestion(card.cardType, card.deckId, card.data)) {
        status.textContent = 'Your browser could not restore this question. Allow site storage, then try again.';
        return;
      }
      button.textContent = 'Restored';
      button.setAttribute('aria-label', 'Restored: ' + label);
      button.setAttribute('aria-disabled', 'true');
      row.querySelector('.stats-skipped-state').textContent = 'Restored. Available in future practice from this deck.';
      status.textContent = 'Question restored to ' + card.source + '. It is available for future practice.';
      updateCount();
    }

    function createRow(card) {
      const row = template.content.firstElementChild.cloneNode(true);
      row.querySelector('.stats-skipped-source').textContent =
        card.source + ' · ' + (card.cardType === 'quiz' ? 'Quiz' : 'Flashcards');
      const prompt = row.querySelector('.stats-skipped-prompt');
      // The embedded corpus contains trusted, rendered course Markdown.
      prompt.innerHTML = card.data.question || '';
      if (card.data.program) {
        const program = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = card.data.program;
        program.appendChild(code);
        prompt.appendChild(program);
      }
      const questionText = prompt.textContent.replace(/\s+/g, ' ').trim();
      const label = questionText.slice(0, 180) + ' (' + card.source + ')';
      const button = row.querySelector('button');
      button.setAttribute('aria-label', 'Show again: ' + label);
      button.addEventListener('click', function () {
        restoreCard(card, row, label);
      });
      return row;
    }

    cards.forEach(function (card) {
      list.appendChild(createRow(card));
    });
    empty.classList.toggle('is-hidden', cards.length > 0);
    empty.textContent = 'No skipped questions. Questions you mark Always skip during a workout will appear here.';
    updateCount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSkippedQuestions);
  } else {
    renderSkippedQuestions();
  }
})();
