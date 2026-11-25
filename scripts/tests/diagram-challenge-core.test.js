const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/tutorial-diagram-challenge-core.js');

// A small T1-shaped challenge: two Part A questions, one follow-up, an
// evidence check, and the debrief's consolidation and mechanism question.
const RECEIVERS = {
  id: 'receivers',
  type: 'multiple',
  question: 'Which queues receive `order.placed`?',
  options: ['partner-gateway', 'trip-site-notifications', 'warehouse-etl', 'checkout'],
  correct_indices: [0, 1, 2],
};
const SOURCE = {
  id: 'source',
  type: 'single',
  question: 'Which file decides who receives an order event?',
  options: ['deploy/broker.toml', 'services/opc/orders.py'],
  correct_index: 0,
};

function spec(overrides) {
  return Object.assign({
    mode: 'code-first',
    budget_minutes: 7,
    min_score: 0.8,
    questions: [RECEIVERS, SOURCE],
    reply: {
      request: 'Draw a UML component diagram of the order events.',
      summary: 'Publisher, exchange, and consumers.',
      diagrams: [{ id: 'events', type: 'component', source: '@startuml\ncomponent A\n@enduml' }],
      evidence: [{ text: 'warehouse-etl binds #', ref: 'deploy/broker.toml:18' }],
    },
    follow_up: [{
      id: 'cancelled',
      type: 'multiple',
      question: 'Which queues receive `order.cancelled`?',
      options: ['partner-gateway', 'trip-site-notifications', 'warehouse-etl'],
      correct_indices: [1, 2],
    }],
    evidence_check: {
      prompt: 'Open the bindings and confirm the absence.',
      question: { id: 'verified', type: 'single', question: 'Does the code agree?', options: ['Yes', 'No'], correct_index: 0 },
    },
    debrief: {
      hidden_by: 'Bindings live in configuration.',
      consolidation_prompt: 'What did the diagram put side by side that you had to search for?',
      mechanism_question: {
        id: 'mechanism', type: 'single', question: 'Which mechanism hid the answer?',
        options: ['Bindings in configuration, with wildcards', 'A remote call inside a loop'], correct_index: 0,
      },
    },
  }, overrides);
}

const ATTEMPT = { hypothesis: true, evidence_pins: 1, view_wish: true };
const kinds = session => session.missing().map(item => item.kind);

function answerPartA(session) {
  session.answer('receivers', [0]);
  session.answer('source', 0);
  session.setConfidence('fairly-sure');
}

/** A session locked at t = 100 s with Part A: receivers [0], source 0. */
function lockedSession(overrides) {
  const session = Core.createSession(spec(overrides));
  session.resume(0);
  answerPartA(session);
  assert.equal(session.lock(100_000), true);
  return session;
}

/** Locked, Part B checked once, then moved on to the follow-up stage. */
function followUpSession() {
  const session = lockedSession();
  session.answer('receivers', [0, 1, 2]);
  session.checkMain(160_000);
  assert.equal(session.advance(170_000), true);
  return session;
}

/** Every graded part answered correctly, ready to finish the debrief. */
function doneSession() {
  const session = followUpSession();
  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(200_000);
  session.answerEvidenceCheck('verified', 0);
  session.checkEvidence(230_000);
  assert.equal(session.advance(240_000), true);
  return session;
}

test('cannot lock until every question and the confidence are answered', () => {
  const session = Core.createSession(spec());

  assert.equal(session.canLock(), false);
  assert.deepEqual(kinds(session), ['question', 'question', 'confidence']);
  session.answer('receivers', [0, 1]);
  session.answer('source', 0);
  assert.deepEqual(kinds(session), ['confidence']);
  assert.equal(session.lock(1000), false, 'lock refuses an incomplete attempt');
  assert.equal(session.state, 'exploring');

  session.setConfidence('fairly-sure');
  assert.equal(session.canLock(), true);
  session.answer('receivers', []);
  assert.equal(session.canLock(), false, 'an empty selection is not an answer');
});

