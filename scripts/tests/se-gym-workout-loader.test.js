'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(path.resolve(__dirname, '../../js/se-gym-workout-loader.js'), 'utf8');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function environment({ data = { quizzes: {}, flashcards: {} }, urls = {}, assets = {}, response, script } = {}) {
  const requests = [];
  const scripts = [];
  const errors = [];
  const window = { ALL_CARD_DATA: data, SEGymDeckUrls: urls, SEGymWorkoutAssets: assets };
  const document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: {
      appendChild(element) {
        scripts.push(element);
        queueMicrotask(() => {
          if (script) script(element, window);
          else element.onload();
        });
      },
    },
  };
  vm.runInNewContext(source, {
    window, document,
    fetch(url) {
      requests.push(url);
      return response ? response(url) : Promise.reject(new Error('Unexpected request: ' + url));
    },
    console: { error: (...details) => errors.push(details) },
  }, { filename: 'se-gym-workout-loader.js' });
  return { loader: window.SEGymWorkoutLoader, window, requests, scripts, errors };
}

function quizFixture() {
  const questions = [1, 2].map(id => ({ id, sourceDeckId: 'topic', question: `<p>Question ${id}</p>`, type: 'single' }));
  const data = { quizzes: { topic: { questions }, master: { questions: [...questions] }, unused: { questions: [] } }, flashcards: {} };
  const full = questions.map(question => ({ ...question, options: ['Right', 'Wrong'], correct_index: 0, explanation: 'Feedback' }));
  const cards = [{ cardType: 'quiz', deckId: 'master', data: questions[0] }];
  return { data, questions, full, cards, urls: { quizzes: { topic: '/topic-v1.json', unused: '/unused.json' } } };
}

const jsonResponse = payload => Promise.resolve({ ok: true, json: async () => payload });

test('startup and an empty workout make no data or renderer requests', async () => {
  const env = environment();
  assert.equal(env.requests.length, 0);
  assert.equal(env.scripts.length, 0);
  await env.loader.ensureCards([]);
  assert.equal(env.requests.length, 0);
  assert.equal(env.scripts.length, 0);
});

test('only selected source decks load and aggregate references receive full content in place', async () => {
  const fixture = quizFixture();
  const env = environment({ ...fixture, response: () => jsonResponse({ questions: fixture.full }) });
  await env.loader.ensureCards(fixture.cards);
  assert.deepEqual(env.requests, ['/topic-v1.json']);
  assert.equal(fixture.cards[0].data, fixture.questions[0]);
  assert.equal(fixture.data.quizzes.master.questions[0], fixture.questions[0]);
  assert.deepEqual(fixture.questions[0].options, ['Right', 'Wrong']);
  assert.equal(fixture.questions[1].explanation, 'Feedback');
  assert.equal(env.scripts.length, 0, 'plain questions need no optional renderer');
  await env.loader.ensureCards(fixture.cards);
  assert.equal(env.requests.length, 1);
});

test('concurrent workouts share a pending deck request', async () => {
  const fixture = quizFixture();
  const network = deferred();
  const env = environment({ ...fixture, response: () => network.promise });
  const first = env.loader.ensureCards(fixture.cards);
  const second = env.loader.ensureCards(fixture.cards);
  assert.deepEqual(env.requests, ['/topic-v1.json']);
  network.resolve({ ok: true, json: async () => ({ questions: fixture.full }) });
  await Promise.all([first, second]);
  assert.equal(fixture.cards[0].data.correct_index, 0);
});

for (const failure of ['network', 'http', 'length', 'id', 'sourceDeckId', 'question']) {
  test(`${failure} failure leaves all cards unchanged and permits a successful retry`, async () => {
    const fixture = quizFixture();
    let attempts = 0;
    const env = environment({ ...fixture, response: () => {
      attempts++;
      if (attempts > 1) return jsonResponse({ questions: fixture.full });
      if (failure === 'network') return Promise.reject(new Error('Offline'));
      if (failure === 'http') return Promise.resolve({ ok: false });
      const records = fixture.full.map(record => ({ ...record }));
      if (failure === 'length') records.pop();
      else records[1][failure] = 'mismatch';
      return jsonResponse({ questions: records });
    } });
    await assert.rejects(env.loader.ensureCards(fixture.cards));
    assert.equal(fixture.questions[0].options, undefined, 'no partial hydration before complete validation');
    await env.loader.ensureCards(fixture.cards);
    assert.equal(attempts, 2);
    assert.equal(fixture.questions[0].correct_index, 0);
  });
}

test('quiz and flashcard decks with the same name load independently', async () => {
  const question = { id: 1, sourceDeckId: 'topic', question: 'Quiz?' };
  const flashcard = { id: 1, sourceDeckId: 'topic', question: 'Card?' };
  const env = environment({
    data: { quizzes: { topic: { questions: [question] } }, flashcards: { topic: { cards: [flashcard] } } },
    urls: { quizzes: { topic: '/quiz.json' }, flashcards: { topic: '/card.json' } },
    response: url => jsonResponse(url === '/quiz.json'
      ? { questions: [{ ...question, correct_index: 0 }] }
      : { cards: [{ ...flashcard, answer: 'Answer' }] }),
  });
  await env.loader.ensureCards([{ cardType: 'quiz', deckId: 'topic', data: question }, { cardType: 'flashcard', deckId: 'topic', data: flashcard }]);
  assert.deepEqual(env.requests.sort(), ['/card.json', '/quiz.json']);
  assert.equal(question.correct_index, 0);
  assert.equal(flashcard.answer, 'Answer');
});

