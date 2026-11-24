/**
 * Rules of the design-review exercise (`design_review` steps), without DOM.
 *
 * A step shows an AI agent's design and asks the learner for a review
 * comment. The comment can be checked by the local model (see
 * js/browser-llm/design-review-judge.mjs) any number of times; the step is
 * done once the learner, having written at least `min_words` words, compares
 * the comment with the expert review. The model's ratings never decide that.
 *
 * Record (saved as `designReviews[stepKey]` in the tutorial progress):
 *   {v: 1, draft, checks: [{verdicts, ratings, anchors}], passed,
 *    revealedDraft, selfCheck: {flaw, consequence, fix}}
 *
 * Loaded in the browser as window.DesignReviewCore and in Node with require.
 */
(function (root, factory) {
  'use strict';
  var core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.DesignReviewCore = core;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RECORD_VERSION = 1;
  var DEFAULT_MIN_WORDS = 20;
  var MAX_DRAFT_CHARS = 900;
  var MAX_SAVED_CHECKS = 12;
  var CRITERIA = ['flaw', 'consequence', 'fix'];
  var VERDICTS = ['yes', 'partly', 'no'];
  var CORRECTNESS = ['correct', 'close', 'not-yet'];
  var CONVINCINGNESS = ['convincing', 'partly', 'not-yet'];

  var RATING_LABELS = {
    correctness: { correct: 'Correct', close: 'Close', 'not-yet': 'Not yet' },
    convincingness: { convincing: 'Convincing', partly: 'Partly convincing', 'not-yet': 'Not yet convincing' },
  };

  var RATING_EXPLANATIONS = {
    correctness: {
      correct: 'The assistant found the flaw and a fix that removes its cause in your comment.',
      close: 'The assistant found part of the answer: the flaw or the fix is missing or vague.',
      'not-yet': 'The assistant did not find the flaw in your comment.',
    },
    convincingness: {
      convincing: 'You trace what goes wrong in the Given scenario and point at the diagram.',
      partly: 'Your argument is there in part: trace the scenario to its effect on the story, and name the diagram element.',
      'not-yet': 'The assistant did not find an explanation of what goes wrong in the Given scenario.',
    },
  };

  var GENERIC_COACHING = {
    flaw: [
      'Trace the Given scenario through the diagram one message or element at a time. Where does the design stop meeting the story?',
      'Name the element (a message, class, or component) where it goes wrong, and say what that element does that it should not.',
      'Ask the lesson question for this kind of design: which course concept decides whether this element is right?',
    ],
    consequence: [
      'Say what the user would notice in the Given scenario, not just that the design is "bad" or "slow".',
      'Connect cause and effect: because of the flaw, what happens next, and which part of the story or acceptance criterion fails?',
      'Use the numbers or the situation in the Given scenario to show the failure concretely.',
    ],
    fix: [
      'Propose a change to the design, not only a description of the problem.',
      'Check that your fix removes the cause. A fix that only hides the symptom will fail the same scenario later.',
      'Say which element changes, and how, so the agent could apply your fix.',
    ],
  };

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /** Words in a comment: whitespace-separated runs with a letter or digit. */
  function wordCount(text) {
    return String(text == null ? '' : text).split(/\s+/).filter(function (token) {
      return /[\p{L}\p{N}]/u.test(token);
    }).length;
  }

  function minWords(spec) {
    var value = spec && Number(spec.min_words);
    return value > 0 ? Math.floor(value) : DEFAULT_MIN_WORDS;
  }

  /** The expert review opens once the comment is a real attempt. */
  function canCompare(spec, draft) {
    return wordCount(draft) >= minWords(spec);
  }

  function newRecord() {
    return {
      v: RECORD_VERSION,
      draft: '',
      checks: [],
      passed: false,
      revealedDraft: '',
      selfCheck: { flaw: false, consequence: false, fix: false },
    };
  }

  function sanitizeCheck(check) {
    if (!isObject(check) || !isObject(check.verdicts) || !isObject(check.ratings)) return null;
    var verdicts = {};
    for (var i = 0; i < CRITERIA.length; i++) {
      var verdict = check.verdicts[CRITERIA[i]];
      if (VERDICTS.indexOf(verdict) === -1) return null;
      verdicts[CRITERIA[i]] = verdict;
    }
    if (CORRECTNESS.indexOf(check.ratings.correctness) === -1) return null;
    if (CONVINCINGNESS.indexOf(check.ratings.convincingness) === -1) return null;
    return {
      verdicts: verdicts,
      ratings: { correctness: check.ratings.correctness, convincingness: check.ratings.convincingness },
      anchors: Array.isArray(check.anchors) ? check.anchors.filter(function (a) { return typeof a === 'string'; }).slice(0, 12) : [],
    };
  }

  /** A saved record, checked field by field; anything else starts afresh. */
  function sanitizeRecord(record) {
    if (!isObject(record) || record.v !== RECORD_VERSION) return newRecord();
    var clean = newRecord();
    if (typeof record.draft === 'string') clean.draft = record.draft.slice(0, MAX_DRAFT_CHARS);
    if (Array.isArray(record.checks)) {
      clean.checks = record.checks.map(sanitizeCheck).filter(Boolean).slice(-MAX_SAVED_CHECKS);
    }
    clean.passed = record.passed === true;
    if (typeof record.revealedDraft === 'string') clean.revealedDraft = record.revealedDraft.slice(0, MAX_DRAFT_CHARS);
    if (isObject(record.selfCheck)) {
      CRITERIA.forEach(function (criterion) { clean.selfCheck[criterion] = record.selfCheck[criterion] === true; });
    }
    return clean;
  }

  function isPassed(record) {
    return !!(record && record.v === RECORD_VERSION && record.passed === true);
  }

  /** Record a model check (sanitized; the history keeps the latest few). */
  function addCheck(record, result) {
    var check = sanitizeCheck(result);
    if (!check) throw new Error('A check result needs a verdict for every criterion and both ratings.');
    var next = sanitizeRecord(record);
    next.checks = next.checks.concat([check]).slice(-MAX_SAVED_CHECKS);
    return next;
  }

  /** Compare with the expert review: allowed once the comment is long enough. */
  function reveal(record, spec, draft) {
    if (!canCompare(spec, draft)) {
      throw new Error('Write at least ' + minWords(spec) + ' words before comparing with the expert review.');
    }
    var next = sanitizeRecord(record);
    next.draft = String(draft).slice(0, MAX_DRAFT_CHARS);
    next.revealedDraft = next.draft;
    next.passed = true;
    return next;
  }

  function ladderFor(spec, criterion) {
    var authored = spec && isObject(spec.coach) && Array.isArray(spec.coach[criterion]) ? spec.coach[criterion] : [];
    return authored.length ? authored : GENERIC_COACHING[criterion];
  }

  /**
   * Coaching after a check: one line for every criterion that is not YES,
   * from its ladder. `attempt` is 1 for the first check; later checks climb
   * the ladder (orient, then diagnose, then scaffold) and stay on its last
   * rung.
   */
  function coaching(spec, verdicts, attempt) {
    var rung = Math.max(0, Math.floor(Number(attempt) || 1) - 1);
    return CRITERIA.filter(function (criterion) { return verdicts[criterion] !== 'yes'; }).map(function (criterion) {
      var ladder = ladderFor(spec, criterion);
      return { criterion: criterion, text: ladder[Math.min(rung, ladder.length - 1)] };
    });
  }

  /**
   * Notes for known wrong claims, shown only while the flaw is not found:
   * the comment matches one of the claim's authored patterns.
   */
  function wrongClaimNotes(spec, review, verdicts) {
    if (verdicts && verdicts.flaw === 'yes') return [];
    var claims = spec && Array.isArray(spec.wrong_claims) ? spec.wrong_claims : [];
    var text = String(review == null ? '' : review);
    return claims.filter(function (claim) {
      return Array.isArray(claim.patterns) && claim.patterns.some(function (pattern) { return new RegExp(pattern, 'i').test(text); });
    }).map(function (claim) { return claim.note; });
  }

  function ratingLabel(axis, level) {
    return (RATING_LABELS[axis] || {})[level] || '';
  }

  function ratingExplanation(axis, level) {
    return (RATING_EXPLANATIONS[axis] || {})[level] || '';
  }

  /** 0 to 2 filled marks for a rating, for the visual meter. */
  function ratingMarks(axis, level) {
    var order = axis === 'correctness' ? CORRECTNESS : CONVINCINGNESS;
    var index = order.indexOf(level);
    return index === -1 ? 0 : order.length - 1 - index;
  }

  return {
    RECORD_VERSION: RECORD_VERSION,
    DEFAULT_MIN_WORDS: DEFAULT_MIN_WORDS,
    MAX_DRAFT_CHARS: MAX_DRAFT_CHARS,
    CRITERIA: CRITERIA,
    wordCount: wordCount,
    minWords: minWords,
    canCompare: canCompare,
    newRecord: newRecord,
    sanitizeRecord: sanitizeRecord,
    isPassed: isPassed,
    addCheck: addCheck,
    reveal: reveal,
    coaching: coaching,
    wrongClaimNotes: wrongClaimNotes,
    ratingLabel: ratingLabel,
    ratingExplanation: ratingExplanation,
    ratingMarks: ratingMarks,
  };
});