test('options stay hidden until a hypothesis exists', () => {
  const session = Core.createSession(spec({ attempt: ATTEMPT }));

  assert.equal(session.optionsVisible(), false);
  assert.equal(session.answer('source', 0), false, 'answers wait until the hypothesis is written');
  session.setHypothesis('   ');
  assert.equal(session.optionsVisible(), false, 'a blank hypothesis does not count');

  session.setHypothesis('The broker bindings in deploy/ decide.');
  assert.equal(session.optionsVisible(), true);
  assert.equal(session.answer('source', 0), true);
  session.setHypothesis('');
  assert.equal(session.optionsVisible(), true, 'choices already answered stay visible');
});

test('lock requires pinned evidence and a view wish', () => {
  const session = Core.createSession(spec({ attempt: ATTEMPT }));
  session.setHypothesis('Bindings decide.');
  answerPartA(session);

  assert.deepEqual(kinds(session), ['evidence', 'view-wish']);
  assert.equal(session.missing()[0].needed, 1);
  assert.equal(session.addEvidence({ path: 'deploy/broker.toml', line: 18 }), true);
  assert.equal(session.addEvidence({ path: 'deploy/broker.toml', line: 18 }), false, 'a line is pinned once');
  assert.equal(session.addEvidence({ path: '', line: 3 }), false);
  assert.equal(session.addEvidence({ path: 'infra/bus.py', line: 0 }), false);
  assert.deepEqual(kinds(session), ['view-wish']);

  session.setViewWish('Every consumer of the exchange with its binding key.');
  assert.equal(session.canLock(), true);
  session.removeEvidence(0);
  assert.deepEqual(kinds(session), ['evidence']);
});

test('lock freezes part A answers and part B starts from them', () => {
  const session = Core.createSession(spec({ attempt: ATTEMPT }));
  session.resume(0);
  session.setHypothesis('Bindings decide.');
  session.addEvidence({ path: 'deploy/broker.toml', line: 8 });
  session.setViewWish('Consumers with bindings.');
  answerPartA(session);
  session.lock(100_000);

  assert.deepEqual(session.snapshot().b.answers, { receivers: [0], source: 0 }, 'part B is prefilled');
  session.answer('receivers', [0, 1, 2]);
  session.setHypothesis('Changed after lock-in.');
  session.setConfidence('sure');
  session.addEvidence({ path: 'infra/bus.py', line: 9 });

  const { a, b } = session.snapshot();
  assert.deepEqual(a.answers, { receivers: [0], source: 0 });
  assert.equal(a.hypothesis, 'Bindings decide.');
  assert.equal(a.confidence, 'fairly-sure');
  assert.deepEqual(a.evidence, [{ path: 'deploy/broker.toml', line: 8 }]);
  assert.deepEqual(b.answers.receivers, [0, 1, 2], 'later answers change only part B');
});

test('multiple-choice grading reports found, missed, extra', () => {
  const session = lockedSession();
  session.answer('receivers', [3, 0]);

  const [receivers, source] = session.checkMain(160_000);
  assert.deepEqual(receivers, { id: 'receivers', correct: false, found: [0], missed: [1, 2], extra: [3] });
  assert.deepEqual(source, { id: 'source', correct: true, found: [0], missed: [], extra: [] });

  session.answer('receivers', [2, 1, 0]);
  assert.equal(session.checkMain(170_000)[0].correct, true, 'selection order does not matter');
});

test('comparison uses the first part B attempt after a retry', () => {
  const session = lockedSession();
  session.answer('source', 1);
  session.checkMain(160_000);
  session.answer('source', 0);
  session.answer('receivers', [0, 1, 2]);
  session.checkMain(180_000);

  const source = session.comparison().questions.find(row => row.id === 'source');
  assert.deepEqual(source.partA, { id: 'source', correct: true, found: [0], missed: [], extra: [] });
  assert.deepEqual(source.partB, { id: 'source', correct: false, found: [], missed: [0], extra: [1] },
    'the first attempt feeds the comparison');
  assert.deepEqual(session.snapshot().b.attempts, 2);
  assert.deepEqual(session.lastResults('main').map(result => result.correct), [true, true],
    'the latest attempt is what the marks show');
});

