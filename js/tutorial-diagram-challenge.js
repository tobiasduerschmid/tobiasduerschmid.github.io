/**
 * DiagramChallenge — the diagram challenge widget of a tutorial step.
 *
 *   DiagramChallenge.initFrom(root, options) -> Promise
 *     Mounts every challenge host ([data-diagram-challenge]) inside root.
 *     options.runtime        TutorialCode (diagram pane, revealSource,
 *                            currentEditorLocation, addEditorLineAction,
 *                            setEditorLineMarks, projectLineText); optional
 *     options.records        {"key:<step key>": record} saved challenge records
 *     options.onRecord(key, record)  called whenever the record changes
 *     options.instructorMode the student flow, never locked and never
 *                            saved; showAnswerKeysWithin switches to the
 *                            answer keys with every panel
 *     options.readOnly       the questions only, with a pointer to the main
 *                            window (instructions popout); options.onReturn
 *                            adds a button that returns there
 *     options.now()          clock in ms (default Date.now)
 *   DiagramChallenge.showAnswerKeysWithin(root) -> number
 *     Instructor mode: shows the answer keys of the challenges inside root
 *     (the toolbar's Solution button); returns how many it revealed.
 *   DiagramChallenge.destroyWithin(root)
 *     Pauses timers, emits the final record, hides the diagram pane.
 *   DiagramChallenge.renderResults(root, {records})
 *     Fills results-card hosts ([data-diagram-challenge-results-host]) from
 *     saved records; the print view uses it.
 *
 * Finished parts fold away: after lock-in, Part A becomes a closed
 * <details> with a one-line summary of what was locked, and the reply's
 * evidence list and files read are closed too. Once the step is ready
 * (tvm:stepchange), a challenge past lock-in shows its diagram again and
 * scrolls to its live part.
 *
 * The host is server-rendered by _includes/tutorial-diagram-challenge.html:
 * the step's challenge as JSON and every Markdown field rendered into inert
 * <template data-diagram-challenge-md="…"> elements. The rules (states,
 * grading, timing, records) live in DiagramChallengeCore; this module owns
 * the DOM, focus, announcements, and the calls into the tutorial runtime.
 */
