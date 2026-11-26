const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateStudy } = require('../narration/study');
const { loadLesson } = require('../narration/source');

function fixture() {
  const story = { scenes: [{ id: 'roles', cues: [{ id: 'before' }, { id: 'after' }] }] };
  const quizzes = { roles: { question: 'Who owns the data?' } };
  const study = {
    version: 1,
    reviews: { roles: [{ scene: 'roles', cue: 'after', retry: {
      question: 'Who owns a new data field?', options: ['Model', 'View'], correct_index: 0,
      explanation: 'The model owns domain data.', option_feedback: { 1: 'The view presents the data.' },
    } }] },
    exercises: [{ id: 'add-view', title: 'Add a view', scene: 'roles', cue: 'after',
      prompt: 'Add another view.', type: 'class', starter: 'class Model', solution: 'class Model\nclass View', checks: ['Two roles appear.'] }],
    comparisons: [{ id: 'separate', title: 'Separate roles', question: 'What changes for another view?',
      before: { scene: 'roles', cue: 'before', label: 'Combined' }, after: { scene: 'roles', cue: 'after', label: 'Separated' },
      consequences: ['A view can change independently.'] }],
  };
  return { story, quizzes, study };
}

test('valid study material preserves its source and leaves speech untouched', () => {
  const { study, story, quizzes } = fixture();
  const original = structuredClone({ study, story, quizzes });
  assert.equal(validateStudy(study, story, quizzes), study);
  assert.deepEqual({ study, story, quizzes }, original);
});

for (const [name, edit, diagnostic] of [
  ['dangling review cue', s => { s.reviews.roles[0].cue = 'missing'; }, /reviews.roles.0.*unknown cue/],
  ['missing review', s => { s.reviews.roles = []; }, /one review per question/],
  ['extra review', s => { s.reviews.roles.push(s.reviews.roles[0]); }, /one review per question/],
  ['copied question', s => { s.reviews.roles[0].retry.question = 'Who owns the data?'; }, /fresh question/],
  ['out-of-range answer', s => { s.reviews.roles[0].retry.correct_index = 2; }, /correct_index/],
  ['invalid feedback index', s => { s.reviews.roles[0].retry.option_feedback[8] = 'Wrong'; }, /feedback index/],
  ['uneditable completed starter', s => { s.exercises[0].starter = s.exercises[0].solution; }, /leave a change/],
  ['unknown exercise type', s => { s.exercises[0].type = 'typo'; }, /diagram type/],
  ['duplicate exercise ID', s => { s.exercises.push(s.exercises[0]); }, /duplicate id/],
  ['identical comparison frames', s => { s.comparisons[0].before = s.comparisons[0].after; }, /different frames/],
  ['unknown field', s => { s.exercises[0].sloution = 'Typo'; }, /sloution.*unknown field/],
]) test(`study authoring rejects ${name}`, () => {
  const { study, story, quizzes } = fixture();
  edit(study);
  assert.throws(() => validateStudy(study, story, quizzes), diagnostic);
});

test('all nine UML and pattern lessons ship practice, comparisons, and complete question review', () => {
  for (const topic of ['uml_class_diagram', 'uml_sequence_diagram', 'uml_state_diagram', 'uml_component_diagram', 'observer', 'state', 'strategy', 'mvc', 'composite']) {
    const { study } = loadLesson(topic);
    assert.ok(study, `${topic} has study material`);
    assert.ok(study.exercises.length >= 2, `${topic} offers progressive practice`);
    assert.ok(study.comparisons.length >= 2, `${topic} contrasts design consequences`);
    // loadLesson validates review cardinality against every original question.
  }
});