test('score includes evidence check and mechanism question', () => {
  const session = doneSession();
  // Part B right; the follow-up and evidence check answered again, wrongly
  // (checks stay open in the comparison), and the mechanism wrong.
  session.answerFollowUp('cancelled', [0]);
  session.checkFollowUp(245_000);
  session.answerEvidenceCheck('verified', 1);
  session.checkEvidence(246_000);
  session.answerMechanism('mechanism', 1);
  session.setConsolidation('The bindings sat next to every consumer.');

  let outcome = session.finish(250_000);
  assert.equal(outcome.passed, false);
  assert.equal(session.score(), 2 / 5, 'two part B questions right; follow-up, evidence, mechanism wrong');

  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(255_000);
  session.answerEvidenceCheck('verified', 0);
  session.checkEvidence(256_000);
  session.answerMechanism('mechanism', 0);
  outcome = session.finish(260_000);
  assert.equal(session.score(), 1);
  assert.equal(outcome.passed, true);
});

test('moving on needs at least one correct answer in each latest check', () => {
  const session = lockedSession();
  session.answer('receivers', [3]);
  session.answer('source', 1);
  session.checkMain(160_000);
  assert.equal(session.canAdvance(), false, 'nothing right yet: no moving on');
  assert.equal(session.advance(165_000), false);

  session.answer('source', 0);
  session.checkMain(170_000);
  assert.equal(session.canAdvance(), true, 'one of two right: the learner may move on');
  assert.equal(session.advance(175_000), true);

  session.answerFollowUp('cancelled', [0]);
  session.checkFollowUp(180_000);
  session.answerEvidenceCheck('verified', 1);
  session.checkEvidence(185_000);
  assert.equal(session.canAdvance(), false, 'the follow-up and the evidence check have nothing right');
  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(190_000);
  assert.equal(session.canAdvance(), false, 'the evidence check still has nothing right');
  session.answerEvidenceCheck('verified', 0);
  session.checkEvidence(195_000);
  assert.equal(session.canAdvance(), true);
});

test('a question names the reply diagram that answers it, when that diagram exists', () => {
  const challenge = Core.normalizeSpec(spec({
    questions: [Object.assign({ diagram: 'events' }, RECEIVERS), Object.assign({ diagram: 'imports' }, SOURCE)],
  }));

  assert.equal(challenge.questions[0].diagram, 'events');
  assert.equal(challenge.questions[1].diagram, null, 'a diagram the reply does not have');
  assert.equal(Core.normalizeSpec(spec()).questions[0].diagram, null);
});

test('passing needs the consolidation sentence and the minimum score, and stays passed', () => {
  const session = doneSession();
  session.answerMechanism('mechanism', 0);

  assert.deepEqual(session.finishMissing().map(item => item.kind), ['consolidation']);
  assert.equal(session.finish(250_000).passed, false);
  session.setConsolidation('Every consumer appeared beside its binding key.');
  assert.equal(session.finish(260_000).passed, true);
  assert.equal(Core.isPassed(session.serialize(260_000)), true);

  session.answer('receivers', [3]);
  session.checkMain(270_000);
  assert.equal(session.passed, true, 'later practice does not undo completion');
});

test('contrast question must be answered before the main diagram', () => {
  const contrast = {
    request: 'Draw the dependencies between the Python packages.',
    diagram: { id: 'imports', type: 'class', source: '@startuml\nclass A\n@enduml' },
    question: { id: 'fits', type: 'single', question: 'Can this view answer it?', options: ['Yes', 'No'], correct_index: 1 },
  };
  const session = lockedSession({ reply: Object.assign({}, spec().reply, { contrast }) });

  assert.equal(session.contrastPending(), true);
  assert.equal(session.mainVisible(), false);
  assert.equal(session.checkMain(110_000), null, 'part B waits for the contrast');
  assert.equal(session.checkContrast(110_000), null, 'an unanswered contrast cannot be checked');

  session.answerContrast('fits', 1);
  assert.deepEqual(session.checkContrast(120_000), { id: 'fits', correct: true, found: [1], missed: [], extra: [] });
  assert.equal(session.mainVisible(), true);
  assert.equal(session.answerContrast('fits', 0), false, 'the contrast answer is final');
  assert.equal(session.snapshot().c.checked.fits, 1);
});

