'use strict';

// Study companions never change spoken text or its fingerprint. Validate links
// at the authoring boundary so the browser can navigate stable cue IDs directly.
function validateStudy(study, story, quizzes = {}) {
  const fail = (at, message) => { throw new Error(`study.${at}: ${message}`); };
  const object = (value, at) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(at, 'expected an object');
  };
  const text = (value, at) => {
    if (typeof value !== 'string' || !value.trim()) fail(at, 'expected nonempty text');
  };
  const fields = (value, allowed, at) => {
    object(value, at);
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${at}.${key}`, 'unknown field');
  };
  const list = (value, at) => {
    if (!Array.isArray(value) || !value.length) fail(at, 'expected a nonempty list');
  };
  const texts = (value, at) => { list(value, at); value.forEach((item, index) => text(item, `${at}.${index}`)); };
  const reference = (value, at) => {
    object(value, at);
    const scene = story.scenes.find(scene => scene.id === value.scene);
    if (!scene) fail(at, `unknown scene ${value.scene}`);
    if (!scene.cues.some(cue => cue.id === value.cue)) fail(at, `unknown cue ${value.scene}.${value.cue}`);
  };
  const items = (values, at, validate) => {
    list(values, at);
    const ids = new Set();
    values.forEach((value, index) => {
      const location = `${at}.${index}`;
      object(value, location);
      if (!/^[a-z][a-z0-9_-]*$/.test(value.id || '')) fail(location, 'expected a stable lowercase id');
      if (ids.has(value.id)) fail(location, `duplicate id ${value.id}`);
      ids.add(value.id);
      text(value.title, `${location}.title`);
      validate(value, location);
    });
  };

  fields(study, ['version', 'reviews', 'exercises', 'comparisons'], '');
  if (study.version !== 1) fail('version', 'supported version is 1');
  object(study.reviews, 'reviews');
  const checks = new Map(story.scenes.flatMap(scene => {
    const check = quizzes[scene.id] || scene.checkpoint;
    return check ? [[scene.id, check.questions || [check]]] : [];
  }));
  for (const id of Object.keys(study.reviews)) if (!checks.has(id)) fail(`reviews.${id}`, 'no matching quiz');
  for (const [id, questions] of checks) {
    const reviews = study.reviews[id];
    if (!Array.isArray(reviews) || reviews.length !== questions.length) fail(`reviews.${id}`, 'supply one review per question');
    reviews.forEach((review, index) => {
      const at = `reviews.${id}.${index}`;
      fields(review, ['scene', 'cue', 'retry'], at);
      reference(review, at);
      const retry = review.retry;
      fields(retry, ['type', 'question', 'options', 'correct_index', 'explanation', 'option_feedback', 'difficulty'], `${at}.retry`);
      if (retry.type && retry.type !== 'single') fail(at, 'retry must be single choice');
      text(retry.question, `${at}.retry.question`);
      if (retry.question.trim() === questions[index].question.trim()) fail(at, 'retry must use a fresh question');
      texts(retry.options, `${at}.retry.options`);
      if (retry.options.length < 2 || new Set(retry.options).size !== retry.options.length) fail(at, 'retry needs distinct options');
      if (!Number.isInteger(retry.correct_index) || retry.correct_index < 0 || retry.correct_index >= retry.options.length) fail(at, 'retry correct_index is out of range');
      text(retry.explanation, `${at}.retry.explanation`);
      if (retry.option_feedback) {
        object(retry.option_feedback, `${at}.retry.option_feedback`);
        for (const [key, value] of Object.entries(retry.option_feedback)) {
          if (!/^\d+$/.test(key) || Number(key) >= retry.options.length) fail(at, 'feedback index is out of range');
          text(value, `${at}.retry.option_feedback.${key}`);
        }
      }
    });
  }
  items(study.exercises, 'exercises', (exercise, at) => {
    fields(exercise, ['id', 'title', 'scene', 'cue', 'prompt', 'type', 'starter', 'solution', 'checks'], at);
    reference(exercise, at);
    if (!['class', 'sequence', 'state', 'component'].includes(exercise.type)) fail(at, 'unsupported exercise diagram type');
    for (const key of ['prompt', 'starter', 'solution']) text(exercise[key], `${at}.${key}`);
    if (exercise.starter.trim() === exercise.solution.trim()) fail(at, 'starter must leave a change for the learner');
    texts(exercise.checks, `${at}.checks`);
  });
  items(study.comparisons, 'comparisons', (comparison, at) => {
    fields(comparison, ['id', 'title', 'question', 'before', 'after', 'consequences'], at);
    text(comparison.question, `${at}.question`);
    for (const side of ['before', 'after']) {
      fields(comparison[side], ['scene', 'cue', 'label'], `${at}.${side}`);
      reference(comparison[side], `${at}.${side}`);
      text(comparison[side].label, `${at}.${side}.label`);
    }
    if (comparison.before.scene === comparison.after.scene && comparison.before.cue === comparison.after.cue) fail(at, 'comparison needs two different frames');
    texts(comparison.consequences, `${at}.consequences`);
  });
  return study;
}

module.exports = { validateStudy };