(function () {
  'use strict';

  var Core = window.DiagramChallengeCore;
  var HOST_SELECTOR = '[data-diagram-challenge]';
  var RESULTS_SELECTOR = '[data-diagram-challenge-results-host]';
  var C = 'tutorial-diagram-challenge__';
  var TEXT_SAVE_DELAY_MS = 400;
  var widgets = new WeakMap();
  var sequence = 0;

  var CONFIDENCE_LABELS = { guessing: 'Guessing', 'fairly-sure': 'Fairly sure', sure: 'Sure' };
  var VIEW_LABELS = {
    class: 'Class diagram',
    component: 'Component diagram',
    sequence: 'Sequence diagram',
    state: 'State machine diagram',
    activity: 'Activity diagram',
    deployment: 'Deployment diagram',
    usecase: 'Use case diagram',
  };

  function plural(count, one, many) {
    return count + ' ' + (count === 1 ? one : many);
  }

  function percent(fraction) {
    return Math.round(fraction * 100) + '%';
  }

  var COPY = {
    partA: 'Answer from the code',
    plan: 'Plan your requests',
    hypothesisLabel: 'Your hypothesis, in one sentence',
    hypothesisHint: 'Write it before you see the answer choices.',
    pinsLabel: function (count, needed) {
      return 'Evidence you pinned (' + (count <= needed ? count + ' of ' + needed : count + '; ' + needed + ' needed') + ')';
    },
    pinsHint: function (count) {
      return 'Put the cursor on a line in the editor, then choose Pin this line, right-click the line, or press ' +
        'Ctrl+Alt+P (Cmd+Option+P on a Mac). Pin at least ' + plural(count, 'line', 'lines') + '.';
    },
    pinLineAction: 'Pin line as evidence',
    pinsEmpty: 'No lines pinned yet.',
    pinButton: 'Pin this line',
    pinNoLocation: 'Open a file and put the cursor on the line you want to pin.',
    pinDuplicate: 'That line is already pinned.',
    pinned: function (ref) { return 'Pinned ' + ref + '.'; },
    unpinned: function (ref) { return 'Removed ' + ref + '.'; },
    removePin: 'Remove',
    wishLabel: 'What would you want a diagram of this code to show?',
    wishHint: 'One sentence.',
    choicesHint: 'The answer choices appear after you write your hypothesis.',
    choicesShown: 'The answer choices are now shown below your hypothesis.',
    question: function (number) { return 'Question ' + number; },
    multipleHint: 'Select all that apply.',
    confidenceLegend: 'How sure are you of these answers?',
    viewLegend: 'Which view would you ask the agent for?',
    planHint: 'Which view would you ask the agent for to answer it?',
    todoPrefix: 'Still to do: ',
    todo: {
      hypothesis: function () { return 'write your hypothesis'; },
      evidence: function (item) { return 'pin ' + plural(item.needed, 'more line', 'more lines'); },
      'view-wish': function () { return 'say what a diagram should show'; },
      question: function (item, number) { return 'answer question ' + number; },
      confidence: function () { return 'choose how sure you are'; },
      view: function () { return 'choose the view you would ask for'; },
      plan: function (item, number) { return 'choose a view for question ' + number; },
    },
    ready: 'Everything is answered. Lock in when you are ready.',
    lock: 'Lock in my answer',
    lockPlan: 'Lock in my plan',
    lockTitle: 'Lock in your answer?',
    lockMessage: 'You will see the agent’s diagram next, and this answer cannot change afterwards.',
    lockConfirm: 'Lock in',
    lockedIn: 'Locked in. The agent’s reply is below; its diagram is open in the workspace.',
    lockedAnswer: function (parts) { return 'Your locked answer: ' + parts.join(', '); },
    lockedPlan: function (count) { return 'Your locked plan: ' + plural(count, 'view chosen', 'views chosen'); },
    pinnedCount: function (count) { return plural(count, 'line pinned', 'lines pinned'); },
    budget: function (minutes) {
      return 'You have worked on this for about ' + plural(minutes, 'minute', 'minutes') +
        '. When you are ready, lock in your best answer; the diagram comes next. There is no time limit.';
    },
    paneUnavailable: 'Lock in your answer to see the agent’s diagram.',
    reply: 'The agent’s reply',
    firstReply: 'First reply',
    secondReply: 'Second reply',
    youAsked: 'You asked:',
    summary: 'Summary:',
    leftOut: 'Left out:',
    showDiagram: 'Show the diagram',
    showDiagrams: 'Show the diagrams',
    showThisDiagram: 'Show this diagram',
    evidence: function (count) { return 'Evidence (' + count + ')'; },
    evidenceHint: 'Each note opens the file at its line.',
    filesRead: function (count) { return 'Files read (' + count + ')'; },
    notInStep: function (path) { return path + ' is not part of this step.'; },
    contrastChecked: 'The agent’s second reply is below.',
    partB: 'Answer with the diagram',
    partBHint: 'Your answers from the code are filled in. Change any that the diagram corrects, then check them.',
    partBHintPlan: 'Answer each question with the expert’s views.',
    check: 'Check my answers',
    checkOne: 'Check my answer',
    answerAll: 'Answer every question first.',
    results: function (correct, total) { return correct + ' of ' + total + ' correct'; },
    retryHint: 'You can change an answer and check again.',
    retryPointer: 'Look for it in the diagram, then check it in the code through the evidence notes in the agent’s reply.',
    retryPointerCode: 'Open the code that the claim rests on and read it again.',
    correct: 'Correct',
    notCorrect: 'Not correct',
    notYet: 'Not correct yet',
    changed: 'Changed since your last check',
    checkedWith: function (label, correct, total) { return label + ': ' + correct + ' of ' + total + ' correct.'; },
    continueFollowUp: function (count) { return count > 1 ? 'Continue to the new questions' : 'Continue to the new question'; },
    continueEvidence: 'Continue to the evidence check',
    continueDone: 'Show the comparison',
    skipFollowUp: function (count) { return count > 1 ? 'Skip to the new questions' : 'Skip to the new question'; },
    skipEvidence: 'Skip to the evidence check',
    skipDone: 'Skip to the comparison',
    followUp: function (count) { return count > 1 ? 'New questions' : 'A new question'; },
    followUpHint: function (count) { return count > 1 ? 'Answer them with the diagram.' : 'Answer it with the diagram.'; },
    openView: function (label) { return 'Open its view: ' + label; },
    showingView: function (label) { return 'Showing ' + label + '.'; },
    phasesLabel: 'Challenge progress',
    phases: {
      plan: 'Plan', fromCode: 'From the code', withDiagram: 'With the diagram',
      newQuestion: function (count) { return count > 1 ? 'New questions' : 'New question'; },
      evidence: 'Evidence check', compare: 'Compare',
    },
    phaseDone: ', done',
    evidenceCheck: 'Check the diagram against the code',
    done: 'Compare your answers',
    fromCode: 'From the code',
    withDiagram: 'With the diagram',
    yourPlan: 'Your plan',
    answerKey: 'Answer key',
    newQuestion: function (number) { return 'New question ' + number; },
    noAnswer: 'No answer.',
    timesIntro: 'Your experience, not an experiment: ',
    hideTimes: 'Hide times',
    reflection: 'Reflection question',
    hiddenBy: 'What hid the answer in the code',
    findInCode: 'Find it in the code next time',
    viewShows: 'What the view shows',
    consolidationHint: 'One sentence; you need it to finish.',
    finish: 'Finish the challenge',
    finishMissing: {
      consolidation: 'Write your sentence before you finish.',
      mechanism: 'Choose an answer to the last question before you finish.',
    },
    passed: function (score) { return 'Challenge complete with a score of ' + percent(score) + '. You can continue to the next step.'; },
    belowMin: function (score, min) {
      return 'Your score is ' + percent(score) + '; this step needs ' + percent(min) +
        '. Change the answers marked Not correct yet, check them again, then finish again.';
    },
    alreadyPassed: 'You completed this challenge. Further checks are practice.',
    resultsTitle: 'Your results across the challenges',
    resultsNote: 'Times are your experience, not an experiment: each answer with a diagram also benefited from your earlier search of the code. Earlier diagrams stay available in their steps.',
    resultsCaption: 'Correct answers and times for each diagram challenge',
    resultsColumns: ['Challenge', 'From the code', 'With the diagram', 'New question', 'What hid the answer'],
    notStarted: 'Not started',
    inProgress: 'In progress',
    notReached: 'Not reached yet',
    noneAsked: 'None',
    resultsEmpty: 'No saved challenge results in this browser yet.',
    instructorNote: 'Instructor mode: work through this step as a student would. It never locks, and nothing you enter is saved. Press Solution to show the answer keys.',
    instructorKeysNote: 'Instructor mode: answer keys and every panel are shown, and this step never locks.',
    instructorKeysShown: 'Answer keys shown.',
    keyMark: '(answer key)',
    expertView: 'Expert’s view: ',
    expertChoice: 'Expert’s choice',
    attemptRequires: 'Before the answer choices appear, students write:',
    readOnlyNotice: 'Answer this diagram challenge in the main tutorial window.',
    readOnlyStates: {
      exploring: 'Not locked in yet.',
      locked: 'Locked in: the agent’s reply is shown in the main window.',
      'follow-up': 'Answering the new question in the main window.',
      done: 'Done: the comparison is shown in the main window.',
    },
    readOnlyPassed: 'This challenge is complete.',
    returnToMain: 'Close this window and answer in the main window',
    failed: 'This diagram challenge could not be shown. Reload the page to try again.',
  };

  // ---------------------------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------------------------

  /** Create an element. props: className, text, hidden, disabled, or attributes. */
  function h(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (name) {
      var value = props[name];
      if (value === null || value === undefined || value === false) return;
      if (name === 'className') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name === 'hidden' || name === 'disabled') node[name] = true;
      else node.setAttribute(name, value === true ? '' : String(value));
    });
    append(node, children);
    return node;
  }

  function append(node, children) {
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function button(className, text) {
    return h('button', { type: 'button', className: C + className, text: text });
  }

  function slug(value) {
    return String(value).replace(/[^A-Za-z0-9_-]/g, '-');
  }

  function readJson(host, selector) {
    var script = host.querySelector(selector);
    if (!script) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      return null;
    }
  }

  /**
   * Rendered Markdown from the host's templates, keyed by field. `link`, when
   * given, runs on every block and labeled paragraph before it is shown (it
   * turns `path:line` code spans into buttons); legends and labels never get
   * it, since a control cannot sit inside them.
   */
  function MarkdownLookup(host, link) {
    var templates = {};
    host.querySelectorAll('template[data-diagram-challenge-md]').forEach(function (template) {
      templates[template.getAttribute('data-diagram-challenge-md')] = template;
    });
    this._templates = templates;
    this._link = typeof link === 'function' ? link : function () {};
  }

  /** Apply the link step to rendered content and return it. */
  MarkdownLookup.prototype.linked = function (content) {
    if (content) this._link(content);
    return content;
  };

  MarkdownLookup.prototype.has = function (key) {
    return !!this._templates[key];
  };

  /** Block content; a plain paragraph of `fallback` text when there is no template. */
  MarkdownLookup.prototype.block = function (key, fallback) {
    var template = this._templates[key];
    if (template) return this.linked(template.content.cloneNode(true));
    var fragment = document.createDocumentFragment();
    if (fallback) fragment.appendChild(h('p', { text: fallback }));
    return fragment;
  };

  /** The children of a single rendered paragraph, or null for block content. */
  MarkdownLookup.prototype.inline = function (key) {
    var template = this._templates[key];
    if (!template) return null;
    var nodes = Array.prototype.filter.call(template.content.childNodes, function (node) {
      return !(node.nodeType === 3 && !node.textContent.trim());
    });
    if (nodes.length !== 1 || nodes[0].nodeName !== 'P') return null;
    var fragment = document.createDocumentFragment();
    Array.prototype.forEach.call(nodes[0].childNodes, function (node) { fragment.appendChild(node.cloneNode(true)); });
    return fragment;
  };

  /** Inline content where only phrasing content is allowed (labels, legends). */
  MarkdownLookup.prototype.phrase = function (key, fallback) {
    var inline = this.inline(key);
    if (inline) return inline;
    var template = this._templates[key];
    var text = template ? template.content.textContent.replace(/\s+/g, ' ').trim() : '';
    return document.createTextNode(text || fallback || '');
  };

  function questionKey(prefix, question) {
    return prefix + ':' + question.id;
  }

  // ---------------------------------------------------------------------------
  // Question fieldset (native radios or checkboxes)
  // ---------------------------------------------------------------------------

  /**
   * options: idBase, label ("Question 1"), mdPrefix ('q' or 'p'),
   * stemKey and stemFallback (the stem's Markdown key and plain text; by
   * default the question's own), optionLabels (plain strings instead of
   * Markdown), hint, extra (a node after the hint, such as a button),
   * onChange(value).
   */
  function QuestionField(widget, question, options) {
    var self = this;
    this.question = question;
    var md = widget.md;
    var idBase = options.idBase;
    var prefix = questionKey(options.mdPrefix || 'q', question);
    var stemKey = options.stemKey || prefix + ':stem';
    var stemFallback = options.stemFallback !== undefined ? options.stemFallback : question.question;
    var multiple = question.type === 'multiple';
    var stem = options.stem !== undefined ? options.stem : (options.optionLabels ? null : md.inline(stemKey));
    var legend = h('legend', { className: C + 'legend' });
    var describedBy = [];
    var blockStem = null;
    if (options.label) append(legend, h('span', { className: C + 'question-number', text: options.label + (stem ? ':' : '') }));
    if (stem) {
      if (options.label) append(legend, ' ');
      append(legend, h('span', { className: C + 'stem' }, stem));
    } else if (!options.optionLabels && (md.has(stemKey) || stemFallback)) {
      blockStem = h('div', { className: C + 'stem-block', id: idBase + '-stem' }, md.block(stemKey, stemFallback));
      describedBy.push(idBase + '-stem');
    }
    var hintText = options.hint || (multiple ? COPY.multipleHint : '');
    var hint = hintText ? h('p', { className: C + 'hint', id: idBase + '-hint', text: hintText }) : null;
    if (hint) describedBy.push(idBase + '-hint');
    this.inputs = [];
    this.labels = [];
    var list = h('div', { className: C + 'options' });
    question.options.forEach(function (option, index) {
      var id = idBase + '-' + index;
      var input = h('input', { type: multiple ? 'checkbox' : 'radio', id: id, name: idBase, value: String(index), className: C + 'input' });
      var content = options.optionLabels ? document.createTextNode(options.optionLabels[index])
        : md.phrase(prefix + ':o:' + index, option);
      var label = h('label', { for: id, className: C + 'option-label' }, content);
      self.inputs.push(input);
      self.labels.push(label);
      append(list, h('div', { className: C + 'option' }, [input, label]));
      if (options.onChange) {
        input.addEventListener('change', function () { options.onChange(self.value()); }, { signal: widget.signal });
      }
    });
    this.result = h('p', { className: C + 'result', hidden: true });
    this.pointer = h('p', { className: C + 'hint ' + C + 'pointer', hidden: true });
    this.fieldset = h('fieldset', {
      className: C + 'question',
      'aria-describedby': describedBy.length ? describedBy.join(' ') : null,
    }, [legend, blockStem, hint, options.extra || null, list, this.result, this.pointer]);
  }

  QuestionField.prototype.value = function () {
    var selected = this.inputs.filter(function (input) { return input.checked; })
      .map(function (input) { return Number(input.value); });
    if (this.question.type === 'multiple') return selected;
    return selected.length ? selected[0] : null;
  };

  QuestionField.prototype.setValue = function (value) {
    var selected = Array.isArray(value) ? value : Number.isInteger(value) ? [value] : [];
    this.inputs.forEach(function (input) { input.checked = selected.indexOf(Number(input.value)) !== -1; });
  };

  QuestionField.prototype.setDisabled = function (disabled) {
    this.inputs.forEach(function (input) { input.disabled = disabled; });
  };

  /**
   * Show a check result: correct, not yet, or changed since the check.
   * `pointer`, when given, says where to look after a wrong answer.
   */
  QuestionField.prototype.showResult = function (result, changed, pointer) {
    var kind = !result ? null : changed ? 'changed' : result.correct ? 'correct' : 'incorrect';
    this.pointer.textContent = kind === 'incorrect' && pointer ? pointer : '';
    this.pointer.hidden = !this.pointer.textContent;
    if (!kind) {
      this.result.hidden = true;
      this.result.replaceChildren();
      return;
    }
    var icon = { correct: '✓', incorrect: '✗', changed: '•' }[kind];
    var text = { correct: COPY.correct, incorrect: COPY.notYet, changed: COPY.changed }[kind];
    this.result.className = C + 'result ' + C + 'result--' + kind;
    this.result.replaceChildren(h('span', { className: C + 'result-icon', 'aria-hidden': 'true', text: icon }), ' ', h('span', { text: text }));
    this.result.hidden = false;
  };

  /** Answer-key view: mark keys and show option feedback and the explanation. */
  QuestionField.prototype.showKey = function (md, prefix) {
    var question = this.question;
    var self = this;
    this.setValue(question.type === 'multiple' ? question.correct : question.correct[0]);
    this.setDisabled(true);
    // Keys, not the learner's answers: no "Your answer" tag (see the CSS).
    this.fieldset.classList.add(C + 'question--key');
    question.options.forEach(function (option, index) {
      var row = self.labels[index].parentNode;
      if (question.correct.indexOf(index) !== -1) {
        append(self.labels[index], [' ', h('span', { className: C + 'key-mark', text: COPY.keyMark })]);
      }
      if (md.has(prefix + ':f:' + index)) append(row, h('div', { className: C + 'feedback' }, md.block(prefix + ':f:' + index)));
    });
    if (md.has(prefix + ':x')) append(this.fieldset, h('div', { className: C + 'explanation' }, md.block(prefix + ':x')));
  };

  function sameAnswer(left, right) {
    return JSON.stringify(left === undefined ? null : left) === JSON.stringify(right === undefined ? null : right);
  }

  // ---------------------------------------------------------------------------
  // Widget
  // ---------------------------------------------------------------------------

  function Widget(host, options) {
    this.host = host;
    this.options = options;
    this.key = host.getAttribute('data-diagram-challenge-key') || '';
    this.spec = readJson(host, 'script[data-diagram-challenge-spec]');
    if (!this.spec) throw new Error('Diagram challenge data is missing.');
    this.runtime = options.runtime || null;
    this.now = typeof options.now === 'function' ? options.now : function () { return Date.now(); };
    this.records = options.records || {};
    this.md = new MarkdownLookup(host, this._sourceLinker());
    this.id = 'tdc' + (++sequence);
    this.events = new AbortController();
    this.signal = this.events.signal;
    this.body = host.querySelector('[data-diagram-challenge-body]') || host.appendChild(h('div', { className: C + 'body' }));
    this.session = Core.createSession(this.spec, options.instructorMode ? null : this.records[this.key]);
    this.challenge = this.session.challenge;
    this.destroyed = false;
    this.keysShown = false;
    this._textTimer = null;
    this._budgetTimer = null;
    this._removePinAction = null;
    this._lineMarksOwner = 'diagram-challenge:' + this.id;
  }

  Widget.prototype.mount = function () {
    this.body.replaceChildren();
    this.live = h('p', { className: C + 'live', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    this.body.appendChild(this.live);
    if (this.options.instructorMode && this.keysShown) this._renderAnswerKey();
    else if (this.options.readOnly) this._renderReadOnly();
    else {
      if (this.options.instructorMode) this.body.appendChild(h('p', { className: C + 'notice', text: COPY.instructorNote }));
      this._renderInteractive();
    }
  };

  Widget.prototype.destroy = function () {
    if (this.destroyed) return;
    var interactive = !this.options.readOnly && !this.keysShown;
    if (interactive) {
      this.session.pause(this.now());
      this._emit();
    }
    this.destroyed = true;
    clearTimeout(this._textTimer);
    clearTimeout(this._budgetTimer);
    this.events.abort();
    this._releaseEditor();
    if (this.runtime && !this.options.readOnly && typeof this.runtime.hideAuthoredDiagrams === 'function') {
      this.runtime.hideAuthoredDiagrams();
    }
    this.body.replaceChildren();
  };

  Widget.prototype.announce = function (text) {
    // Clear first so a repeated message is announced again.
    this.live.textContent = '';
    var live = this.live;
    requestAnimationFrame(function () { live.textContent = text; });
  };

  Widget.prototype._emit = function () {
    if (this.destroyed || this.options.readOnly || this.options.instructorMode) return;
    clearTimeout(this._textTimer);
    this._textTimer = null;
    if (typeof this.options.onRecord === 'function') this.options.onRecord(this.key, this.session.serialize(this.now()));
  };

  /** Typing saves after a short pause instead of on every key. */
  Widget.prototype._emitSoon = function () {
    var self = this;
    clearTimeout(this._textTimer);
    this._textTimer = setTimeout(function () { self._emit(); }, TEXT_SAVE_DELAY_MS);
  };

  Widget.prototype._focus = function (node) {
    if (!node) return;
    if (!node.hasAttribute('tabindex') && !/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(node.nodeName)) node.setAttribute('tabindex', '-1');
    node.focus();
  };

  Widget.prototype._section = function (name, title) {
    var titleId = this.id + '-' + name + '-title';
    var heading = h('h4', { className: C + 'section-title', id: titleId, tabindex: '-1', text: title });
    var section = h('section', { className: C + 'part ' + C + 'part--' + name, 'aria-labelledby': titleId }, heading);
    this.body.appendChild(section);
    return { section: section, heading: heading };
  };

  /** A labelled textarea; `label` may be a node (rendered Markdown). */
  Widget.prototype._textField = function (name, label, hint, onInput) {
    var id = this.id + '-' + name;
    var self = this;
    var hintNode = hint ? h('p', { className: C + 'hint', id: id + '-hint', text: hint }) : null;
    var textarea = h('textarea', { id: id, className: C + 'textarea', rows: '2', 'aria-describedby': hint ? id + '-hint' : null });
    textarea.addEventListener('input', function () {
      onInput(textarea.value);
      self._emitSoon();
    }, { signal: this.signal });
    textarea.addEventListener('change', function () { self._emit(); }, { signal: this.signal });
    var wrap = h('div', { className: C + 'field' }, [
      h('label', { for: id, className: C + 'label' }, label), hintNode, textarea,
    ]);
    return { wrap: wrap, textarea: textarea };
  };

  /** "You asked:" style rows: the label inline with a one-paragraph value. */
  Widget.prototype._labeledText = function (label, key, fallback) {
    if (!this.md.has(key) && !fallback) return null;
    var inline = this.md.inline(key);
    if (inline) return h('p', { className: C + 'labeled' }, [h('strong', { text: label }), ' ', this.md.linked(inline)]);
    return h('div', { className: C + 'labeled' }, [h('p', {}, h('strong', { text: label })), this.md.block(key, fallback)]);
  };

  function findById(items, id) {
    return items.filter(function (item) { return item.id === id; })[0] || null;
  }

  /**
   * Plan-first field: which view to request for one question. It shows the
   * planned question's whole stem, then one prompt: which view.
   */
  Widget.prototype._planField = function (entry, index, onChange) {
    var planned = findById(this.challenge.questions, entry.id);
    return new QuestionField(this, entry, {
      idBase: this.id + '-plan-' + slug(entry.id),
      label: COPY.question(index + 1),
      mdPrefix: 'p',
      stemKey: 'q:' + entry.id + ':stem',
      stemFallback: planned ? planned.question : '',
      hint: COPY.planHint,
      onChange: onChange,
    });
  };

  Widget.prototype._questionFields = function (group, questions, prefix, onChange) {
    var self = this;
    return questions.map(function (question, index) {
      return new QuestionField(self, question, {
        idBase: self.id + '-' + group + '-' + slug(question.id),
        label: questions.length > 1 || group === 'a' || group === 'b' ? COPY.question(index + 1) : null,
        mdPrefix: prefix,
        onChange: onChange && function (value) { onChange(question, value); },
      });
    });
  };

  // ----- Interactive view -----------------------------------------------------

  Widget.prototype._renderInteractive = function () {
    this._buildStepper();
    this._buildPartA();
    this._wireClock();
    this._sync();
    // The pane draws once the step is shown (see _onStepReady).
    if (this.session.state === 'exploring') this._paneUnavailable();
    else this._showDiagrams(false);
    this._wireStepReady();
  };

  /**
   * The step's files open after the widget mounts; the runtime announces
   * the finished step with tvm:stepchange. Then pins get their line text
   * and editor marks, and a challenge past lock-in (a reload, a return to
   * the step) shows its diagram again and scrolls to the live part.
   */
  Widget.prototype._wireStepReady = function () {
    var self = this;
    if (!this.runtime) return;
    document.addEventListener('tvm:stepchange', function onReady() {
      document.removeEventListener('tvm:stepchange', onReady);
      if (!self.destroyed) self._onStepReady();
    }, { signal: this.signal });
  };

  Widget.prototype._onStepReady = function () {
    if (this.pinList) this._renderPins();
    if (this.session.state === 'exploring') return;
    this._showDiagrams(true);
    var live = this._livePart();
    if (live) live.heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  /** The part the learner works on now. */
  Widget.prototype._livePart = function () {
    switch (this.session.state) {
      case 'locked': return this.session.contrastPending() ? this.reply : this.partB;
      case 'follow-up': return this.followUpPart;
      case 'done': return this.donePart;
      default: return this.partA;
    }
  };

  // ----- Stepper ----------------------------------------------------------------

  /** The challenge's phases, in order; the current one follows the state. */
  Widget.prototype._phases = function () {
    var challenge = this.challenge;
    var phases = [challenge.mode === 'plan-first' ? COPY.phases.plan : COPY.phases.fromCode, COPY.phases.withDiagram];
    if (challenge.followUp.length) phases.push(COPY.phases.newQuestion(challenge.followUp.length));
    else if (challenge.evidenceQuestions.length) phases.push(COPY.phases.evidence);
    phases.push(COPY.phases.compare);
    return phases;
  };

  Widget.prototype._buildStepper = function () {
    this.stepper = h('ol', { className: C + 'stepper', 'aria-label': COPY.phasesLabel });
    this.body.appendChild(this.stepper);
  };

  Widget.prototype._syncStepper = function () {
    var phases = this._phases();
    var state = this.session.state;
    var current = state === 'done' ? phases.length - 1 : ['exploring', 'locked', 'follow-up'].indexOf(state);
    var passed = this.session.passed;
    this.stepper.replaceChildren.apply(this.stepper, phases.map(function (name, index) {
      var done = index < current || (passed && index === current);
      var item = h('li', {
        className: C + 'phase' + (done ? ' ' + C + 'phase--done' : '') + (index === current && !done ? ' ' + C + 'phase--current' : ''),
        'aria-current': index === current && !done ? 'step' : null,
      });
      if (done) append(item, h('span', { className: C + 'phase-mark', 'aria-hidden': 'true', text: '✓' }));
      append(item, name);
      if (done) append(item, h('span', { className: C + 'sr-only', text: COPY.phaseDone }));
      return item;
    }));
  };

  Widget.prototype._buildPartA = function () {
    var self = this;
    var session = this.session;
    var challenge = this.challenge;
    var planFirst = challenge.mode === 'plan-first';
    var part = this._section('a', planFirst ? COPY.plan : COPY.partA);
    this.partA = part;
    var attempt = challenge.attempt;
    if (attempt.hypothesis) {
      this.hypothesis = this._textField('hypothesis', COPY.hypothesisLabel, COPY.hypothesisHint, function (text) {
        var hidden = !session.optionsVisible();
        session.setHypothesis(text);
        if (hidden && session.optionsVisible()) self.announce(COPY.choicesShown);
        self._syncPartA();
      });
      part.section.appendChild(this.hypothesis.wrap);
    }
    if (attempt.evidencePins) this._buildPins(part.section);
    if (attempt.viewWish) {
      this.viewWish = this._textField('wish', COPY.wishLabel, COPY.wishHint, function (text) {
        session.setViewWish(text);
        self._syncPartA();
      });
      part.section.appendChild(this.viewWish.wrap);
    }
    this.choicesHint = h('p', { className: C + 'hint', text: COPY.choicesHint, hidden: true });
    this.choices = h('div', { className: C + 'choices' });
    part.section.append(this.choicesHint, this.choices);
    var changed = function () {
      self._emit();
      self._syncPartA();
    };
    if (planFirst) {
      this.planFields = challenge.plan.map(function (entry, index) {
        return self._planField(entry, index, function (value) {
          session.choosePlan(entry.id, value);
          changed();
        });
      });
      this.planFields.forEach(function (field) { self.choices.appendChild(field.fieldset); });
    } else {
      this.aFields = this._questionFields('a', challenge.questions, 'q', function (question, value) {
        session.answer(question.id, value);
        changed();
      });
      this.aFields.forEach(function (field) { self.choices.appendChild(field.fieldset); });
      var levels = Core.CONFIDENCE_LEVELS;
      this.confidenceField = new QuestionField(this, { id: 'confidence', type: 'single', options: levels }, {
        idBase: this.id + '-confidence',
        stem: document.createTextNode(COPY.confidenceLegend),
        optionLabels: levels.map(function (level) { return CONFIDENCE_LABELS[level]; }),
        onChange: function (value) { session.setConfidence(levels[value]); changed(); },
      });
      this.choices.appendChild(this.confidenceField.fieldset);
      if (challenge.predictView) {
        var views = session.viewChoices();
        this.viewField = new QuestionField(this, { id: 'view', type: 'single', options: views }, {
          idBase: this.id + '-view',
          stem: document.createTextNode(COPY.viewLegend),
          optionLabels: views.map(function (view) { return VIEW_LABELS[view] || view; }),
          onChange: function (value) { session.setViewPrediction(views[value]); changed(); },
        });
        this.choices.appendChild(this.viewField.fieldset);
      }
    }
    this.todo = h('p', { className: C + 'todo', id: this.id + '-todo' });
    this.budgetNote = h('p', { className: C + 'budget', hidden: true });
    this.lockButton = h('button', {
      type: 'button', className: C + 'primary', 'aria-describedby': this.todo.id,
      text: planFirst ? COPY.lockPlan : COPY.lock,
    });
    this.lockButton.addEventListener('click', function () { self._onLock(); }, { signal: this.signal });
    this.lockRow = h('div', { className: C + 'actions' }, [this.todo, this.budgetNote, this.lockButton]);
    part.section.appendChild(this.lockRow);
    this._restorePartA();
  };

  Widget.prototype._restorePartA = function () {
    var a = this.session.snapshot().a;
    var challenge = this.challenge;
    if (this.hypothesis) this.hypothesis.textarea.value = a.hypothesis;
    if (this.viewWish) this.viewWish.textarea.value = a.viewWish;
    (this.aFields || []).forEach(function (field) { field.setValue(a.answers[field.question.id]); });
    (this.planFields || []).forEach(function (field) { field.setValue(a.plan[field.question.id]); });
    if (this.confidenceField) this.confidenceField.setValue(Core.CONFIDENCE_LEVELS.indexOf(a.confidence));
    if (this.viewField) this.viewField.setValue(this.session.viewChoices().indexOf(a.view));
    if (this.pinList) this._renderPins();
    if (challenge.budgetMinutes && this.session.state === 'exploring' &&
        this.session.elapsedSeconds('a', this.now()) >= challenge.budgetMinutes * 60) {
      this._showBudgetNote(false);
    }
  };

  Widget.prototype._buildPins = function (container) {
    var self = this;
    var titleId = this.id + '-pins-title';
    this.pinEmpty = h('p', { className: C + 'empty', text: COPY.pinsEmpty });
    this.pinList = h('ul', { className: C + 'pins' });
    this.pinTitle = h('p', { className: C + 'label', id: titleId });
    this.pinButton = button('button', COPY.pinButton);
    this.pinButton.addEventListener('click', function () { self._pinCurrentLine(); }, { signal: this.signal });
    container.appendChild(h('div', { className: C + 'field', role: 'group', 'aria-labelledby': titleId }, [
      this.pinTitle,
      h('p', { className: C + 'hint', text: COPY.pinsHint(this.challenge.attempt.evidencePins) }),
      this.pinEmpty, this.pinList, this.pinButton,
    ]));
    // The same action from the code: the editor's context menu and a key.
    if (this.session.state === 'exploring' && this.runtime && typeof this.runtime.addEditorLineAction === 'function') {
      this._removePinAction = this.runtime.addEditorLineAction({
        id: 'tutorial.diagramChallenge.pinLine',
        label: COPY.pinLineAction,
        keys: { ctrlCmd: true, alt: true, key: 'P' },
        run: function (location) { if (!self.destroyed) self._pinLocation(location); },
      });
    }
  };

  Widget.prototype._stopPinAction = function () {
    if (this._removePinAction) this._removePinAction();
    this._removePinAction = null;
  };

  /** Give the code editors back: no pin action and no pin marks. */
  Widget.prototype._releaseEditor = function () {
    this._stopPinAction();
    if (this.runtime && typeof this.runtime.setEditorLineMarks === 'function') {
      this.runtime.setEditorLineMarks(this._lineMarksOwner, []);
    }
  };

  Widget.prototype._pinCurrentLine = function () {
    var runtime = this.runtime;
    this._pinLocation(runtime && typeof runtime.currentEditorLocation === 'function' ? runtime.currentEditorLocation() : null);
  };

  Widget.prototype._pinLocation = function (location) {
    if (!location) {
      this.announce(COPY.pinNoLocation);
      return;
    }
    var ref = location.path + ':' + location.line;
    if (!this.session.addEvidence(location)) {
      this.announce(COPY.pinDuplicate);
      return;
    }
    this._emit();
    this._renderPins();
    this._syncPartA();
    this.announce(COPY.pinned(ref));
  };

  /** The pin list, each with its line's text, and the marks in the editor. */
  Widget.prototype._renderPins = function () {
    var self = this;
    var runtime = this.runtime;
    var pins = this.session.snapshot().a.evidence;
    var editable = this.session.state === 'exploring';
    var lineText = function (pin) {
      return runtime && typeof runtime.projectLineText === 'function' ? runtime.projectLineText(pin.path, pin.line) : null;
    };
    this.pinTitle.textContent = COPY.pinsLabel(pins.length, this.challenge.attempt.evidencePins);
    this.pinEmpty.hidden = pins.length > 0;
    this.pinList.hidden = pins.length === 0;
    this.pinList.replaceChildren.apply(this.pinList, pins.map(function (pin, index) {
      var ref = pin.path + ':' + pin.line;
      var open = h('button', { type: 'button', className: C + 'link' }, h('code', { text: ref }));
      open.addEventListener('click', function () { self._revealSource(pin.path, pin.line); }, { signal: self.signal });
      var row = h('li', { className: C + 'pin' }, open);
      if (editable) {
        var remove = h('button', { type: 'button', className: C + 'button ' + C + 'button--small', 'aria-label': COPY.removePin + ' ' + ref, text: COPY.removePin });
        remove.addEventListener('click', function () { self._removePin(index, ref); }, { signal: self.signal });
        append(row, [' ', remove]);
      }
      var text = lineText(pin);
      if (text) append(row, h('div', { className: C + 'pin-text' }, h('code', { text: text })));
      return row;
    }));
    if (runtime && typeof runtime.setEditorLineMarks === 'function') runtime.setEditorLineMarks(this._lineMarksOwner, pins);
  };

  Widget.prototype._removePin = function (index, ref) {
    if (!this.session.removeEvidence(index)) return;
    this._emit();
    this._renderPins();
    this._syncPartA();
    var buttons = this.pinList.querySelectorAll('.' + C + 'button--small');
    this._focus(buttons[Math.min(index, buttons.length - 1)] || this.pinButton);
    this.announce(COPY.unpinned(ref));
  };

  Widget.prototype._todoText = function () {
    var challenge = this.challenge;
    var numbers = {};
    challenge.questions.forEach(function (question, index) { numbers[question.id] = index + 1; });
    var parts = this.session.missing().map(function (item) {
      return COPY.todo[item.kind](item, numbers[item.id]);
    });
    return parts.length ? COPY.todoPrefix + parts.join('; ') + '.' : COPY.ready;
  };

  Widget.prototype._syncPartA = function () {
    var session = this.session;
    var exploring = session.state === 'exploring';
    var showChoices = session.optionsVisible();
    this.choicesHint.hidden = !exploring || showChoices;
    this.choices.hidden = !showChoices;
    if (this.hypothesis) this.hypothesis.textarea.readOnly = !exploring;
    if (this.viewWish) this.viewWish.textarea.readOnly = !exploring;
    if (this.pinButton) this.pinButton.hidden = !exploring;
    [].concat(this.aFields || [], this.planFields || [], this.confidenceField || [], this.viewField || [])
      .forEach(function (field) { field.setDisabled(!exploring); });
    this.lockRow.hidden = !exploring;
    if (exploring) {
      this.todo.textContent = this._todoText();
      this.lockButton.disabled = !session.canLock();
      return;
    }
    this._stopPinAction();
    if (this.pinList && this.pinList.querySelector('.' + C + 'button--small')) this._renderPins();
    this._foldPartA();
  };

  /** "Your locked answer: 2 lines pinned, Fairly sure" */
  Widget.prototype._lockedSummary = function () {
    var a = this.session.snapshot().a;
    if (this.challenge.mode === 'plan-first') return COPY.lockedPlan(Object.keys(a.plan).length);
    var parts = [];
    if (this.challenge.attempt.evidencePins) parts.push(COPY.pinnedCount(a.evidence.length));
    if (a.confidence) parts.push(CONFIDENCE_LABELS[a.confidence]);
    return COPY.lockedAnswer(parts);
  };

  /**
   * After lock-in Part A is finished: it folds into a closed <details>
   * under its heading, so the column leads with the part in progress.
   */
  Widget.prototype._foldPartA = function () {
    if (this.partAFold) return;
    var heading = this.partA.heading;
    var fold = h('details', { className: C + 'fold' }, h('summary', { className: C + 'fold-summary', text: this._lockedSummary() }));
    while (heading.nextSibling) fold.appendChild(heading.nextSibling);
    this.partA.section.appendChild(fold);
    this.partAFold = fold;
  };

  Widget.prototype._onLock = function () {
    var self = this;
    if (!this.session.canLock()) return;
    var confirmation = window.SebookConfirmation && typeof window.SebookConfirmation.confirm === 'function'
      ? window.SebookConfirmation.confirm({
        title: COPY.lockTitle, message: COPY.lockMessage, confirmLabel: COPY.lockConfirm, trigger: this.lockButton,
      })
      : Promise.resolve(true);
    confirmation.then(function (confirmed) {
      if (!confirmed || self.destroyed || !self.session.lock(self.now())) return;
      clearTimeout(self._budgetTimer);
      self._emit();
      self._sync();
      self._showDiagrams(true);
      self.announce(COPY.lockedIn);
      self._focus(self.reply.heading);
    });
  };

  // ----- Clock ----------------------------------------------------------------

  Widget.prototype._wireClock = function () {
    var self = this;
    var signal = this.signal;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') self._pauseClock();
      else self._resumeClock();
    }, { signal: signal });
    window.addEventListener('pagehide', function () { self._pauseClock(); }, { signal: signal });
    window.addEventListener('pageshow', function () {
      if (document.visibilityState !== 'hidden') self._resumeClock();
    }, { signal: signal });
    if (document.visibilityState !== 'hidden') this._resumeClock();
  };

  Widget.prototype._pauseClock = function () {
    clearTimeout(this._budgetTimer);
    this.session.pause(this.now());
    this._emit();
  };

  Widget.prototype._resumeClock = function () {
    this.session.resume(this.now());
    this._scheduleBudgetNote();
  };

  /** A polite nudge once Part A's active time reaches budget_minutes. */
  Widget.prototype._scheduleBudgetNote = function () {
    var self = this;
    var budget = this.challenge.budgetMinutes;
    clearTimeout(this._budgetTimer);
    if (!budget || this.session.state !== 'exploring' || !this.budgetNote.hidden) return;
    var remainingMs = budget * 60000 - this.session.elapsedSeconds('a', this.now()) * 1000;
    this._budgetTimer = setTimeout(function () {
      if (self.session.state === 'exploring' && self.session.timing()) self._showBudgetNote(true);
    }, Math.max(0, remainingMs));
  };

  Widget.prototype._showBudgetNote = function (announce) {
    var text = COPY.budget(Math.round(this.challenge.budgetMinutes));
    this.budgetNote.textContent = text;
    this.budgetNote.hidden = false;
    if (announce) this.announce(text);
  };

  // ----- Diagram pane ---------------------------------------------------------

  Widget.prototype._paneUnavailable = function () {
    if (this.runtime && typeof this.runtime.setDiagramPaneAvailable === 'function') {
      this.runtime.setDiagramPaneAvailable(false, COPY.paneUnavailable);
    }
  };

  /** A diagram as the pane takes it, under the label it shows. */
  function paneDiagram(diagram, label) {
    return { id: diagram.id, label: label, type: diagram.type, source: diagram.source, links: diagram.links };
  }

  /**
   * A reply diagram's label in the pane: "Q1 · Website connections" when
   * questions name it as their view (a question's `diagram`).
   */
  Widget.prototype._diagramLabel = function (diagram) {
    var label = diagram.label || VIEW_LABELS[diagram.type] || 'Diagram';
    var numbers = [];
    this.challenge.questions.forEach(function (question, index) {
      if (question.diagram === diagram.id) numbers.push('Q' + (index + 1));
    });
    return numbers.length ? numbers.join(', ') + ' · ' + label : label;
  };

  /**
   * The diagrams the learner may see now: the contrast view alone until its
   * question is checked, then the reply's diagrams followed by the contrast.
   */
  Widget.prototype._paneDiagrams = function (all) {
    var challenge = this.challenge;
    var contrast = challenge.contrast && challenge.contrast.diagram;
    var contrastLabel = contrast ? contrast.label || (VIEW_LABELS[contrast.type] || 'Diagram') + ' (' + COPY.firstReply.toLowerCase() + ')' : '';
    if (!all && this.session.contrastPending()) return contrast ? [paneDiagram(contrast, contrastLabel)] : [];
    var self = this;
    var diagrams = challenge.diagrams.map(function (diagram) {
      return paneDiagram(diagram, self._diagramLabel(diagram));
    });
    if (contrast) diagrams.push(paneDiagram(contrast, contrastLabel));
    return diagrams;
  };

  Widget.prototype._showDiagrams = function (open, all) {
    var runtime = this.runtime;
    if (!runtime || typeof runtime.showAuthoredDiagrams !== 'function') return;
    var diagrams = this._paneDiagrams(all);
    if (!diagrams.length) {
      runtime.hideAuthoredDiagrams();
      return;
    }
    runtime.showAuthoredDiagrams(diagrams, { layout: 'maximized', open: open });
  };

  /**
   * Show one reply diagram in the Diagram pane. The pane selects a tab only
   * through revealDiagramText; an empty query marks no label, and the note
   * that says so is cleared at once.
   */
  Widget.prototype._openDiagram = function (diagram) {
    var runtime = this.runtime;
    var label = this._diagramLabel(diagram);
    if (runtime && typeof runtime.revealDiagramText === 'function' && runtime.revealDiagramText(diagram.id, '')) {
      if (typeof runtime.clearDiagramTextHighlights === 'function') runtime.clearDiagramTextHighlights();
    } else {
      this._showDiagrams(true, true);
    }
    this.announce(COPY.showingView(label));
  };

  Widget.prototype._revealSource = function (path, line, column) {
    var runtime = this.runtime;
    if (runtime && typeof runtime.revealSource === 'function' && runtime.revealSource(path, line, column)) return;
    this.announce(COPY.notInStep(path));
  };

  /**
   * The link step for rendered Markdown: a code span that is exactly
   * `path:line` of a project file becomes a button opening it there. Only
   * with a runtime that can open files (not in print or a read-only popout).
   */
  Widget.prototype._sourceLinker = function () {
    var self = this;
    var links = window.TutorialSourceLinks;
    var runtime = this.runtime;
    if (!links || this.options.readOnly || !runtime || typeof runtime.hasProjectFile !== 'function') return null;
    return function (content) {
      links.linkSourceReferences(content, function (path) { return runtime.hasProjectFile(path); },
        function (path, line, column) { self._revealSource(path, line, column); });
    };
  };

  // ----- Reply card -----------------------------------------------------------

  Widget.prototype._buildReplyCard = function (container, contrastStage) {
    var self = this;
    var challenge = this.challenge;
    if (contrastStage) {
      append(container, this._labeledText(COPY.youAsked, 'contrast:request'));
      var showContrast = button('button', COPY.showThisDiagram);
      showContrast.addEventListener('click', function () { self._showDiagrams(true); }, { signal: this.signal });
      append(container, h('p', { className: C + 'row' }, showContrast));
      return;
    }
    append(container, [
      this._labeledText(COPY.youAsked, 'reply:request'),
      this._labeledText(COPY.summary, 'reply:summary'),
    ]);
    if (challenge.diagrams.length) {
      var show = button('button', challenge.diagrams.length > 1 ? COPY.showDiagrams : COPY.showDiagram);
      show.addEventListener('click', function () { self._showDiagrams(true, true); }, { signal: this.signal });
      append(container, h('p', { className: C + 'row' }, show));
    }
    // Reference lists stay closed until wanted, so the questions stay near.
    if (challenge.evidence.length) {
      var evidenceId = this.id + '-evidence-hint';
      append(container, h('details', { className: C + 'fold' }, [
        h('summary', { className: C + 'fold-summary', text: COPY.evidence(challenge.evidence.length) }),
        h('p', { className: C + 'hint', id: evidenceId, text: COPY.evidenceHint }),
        h('ul', { className: C + 'evidence' }, challenge.evidence.map(function (item, index) {
          var note = h('button', { type: 'button', className: C + 'link ' + C + 'evidence-link', 'aria-describedby': evidenceId }, [
            h('span', {}, self.md.phrase('reply:evidence:' + index, item.text)), ' ', h('code', { text: item.ref }),
          ]);
          note.addEventListener('click', function () { self._revealSource(item.path, item.line); }, { signal: self.signal });
          return h('li', {}, note);
        })),
      ]));
    }
    var filesRead = Array.isArray(this.spec.reply && this.spec.reply.files_read) ? this.spec.reply.files_read : [];
    if (filesRead.length) {
      append(container, h('details', { className: C + 'fold' }, [
        h('summary', { className: C + 'fold-summary', text: COPY.filesRead(filesRead.length) }),
        h('ul', { className: C + 'files' }, filesRead.map(function (path) { return h('li', {}, h('code', { text: String(path) })); })),
      ]));
    }
    append(container, this._labeledText(COPY.leftOut, 'reply:left_out'));
    if (this.md.has('reply:label')) append(container, h('div', { className: C + 'provenance' }, this.md.block('reply:label')));
  };

  Widget.prototype._ensureReply = function () {
    if (this.reply) return;
    var self = this;
    var challenge = this.challenge;
    var part = this._section('reply', COPY.reply);
    this.reply = part;
    var contrast = challenge.contrast;
    if (contrast && contrast.question) {
      var card = h('div', { className: C + 'card' });
      if (challenge.diagrams.length) append(card, h('h5', { className: C + 'subtitle', text: COPY.firstReply }));
      this._buildReplyCard(card, true);
      this.contrastField = new QuestionField(this, contrast.question, {
        idBase: this.id + '-contrast',
        mdPrefix: 'q',
        onChange: function (value) {
          self.session.answerContrast(contrast.question.id, value);
          self._emit();
          self._syncReply();
        },
      });
      this.contrastCheck = button('primary', COPY.checkOne);
      this.contrastCheck.addEventListener('click', function () { self._onCheckContrast(); }, { signal: this.signal });
      this.contrastFeedback = h('div', { className: C + 'feedback-list', hidden: true });
      append(card, [this.contrastField.fieldset, this.contrastFeedback, h('p', { className: C + 'row' }, this.contrastCheck)]);
      part.section.appendChild(card);
    }
    this.mainCard = h('div', { className: C + 'card', hidden: true });
    if (contrast && contrast.question) {
      this.mainCardTitle = h('h5', { className: C + 'subtitle', tabindex: '-1', text: COPY.secondReply });
      this.mainCard.appendChild(this.mainCardTitle);
    }
    this._buildReplyCard(this.mainCard, false);
    part.section.appendChild(this.mainCard);
  };

  Widget.prototype._syncReply = function () {
    var session = this.session;
    if (this.contrastField) {
      var c = session.snapshot().c;
      var question = this.challenge.contrast.question;
      this.contrastField.setValue(c.checked ? c.checked[question.id] : c.answers[question.id]);
      this.contrastField.setDisabled(!session.contrastPending());
      var result = session.lastResults('contrast');
      this.contrastField.showResult(result && result[0]);
      this.contrastCheck.hidden = !session.contrastPending();
      this.contrastCheck.disabled = !(c.answers[question.id] !== undefined);
      if (result && this.contrastFeedback.hidden) {
        this._fillFeedback(this.contrastFeedback, question, 'q', [result[0]]);
        this.contrastFeedback.hidden = !this.contrastFeedback.childNodes.length;
      }
    }
    this.mainCard.hidden = !session.mainVisible();
  };

  Widget.prototype._onCheckContrast = function () {
    var result = this.session.checkContrast(this.now());
    if (!result) {
      this.announce(COPY.answerAll);
      return;
    }
    this._emit();
    this._sync();
    this._showDiagrams(true, true);
    this.announce((result.correct ? COPY.correct : COPY.notYet) + '. ' + COPY.contrastChecked);
    this._focus(this.mainCardTitle);
  };

  /** Option feedback for every wrongly answered option, then the explanation. */
  Widget.prototype._fillFeedback = function (container, question, prefix, results) {
    var md = this.md;
    var key = questionKey(prefix, question);
    var shown = {};
    container.replaceChildren();
    results.forEach(function (result) {
      if (!result) return;
      result.missed.concat(result.extra).forEach(function (index) {
        if (shown[index] || !md.has(key + ':f:' + index)) return;
        shown[index] = true;
        append(container, h('div', { className: C + 'feedback' }, md.block(key + ':f:' + index)));
      });
    });
    if (md.has(key + ':x')) append(container, h('div', { className: C + 'explanation' }, md.block(key + ':x')));
  };

  // ----- Part B, follow-up, evidence check --------------------------------------

  /**
   * A checkable group of questions with a result summary. options.pointer
   * says where to look after a wrong answer; options.extra(question) may
   * add a node under a question's stem.
   */
  Widget.prototype._checkGroup = function (container, group, questions, options) {
    var self = this;
    var fields = questions.map(function (question, index) {
      return new QuestionField(self, question, {
        idBase: self.id + '-' + group + '-' + slug(question.id),
        label: questions.length > 1 || group === 'b' ? COPY.question(index + 1) : null,
        mdPrefix: 'q',
        extra: options.extra ? options.extra(question) : null,
        onChange: function (value) { options.onChange(question, value); },
      });
    });
    var check = button('primary', questions.length > 1 ? COPY.check : COPY.checkOne);
    check.addEventListener('click', function () { options.onCheck(); }, { signal: this.signal });
    var heading = h('h5', { className: C + 'subtitle', tabindex: '-1' });
    var retry = h('p', { className: C + 'hint', text: COPY.retryHint });
    var summary = h('div', { className: C + 'summary', hidden: true }, [heading, retry]);
    fields.forEach(function (field) { container.appendChild(field.fieldset); });
    append(container, [h('p', { className: C + 'row' }, check), summary]);
    return { fields: fields, check: check, summary: summary, heading: heading, retry: retry, pointer: options.pointer };
  };

  function allCorrect(results) {
    return !!results && results.every(function (result) { return result.correct; });
  }

  Widget.prototype._syncGroup = function (group, answers, checked, results, canCheck) {
    group.fields.forEach(function (field, index) {
      var id = field.question.id;
      field.setValue(answers[id]);
      field.showResult(results && results[index], !!checked && !sameAnswer(answers[id], checked[id]), group.pointer);
    });
    group.check.disabled = !canCheck;
    group.summary.hidden = !results;
    if (results) {
      var correct = results.filter(function (result) { return result.correct; }).length;
      group.heading.textContent = COPY.results(correct, results.length);
      group.retry.hidden = correct === results.length;
    }
  };

  /**
   * The button that leaves a stage: shown once the stage may be left. With
   * every answer right it is the primary "Continue"; otherwise a secondary
   * "Skip to …", since answers can still be fixed.
   */
  Widget.prototype._syncAdvanceButton = function (control, stage, allRight) {
    var session = this.session;
    control.hidden = session.state !== stage || !session.canAdvance();
    if (control.hidden) return;
    var next = session.nextState();
    var count = this.challenge.followUp.length;
    var label = next === 'done' ? (allRight ? COPY.continueDone : COPY.skipDone)
      : count ? (allRight ? COPY.continueFollowUp(count) : COPY.skipFollowUp(count))
        : (allRight ? COPY.continueEvidence : COPY.skipEvidence);
    control.textContent = label;
    control.className = C + (allRight ? 'primary' : 'button');
  };

  Widget.prototype._afterCheck = function (group, results, label) {
    if (!results) {
      this.announce(COPY.answerAll);
      return;
    }
    this._emit();
    this._sync();
    var correct = results.filter(function (result) { return result.correct; }).length;
    this.announce(COPY.checkedWith(label, correct, results.length));
    this._focus(group.heading);
  };

  Widget.prototype._ensurePartB = function () {
    if (this.partB) return;
    var self = this;
    var session = this.session;
    var part = this._section('b', COPY.partB);
    this.partB = part;
    part.section.appendChild(h('p', { className: C + 'hint', text: this.challenge.mode === 'plan-first' ? COPY.partBHintPlan : COPY.partBHint }));
    this.bGroup = this._checkGroup(part.section, 'b', this.challenge.questions, {
      pointer: COPY.retryPointer,
      extra: function (question) { return self._viewControl(question); },
      onChange: function (question, value) {
        session.answer(question.id, value);
        self._emit();
        self._syncPartB();
      },
      onCheck: function () { self._afterCheck(self.bGroup, session.checkMain(self.now()), COPY.withDiagram); },
    });
    this.bContinue = button('primary', '');
    this.bContinue.addEventListener('click', function () { self._onAdvance(); }, { signal: this.signal });
    part.section.appendChild(h('p', { className: C + 'row' }, this.bContinue));
  };

  /**
   * Under a Part B question: a button that shows the view answering it (a
   * question's `diagram`), or, in plan-first, the expert's choice when that
   * was no view.
   */
  Widget.prototype._viewControl = function (question) {
    var self = this;
    var diagram = question.diagram ? findById(this.challenge.diagrams, question.diagram) : null;
    if (diagram) {
      var open = button('button', COPY.openView(this._diagramLabel(diagram)));
      open.addEventListener('click', function () { self._openDiagram(diagram); }, { signal: this.signal });
      return h('p', { className: C + 'row' }, open);
    }
    var entry = this.challenge.mode === 'plan-first' ? findById(this.challenge.plan, question.id) : null;
    if (!entry) return null;
    return h('p', { className: C + 'expert-choice' }, [COPY.expertChoice + ': ', this._keyPhrase(entry, 'p')]);
  };

  Widget.prototype._syncPartB = function () {
    var session = this.session;
    var b = session.snapshot().b;
    var results = session.lastResults('main');
    this._syncGroup(this.bGroup, b.answers, b.checked, results, session.canCheckMain());
    this._syncAdvanceButton(this.bContinue, 'locked', allCorrect(results));
  };

  Widget.prototype._ensureFollowUp = function () {
    if (this.followUpPart) return;
    var self = this;
    var session = this.session;
    var challenge = this.challenge;
    var count = challenge.followUp.length;
    var part = this._section('f', count ? COPY.followUp(count) : COPY.evidenceCheck);
    this.followUpPart = part;
    if (count) {
      part.section.appendChild(h('p', { className: C + 'hint', text: COPY.followUpHint(count) }));
      this.fGroup = this._checkGroup(part.section, 'f', challenge.followUp, {
        pointer: COPY.retryPointer,
        onChange: function (question, value) {
          session.answerFollowUp(question.id, value);
          self._emit();
          self._syncFollowUp();
        },
        onCheck: function () { self._afterCheck(self.fGroup, session.checkFollowUp(self.now()), COPY.followUp(count)); },
      });
    }
    if (challenge.evidenceQuestions.length) {
      // After a follow-up, the evidence check shares the section, so its
      // subtitle names the group: its Check button is not the follow-up's.
      var evidenceTitleId = this.id + '-evidence-check-title';
      this.evidenceBlock = h('div', {
        className: C + 'evidence-check', hidden: true,
        role: count ? 'group' : null, 'aria-labelledby': count ? evidenceTitleId : null,
      });
      if (count) this.evidenceBlock.appendChild(h('h5', { className: C + 'subtitle', id: evidenceTitleId, text: COPY.evidenceCheck }));
      if (this.md.has('evidence:prompt')) this.evidenceBlock.appendChild(h('div', { className: C + 'prompt' }, this.md.block('evidence:prompt')));
      this.eGroup = this._checkGroup(this.evidenceBlock, 'e', challenge.evidenceQuestions, {
        pointer: COPY.retryPointerCode,
        onChange: function (question, value) {
          session.answerEvidenceCheck(question.id, value);
          self._emit();
          self._syncFollowUp();
        },
        onCheck: function () { self._afterCheck(self.eGroup, session.checkEvidence(self.now()), COPY.evidenceCheck); },
      });
      this.evidenceFeedback = h('div', { className: C + 'feedback-list', hidden: true });
      this.evidenceBlock.appendChild(this.evidenceFeedback);
      part.section.appendChild(this.evidenceBlock);
    }
    this.fContinue = button('primary', COPY.continueDone);
    this.fContinue.hidden = true;
    this.fContinue.addEventListener('click', function () { self._onAdvance(); }, { signal: this.signal });
    part.section.appendChild(h('p', { className: C + 'row' }, this.fContinue));
  };

  Widget.prototype._syncFollowUp = function () {
    var session = this.session;
    var snapshot = session.snapshot();
    var followUpResults = session.lastResults('follow-up');
    if (this.fGroup) {
      this._syncGroup(this.fGroup, snapshot.f.answers, snapshot.f.checked, followUpResults, session.canCheckFollowUp());
    }
    var results = session.lastResults('evidence');
    if (this.eGroup) {
      this.evidenceBlock.hidden = !session.evidenceVisible();
      this._syncGroup(this.eGroup, snapshot.e.answers, snapshot.e.checked, results, session.canCheckEvidence());
      if (results) {
        var self = this;
        this.evidenceFeedback.replaceChildren();
        this.challenge.evidenceQuestions.forEach(function (question, index) {
          var holder = h('div', {});
          self._fillFeedback(holder, question, 'q', [results[index]]);
          if (holder.childNodes.length) self.evidenceFeedback.appendChild(holder);
        });
        this.evidenceFeedback.hidden = !this.evidenceFeedback.childNodes.length;
      }
    }
    this._syncAdvanceButton(this.fContinue, 'follow-up',
      (!this.fGroup || allCorrect(followUpResults)) && (!this.eGroup || allCorrect(results)));
  };

  Widget.prototype._onAdvance = function () {
    if (!this.session.advance(this.now())) return;
    this._emit();
    this._sync();
    var target = this.session.state === 'done' ? this.donePart : this.followUpPart;
    this.announce(target.heading.textContent);
    this._focus(target.heading);
  };

  // ----- Done: comparison, debrief, finish ------------------------------------

  /** "Correct: …." / "Not correct: …." (single) / "Not correct. Found: …. Missed: …. Extra: …." */
  Widget.prototype._resultPhrase = function (question, result, prefix) {
    var md = this.md;
    var key = questionKey(prefix, question);
    var fragment = document.createDocumentFragment();
    function options(indices) {
      var holder = document.createDocumentFragment();
      indices.forEach(function (index, position) {
        if (position) holder.appendChild(document.createTextNode(', '));
        holder.appendChild(md.phrase(key + ':o:' + index, question.options[index]));
      });
      return holder;
    }
    if (!result || (!result.found.length && !result.extra.length)) {
      fragment.appendChild(document.createTextNode(COPY.noAnswer));
      return fragment;
    }
    if (result.correct || question.type === 'single') {
      var chosen = result.found.concat(result.extra);
      append(fragment, [(result.correct ? COPY.correct : COPY.notCorrect) + ': ', options(chosen), '.']);
      return fragment;
    }
    append(fragment, COPY.notCorrect + '.');
    [['Found', result.found], ['Missed', result.missed], ['Extra', result.extra]].forEach(function (part) {
      if (!part[1].length) return;
      append(fragment, [' ' + part[0] + ': ', options(part[1]), '.']);
    });
    return fragment;
  };

  Widget.prototype._keyPhrase = function (question, prefix) {
    var md = this.md;
    var fragment = document.createDocumentFragment();
    question.correct.forEach(function (index, position) {
      if (position) fragment.appendChild(document.createTextNode(', '));
      fragment.appendChild(md.phrase(questionKey(prefix, question) + ':o:' + index, question.options[index]));
    });
    return fragment;
  };

  /**
   * One question of the comparison: rows of {label, value}, the key, then
   * feedback for every option answered wrongly in `feedback`
   * ([{question, prefix, results}]).
   */
  Widget.prototype._compareBlock = function (title, question, rows, feedbackSets) {
    var self = this;
    var dl = h('dl', { className: C + 'compare-list' });
    rows.forEach(function (row) {
      append(dl, [h('dt', { text: row.label }), h('dd', {}, row.value)]);
    });
    var feedback = h('div', { className: C + 'feedback-list' });
    feedbackSets.forEach(function (set) {
      var holder = h('div', {});
      self._fillFeedback(holder, set.question, set.prefix, set.results);
      if (holder.childNodes.length) feedback.appendChild(holder);
    });
    return h('div', { className: C + 'compare' }, [
      h('h5', { className: C + 'subtitle', text: title }),
      h('div', { className: C + 'stem-block' }, this.md.block('q:' + question.id + ':stem', question.question)),
      dl,
      feedback.childNodes.length ? feedback : null,
    ]);
  };

  Widget.prototype._timesText = function () {
    var now = this.now();
    var session = this.session;
    var parts = [];
    var planFirst = this.challenge.mode === 'plan-first';
    parts.push((planFirst ? 'planning ' : 'from the code ') + Core.formatDuration(session.elapsedSeconds('a', now)));
    parts.push('with the diagram ' + Core.formatDuration(session.elapsedSeconds('b', now)));
    if (this.challenge.followUp.length) parts.push('new question ' + Core.formatDuration(session.elapsedSeconds('f', now)));
    return COPY.timesIntro + parts.join(' · ') + '.';
  };

  Widget.prototype._ensureDone = function () {
    if (this.donePart) return;
    var self = this;
    var session = this.session;
    var challenge = this.challenge;
    var part = this._section('d', COPY.done);
    this.donePart = part;
    var section = part.section;
    var comparison = session.comparison();
    var planFirst = challenge.mode === 'plan-first';
    challenge.questions.forEach(function (question, index) {
      var row = comparison.questions[index];
      var rows = [];
      var feedback = [];
      var entry = challenge.plan.filter(function (item) { return item.id === question.id; })[0];
      if (row.partA) rows.push({ label: COPY.fromCode, value: self._resultPhrase(question, row.partA, 'q') });
      if (row.plan && entry) {
        rows.push({ label: COPY.yourPlan, value: self._resultPhrase(entry, row.plan, 'p') });
        rows.push({ label: COPY.expertChoice, value: self._keyPhrase(entry, 'p') });
        feedback.push({ question: entry, prefix: 'p', results: [row.plan] });
      }
      rows.push({ label: COPY.withDiagram, value: self._resultPhrase(question, row.partB, 'q') });
      rows.push({ label: COPY.answerKey, value: self._keyPhrase(question, 'q') });
      feedback.push({ question: question, prefix: 'q', results: [row.partA, row.partB] });
      section.appendChild(self._compareBlock(COPY.question(index + 1), question, rows, feedback));
    });
    challenge.followUp.forEach(function (question, index) {
      var first = comparison.followUp[index].first;
      section.appendChild(self._compareBlock(COPY.newQuestion(index + 1), question, [
        { label: COPY.withDiagram, value: self._resultPhrase(question, first, 'q') },
        { label: COPY.answerKey, value: self._keyPhrase(question, 'q') },
      ], [{ question: question, prefix: 'q', results: [first] }]));
    });
    this.timesLine = h('p', { className: C + 'times', text: this._timesText() });
    this.hideTimesButton = h('button', { type: 'button', className: C + 'button', 'aria-pressed': 'false', text: COPY.hideTimes });
    this.hideTimesButton.addEventListener('click', function () {
      session.setHideTimes(!session.snapshot().hideTimes);
      self._emit();
      self._syncDone();
    }, { signal: this.signal });
    append(section, h('div', { className: C + 'times-row' }, [this.timesLine, this.hideTimesButton]));
    if (!planFirst && comparison.confidence) {
      var fromCode = comparison.questions.filter(function (row) { return row.partA && row.partA.correct; }).length;
      section.appendChild(h('p', {
        className: C + 'calibration',
        text: 'Before the diagram you chose “' + CONFIDENCE_LABELS[comparison.confidence] + '”; from the code you answered ' +
          fromCode + ' of ' + challenge.questions.length + ' questions correctly.',
      }));
    }
    if (comparison.view && comparison.view.predicted) {
      section.appendChild(h('p', {
        className: C + 'calibration',
        text: 'You would have asked for a ' + (VIEW_LABELS[comparison.view.predicted] || '').toLowerCase() +
          '; the expert asked for a ' + (VIEW_LABELS[comparison.view.expert] || '').toLowerCase() + '.' +
          (comparison.view.correct ? ' Your choice matched.' : ''),
      }));
    }
    [['debrief:hidden_by', COPY.hiddenBy], ['debrief:find_in_code', COPY.findInCode], ['debrief:view_shows', COPY.viewShows]]
      .forEach(function (item) {
        if (!self.md.has(item[0])) return;
        append(section, [h('h5', { className: C + 'subtitle', text: item[1] }), h('div', { className: C + 'debrief' }, self.md.block(item[0]))]);
      });
    if (challenge.consolidation) {
      this.consolidation = this._textField('consolidation', this.md.phrase('debrief:consolidation_prompt'), COPY.consolidationHint, function (text) {
        session.setConsolidation(text);
      });
      this.consolidation.textarea.setAttribute('aria-required', 'true');
      section.appendChild(this.consolidation.wrap);
    }
    if (challenge.mechanism) {
      this.mechanismField = new QuestionField(this, challenge.mechanism, {
        idBase: this.id + '-mechanism',
        mdPrefix: 'q',
        onChange: function (value) {
          session.answerMechanism(challenge.mechanism.id, value);
          self._emit();
          self._syncDone();
        },
      });
      this.mechanismFeedback = h('div', { className: C + 'feedback-list', hidden: true });
      append(section, [this.mechanismField.fieldset, this.mechanismFeedback]);
    }
    this.finishButton = button('primary', COPY.finish);
    this.finishButton.addEventListener('click', function () { self._onFinish(); }, { signal: this.signal });
    this.finishStatus = h('p', { className: C + 'status' });
    append(section, [h('p', { className: C + 'row' }, this.finishButton), this.finishStatus]);
    if (planFirst) this._buildResultsCard(section, this.records);
  };

  Widget.prototype._syncDone = function () {
    var session = this.session;
    var snapshot = session.snapshot();
    this.timesLine.hidden = snapshot.hideTimes;
    this.hideTimesButton.setAttribute('aria-pressed', snapshot.hideTimes ? 'true' : 'false');
    this.body.classList.toggle(C + 'times-hidden', snapshot.hideTimes);
    if (this.consolidation && document.activeElement !== this.consolidation.textarea) {
      this.consolidation.textarea.value = snapshot.d.consolidation;
    }
    if (this.mechanismField) {
      var mechanism = this.challenge.mechanism;
      var results = session.lastResults('mechanism');
      this.mechanismField.setValue(snapshot.d.answers[mechanism.id]);
      this.mechanismField.showResult(results && results[0],
        !!snapshot.d.checked && !sameAnswer(snapshot.d.answers[mechanism.id], snapshot.d.checked[mechanism.id]));
      if (results) {
        this._fillFeedback(this.mechanismFeedback, mechanism, 'q', [results[0]]);
        this.mechanismFeedback.hidden = !this.mechanismFeedback.childNodes.length;
      }
    }
    if (session.passed && !this.finishStatus.textContent) this.finishStatus.textContent = COPY.alreadyPassed;
  };

  Widget.prototype._onFinish = function () {
    var outcome = this.session.finish(this.now());
    var message;
    if (outcome.missing.length) {
      message = COPY.finishMissing[outcome.missing[0].kind];
      this.finishStatus.textContent = message;
      this.announce(message);
      this._focus(outcome.missing[0].kind === 'consolidation' ? this.consolidation.textarea : this.mechanismField.inputs[0]);
      return;
    }
    message = outcome.passed ? COPY.passed(outcome.score) : COPY.belowMin(outcome.score, this.challenge.minScore);
    this._emit();
    this._sync();
    this.finishStatus.textContent = message;
    this.announce(message);
  };

  // ----- Results card -----------------------------------------------------------

  function resultCell(summary, part, extra) {
    if (!summary) return COPY.notStarted;
    var value = summary[part];
    if (!value || value.correct === null) return summary.state === 'exploring' && part === 'a' ? COPY.inProgress : COPY.notReached;
    var time = Core.formatDuration(value.seconds) + (extra ? ' · ' + extra : '');
    return [
      h('span', { className: C + 'cell-main', text: value.correct + ' of ' + value.total + ' correct' }),
      h('span', { className: C + 'cell-time', text: time }),
    ];
  }

  /**
   * The results card of a plan-first step: one row per code-first challenge
   * of the tutorial, from its saved record. Shared by the live widget and
   * the print view.
   */
  function buildResultsTable(md, entries, records) {
    var rows = entries.map(function (entry) {
      var summary = Core.summarize(entry.spec, records && records[entry.key]);
      var confidence = summary && summary.a.confidence ? CONFIDENCE_LABELS[summary.a.confidence] : '';
      var followUp = Array.isArray(entry.spec.follow_up) && entry.spec.follow_up.length
        ? resultCell(summary, 'f') : COPY.noneAsked;
      return h('tr', {}, [
        h('th', { scope: 'row' }, md.phrase('results:' + entry.key + ':title', entry.title)),
        h('td', {}, resultCell(summary, 'a', confidence)),
        h('td', {}, resultCell(summary, 'b')),
        h('td', {}, followUp),
        h('td', {}, md.phrase('results:' + entry.key + ':hidden_by', '')),
      ]);
    });
    return h('table', { className: C + 'results-table' }, [
      h('caption', { text: COPY.resultsCaption }),
      h('thead', {}, h('tr', {}, COPY.resultsColumns.map(function (title) { return h('th', { scope: 'col', text: title }); }))),
      h('tbody', {}, rows),
    ]);
  }

  Widget.prototype._buildResultsCard = function (container, records) {
    var entries = readJson(this.host, 'script[data-diagram-challenge-results]');
    if (!Array.isArray(entries) || !entries.length) return;
    var titleId = this.id + '-results-title';
    container.appendChild(h('section', { className: C + 'results', 'aria-labelledby': titleId }, [
      h('h5', { className: C + 'subtitle', id: titleId, text: COPY.resultsTitle }),
      h('p', { className: C + 'hint', text: COPY.resultsNote }),
      buildResultsTable(this.md, entries.filter(Boolean), records),
    ]));
  };

  // ----- Shared section builder -------------------------------------------------

  Widget.prototype._sync = function () {
    var session = this.session;
    var state = session.state;
    this._syncStepper();
    this._syncPartA();
    if (state !== 'exploring') {
      this._ensureReply();
      this._syncReply();
    }
    if (session.mainVisible()) {
      this._ensurePartB();
      this._syncPartB();
    }
    if (state === 'follow-up' || state === 'done') {
      if (this.challenge.followUp.length || this.challenge.evidenceQuestions.length) {
        this._ensureFollowUp();
        this._syncFollowUp();
      }
    }
    if (state === 'done') {
      this._ensureDone();
      this._syncDone();
    }
  };

  // ----- Instructor (answer key) view ---------------------------------------------

  Widget.prototype._keyFields = function (container, questions, prefix, group) {
    var self = this;
    this._questionFields(group, questions, prefix).forEach(function (field) {
      field.showKey(self.md, questionKey(prefix, field.question));
      container.appendChild(field.fieldset);
    });
  };

  /** Instructor mode: redraw the challenge with its answer keys. */
  Widget.prototype.showAnswerKey = function () {
    if (!this.options.instructorMode || this.keysShown || this.destroyed) return false;
    // Leave the student flow: stop its clock and listeners, then redraw.
    this.session.pause(this.now());
    clearTimeout(this._textTimer);
    clearTimeout(this._budgetTimer);
    this._releaseEditor();
    this.events.abort();
    this.events = new AbortController();
    this.signal = this.events.signal;
    this.keysShown = true;
    this.mount();
    this.live.textContent = COPY.instructorKeysShown;
    return true;
  };

  Widget.prototype._renderAnswerKey = function () {
    var self = this;
    var challenge = this.challenge;
    this.body.appendChild(h('p', { className: C + 'notice', text: COPY.instructorKeysNote }));
    var partA = this._section('a', challenge.mode === 'plan-first' ? COPY.plan : COPY.partA).section;
    var attempt = challenge.attempt;
    var requires = [];
    if (attempt.hypothesis) requires.push(COPY.hypothesisLabel);
    if (attempt.evidencePins) requires.push(COPY.pinsHint(attempt.evidencePins));
    if (attempt.viewWish) requires.push(COPY.wishLabel);
    if (requires.length) {
      append(partA, [h('p', { text: COPY.attemptRequires }), h('ul', { className: C + 'files' }, requires.map(function (text) { return h('li', { text: text }); }))]);
    }
    if (challenge.mode === 'plan-first') {
      challenge.plan.forEach(function (entry, index) {
        var field = self._planField(entry, index);
        field.showKey(self.md, questionKey('p', entry));
        partA.appendChild(field.fieldset);
      });
    } else {
      this._keyFields(partA, challenge.questions, 'q', 'a');
    }
    if (challenge.predictView && challenge.expertView) {
      partA.appendChild(h('p', { className: C + 'calibration', text: COPY.expertView + (VIEW_LABELS[challenge.expertView] || challenge.expertView) + '.' }));
    }
    var reply = this._section('reply', COPY.reply).section;
    if (challenge.contrast) {
      var first = h('div', { className: C + 'card' }, h('h5', { className: C + 'subtitle', text: COPY.firstReply }));
      this._buildReplyCard(first, true);
      if (challenge.contrast.question) this._keyFields(first, [challenge.contrast.question], 'q', 'c');
      reply.appendChild(first);
    }
    var main = h('div', { className: C + 'card' });
    if (challenge.contrast) main.appendChild(h('h5', { className: C + 'subtitle', text: COPY.secondReply }));
    this._buildReplyCard(main, false);
    reply.appendChild(main);
    if (challenge.followUp.length) this._keyFields(this._section('f', COPY.followUp(challenge.followUp.length)).section, challenge.followUp, 'q', 'f');
    if (challenge.evidenceQuestions.length) {
      var evidence = this._section('e', COPY.evidenceCheck).section;
      if (this.md.has('evidence:prompt')) evidence.appendChild(h('div', { className: C + 'prompt' }, this.md.block('evidence:prompt')));
      this._keyFields(evidence, challenge.evidenceQuestions, 'q', 'e');
    }
    var done = this._section('d', COPY.done).section;
    [['debrief:hidden_by', COPY.hiddenBy], ['debrief:find_in_code', COPY.findInCode], ['debrief:view_shows', COPY.viewShows],
      ['debrief:consolidation_prompt', COPY.reflection]].forEach(function (item) {
      if (!self.md.has(item[0])) return;
      append(done, [h('h5', { className: C + 'subtitle', text: item[1] }), h('div', { className: C + 'debrief' }, self.md.block(item[0]))]);
    });
    if (challenge.mechanism) this._keyFields(done, [challenge.mechanism], 'q', 'd');
    if (challenge.mode === 'plan-first') this._buildResultsCard(done, this.records);
    this._showDiagrams(false, true);
  };

  // ----- Read-only view (instructions popout) -------------------------------------

  Widget.prototype._renderReadOnly = function () {
    var self = this;
    var session = this.session;
    var snapshot = session.snapshot();
    var notice = h('div', { className: C + 'notice' }, [
      h('p', {}, h('strong', { text: COPY.readOnlyNotice })),
      h('p', { text: session.passed ? COPY.readOnlyPassed : COPY.readOnlyStates[session.state] }),
    ]);
    if (typeof this.options.onReturn === 'function') {
      var back = button('button', COPY.returnToMain);
      back.addEventListener('click', function () { self.options.onReturn(); }, { signal: this.signal });
      notice.appendChild(h('p', { className: C + 'row' }, back));
    }
    this.body.appendChild(notice);
    if (!session.optionsVisible()) return;
    var exploring = session.state === 'exploring';
    var part = this._section('a', exploring ? COPY.partA : COPY.partB).section;
    if (this.challenge.mode === 'plan-first' && exploring) {
      this.challenge.plan.forEach(function (entry, index) {
        var field = self._planField(entry, index);
        field.setValue(snapshot.a.plan[entry.id]);
        field.setDisabled(true);
        part.appendChild(field.fieldset);
      });
      return;
    }
    var answers = exploring ? snapshot.a.answers : snapshot.b.answers;
    this._questionFields(exploring ? 'a' : 'b', this.challenge.questions, 'q').forEach(function (field) {
      field.setValue(answers[field.question.id]);
      field.setDisabled(true);
      part.appendChild(field.fieldset);
    });
  };

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function hostsWithin(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    var hosts = Array.prototype.slice.call(root.querySelectorAll(HOST_SELECTOR));
    if (root.matches && root.matches(HOST_SELECTOR)) hosts.unshift(root);
    return hosts;
  }

  function showFailure(host, error) {
    var body = host.querySelector('[data-diagram-challenge-body]') || host;
    body.replaceChildren(h('p', { className: C + 'notice', role: 'alert', text: COPY.failed }));
    console.error('Diagram challenge error:', error);
  }

  function initFrom(root, options) {
    options = options || {};
    hostsWithin(root).forEach(function (host) {
      if (widgets.has(host)) return;
      if (!Core) {
        showFailure(host, new Error('DiagramChallengeCore is not loaded.'));
        return;
      }
      try {
        var widget = new Widget(host, options);
        widgets.set(host, widget);
        widget.mount();
      } catch (error) {
        widgets.delete(host);
        showFailure(host, error);
      }
    });
    return Promise.resolve();
  }

  function showAnswerKeysWithin(root) {
    var shown = 0;
    hostsWithin(root).forEach(function (host) {
      var widget = widgets.get(host);
      if (widget && widget.showAnswerKey()) shown += 1;
    });
    return shown;
  }

  function destroyWithin(root) {
    hostsWithin(root).forEach(function (host) {
      var widget = widgets.get(host);
      if (!widget) return;
      widgets.delete(host);
      widget.destroy();
    });
  }

  /** Print view: fill results-card hosts from saved records. */
  function renderResults(root, options) {
    if (!Core || !root) return;
    var records = (options && options.records) || {};
    Array.prototype.forEach.call(root.querySelectorAll(RESULTS_SELECTOR), function (host) {
      var entries = readJson(host, 'script[data-diagram-challenge-results]');
      var target = host.querySelector('[data-diagram-challenge-results-body]');
      if (!Array.isArray(entries) || !target) return;
      entries = entries.filter(Boolean);
      var saved = entries.some(function (entry) { return records[entry.key]; });
      target.replaceChildren(saved
        ? buildResultsTable(new MarkdownLookup(host), entries, records)
        : h('p', { className: C + 'hint', text: COPY.resultsEmpty }));
    });
  }

  window.DiagramChallenge = {
    initFrom: initFrom,
    destroyWithin: destroyWithin,
    showAnswerKeysWithin: showAnswerKeysWithin,
    renderResults: renderResults,
  };
})();