test('timer excludes paused intervals', () => {
  const session = Core.createSession(spec());
  session.resume(0);
  session.pause(60_000);          // tab hidden at one minute
  session.resume(600_000);        // back after nine minutes away
  answerPartA(session);
  session.lock(630_000);

  assert.equal(session.serialize(630_000).a.seconds, 90);
});

test('each part times only its own first answer', () => {
  const contrast = {
    request: 'Draw the package dependencies.',
    diagram: { id: 'imports', type: 'class', source: '@startuml\nclass A\n@enduml' },
    question: { id: 'fits', type: 'single', question: 'Fits?', options: ['Yes', 'No'], correct_index: 1 },
  };
  const session = lockedSession({ reply: Object.assign({}, spec().reply, { contrast }) });
  session.answerContrast('fits', 0);
  session.checkContrast(130_000);   // part B's clock starts with the main reply
  session.pause(150_000);
  session.resume(500_000);
  session.checkMain(520_000);       // 20 s + 20 s with the diagram
  session.checkMain(900_000);       // a retry is practice, not timed
  session.advance(910_000);
  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(935_500);

  const record = session.serialize(1_000_000);
  assert.equal(record.a.seconds, 100);
  assert.equal(record.b.seconds, 40);
  assert.equal(record.f.seconds, 25.5, 'seconds keep one decimal');
});

test('serialize and restore round-trip every state', () => {
  const exploring = Core.createSession(spec({ attempt: ATTEMPT }));
  exploring.resume(0);
  exploring.setHypothesis('Draft hypothesis');
  exploring.answer('receivers', [1]);
  exploring.addEvidence({ path: 'deploy/broker.toml', line: 8 });

  const passed = doneSession();
  passed.answerMechanism('mechanism', 0);
  passed.setConsolidation('Side by side.');
  passed.finish(250_000);
  passed.setHideTimes(true);

  const sessions = { exploring, locked: lockedSession(), 'follow-up': followUpSession(), done: doneSession(), passed };
  for (const [name, session] of Object.entries(sessions)) {
    const record = session.serialize(300_000);
    const restored = Core.createSession(session.spec, JSON.parse(JSON.stringify(record)));
    assert.deepEqual(restored.serialize(300_000), record, `${name} survives a reload`);
    assert.equal(restored.state, record.state);
  }

  // The restored clock continues from the saved total, without the time away.
  const reloaded = Core.createSession(spec(), lockedSession().serialize(100_000));
  reloaded.resume(5_000_000);
  reloaded.checkMain(5_030_000);
  assert.equal(reloaded.serialize(5_030_000).b.seconds, 30);
});

test('a restored record is sanitized against the challenge', () => {
  const session = Core.createSession(spec({ attempt: ATTEMPT }), {
    v: 1,
    state: 'exploring',
    a: {
      answers: { receivers: [0, 9, 'x', 0], ghost: 1, source: 5 },
      confidence: 'very',
      evidence: [{ path: '', line: 3 }, { path: 'infra/bus.py', line: 9 }, { path: 'infra/bus.py', line: 2.5 }],
      hypothesis: 42,
      seconds: -3,
    },
  });

  const { a } = session.snapshot();
  assert.deepEqual(a.answers, { receivers: [0] });
  assert.equal(a.confidence, null);
  assert.deepEqual(a.evidence, [{ path: 'infra/bus.py', line: 9 }]);
  assert.equal(a.hypothesis, '');
  assert.equal(session.serialize(0).a.seconds, 0);

  assert.equal(Core.createSession(spec(), { v: 2, state: 'done' }).state, 'exploring', 'a future record starts afresh');
  assert.equal(Core.createSession(spec(), { v: 1, state: 'finished' }).state, 'exploring');
});

