'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../../js/se-gym.js'), 'utf8');
const storageKey = 'se-gym-skipped-questions';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function loadGym(localStorage = createStorage()) {
  const context = { localStorage, window: {}, document: { cookie: '' } };
  vm.runInNewContext(source, context, { filename: 'se-gym.js' });
  return context.window.PersonalGym;
}

const question = { id: 1, sourceDeckId: 'topic', question: '<p>First question</p>' };

test('a skipped question remains excluded after reload using its stable ID', () => {
  const storage = createStorage();
  const gym = loadGym(storage);

  assert.equal(gym.skipQuestion('quiz', 'topic', question), true);

  const reloaded = loadGym(storage);
  assert.equal(reloaded.isQuestionSkipped('quiz', 'topic', { ...question, question: 'Reworded question' }), true);
  assert.deepEqual(JSON.parse(storage.getItem(storageKey))['quiz:topic'], ['1']);
});

test('skipping is limited to the selected deck and card type', () => {
  const gym = loadGym();
  gym.skipQuestion('quiz', 'topic', question);

  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), true);
  assert.equal(gym.isQuestionSkipped('flashcard', 'topic', question), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'other-deck', question), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', { ...question, id: 2 }), false);
});

test('repeated skipping keeps a single saved question exclusion', () => {
  const storage = createStorage();
  const gym = loadGym(storage);
  gym.skipQuestion('quiz', 'topic', question);

  assert.equal(gym.skipQuestion('quiz', 'topic', question), true);
  assert.deepEqual(JSON.parse(storage.getItem(storageKey))['quiz:topic'], ['1']);
});

test('aggregate decks distinguish same-numbered questions from different source decks', () => {
  const gym = loadGym();
  gym.skipQuestion('quiz', 'all-topics', question);

  assert.equal(gym.isQuestionSkipped('quiz', 'all-topics', question), true);
  assert.equal(gym.isQuestionSkipped('quiz', 'all-topics', { ...question, sourceDeckId: 'other-topic' }), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), false);
});

test('questions without IDs use the existing normalized question identity', () => {
  const gym = loadGym();
  gym.skipQuestion('quiz', 'topic', { question: '<p>No ID here</p>' });

  assert.equal(gym.isQuestionSkipped('quiz', 'topic', { question: 'No   ID here' }), true);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', { question: 'A different question' }), false);
});

test('filtering removes saved exclusions while preserving remaining cards and their order', () => {
  const gym = loadGym();
  const skipped = { cardType: 'quiz', deckId: 'topic', data: question };
  const otherDeck = { ...skipped, deckId: 'other-deck' };
  const otherQuestion = { ...skipped, data: { ...question, id: 2 } };
  const cards = [otherQuestion, skipped, otherDeck];
  gym.skipQuestion('quiz', 'topic', question);

  assert.deepEqual(gym.filterSkippedQuestions(cards), [otherQuestion, otherDeck]);
  assert.deepEqual(cards, [otherQuestion, skipped, otherDeck]);
  assert.deepEqual(gym.filterSkippedQuestions([]), []);
});

for (const malformed of ['{bad json', 'null', '[]', '"string"']) {
  test(`malformed stored exclusions ${malformed} do not hide questions or prevent a fresh choice`, () => {
    const storage = createStorage({ [storageKey]: malformed });
    const gym = loadGym(storage);

    assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), false);
    assert.equal(gym.skipQuestion('quiz', 'topic', question), true);
    assert.equal(loadGym(storage).isQuestionSkipped('quiz', 'topic', question), true);
  });
}

test('invalid stored entries are ignored without losing valid exclusions', () => {
  const storage = createStorage({
    [storageKey]: JSON.stringify({
      'quiz:topic': ['1', null, {}, false],
      'quiz:invalid': '1',
    }),
  });
  const gym = loadGym(storage);

  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), true);
  assert.equal(gym.isQuestionSkipped('quiz', 'invalid', { ...question, sourceDeckId: 'invalid' }), false);
  assert.equal(gym.skipQuestion('quiz', 'topic', { ...question, id: 2 }), true);
  assert.deepEqual(JSON.parse(storage.getItem(storageKey))['quiz:topic'], ['1', '2']);
});

test('denied storage reads cannot claim a question has been saved', () => {
  const storage = createStorage();
  storage.getItem = () => { throw new Error('Storage denied'); };
  const gym = loadGym(storage);

  assert.equal(gym.skipQuestion('quiz', 'topic', question), false);
  assert.equal(gym.restoreQuestion('quiz', 'topic', question), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), false);
});

test('failed writes preserve earlier exclusions without claiming the new choice succeeded', () => {
  const storage = createStorage();
  const gym = loadGym(storage);
  gym.skipQuestion('quiz', 'topic', question);
  storage.setItem = () => { throw new Error('Storage full'); };

  assert.equal(gym.skipQuestion('quiz', 'topic', { ...question, id: 2 }), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), true);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', { ...question, id: 2 }), false);
});

test('restoring a question is persisted and leaves other decks and questions skipped', () => {
  const storage = createStorage();
  const gym = loadGym(storage);
  gym.skipQuestion('quiz', 'topic', question);
  gym.skipQuestion('quiz', 'topic', { ...question, id: 2 });
  gym.skipQuestion('quiz', 'all-topics', question);

  assert.equal(gym.restoreQuestion('quiz', 'topic', question), true);

  const reloaded = loadGym(storage);
  assert.equal(reloaded.isQuestionSkipped('quiz', 'topic', question), false);
  assert.equal(reloaded.isQuestionSkipped('quiz', 'topic', { ...question, id: 2 }), true);
  assert.equal(reloaded.isQuestionSkipped('quiz', 'all-topics', question), true);
});

test('restoring the final question clears its storage entry', () => {
  const storage = createStorage();
  const gym = loadGym(storage);
  gym.skipQuestion('quiz', 'topic', question);

  assert.equal(gym.restoreQuestion('quiz', 'topic', question), true);
  assert.equal(storage.getItem(storageKey), null);
  assert.equal(loadGym(storage).isQuestionSkipped('quiz', 'topic', question), false);
});

test('failed restoration leaves the question skipped and reports the failure', () => {
  const storage = createStorage();
  const gym = loadGym(storage);
  gym.skipQuestion('quiz', 'topic', question);
  storage.removeItem = () => { throw new Error('Storage denied'); };

  assert.equal(gym.restoreQuestion('quiz', 'topic', question), false);
  assert.equal(gym.isQuestionSkipped('quiz', 'topic', question), true);
});

test('the review list includes each saved deck scope and excludes other questions', () => {
  const gym = loadGym();
  const cardData = {
    quizzes: {
      topic: { title: 'Topic quiz', questions: [question, { ...question, id: 2 }] },
      'all-topics': { title: 'All topics', isMaster: true, questions: [question] },
    },
    flashcards: { topic: { title: 'Topic cards', cards: [question] } },
  };
  gym.skipQuestion('quiz', 'topic', question);
  gym.skipQuestion('quiz', 'all-topics', question);

  const skippedCards = Array.from(gym.getSkippedCards(cardData));
  assert.deepEqual(skippedCards.map((card) => [card.cardType, card.deckId, card.source, card.data.id]),
    [['quiz', 'topic', 'Topic quiz', 1], ['quiz', 'all-topics', 'All topics', 1]]);
});
