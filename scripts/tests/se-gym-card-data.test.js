'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function renderCatalog(data) {
  const rendered = JSON.parse(execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    require_relative '_plugins/se_gym_card_catalog'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    site.data = JSON.parse(STDIN.read)
    Jekyll::SEGymCardCatalog.new.generate(site)
    template = Liquid::Template.parse(File.read('_includes/se-gym-card-data.html'))
    html = template.render!({ 'site' => { 'data' => site.data } }, registers: { site: site })
    site.render
    puts JSON.generate({ 'html' => html, 'decks' => site.pages.to_h { |page| [page.url, JSON.parse(page.output)] } })
  `], { cwd: root, input: JSON.stringify(data), encoding: 'utf8' }));
  const { html, decks } = rendered;
  const context = {};
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    vm.runInNewContext(script, context);
  }
  return { html, decks, catalog: JSON.parse(JSON.stringify(context.ALL_CARD_DATA)),
    sharedCatalog: context.ALL_CARD_DATA, urls: context.SEGymDeckUrls };
}

const examples = [
  ['quizzes', 'questions', {
    id: 'shared-id', question: '**payload-quiz-alpha**', type: 'multi',
    options: ['First', 'Second'], correct_indices: [0], optional_indices: [1],
    option_feedback: { 0: '**Correct**', 1: 'Optional' }, explanation: 'Because.',
    lines: ['start', 'finish'], interchangeable: [[0, 1]], distractors: ['extra'],
    display: 'inline', difficulty: 'Medium',
  }, {
    id: 'shared-id', question: 'Write the output.', type: 'write-in',
    program: 'print("answer")', answer: 'answer', answer_prompt: 'Output',
    explanation: '**Keep raw for the write-in renderer.**', difficulty: 'Easy',
  }],
  ['flashcards', 'cards', {
    id: 'shared-id', question: '**payload-flashcard-alpha**', hint: 'A prerequisite.',
    answer: '**Answer**', explanation: 'Because.', difficulty: 'Hard',
  }, {
    id: 'shared-id', question: 'Second question.', answer: 'Second answer.',
  }],
];

for (const [collection, entries, first, second] of examples) {
  test(`${collection}: combined decks preserve source content, order, and repeated references`, () => {
    const { catalog, html, sharedCatalog, decks: payloads, urls } = renderCatalog({
      quizzes: {}, flashcards: {},
      [collection]: {
        combined: { title: 'Combined', description: 'Review both topics.',
          decks: ['later', 'earlier', 'missing', 'nested', 'empty', 'later'] },
        nested: { title: 'Nested', decks: ['earlier'] },
        earlier: { title: 'Earlier', [entries]: [first] },
        later: { title: 'Later', [entries]: [second] },
        empty: { title: 'Empty', [entries]: [] },
        emptyCombined: { title: 'Empty combined', decks: ['missing', 'nested'] },
        own: { title: 'Own', [entries]: [second], decks: ['earlier'] },
      },
    });
    const decks = catalog[collection];
    assert.equal(decks.combined.title, 'Combined');
    assert.equal(decks.combined.description, 'Review both topics.');
    assert.equal(decks.combined.isMaster, true);
    assert.deepEqual(decks.combined[entries], [
      decks.later[entries][0], decks.earlier[entries][0], decks.later[entries][0],
    ], 'only directly referenced base decks contribute, in authored order');
    assert.deepEqual(decks.nested[entries], decks.earlier[entries]);
    assert.deepEqual(decks.combined[entries].map(card => card.sourceDeckId), ['later', 'earlier', 'later']);
    assert.equal(decks.own.isMaster, undefined, 'a deck with its own cards takes precedence over deck references');
    assert.equal(decks.own[entries][0].sourceDeckId, 'own');
    assert.deepEqual(decks.empty[entries], []);
    assert.deepEqual(decks.emptyCombined[entries], []);
    assert.equal(sharedCatalog[collection].combined[entries][0], sharedCatalog[collection].later[entries][0],
      'aggregate cards share the source object so loading its answer updates every selection');

    assert.equal(payloads[urls[collection].earlier][entries][0].sourceDeckId, 'earlier');
    assert.equal(payloads[urls[collection].later][entries][0].sourceDeckId, 'later');
    assert.equal(urls[collection].combined, undefined, 'combined decks reuse their source payloads');

    const marker = first.question.replaceAll('*', '');
    assert.equal(html.split(marker).length - 1, 1,
      'a source question must be serialized once even when several combined decks include it');
  });
}

test('an empty catalog remains available synchronously', () => {
  const { catalog } = renderCatalog({ quizzes: {}, flashcards: {} });
  assert.deepEqual(catalog, { quizzes: {}, flashcards: {} });
});

test('full deck payloads preserve quiz, write-in, flashcard, and literal template content', () => {
  const result = renderCatalog({
    quizzes: { assessment: { title: 'Assessment', questions: [examples[0][2], examples[0][3]] } },
    flashcards: { retrieval: { title: 'Retrieval', cards: [examples[1][2], {
      question: 'A literal template', answer: '{{ untouched }} {% if untouched %}literal{% endif %}',
    }] } },
  });
  const quizzes = result.decks[result.urls.quizzes.assessment].questions;
  assert.deepEqual(quizzes[0], {
    id: 'shared-id', sourceDeckId: 'assessment', question: '<p><strong>payload-quiz-alpha</strong></p>\n',
    type: 'multi', options: ['<p>First</p>\n', '<p>Second</p>\n'],
    correct_index: null, correct_indices: [0], optional_indices: [1],
    option_feedback: { 0: '<p><strong>Correct</strong></p>\n', 1: '<p>Optional</p>\n' },
    explanation: '<p>Because.</p>\n', lines: ['start', 'finish'], interchangeable: [[0, 1]],
    distractors: ['extra'], display: 'inline', difficulty: 'medium',
  });
  assert.deepEqual(quizzes[1], {
    id: 'shared-id', sourceDeckId: 'assessment', question: '<p>Write the output.</p>\n',
    type: 'write-in', options: [], correct_index: null, correct_indices: null,
    optional_indices: null, option_feedback: {}, explanation: '**Keep raw for the write-in renderer.**',
    lines: null, interchangeable: null, distractors: null, display: 'block', difficulty: 'easy',
    program: 'print("answer")', answer: 'answer', answer_prompt: 'Output',
  });
  const flashcards = result.decks[result.urls.flashcards.retrieval].cards;
  assert.deepEqual(flashcards[0], {
    id: 'shared-id', sourceDeckId: 'retrieval', question: '<p><strong>payload-flashcard-alpha</strong></p>\n',
    hint: '<p>A prerequisite.</p>', answer: '<p><strong>Answer</strong></p>\n',
    explanation: '<p>Because.</p>\n', difficulty: 'hard',
  });
  assert.equal(flashcards[1].answer, '<p>{{ untouched }} {% if untouched %}literal{% endif %}</p>\n');
  assert.deepEqual(result.catalog.quizzes.assessment.questions[1], {
    id: 'shared-id', sourceDeckId: 'assessment', question: '<p>Write the output.</p>\n',
    type: 'write-in', difficulty: 'easy', program: 'print("answer")',
  }, 'the entrance retains the prompt and identity needed for statistics, skipping, and saved selection');
  assert.equal(result.catalog.flashcards.retrieval.cards[0].answer, undefined);
  assert.equal(result.catalog.flashcards.retrieval.cards[0].hint, undefined);
  assert.equal(result.catalog.quizzes.assessment.questions[0].options, undefined);
});

test('deck URLs change with content and stay stable for unchanged content', () => {
  const data = { quizzes: { topic: { title: 'Topic', questions: [examples[0][2]] } }, flashcards: {} };
  const first = renderCatalog(data);
  const unchanged = renderCatalog(data);
  assert.equal(unchanged.urls.quizzes.topic, first.urls.quizzes.topic);
  data.quizzes.topic.questions = [{ ...examples[0][2], explanation: 'Updated feedback.' }];
  const updated = renderCatalog(data);
  assert.notEqual(updated.urls.quizzes.topic, first.urls.quizzes.topic,
    'new pages cannot accidentally hydrate stale content cached by an earlier deployment');
});