test('plan-first sessions lock view choices and grade them', () => {
  const planSpec = {
    mode: 'plan-first',
    min_score: 0.8,
    questions: [
      { id: 'q-a', type: 'single', question: 'Which call places the order?', options: ['place()', 'reserve()'], correct_index: 0 },
      { id: 'q-b', type: 'single', question: 'Which queue receives every event?', options: ['warehouse-etl', 'partner-gateway'], correct_index: 0 },
    ],
    plan: [
      { for: 'q-a', options: ['A sequence diagram of one checkout', 'A component diagram', 'No diagram: read checkout.py'], correct_index: 2 },
      { for: 'q-b', options: ['A class diagram', 'A component diagram of the bindings'], correct_index: 1 },
    ],
    reply: { request: 'Your requests', diagrams: [{ id: 'events', type: 'component', source: '@startuml\n@enduml' }] },
  };
  const session = Core.createSession(planSpec);
  session.resume(0);

  assert.equal(session.answer('q-a', 0), false, 'part A plans the request; it does not answer');
  assert.deepEqual(session.missing().map(item => [item.kind, item.id]), [['plan', 'q-a'], ['plan', 'q-b']]);
  session.choosePlan('q-a', 1);
  session.choosePlan('q-b', 1);
  assert.equal(session.lock(45_000), true);
  assert.equal(session.choosePlan('q-a', 2), false, 'locked view choices do not change');

  assert.deepEqual(session.snapshot().b.answers, {}, 'part B starts empty');
  const plans = session.comparison().questions.map(row => row.plan.correct);
  assert.deepEqual(plans, [false, true]);
  assert.equal(session.serialize(45_000).a.seconds, 45);
});

test('the view prediction is compared with the expert view', () => {
  const session = Core.createSession(spec({ predict_view: true }));
  assert.deepEqual(session.viewChoices(), ['class', 'component', 'sequence']);
  answerPartA(session);
  assert.deepEqual(kinds(session), ['view']);
  session.setViewPrediction('class');
  session.lock(10_000);

  assert.deepEqual(session.comparison().view, { predicted: 'class', expert: 'component', correct: false });
});

test('summarize reports first attempts and times for the results card', () => {
  const session = doneSession();
  const row = Core.summarize(session.spec, session.serialize(250_000));

  assert.deepEqual(row.a, { correct: 1, total: 2, seconds: 100, confidence: 'fairly-sure' });
  assert.deepEqual(row.b, { correct: 2, total: 2, seconds: 60 });
  assert.deepEqual(row.f, { correct: 1, total: 1, seconds: 30 });
  assert.equal(row.state, 'done');
  assert.equal(Core.summarize(session.spec, null), null);
});

test('durations read in minutes and seconds', () => {
  assert.equal(Core.formatDuration(372.4), '6 min 12 s');
  assert.equal(Core.formatDuration(40), '40 s');
  assert.equal(Core.formatDuration(59.6), '1 min 0 s');
  assert.equal(Core.formatDuration(3725), '1 h 2 min');
});

test('a reply diagram keeps its valid code links and drops malformed ones', () => {
  const links = [
    { text: 'Notifications', path: 'services/notifications/consumers.py', line: 25 },
    { text: 'no line', path: 'a.py' },
    { text: '', path: 'a.py', line: 3 },
    { text: 'zero', path: 'a.py', line: 0 },
    'not a link',
  ];
  const challenge = Core.normalizeSpec(spec({
    reply: { request: 'r', diagrams: [{ id: 'events', type: 'component', source: '@startuml\n@enduml', links }] },
  }));

  assert.deepEqual(challenge.diagrams[0].links,
    [{ text: 'Notifications', path: 'services/notifications/consumers.py', line: 25 }]);
});

test('a diagram without links has an empty list', () => {
  const challenge = Core.normalizeSpec(spec());
  assert.deepEqual(challenge.diagrams[0].links, []);
});

