/**
 * DiagramChallengeCore — the rules of a tutorial diagram challenge (the
 * `diagram_challenge` step block; tutorial-authoring skill §3.2).
 *
 * A session moves exploring → locked → follow-up → done:
 *   exploring  Part A. Code-first: a hypothesis, pinned evidence, and a view
 *              wish (as `attempt` requires), then the questions, a confidence
 *              level, and optionally the view to request. Plan-first: one
 *              view choice per question. lock() freezes Part A.
 *   locked     Part B. An optional contrast question comes first; then the
 *              reply's diagrams and the questions again, prefilled from
 *              Part A. Part B may be checked again; its first attempt feeds
 *              the comparison and its latest attempt the score. A question's
 *              optional `diagram` names the reply diagram that answers it.
 *   follow-up  New questions answered with the diagram, then the optional
 *              evidence check (absence in a diagram is a hypothesis).
 *              advance() leaves a stage once each of its groups has been
 *              checked with at least one answer right.
 *   done       Comparison and debrief. finish() passes the challenge when
 *              the consolidation sentence is written and score() reaches
 *              min_score. Passing is permanent; later checks are practice.
 *
 * score() counts Part B's latest attempt, the follow-up, the evidence check,
 * and the mechanism question, one item per question. Part A earns
 * completion credit by being locked in, whatever its correctness.
 *
 * Time is active time only. The caller resumes the clock while the step is
 * shown and the document visible, and pauses it otherwise. Part A's clock
 * runs until lock-in; Part B's and the follow-up's until their first check.
 *
 * Pure: no DOM, storage, or clock access (callers pass `now` in ms). Restored
 * records are untrusted input and are sanitized against the challenge.
 * Loaded as a classic script (window.DiagramChallengeCore) and by Node tests
 * (module.exports).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiagramChallengeCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var RECORD_VERSION = 1;
  var STATES = ['exploring', 'locked', 'follow-up', 'done'];
  var MODES = ['code-first', 'plan-first', 'diagram-first'];
  var CONFIDENCE_LEVELS = ['guessing', 'fairly-sure', 'sure'];
  var VIEW_CHOICES = ['class', 'component', 'sequence'];
  var DEFAULT_MIN_SCORE = 0.8;
  var MAX_TEXT_LENGTH = 2000;
  var MAX_EVIDENCE_PINS = 20;
  var TIMED_PARTS = ['a', 'b', 'f'];

  // ---------------------------------------------------------------------------
  // Values
  // ---------------------------------------------------------------------------

  function isObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim() !== '';
  }

  function boundedText(value) {
    return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : '';
  }

  /** Distinct integer indices below `limit`, ascending. */
  function indexList(values, limit) {
    var seen = {};
    return list(values).filter(function (value) {
      if (!Number.isInteger(value) || value < 0 || value >= limit || seen[value]) return false;
      seen[value] = true;
      return true;
    }).sort(function (left, right) { return left - right; });
  }

  // ---------------------------------------------------------------------------
  // Challenge (normalized YAML)
  // ---------------------------------------------------------------------------

  function normalizeQuestion(raw) {
    if (!isObject(raw) || raw.id === undefined || raw.id === null || raw.id === '') return null;
    var options = list(raw.options).map(function (option) { return String(option); });
    var multiple = raw.type === 'multiple';
    return {
      id: String(raw.id),
      type: multiple ? 'multiple' : 'single',
      question: typeof raw.question === 'string' ? raw.question : '',
      options: options,
      correct: indexList(multiple ? raw.correct_indices : [raw.correct_index], options.length),
      optional: multiple ? indexList(raw.optional_indices, options.length) : [],
      optionFeedback: isObject(raw.option_feedback) ? raw.option_feedback : {},
      explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
      diagram: hasText(raw.diagram) ? String(raw.diagram).trim() : null,
    };
  }

  /** Keep a question's `diagram` only when the reply has that diagram. */
  function linkDiagrams(questions, diagrams) {
    var ids = diagrams.map(function (diagram) { return diagram.id; });
    questions.forEach(function (question) {
      if (question.diagram && ids.indexOf(question.diagram) === -1) question.diagram = null;
    });
    return questions;
  }

  function normalizeDiagram(raw, index) {
    if (!isObject(raw) || typeof raw.source !== 'string') return null;
    return {
      id: raw.id ? String(raw.id) : 'diagram-' + (index + 1),
      type: String(raw.type || 'class').trim().toLowerCase(),
      label: typeof raw.label === 'string' ? raw.label : '',
      source: raw.source,
      links: list(raw.links).map(normalizeLink).filter(Boolean),
    };
  }

  /** A code link `{text, path, line}`: double-clicking the label `text` opens path:line. */
  function normalizeLink(raw) {
    if (!isObject(raw) || !hasText(raw.text) || !hasText(raw.path)) return null;
    var line = Math.floor(Number(raw.line));
    if (!isFinite(line) || line < 1) return null;
    return { text: String(raw.text).trim(), path: String(raw.path).trim(), line: line };
  }

  /** `ref: path/to/file.py:31` → {path, line}; a ref without a line opens line 1. */
  function parseEvidence(raw) {
    if (!isObject(raw) || typeof raw.ref !== 'string' || !raw.ref.trim()) return null;
    var ref = raw.ref.trim();
    var match = /^(.*?):(\d+)$/.exec(ref);
    return {
      text: typeof raw.text === 'string' ? raw.text : '',
      ref: ref,
      path: match ? match[1] : ref,
      line: match ? Math.max(1, Number(match[2])) : 1,
    };
  }

  /** Plan entries are single-choice questions keyed by the question they plan. */
  function normalizePlan(rawPlan, questions) {
    return list(rawPlan).map(function (entry, index) {
      if (!isObject(entry)) return null;
      var planned = entry.for !== undefined ? String(entry.for) : questions[index] && questions[index].id;
      if (!planned) return null;
      return normalizeQuestion(Object.assign({}, entry, { id: planned, type: 'single' }));
    }).filter(Boolean);
  }

  function normalizeSpec(raw) {
    raw = isObject(raw) ? raw : {};
    var mode = MODES.indexOf(raw.mode) !== -1 ? raw.mode : 'code-first';
    // A diagram-first step has no attempt from the code, so nothing to require.
    var attempt = mode !== 'diagram-first' && isObject(raw.attempt) ? raw.attempt : {};
    var reply = isObject(raw.reply) ? raw.reply : {};
    var contrast = isObject(reply.contrast) ? reply.contrast : null;
    var evidenceCheck = isObject(raw.evidence_check) ? raw.evidence_check : {};
    var debrief = isObject(raw.debrief) ? raw.debrief : {};
    var diagrams = list(reply.diagrams).map(normalizeDiagram).filter(Boolean);
    var questions = linkDiagrams(list(raw.questions).map(normalizeQuestion).filter(Boolean), diagrams);
    var minScore = Number(raw.min_score);
    var budget = Number(raw.budget_minutes);
    var pins = Math.floor(Number(attempt.evidence_pins));
    return {
      mode: mode,
      budgetMinutes: isFinite(budget) && budget > 0 ? budget : null,
      minScore: raw.min_score !== undefined && isFinite(minScore) && minScore >= 0 && minScore <= 1
        ? minScore : DEFAULT_MIN_SCORE,
      predictView: mode === 'code-first' && raw.predict_view === true,
      attempt: {
        hypothesis: attempt.hypothesis === true,
        evidencePins: isFinite(pins) && pins > 0 ? Math.min(pins, MAX_EVIDENCE_PINS) : 0,
        viewWish: attempt.view_wish === true,
      },
      questions: questions,
      plan: mode === 'plan-first' ? normalizePlan(raw.plan, questions) : [],
      diagrams: diagrams,
      expertView: diagrams.length ? diagrams[0].type : null,
      contrast: contrast ? {
        diagram: normalizeDiagram(contrast.diagram, 0),
        question: normalizeQuestion(contrast.question),
      } : null,
      evidence: list(reply.evidence).map(parseEvidence).filter(Boolean),
      followUp: list(raw.follow_up).map(normalizeQuestion).filter(Boolean),
      evidenceQuestions: [evidenceCheck.claim_question, evidenceCheck.question].map(normalizeQuestion).filter(Boolean),
      // `graded: false` keeps the check as practice: asked, never scored.
      evidenceGraded: evidenceCheck.graded !== false,
      mechanism: normalizeQuestion(debrief.mechanism_question),
      consolidation: hasText(debrief.consolidation_prompt),
    };
  }

  function findQuestion(questions, id) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === String(id)) return questions[i];
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Answers and grading
  // ---------------------------------------------------------------------------

  function selectionOf(question, value) {
    if (question.type === 'multiple') return indexList(value, question.options.length);
    return Number.isInteger(value) && value >= 0 && value < question.options.length ? [value] : [];
  }

  function isAnswered(question, value) {
    return selectionOf(question, value).length > 0;
  }

  /** Store `value` as the answer to `question`; an empty choice clears it. */
  function setAnswer(answers, question, value) {
    var selection = selectionOf(question, value);
    var clearing = value === null || value === undefined || (Array.isArray(value) && value.length === 0);
    if (!selection.length && !clearing) return false;
    if (!selection.length) delete answers[question.id];
    else answers[question.id] = question.type === 'multiple' ? selection : selection[0];
    return true;
  }

  function sanitizeAnswers(questions, raw) {
    var answers = {};
    if (!isObject(raw)) return answers;
    questions.forEach(function (question) {
      if (Object.prototype.hasOwnProperty.call(raw, question.id)) setAnswer(answers, question, raw[question.id]);
    });
    return answers;
  }

  /**
   * @returns {{id: string, correct: boolean, found: number[], missed: number[], extra: number[]}}
   *   found: selected keys; missed: unselected keys; extra: selected non-keys
   *   (optional indices are neither missed nor extra).
   */
  function gradeQuestion(question, value) {
    var selected = selectionOf(question, value);
    var keys = question.correct;
    var found = selected.filter(function (index) { return keys.indexOf(index) !== -1; });
    var missed = keys.filter(function (index) { return selected.indexOf(index) === -1; });
    var extra = selected.filter(function (index) {
      return keys.indexOf(index) === -1 && question.optional.indexOf(index) === -1;
    });
    return {
      id: question.id,
      correct: selected.length > 0 && missed.length === 0 && extra.length === 0,
      found: found,
      missed: missed,
      extra: extra,
    };
  }

  function gradeAll(questions, answers) {
    return answers ? questions.map(function (question) { return gradeQuestion(question, answers[question.id]); }) : null;
  }

  function countCorrect(questions, answers) {
    return (gradeAll(questions, answers) || []).filter(function (result) { return result.correct; }).length;
  }

  // ---------------------------------------------------------------------------
  // Active-time clock
  // ---------------------------------------------------------------------------

  /** Accumulates time between resume() and pause(); `now` is in milliseconds. */
  function ActiveTimer(totalMs) {
    this._totalMs = Math.max(0, Number(totalMs) || 0);
    this._since = null;
  }

  ActiveTimer.prototype.resume = function (now) {
    if (this._since === null) this._since = now;
  };

  ActiveTimer.prototype.pause = function (now) {
    if (this._since === null) return;
    this._totalMs += Math.max(0, now - this._since);
    this._since = null;
  };

  /** Time so far; a running timer counts up to `now` when it is given. */
  ActiveTimer.prototype.elapsedMs = function (now) {
    var running = this._since !== null && typeof now === 'number' ? Math.max(0, now - this._since) : 0;
    return this._totalMs + running;
  };

  Object.defineProperty(ActiveTimer.prototype, 'running', {
    get: function () { return this._since !== null; },
  });

  function tenths(ms) {
    return Math.round(ms / 100) / 10;
  }

  // ---------------------------------------------------------------------------
  // Session state and records
  // ---------------------------------------------------------------------------

  /** A diagram-first challenge starts where the others are after lock-in. */
  function firstState(challenge) {
    return challenge.mode === 'diagram-first' ? 'locked' : 'exploring';
  }

  function emptyState(challenge) {
    return {
      state: firstState(challenge),
      passed: false,
      hideTimes: false,
      a: { answers: {}, confidence: null, view: null, plan: {}, hypothesis: '', evidence: [], viewWish: '' },
      c: { answers: {}, checked: null },
      b: { answers: {}, checked: null, first: null, attempts: 0 },
      f: { answers: {}, checked: null, first: null, attempts: 0 },
      e: { answers: {}, checked: null, attempts: 0 },
      d: { consolidation: '', answers: {}, checked: null, attempts: 0 },
    };
  }

  function validPin(pin) {
    return isObject(pin) && typeof pin.path === 'string' && pin.path.trim() !== '' &&
      Number.isInteger(pin.line) && pin.line > 0;
  }

  function samePin(left, right) {
    return left.path === right.path && left.line === right.line;
  }

  function sanitizePins(raw) {
    var pins = [];
    list(raw).forEach(function (pin) {
      if (!validPin(pin) || pins.length >= MAX_EVIDENCE_PINS) return;
      var clean = { path: pin.path, line: pin.line };
      if (!pins.some(function (existing) { return samePin(existing, clean); })) pins.push(clean);
    });
    return pins;
  }

  function attemptsOf(value) {
    return Number.isInteger(value) && value > 0 ? value : 0;
  }

  function secondsOf(value) {
    var seconds = Number(value);
    return isFinite(seconds) && seconds > 0 ? seconds : 0;
  }

  function restoreGraded(questions, raw, timed) {
    raw = isObject(raw) ? raw : {};
    var group = {
      answers: sanitizeAnswers(questions, raw.answers),
      checked: isObject(raw.checked) ? sanitizeAnswers(questions, raw.checked) : null,
      attempts: attemptsOf(raw.attempts),
    };
    if (timed) group.first = isObject(raw.first) ? sanitizeAnswers(questions, raw.first) : null;
    return group;
  }

  /** Validate a stored record; anything unusable starts a fresh attempt. */
  function restore(challenge, viewChoices, record) {
    var state = emptyState(challenge);
    var seconds = { a: 0, b: 0, f: 0 };
    if (!isObject(record) || record.v !== RECORD_VERSION || STATES.indexOf(record.state) === -1) {
      return { state: state, seconds: seconds };
    }
    var a = isObject(record.a) ? record.a : {};
    var c = isObject(record.c) ? record.c : {};
    var d = isObject(record.d) ? record.d : {};
    var contrastQuestions = challenge.contrast && challenge.contrast.question ? [challenge.contrast.question] : [];
    var mechanism = challenge.mechanism ? [challenge.mechanism] : [];
    // A record from before a step became diagram-first may still be exploring.
    state.state = record.state === 'exploring' ? firstState(challenge) : record.state;
    state.passed = record.passed === true;
    state.hideTimes = record.hideTimes === true;
    state.a = {
      answers: sanitizeAnswers(challenge.questions, a.answers),
      confidence: CONFIDENCE_LEVELS.indexOf(a.confidence) !== -1 ? a.confidence : null,
      view: viewChoices.indexOf(a.view) !== -1 ? a.view : null,
      plan: sanitizeAnswers(challenge.plan, a.plan),
      hypothesis: boundedText(a.hypothesis),
      evidence: sanitizePins(a.evidence),
      viewWish: boundedText(a.viewWish),
    };
    state.c = {
      answers: sanitizeAnswers(contrastQuestions, c.answers),
      checked: isObject(c.checked) ? sanitizeAnswers(contrastQuestions, c.checked) : null,
    };
    state.b = restoreGraded(challenge.questions, record.b, true);
    state.f = restoreGraded(challenge.followUp, record.f, true);
    state.e = restoreGraded(challenge.evidenceQuestions, record.e, false);
    state.d = Object.assign({ consolidation: boundedText(d.consolidation) }, restoreGraded(mechanism, d, false));
    seconds.a = secondsOf(a.seconds);
    seconds.b = secondsOf(isObject(record.b) && record.b.seconds);
    seconds.f = secondsOf(isObject(record.f) && record.f.seconds);
    return { state: state, seconds: seconds };
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  /**
   * @param {object} rawSpec  the step's `diagram_challenge` block
   * @param {object} [record] a record from serialize(), possibly from storage
   */
  function Session(rawSpec, record) {
    this.spec = rawSpec;
    this.challenge = normalizeSpec(rawSpec);
    var choices = VIEW_CHOICES.slice();
    if (this.challenge.expertView && choices.indexOf(this.challenge.expertView) === -1) {
      choices.push(this.challenge.expertView);
    }
    this._viewChoices = choices;
    var restored = restore(this.challenge, choices, record);
    this._s = restored.state;
    this._timers = {
      a: new ActiveTimer(restored.seconds.a * 1000),
      b: new ActiveTimer(restored.seconds.b * 1000),
      f: new ActiveTimer(restored.seconds.f * 1000),
    };
    this._clockOn = false;
  }

  Object.defineProperty(Session.prototype, 'state', { get: function () { return this._s.state; } });
  Object.defineProperty(Session.prototype, 'passed', { get: function () { return this._s.passed; } });

  /** A deep copy of the answers and progress (no times). */
  Session.prototype.snapshot = function () {
    return clone(this._s);
  };

  Session.prototype.viewChoices = function () {
    return this._viewChoices.slice();
  };

  // ----- Part A ---------------------------------------------------------------

  Session.prototype._exploring = function () {
    return this._s.state === 'exploring';
  };

  /** Answer choices appear once a required hypothesis is written. */
  Session.prototype.optionsVisible = function () {
    var a = this._s.a;
    return !this.challenge.attempt.hypothesis || hasText(a.hypothesis) || !this._exploring() ||
      Object.keys(a.answers).length > 0 || Object.keys(a.plan).length > 0 || !!a.confidence || !!a.view;
  };

  /** What Part A still needs before lock-in: [{kind, id?, needed?}]. */
  Session.prototype.missing = function () {
    var challenge = this.challenge;
    var a = this._s.a;
    var items = [];
    if (!this._exploring()) return items;
    if (challenge.attempt.hypothesis && !hasText(a.hypothesis)) items.push({ kind: 'hypothesis' });
    if (a.evidence.length < challenge.attempt.evidencePins) {
      items.push({ kind: 'evidence', needed: challenge.attempt.evidencePins - a.evidence.length });
    }
    if (challenge.attempt.viewWish && !hasText(a.viewWish)) items.push({ kind: 'view-wish' });
    if (challenge.mode === 'plan-first') {
      challenge.plan.forEach(function (entry) {
        if (!isAnswered(entry, a.plan[entry.id])) items.push({ kind: 'plan', id: entry.id });
      });
      return items;
    }
    challenge.questions.forEach(function (question) {
      if (!isAnswered(question, a.answers[question.id])) items.push({ kind: 'question', id: question.id });
    });
    if (!a.confidence) items.push({ kind: 'confidence' });
    if (challenge.predictView && !a.view) items.push({ kind: 'view' });
    return items;
  };

  Session.prototype.canLock = function () {
    return this._exploring() && this.missing().length === 0;
  };

  Session.prototype.setHypothesis = function (text) {
    if (!this._exploring()) return false;
    this._s.a.hypothesis = boundedText(String(text));
    return true;
  };

  Session.prototype.setViewWish = function (text) {
    if (!this._exploring()) return false;
    this._s.a.viewWish = boundedText(String(text));
    return true;
  };

  /** Pin an editor location ({path, line}); each line is pinned once. */
  Session.prototype.addEvidence = function (pin) {
    var pins = this._s.a.evidence;
    if (!this._exploring() || !validPin(pin) || pins.length >= MAX_EVIDENCE_PINS) return false;
    var clean = { path: pin.path, line: pin.line };
    if (pins.some(function (existing) { return samePin(existing, clean); })) return false;
    pins.push(clean);
    return true;
  };

  Session.prototype.removeEvidence = function (index) {
    var pins = this._s.a.evidence;
    if (!this._exploring() || !Number.isInteger(index) || index < 0 || index >= pins.length) return false;
    pins.splice(index, 1);
    return true;
  };

  Session.prototype.setConfidence = function (level) {
    if (!this._exploring() || this.challenge.mode !== 'code-first' || CONFIDENCE_LEVELS.indexOf(level) === -1) return false;
    if (!this.optionsVisible()) return false;
    this._s.a.confidence = level;
    return true;
  };

  Session.prototype.setViewPrediction = function (view) {
    if (!this._exploring() || !this.challenge.predictView || this._viewChoices.indexOf(view) === -1) return false;
    if (!this.optionsVisible()) return false;
    this._s.a.view = view;
    return true;
  };

  /** Plan-first Part A: the view to request for `questionId`. */
  Session.prototype.choosePlan = function (questionId, optionIndex) {
    var entry = findQuestion(this.challenge.plan, questionId);
    if (!entry || !this._exploring() || !this.optionsVisible()) return false;
    return setAnswer(this._s.a.plan, entry, optionIndex);
  };

  /**
   * Answer a main question: Part A before lock-in (code-first only), Part B
   * after it, once the reply's diagram is shown.
   */
  Session.prototype.answer = function (id, value) {
    var question = findQuestion(this.challenge.questions, id);
    if (!question) return false;
    if (this._exploring()) {
      if (this.challenge.mode !== 'code-first' || !this.optionsVisible()) return false;
      return setAnswer(this._s.a.answers, question, value);
    }
    if (!this.mainVisible()) return false;
    return setAnswer(this._s.b.answers, question, value);
  };

  Session.prototype.lock = function (now) {
    if (!this.canLock()) return false;
    this._s.state = 'locked';
    if (this.challenge.mode === 'code-first') this._s.b.answers = clone(this._s.a.answers);
    this._syncClock(now);
    return true;
  };

  // ----- Part B -----------------------------------------------------------------

  Session.prototype._contrastQuestion = function () {
    return this.challenge.contrast && this.challenge.contrast.question;
  };

  Session.prototype.contrastPending = function () {
    return !this._exploring() && !!this._contrastQuestion() && !this._s.c.checked;
  };

  Session.prototype.answerContrast = function (id, value) {
    var question = this._contrastQuestion();
    if (!this.contrastPending() || question.id !== String(id)) return false;
    return setAnswer(this._s.c.answers, question, value);
  };

  /** Grade the contrast question once; it reveals the main reply. */
  Session.prototype.checkContrast = function (now) {
    var question = this._contrastQuestion();
    if (!this.contrastPending() || !isAnswered(question, this._s.c.answers[question.id])) return null;
    this._s.c.checked = clone(this._s.c.answers);
    this._syncClock(now);
    return gradeQuestion(question, this._s.c.checked[question.id]);
  };

  Session.prototype.mainVisible = function () {
    return !this._exploring() && !this.contrastPending();
  };

  function everyAnswered(questions, answers) {
    return questions.length > 0 && questions.every(function (question) {
      return isAnswered(question, answers[question.id]);
    });
  }

  /** Record a graded attempt of `group`; the first one is kept separately. */
  Session.prototype._check = function (group, questions, now) {
    group.checked = clone(group.answers);
    if (group.attempts === 0 && 'first' in group) group.first = clone(group.answers);
    group.attempts += 1;
    this._syncClock(now);
    return gradeAll(questions, group.checked);
  };

  Session.prototype.canCheckMain = function () {
    return this.mainVisible() && everyAnswered(this.challenge.questions, this._s.b.answers);
  };

  /** @returns {object[]|null} one result per question, or null if not checkable yet */
  Session.prototype.checkMain = function (now) {
    if (!this.canCheckMain()) return null;
    return this._check(this._s.b, this.challenge.questions, now);
  };

  Session.prototype.answerFollowUp = function (id, value) {
    var question = findQuestion(this.challenge.followUp, id);
    var state = this._s.state;
    if (!question || (state !== 'follow-up' && state !== 'done')) return false;
    return setAnswer(this._s.f.answers, question, value);
  };

  Session.prototype.canCheckFollowUp = function () {
    var state = this._s.state;
    return (state === 'follow-up' || state === 'done') && everyAnswered(this.challenge.followUp, this._s.f.answers);
  };

  Session.prototype.checkFollowUp = function (now) {
    if (!this.canCheckFollowUp()) return null;
    return this._check(this._s.f, this.challenge.followUp, now);
  };

  /** The evidence check follows the follow-up's first check (or comes first without one). */
  Session.prototype.evidenceVisible = function () {
    var state = this._s.state;
    return this.challenge.evidenceQuestions.length > 0 && (state === 'follow-up' || state === 'done') &&
      (this.challenge.followUp.length === 0 || this._s.f.attempts > 0);
  };

  Session.prototype.answerEvidenceCheck = function (id, value) {
    var question = findQuestion(this.challenge.evidenceQuestions, id);
    if (!question || !this.evidenceVisible()) return false;
    return setAnswer(this._s.e.answers, question, value);
  };

  Session.prototype.canCheckEvidence = function () {
    return this.evidenceVisible() && everyAnswered(this.challenge.evidenceQuestions, this._s.e.answers);
  };

  Session.prototype.checkEvidence = function (now) {
    if (!this.canCheckEvidence()) return null;
    return this._check(this._s.e, this.challenge.evidenceQuestions, now);
  };

  /** The state advance() moves to, or null when there is none. */
  Session.prototype.nextState = function () {
    var state = this._s.state;
    var challenge = this.challenge;
    if (state === 'locked') {
      return challenge.followUp.length || challenge.evidenceQuestions.length ? 'follow-up' : 'done';
    }
    return state === 'follow-up' ? 'done' : null;
  };

  /**
   * A stage may be left once each of its groups has a check with at least
   * one answer right: a learner with nothing right yet looks again first.
   */
  Session.prototype.canAdvance = function () {
    var challenge = this.challenge;
    var s = this._s;
    var hasRightAnswer = function (questions, checked) { return countCorrect(questions, checked) > 0; };
    if (s.state === 'locked') return this.mainVisible() && hasRightAnswer(challenge.questions, s.b.checked);
    if (s.state === 'follow-up') {
      return (challenge.followUp.length === 0 || hasRightAnswer(challenge.followUp, s.f.checked)) &&
        (challenge.evidenceQuestions.length === 0 || !challenge.evidenceGraded ||
          hasRightAnswer(challenge.evidenceQuestions, s.e.checked));
    }
    return false;
  };

  Session.prototype.advance = function (now) {
    if (!this.canAdvance()) return false;
    this._s.state = this.nextState();
    this._syncClock(now);
    return true;
  };

  // ----- Done -------------------------------------------------------------------

  Session.prototype.setConsolidation = function (text) {
    if (this._s.state !== 'done') return false;
    this._s.d.consolidation = boundedText(String(text));
    return true;
  };

  Session.prototype.answerMechanism = function (id, value) {
    var question = this.challenge.mechanism;
    if (!question || question.id !== String(id) || this._s.state !== 'done') return false;
    return setAnswer(this._s.d.answers, question, value);
  };

  /** What finish() still needs: [{kind: 'consolidation' | 'mechanism'}]. */
  Session.prototype.finishMissing = function () {
    var items = [];
    if (this._s.state !== 'done') return [{ kind: 'state' }];
    if (this.challenge.consolidation && !hasText(this._s.d.consolidation)) items.push({ kind: 'consolidation' });
    var mechanism = this.challenge.mechanism;
    if (mechanism && !isAnswered(mechanism, this._s.d.answers[mechanism.id])) items.push({ kind: 'mechanism' });
    return items;
  };

  /**
   * Grade the mechanism question and pass the challenge when the score
   * reaches min_score. @returns {{passed: boolean, score: number, mechanism: object|null, missing: object[]}}
   */
  Session.prototype.finish = function (now) {
    var missing = this.finishMissing();
    var mechanism = null;
    if (!missing.length) {
      if (this.challenge.mechanism) mechanism = this._check(this._s.d, [this.challenge.mechanism], now)[0];
      if (this.score() >= this.challenge.minScore - 1e-9) this._s.passed = true;
    }
    return { passed: this._s.passed, score: this.score(), mechanism: mechanism, missing: missing };
  };

  /** Fraction of graded items whose latest checked answer is correct. */
  Session.prototype.score = function () {
    var challenge = this.challenge;
    var s = this._s;
    var groups = [
      [challenge.questions, s.b.checked],
      [challenge.followUp, s.f.checked],
      [challenge.evidenceGraded ? challenge.evidenceQuestions : [], s.e.checked],
      [challenge.mechanism ? [challenge.mechanism] : [], s.d.checked],
    ];
    var total = 0;
    var correct = 0;
    groups.forEach(function (group) {
      total += group[0].length;
      correct += countCorrect(group[0], group[1]);
    });
    return total ? correct / total : 1;
  };

  Session.prototype.setHideTimes = function (hidden) {
    this._s.hideTimes = hidden === true;
  };

  /** Results of the latest check of a group, or null before its first check. */
  Session.prototype.lastResults = function (group) {
    var challenge = this.challenge;
    var s = this._s;
    var contrast = this._contrastQuestion();
    switch (group) {
      case 'contrast': return contrast && s.c.checked ? gradeAll([contrast], s.c.checked) : null;
      case 'main': return gradeAll(challenge.questions, s.b.checked);
      case 'follow-up': return gradeAll(challenge.followUp, s.f.checked);
      case 'evidence': return gradeAll(challenge.evidenceQuestions, s.e.checked);
      case 'mechanism': return challenge.mechanism ? gradeAll([challenge.mechanism], s.d.checked) : null;
      default: return null;
    }
  };

  /**
   * Part A versus Part B's first attempt versus the key, per question, plus
   * the follow-up's first attempt, the view prediction, and the confidence.
   */
  Session.prototype.comparison = function () {
    var challenge = this.challenge;
    var s = this._s;
    var lockedIn = !this._exploring();
    return {
      questions: challenge.questions.map(function (question) {
        var planned = findQuestion(challenge.plan, question.id);
        return {
          id: question.id,
          partA: challenge.mode === 'code-first' && lockedIn ? gradeQuestion(question, s.a.answers[question.id]) : null,
          partB: s.b.first ? gradeQuestion(question, s.b.first[question.id]) : null,
          plan: planned && lockedIn ? gradeQuestion(planned, s.a.plan[question.id]) : null,
        };
      }),
      followUp: challenge.followUp.map(function (question) {
        return { id: question.id, first: s.f.first ? gradeQuestion(question, s.f.first[question.id]) : null };
      }),
      view: challenge.predictView
        ? { predicted: s.a.view, expert: challenge.expertView, correct: !!s.a.view && s.a.view === challenge.expertView }
        : null,
      confidence: s.a.confidence,
    };
  };

  // ----- Clock and records --------------------------------------------------------

  /** The timed part that counts now, if the clock is on. */
  Session.prototype._runningPart = function () {
    var s = this._s;
    if (s.state === 'exploring') return 'a';
    if (s.state === 'locked' && this.mainVisible() && s.b.attempts === 0) return 'b';
    if (s.state === 'follow-up' && this.challenge.followUp.length && s.f.attempts === 0) return 'f';
    return null;
  };

  Session.prototype._syncClock = function (now) {
    var active = this._clockOn ? this._runningPart() : null;
    var timers = this._timers;
    TIMED_PARTS.forEach(function (part) {
      if (part === active) timers[part].resume(now);
      else timers[part].pause(now);
    });
  };

  /** The step is shown and the document visible: time counts. */
  Session.prototype.resume = function (now) {
    this._clockOn = true;
    this._syncClock(now);
  };

  Session.prototype.pause = function (now) {
    this._clockOn = false;
    this._syncClock(now);
  };

  /** Whether a part's clock is counting right now. */
  Session.prototype.timing = function () {
    return this._clockOn && this._runningPart() !== null;
  };

  /** @param {'a'|'b'|'f'} part */
  Session.prototype.elapsedSeconds = function (part, now) {
    return tenths(this._timers[part].elapsedMs(now));
  };

  /** The persistence record (§9.1 Persistence), with times up to `now`. */
  Session.prototype.serialize = function (now) {
    var s = clone(this._s);
    var challenge = this.challenge;
    var record = { v: RECORD_VERSION, state: s.state };
    if (s.passed) record.passed = true;
    if (s.hideTimes) record.hideTimes = true;
    record.a = Object.assign(s.a, { seconds: this.elapsedSeconds('a', now) });
    record.b = Object.assign(s.b, {
      seconds: this.elapsedSeconds('b', now),
      score: s.b.checked ? countCorrect(challenge.questions, s.b.checked) / Math.max(1, challenge.questions.length) : null,
    });
    record.f = Object.assign(s.f, {
      seconds: this.elapsedSeconds('f', now),
      score: s.f.checked ? countCorrect(challenge.followUp, s.f.checked) / Math.max(1, challenge.followUp.length) : null,
    });
    if (this._contrastQuestion()) record.c = s.c;
    if (challenge.evidenceQuestions.length) record.e = s.e;
    record.d = s.d;
    return record;
  };

  function createSession(rawSpec, record) {
    return new Session(rawSpec, record);
  }

  /** Whether a stored record shows a passed challenge. */
  function isPassed(record) {
    return isObject(record) && record.v === RECORD_VERSION && record.passed === true;
  }

  /**
   * One results-card row: correctness and times of Part A (null for a
   * diagram-first challenge, which has none), Part B's first attempt, and
   * the follow-up's first attempt (null when not reached).
   */
  function summarize(rawSpec, record) {
    if (!isObject(record) || record.v !== RECORD_VERSION) return null;
    var session = createSession(rawSpec, record);
    var challenge = session.challenge;
    var s = session._s;
    var lockedIn = s.state !== 'exploring';
    var planFirst = challenge.mode === 'plan-first';
    return {
      state: s.state,
      passed: s.passed,
      a: challenge.mode === 'diagram-first' ? null : {
        correct: !lockedIn ? null : planFirst ? countCorrect(challenge.plan, s.a.plan) : countCorrect(challenge.questions, s.a.answers),
        total: planFirst ? challenge.plan.length : challenge.questions.length,
        seconds: session.elapsedSeconds('a'),
        confidence: s.a.confidence,
      },
      b: s.b.first
        ? { correct: countCorrect(challenge.questions, s.b.first), total: challenge.questions.length, seconds: session.elapsedSeconds('b') }
        : null,
      f: challenge.followUp.length && s.f.first
        ? { correct: countCorrect(challenge.followUp, s.f.first), total: challenge.followUp.length, seconds: session.elapsedSeconds('f') }
        : null,
    };
  }

  /** 372.4 → "6 min 12 s"; whole seconds, hours without seconds. */
  function formatDuration(seconds) {
    var total = Math.max(0, Math.round(Number(seconds) || 0));
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    if (hours) return hours + ' h ' + minutes + ' min';
    if (minutes) return minutes + ' min ' + (total % 60) + ' s';
    return total + ' s';
  }

  return {
    RECORD_VERSION: RECORD_VERSION,
    CONFIDENCE_LEVELS: CONFIDENCE_LEVELS.slice(),
    createSession: createSession,
    normalizeSpec: normalizeSpec,
    gradeQuestion: gradeQuestion,
    isPassed: isPassed,
    summarize: summarize,
    formatDuration: formatDuration,
    ActiveTimer: ActiveTimer,
  };
});