test('UML in fetched feedback loads its renderer and description helper once, in order', async () => {
  const fixture = quizFixture();
  fixture.full[0].explanation = '<pre><code class="language-uml-class">class Example</code></pre>';
  const env = environment({ ...fixture,
    assets: { uml: [{ src: '/uml.js' }, { src: '/describe.js' }] },
    response: () => jsonResponse({ questions: fixture.full }),
  });
  await Promise.all([env.loader.ensureCards(fixture.cards), env.loader.ensureCards(fixture.cards)]);
  assert.deepEqual(env.scripts.map(script => script.src), ['/uml.js', '/describe.js']);
});

test('embedded write-in cards load their dependency chain without fetching a deck', async () => {
  const env = environment({ assets: { writeIn: [{ src: '/trace.js' }, { src: '/output.js' }, { src: '/write-in.js' }] } });
  await env.loader.ensureCards([{ cardType: 'quiz', deckId: 'fixture', data: { type: 'write-in', question: 'Predict output' } }]);
  assert.equal(env.requests.length, 0);
  assert.deepEqual(env.scripts.map(script => script.src), ['/trace.js', '/output.js', '/write-in.js']);
});

test('a failed renderer request can be retried without repeating successful dependencies', async () => {
  let failDescription = true;
  const env = environment({
    assets: { uml: [{ src: '/uml.js' }, { src: '/describe.js' }] },
    script(element) {
      if (element.src === '/describe.js' && failDescription) { failDescription = false; element.onerror(); }
      else element.onload();
    },
  });
  const cards = [{ cardType: 'quiz', deckId: 'fixture', data: { question: '<div data-uml-type="class"></div>' } }];
  await assert.rejects(env.loader.ensureCards(cards), /renderer/);
  assert.equal(env.scripts[1].removed, true);
  await env.loader.ensureCards(cards);
  assert.deepEqual(env.scripts.map(script => script.src), ['/uml.js', '/describe.js', '/describe.js']);
});

test('math preserves integrity settings and waits for MathJax startup', async () => {
  const startup = deferred();
  const scriptLoaded = deferred();
  const env = environment({
    assets: { mathjax: { src: '/math.js', id: 'MathJax-script', integrity: 'sha384-example', crossOrigin: 'anonymous' } },
    script(element, window) {
      window.MathJax = { startup: { promise: startup.promise }, typesetPromise: async () => {} };
      element.onload();
      scriptLoaded.resolve();
    },
  });
  let complete = false;
  const pending = env.loader.ensureCards([{ cardType: 'flashcard', deckId: 'fixture', data: { question: '\\(x^2\\)' } }]).then(() => { complete = true; });
  await scriptLoaded.promise;
  assert.equal(complete, false);
  assert.equal(env.scripts[0].integrity, 'sha384-example');
  assert.equal(env.scripts[0].crossOrigin, 'anonymous');
  assert.equal(env.scripts[0].id, 'MathJax-script');
  startup.resolve();
  await pending;
  assert.equal(complete, true);
});

test('an existing MathJax renderer still waits for its pending startup', async () => {
  const startup = deferred();
  const env = environment({ assets: { mathjax: { src: '/math.js' } } });
  env.window.MathJax = { startup: { promise: startup.promise }, typesetPromise: async () => {} };
  let complete = false;
  const pending = env.loader.ensureCards([
    { cardType: 'flashcard', deckId: 'fixture', data: { question: '$x^2$' } },
  ]).then(() => { complete = true; });
  await new Promise(setImmediate);
  assert.equal(complete, false);
  assert.equal(env.scripts.length, 0);
  startup.resolve();
  await pending;
  assert.equal(complete, true);
});

test('question typesetting is serialized and releases the previous detached card', async () => {
  const firstStarted = deferred();
  const firstFinished = deferred();
  const oldCard = {};
  const newCard = {};
  const root = { isConnected: true, children: [oldCard], contains(node) { return this.children.includes(node); } };
  const env = environment();
  const cleared = [];
  let calls = 0;
  env.window.MathJax = {
    typesetClear: nodes => cleared.push([...nodes]),
    typesetPromise() {
      calls++;
      if (calls === 1) { firstStarted.resolve(); return firstFinished.promise; }
      return Promise.resolve();
    },
  };
  const first = env.loader.renderContent(root);
  await firstStarted.promise;
  root.children = [newCard];
  const second = env.loader.renderContent(root);
  assert.equal(calls, 1);
  firstFinished.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
  assert.equal(cleared[0][0], oldCard);
});

test('revealing feedback retains MathJax tracking for the question still on screen', async () => {
  const question = {};
  const feedback = {};
  const root = { isConnected: true, children: [question], contains(node) { return this.children.includes(node); } };
  const env = environment();
  const cleared = [];
  env.window.MathJax = { typesetPromise: async () => {}, typesetClear: nodes => cleared.push([...nodes]) };
  await env.loader.renderContent(root);
  root.children.push(feedback);
  await env.loader.renderContent(root);
  assert.deepEqual(cleared, []);
});

test('a rendering failure is reported without blocking later questions', async () => {
  const env = environment();
  let calls = 0;
  env.window.MathJax = { typesetPromise() { return ++calls === 1 ? Promise.reject(new Error('Typeset failed')) : Promise.resolve(); } };
  const root = { isConnected: true, children: [] };
  await env.loader.renderContent(root);
  await env.loader.renderContent(root);
  assert.equal(calls, 2);
  assert.equal(env.errors.length, 1);
});