// ----- Diagram-first: the diagram and its questions from the start ------------

const UNGRADED_CHECK = Object.assign({}, spec().evidence_check, { graded: false });

test('a diagram-first challenge starts with the reply: nothing to attempt or lock, and the questions take answers at once', () => {
  const session = Core.createSession(spec({ mode: 'diagram-first', attempt: ATTEMPT, predict_view: true }));
  session.resume(0);

  assert.equal(session.state, 'locked');
  assert.deepEqual(session.missing(), []);
  assert.equal(session.canLock(), false);
  assert.equal(session.mainVisible(), true);
  assert.equal(session.challenge.predictView, false);
  assert.equal(session.setHypothesis('a guess'), false);
  assert.equal(session.addEvidence({ path: 'a.py', line: 1 }), false);

  assert.equal(session.answer('receivers', [0, 1, 2]), true);
  assert.equal(session.answer('source', 0), true);
  assert.deepEqual(session.checkMain(30_000).map(result => result.correct), [true, true]);
  assert.equal(session.elapsedSeconds('a', 30_000), 0, 'no time counts as time from the code');
  assert.equal(session.elapsedSeconds('b', 30_000), 30);
});

test('a diagram-first comparison has no answers from the code, and its summary no code part', () => {
  const session = Core.createSession(spec({ mode: 'diagram-first' }));
  session.resume(0);
  session.answer('receivers', [0, 1, 2]);
  session.answer('source', 1);
  session.checkMain(10_000);

  const comparison = session.comparison();
  assert.deepEqual(comparison.questions.map(row => row.partA), [null, null]);
  assert.deepEqual(comparison.questions.map(row => row.partB.correct), [true, false]);
  assert.equal(comparison.confidence, null);

  const summary = Core.summarize(spec({ mode: 'diagram-first' }), session.serialize(10_000));
  assert.equal(summary.a, null);
  assert.deepEqual(summary.b, { correct: 1, total: 2, seconds: 10 });
});

test('a record saved while a step was still code-first continues with the diagram when the step becomes diagram-first', () => {
  const exploring = Core.createSession(spec());
  exploring.resume(0);
  exploring.answer('receivers', [0]);
  const record = exploring.serialize(5_000);
  assert.equal(record.state, 'exploring');

  const session = Core.createSession(spec({ mode: 'diagram-first' }), record);
  assert.equal(session.state, 'locked');
  assert.equal(session.answer('source', 0), true);
});

test('an ungraded evidence check is asked but neither scored nor needed to move on', () => {
  const session = Core.createSession(spec({ mode: 'diagram-first', evidence_check: UNGRADED_CHECK }));
  session.resume(0);
  session.answer('receivers', [0, 1, 2]);
  session.answer('source', 0);
  session.checkMain(1_000);
  session.advance(2_000);
  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(3_000);

  assert.equal(session.evidenceVisible(), true);
  assert.equal(session.canAdvance(), true, 'the stage can be left without checking the code');
  session.answerEvidenceCheck('verified', 1);
  assert.deepEqual(session.checkEvidence(4_000).map(result => result.correct), [false]);
  session.advance(5_000);
  session.setConsolidation('The view put the bindings side by side.');
  session.answerMechanism('mechanism', 0);
  const outcome = session.finish(6_000);
  assert.equal(outcome.score, 1, 'a wrong ungraded check does not lower the score');
  assert.equal(outcome.passed, true);
});

test('a graded evidence check still counts, in any mode', () => {
  const session = Core.createSession(spec({ mode: 'diagram-first' }));
  session.resume(0);
  session.answer('receivers', [0, 1, 2]);
  session.answer('source', 0);
  session.checkMain(1_000);
  session.advance(2_000);
  session.answerFollowUp('cancelled', [1, 2]);
  session.checkFollowUp(3_000);
  assert.equal(session.canAdvance(), false, 'a graded check must be checked before moving on');
  session.answerEvidenceCheck('verified', 1);
  session.checkEvidence(4_000);
  assert.equal(session.score(), 3 / 5);
});
