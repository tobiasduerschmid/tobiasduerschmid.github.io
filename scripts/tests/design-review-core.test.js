const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../../js/tutorial-design-review-core.js');

const words = n => Array.from({ length: n }, (_, i) => 'w' + i).join(' ');
const spec = {
  min_words: 12,
  coach: {
    flaw: ['orient the flaw', 'diagnose the flaw', 'scaffold the flaw'],
    consequence: ['orient the consequence'],
  },
  wrong_claims: [
    { patterns: ['single point of failure', 'bottleneck'], note: 'The server is not the cause here.' },
    { patterns: ['too (small|frequent)'], note: 'Chunk size is not the cause.' },
  ],
};
const check = (flaw, consequence, fix, correctness = 'close', convincingness = 'partly') =>
  ({ verdicts: { flaw, consequence, fix }, ratings: { correctness, convincingness }, anchors: ['POST /audio'] });

test('words are counted by whitespace-separated runs', () => {
  assert.equal(Core.wordCount(''), 0);
  assert.equal(Core.wordCount('   \n '), 0);
  assert.equal(Core.wordCount('Flaw: TCP POST /audio — retransmits.'), 5);
});

test('the expert review opens exactly at the minimum word count', () => {
  assert.equal(Core.canCompare(spec, words(11)), false);
  assert.equal(Core.canCompare(spec, words(12)), true);
  assert.equal(Core.canCompare({}, words(Core.DEFAULT_MIN_WORDS - 1)), false);
  assert.equal(Core.canCompare({}, words(Core.DEFAULT_MIN_WORDS)), true);
});

test('words prefilled by a scaffold do not count toward the minimum, kept or deleted', () => {
  const scaffolded = { min_words: 4, scaffold: 'Flaw: the interface leaks Stripe types.' };
  assert.equal(Core.ownWordCount(scaffolded, scaffolded.scaffold), 0);
  assert.equal(Core.canCompare(scaffolded, scaffolded.scaffold + ' PayPal needs new types'), true);
  assert.equal(Core.canCompare(scaffolded, scaffolded.scaffold + ' PayPal needs types'), false);
  assert.equal(Core.ownWordCount(scaffolded, 'Every caller changes for PayPal'), 5, 'a rewritten comment counts in full');
});

test('comparing too early is refused; comparing in time passes the step and keeps the compared comment', () => {
  assert.throws(() => Core.reveal(Core.newRecord(), spec, words(5)), /at least 12 words/);
  const record = Core.reveal(Core.newRecord(), spec, words(12));
  assert.equal(Core.isPassed(record), true);
  assert.equal(record.revealedDraft, words(12));
  assert.equal(Core.isPassed(Core.newRecord()), false);
});

test('a saved record survives sanitizing, and anything malformed is dropped', () => {
  const saved = {
    v: 1, draft: 'my comment', passed: true, revealedDraft: 'my comment',
    checks: [check('yes', 'partly', 'no'), { verdicts: { flaw: 'maybe' }, ratings: {} }, 'junk'],
    selfCheck: { flaw: true, consequence: 'yes', fix: false },
  };
  const clean = Core.sanitizeRecord(saved);
  assert.equal(clean.draft, 'my comment');
  assert.equal(clean.passed, true);
  assert.equal(clean.checks.length, 1);
  assert.deepEqual(clean.selfCheck, { flaw: true, consequence: false, fix: false });
  assert.equal(Core.sanitizeRecord({ ...saved, v: 2 }).passed, false, 'another version starts afresh');
  assert.equal(Core.sanitizeRecord({ ...saved, passed: 'true' }).passed, false);
  assert.equal(Core.sanitizeRecord({ v: 1, draft: 'x'.repeat(5000) }).draft.length, Core.MAX_DRAFT_CHARS);
});

test('checks accumulate and only the latest twelve are kept', () => {
  let record = Core.newRecord();
  for (let i = 0; i < 14; i++) record = Core.addCheck(record, check(i === 13 ? 'yes' : 'no', 'no', 'no'));
  assert.equal(record.checks.length, 12);
  assert.equal(record.checks.at(-1).verdicts.flaw, 'yes');
  assert.throws(() => Core.addCheck(record, { verdicts: { flaw: 'yes' }, ratings: {} }), /every criterion/);
});

test('coaching covers each criterion that is not YES and climbs its ladder with each attempt', () => {
  const verdicts = { flaw: 'partly', consequence: 'no', fix: 'yes' };
  assert.deepEqual(Core.coaching(spec, verdicts, 1).map(line => line.text), ['orient the flaw', 'orient the consequence']);
  assert.equal(Core.coaching(spec, verdicts, 2)[0].text, 'diagnose the flaw');
  assert.equal(Core.coaching(spec, verdicts, 9)[0].text, 'scaffold the flaw', 'the last rung repeats');
  assert.equal(Core.coaching(spec, verdicts, 2)[1].text, 'orient the consequence', 'a one-rung ladder stays put');
  const fix = Core.coaching(spec, { flaw: 'yes', consequence: 'yes', fix: 'no' }, 1);
  assert.equal(fix.length, 1);
  assert.equal(fix[0].criterion, 'fix');
  assert.ok(fix[0].text.length > 20, 'criteria without an authored ladder use the generic one');
  assert.deepEqual(Core.coaching(spec, { flaw: 'yes', consequence: 'yes', fix: 'yes' }, 1), []);
});

test('notes for known wrong claims appear only while the flaw is not found', () => {
  const review = 'The relay is a single point of failure and a bottleneck.';
  assert.deepEqual(Core.wrongClaimNotes(spec, review, { flaw: 'no' }), ['The server is not the cause here.']);
  assert.deepEqual(Core.wrongClaimNotes(spec, review, { flaw: 'yes' }), []);
  assert.deepEqual(Core.wrongClaimNotes(spec, 'TCP retransmits lost packets.', { flaw: 'partly' }), []);
});

test('rating labels and marks follow the rating order', () => {
  assert.equal(Core.ratingLabel('correctness', 'close'), 'Close');
  assert.equal(Core.ratingLabel('convincingness', 'not-yet'), 'Not yet convincing');
  assert.equal(Core.ratingMarks('correctness', 'correct'), 2);
  assert.equal(Core.ratingMarks('correctness', 'close'), 1);
  assert.equal(Core.ratingMarks('convincingness', 'not-yet'), 0);
  assert.match(Core.ratingExplanation('convincingness', 'partly'), /scenario/);
});
