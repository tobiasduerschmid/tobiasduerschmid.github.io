/**
 * Design review (`design_review` steps): the learner reads an AI agent's
 * design (its diagrams in the Diagram pane), writes a review comment, may
 * check it with the local model, and then compares it with the expert review.
 *
 *   DesignReview.initFrom(root, {runtime, records, onRecord, instructorMode, readOnly})
 *       mount every [data-design-review] host in root; resolves when mounted
 *   DesignReview.destroyWithin(root)      save the draft, hide the diagrams
 *   DesignReview.showExpertReviewsWithin(root)   instructor mode: reveal
 *
 * The host is server-rendered by _includes/tutorial-design-review.html: the
 * case as HTML, the expert review in inert templates, the spec as JSON. Rules
 * and records come from DesignReviewCore; the model is reached through the
 * runtime's model add-on (runtime.llmAddon.reviewDesign), which announces its
 * state with `tvm:llm-state` events on the tutorial root. The model's ratings
 * are feedback only: comparing with the expert review completes the step.
 */
(function () {
  'use strict';

  var Core = window.DesignReviewCore;
  if (!Core) return;

  var DRAFT_SAVE_DELAY_MS = 600;
  var CRITERION_NAMES = { flaw: 'The flaw', consequence: 'What goes wrong', fix: 'The fix' };
  var CRITERION_PROGRESS = {
    flaw: 'Reading your comment: the flaw (1 of 3)…',
    consequence: 'Reading your comment: what goes wrong (2 of 3)…',
    fix: 'Reading your comment: the fix (3 of 3)…',
  };
  var COACHING_PROBLEMS = {
    unusable: 'The assistant’s follow-up was not usable.',
    incomplete: 'The follow-up feedback stopped before it finished.',
    unavailable: 'The follow-up feedback is unavailable.',
  };
  var DEFAULT_TASK = 'Find the flaw. Name the element of the design that is wrong, trace what goes wrong in the Given scenario, and propose a fix that removes the cause.';
  var SELF_CHECK = [
    { criterion: 'flaw', label: 'named the flaw and the element where it sits' },
    { criterion: 'consequence', label: 'traced the Given scenario to what goes wrong for the user' },
    { criterion: 'fix', label: 'proposed a fix that removes the cause, not just the symptom' },
  ];

  var instances = new Map();

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(className, text, action) {
    var node = el('button', className, text);
    node.type = 'button';
    if (action) node.setAttribute('data-action', action);
    return node;
  }

  function template(host, field) {
    var node = host.querySelector('template[data-design-review-md="' + field + '"]');
    return node ? node.content.cloneNode(true) : null;
  }

  function parseSpec(host) {
    var script = host.querySelector('script[data-design-review-spec]');
    return script ? JSON.parse(script.textContent) : {};
  }

  /** The id prefix the include gave this review (design-review-<index>). */
  function idPrefix(host) {
    var title = host.getAttribute('aria-labelledby') || 'design-review';
    return title.replace(/-title$/, '');
  }

  function stepHasFiles(runtime) {
    var step = runtime && runtime.steps && runtime.steps[runtime.currentStep];
    return !!(step && Array.isArray(step.files) && step.files.length);
  }

  function Review(host, options) {
    this.host = host;
    this.options = options;
    this.runtime = options.runtime || null;
    this.readOnly = options.readOnly === true;
    this.key = host.getAttribute('data-design-review-key');
    this.spec = parseSpec(host);
    this.record = Core.sanitizeRecord(options.records && options.records[this.key]);
    this.prefix = idPrefix(host);
    this.events = new AbortController();
    this.modelState = null;
    this.lastCheck = null;
    this.checking = false;
    this.destroyed = false;
    this.body = host.querySelector('[data-design-review-body]');
    this.build();
  }

  Review.prototype.build = function () {
    this.body.replaceChildren();
    this.body.append(this.buildWriting());
    if (!this.readOnly) {
      this.feedback = this.buildFeedback();
      this.body.append(this.feedback);
    }
    this.lesson = this.buildLesson();
    this.body.append(this.lesson);
    if (this.record.passed) this.renderLesson(false);
    if (!this.readOnly) this.watchModel();
    this.refresh();
    if (!this.readOnly) this.showDiagrams(this.record.passed);
  };

  Review.prototype.buildWriting = function () {
    var section = el('section', 'tutorial-design-review__write');
    var heading = el('h4', 'tutorial-design-review__section-title', 'Your review');
    heading.id = this.prefix + '-write';
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);

    var task = el('div', 'tutorial-design-review__task');
    task.id = this.prefix + '-task';
    task.append(template(this.host, 'task') || el('p', null, DEFAULT_TASK));
    section.append(task);

    var label = el('label', 'tutorial-design-review__label', 'Review comment');
    label.htmlFor = this.prefix + '-comment';
    section.append(label);
    var textarea = el('textarea', 'tutorial-design-review__textarea');
    textarea.id = this.prefix + '-comment';
    textarea.rows = 7;
    textarea.maxLength = Core.MAX_DRAFT_CHARS;
    textarea.spellcheck = true;
    textarea.value = this.record.draft || (this.record.checks.length ? '' : (this.spec.scaffold || ''));
    var count = el('p', 'tutorial-design-review__count');
    count.id = this.prefix + '-count';
    textarea.setAttribute('aria-describedby', task.id + ' ' + count.id);
    this.textarea = textarea;
    this.count = count;
    section.append(textarea, count);

    if (this.readOnly) {
      textarea.readOnly = true;
      section.append(el('p', 'tutorial-design-review__hint',
        'Write and check your review in the main tutorial window.'));
      return section;
    }

    var actions = el('div', 'tutorial-design-review__actions');
    this.checkButton = button('tutorial-design-review__primary', 'Check my review', 'check');
    this.compareButton = button('tutorial-design-review__button', 'Compare with the expert review', 'compare');
    actions.append(this.checkButton, this.compareButton);
    section.append(actions);
    this.availability = el('p', 'tutorial-design-review__hint tutorial-design-review__availability');
    this.availability.id = this.prefix + '-availability';
    this.checkButton.setAttribute('aria-describedby', this.availability.id);
    this.status = el('p', 'tutorial-design-review__status');
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    section.append(this.availability, this.status);

    var signal = this.events.signal;
    var self = this;
    textarea.addEventListener('input', function () { self.onInput(); }, { signal: signal });
    this.checkButton.addEventListener('click', function () { self.check(); }, { signal: signal });
    this.compareButton.addEventListener('click', function () { self.compare(); }, { signal: signal });
    return section;
  };

  Review.prototype.buildFeedback = function () {
    var section = el('section', 'tutorial-design-review__feedback');
    section.hidden = true;
    var heading = el('h4', 'tutorial-design-review__section-title', 'The review assistant’s reading');
    heading.id = this.prefix + '-feedback';
    heading.tabIndex = -1;
    section.setAttribute('aria-labelledby', heading.id);
    this.feedbackHeading = heading;
    this.stale = el('p', 'tutorial-design-review__hint tutorial-design-review__stale',
      'You have edited your comment since this check.');
    this.stale.hidden = true;
    this.ratings = el('dl', 'tutorial-design-review__ratings');
    this.coachingList = el('ul', 'tutorial-design-review__coaching');
    this.quotes = el('details', 'tutorial-design-review__quotes');
    this.quotes.append(el('summary', null, 'What the assistant found in your comment'));
    this.quoteList = el('ul');
    this.quotes.append(this.quoteList);
    var caveat = el('p', 'tutorial-design-review__hint',
      'A small model on your device reads your comment and can misread it. When you are done, compare with the expert review.');
    section.append(heading, this.stale, this.ratings, this.coachingList, this.quotes, caveat);
    return section;
  };

  Review.prototype.buildLesson = function () {
    var section = el('section', 'tutorial-design-review__lesson');
    section.hidden = true;
    return section;
  };

  /** Fill the expert review once; `focus` moves to it after a comparison. */
  Review.prototype.renderLesson = function (focus) {
    var section = this.lesson;
    if (!section.childElementCount) {
      var lesson = this.spec.lesson || {};
      var heading = el('h4', 'tutorial-design-review__section-title', 'Lesson learned: ' + (lesson.principle || 'the expert review'));
      heading.id = this.prefix + '-lesson';
      heading.tabIndex = -1;
      section.append(heading);
      section.setAttribute('aria-labelledby', heading.id);
      var definition = template(this.host, 'lesson:definition');
      if (definition) section.append(definition);
      var ask = template(this.host, 'lesson:ask');
      if (ask) {
        var askBox = el('div', 'tutorial-design-review__ask');
        askBox.append(ask);
        section.append(askBox);
      }
      [['lesson:flaw', 'The flaw'], ['lesson:fix', 'The fix']].forEach(function (part) {
        var content = template(this.host, part[0]);
        if (!content) return;
        section.append(el('h5', 'tutorial-design-review__subtitle', part[1]), content);
      }, this);
      var more = template(this.host, 'lesson:more');
      if (more) section.append(more);
      if (!this.readOnly) section.append(this.buildDiagramActions(), this.buildSelfCheck());
      if (this.readOnly && this.record.revealedDraft) {
        section.append(el('p', 'tutorial-design-review__hint', 'Compared with your comment in the main tutorial window.'));
      }
    }
    section.hidden = false;
    if (focus) section.querySelector('h4').focus();
  };

  Review.prototype.buildDiagramActions = function () {
    var actions = el('div', 'tutorial-design-review__actions');
    var self = this;
    var signal = this.events.signal;
    [['annotated', 'Show the flaw on the diagram'], ['fixed', 'Show the fixed design']].forEach(function (entry) {
      var diagram = self.spec[entry[0]];
      if (!diagram || !diagram.source) return;
      var control = button('tutorial-design-review__button', entry[1]);
      control.addEventListener('click', function () { self.showDiagramTab(self.diagramId(entry[0])); }, { signal: signal });
      actions.append(control);
    });
    return actions;
  };

  Review.prototype.buildSelfCheck = function () {
    var fieldset = el('fieldset', 'tutorial-design-review__self-check');
    fieldset.append(el('legend', null, 'Compare it with your comment. Your comment…'));
    var self = this;
    var signal = this.events.signal;
    SELF_CHECK.forEach(function (item) {
      var row = el('div', 'tutorial-design-review__self-item');
      var input = el('input');
      input.type = 'checkbox';
      input.id = self.prefix + '-self-' + item.criterion;
      input.checked = self.record.selfCheck[item.criterion] === true;
      input.addEventListener('change', function () {
        self.record.selfCheck[item.criterion] = input.checked;
        self.emit();
      }, { signal: signal });
      var label = el('label', null, item.label);
      label.htmlFor = input.id;
      row.append(input, label);
      fieldset.append(row);
    });
    return fieldset;
  };

  Review.prototype.diagramId = function (part) {
    return 'review-' + this.prefix + '-' + part;
  };

  /** The agent's diagrams; after the comparison also the annotated and fixed ones. */
  Review.prototype.paneDiagrams = function (revealed) {
    var list = (this.spec.diagrams || []).slice();
    if (revealed) {
      [['annotated', 'The flaw, annotated'], ['fixed', 'The fixed design']].forEach(function (entry) {
        var diagram = this.spec[entry[0]];
        if (!diagram || !diagram.source) return;
        list.push({
          id: this.diagramId(entry[0]),
          type: diagram.type || (list[0] && list[0].type) || 'class',
          label: diagram.label || entry[1],
          source: diagram.source,
        });
      }, this);
    }
    return list;
  };

  Review.prototype.showDiagrams = function (revealed) {
    var runtime = this.runtime;
    if (!runtime || typeof runtime.showAuthoredDiagrams !== 'function') return;
    var diagrams = this.paneDiagrams(revealed);
    if (!diagrams.length) return;
    runtime.showAuthoredDiagrams(diagrams, { layout: 'maximized', codeless: !stepHasFiles(runtime) });
    this.showingDiagrams = true;
  };

  Review.prototype.showDiagramTab = function (id) {
    var runtime = this.runtime;
    if (!runtime || typeof runtime.revealDiagramText !== 'function') return;
    runtime.revealDiagramText(id, '');
    runtime.clearDiagramTextHighlights();
  };

  /** The model add-on mounts after the tutorial starts; follow its state. */
  Review.prototype.watchModel = function () {
    var runtime = this.runtime;
    if (!runtime || !runtime.root) return;
    var self = this;
    runtime.root.addEventListener('tvm:llm-state', function (event) {
      self.modelState = event.detail || null;
      self.refresh();
    }, { signal: this.events.signal });
    if (runtime.llmAddon && typeof runtime.llmAddon.reviewState === 'function') {
      this.modelState = runtime.llmAddon.reviewState();
    }
  };

  /** Whether this page offers the local model at all (the layout includes its panel). */
  Review.prototype.modelOffered = function () {
    return !!document.getElementById('tutorial-llm-template');
  };

  Review.prototype.checkAvailability = function () {
    if (this.checking) return { enabled: false, note: '' };
    var state = this.modelState;
    if (!state) return { enabled: false, note: 'Preparing the review assistant…' };
    if (state.unavailable) return { enabled: false, note: state.unavailable + ' You can still compare with the expert review.' };
    if (state.busy) return { enabled: false, note: 'The review assistant is busy. Wait for it to finish, or cancel it below.' };
    if (!state.usable) {
      return { enabled: false, note: 'Checking needs the local model. Download it once in the Review assistant below, or compare with the expert review instead.' };
    }
    return { enabled: true, note: 'Runs on this device. Checking and follow-up feedback can take about a minute.' };
  };

  Review.prototype.refresh = function () {
    var draft = this.textarea.value;
    var own = Core.ownWordCount(this.spec, draft);
    var needed = Core.minWords(this.spec);
    if (this.readOnly) {
      this.count.textContent = own === 1 ? '1 word' : own + ' words';
      return;
    }
    var written = this.spec.scaffold ? ' of your own' : '';
    this.count.textContent = this.record.passed || own >= needed
      ? (own === 1 ? '1 word' : own + ' words') + written + ' written.'
      : own + ' of ' + needed + ' words' + written + ' written. Write at least ' + needed + ' to compare with the expert review.';
    this.compareButton.disabled = !this.record.passed && own < needed;
    this.compareButton.textContent = this.record.passed ? 'Show the expert review' : 'Compare with the expert review';
    if (!this.modelOffered()) {
      this.checkButton.hidden = true;
      this.availability.textContent = '';
      return;
    }
    var availability = this.checkAvailability();
    this.checkButton.disabled = !availability.enabled;
    this.availability.textContent = availability.note;
    if (this.stale && this.lastCheck) this.stale.hidden = this.lastCheck.review === draft;
  };

  Review.prototype.setStatus = function (text) {
    if (this.status) this.status.textContent = text;
  };

  Review.prototype.onInput = function () {
    if (this.checking && this.runtime.llmAddon) this.runtime.llmAddon.cancel();
    this.refresh();
    var self = this;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(function () { self.saveDraft(); }, DRAFT_SAVE_DELAY_MS);
  };

  Review.prototype.saveDraft = function () {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.readOnly || this.record.draft === this.textarea.value) return;
    this.record.draft = this.textarea.value;
    this.emit();
  };

  Review.prototype.emit = function () {
    if (this.readOnly || this.options.instructorMode || typeof this.options.onRecord !== 'function') return;
    this.options.onRecord(this.key, this.record);
  };

  Review.prototype.check = async function () {
    var addon = this.runtime && this.runtime.llmAddon;
    if (!addon || this.checking || !this.checkAvailability().enabled) return;
    var review = this.textarea.value;
    if (Core.wordCount(review) < 3) {
      this.setStatus('Write your review comment first.');
      return;
    }
    this.saveDraft();
    this.checking = true;
    this.refresh();
    var self = this;
    this.setStatus('Reading your comment with the local model…');
    try {
      var result = await addon.reviewDesign({
        spec: this.spec,
        review: review,
        hints: Core.coaching(this.spec, {}, this.record.checks.length + 1),
        onCriterion: function (criterion) { if (!self.destroyed) self.setStatus(CRITERION_PROGRESS[criterion]); },
        onCoaching: function () { if (!self.destroyed) self.setStatus('Preparing a question for your next revision…'); },
      });
      if (this.destroyed || !result) return;
      if (this.textarea.value !== review) {
        this.setStatus('Your comment changed during the check. Check again for feedback on the revision.');
        return;
      }
      this.record = Core.addCheck(this.record, result);
      this.lastCheck = { result: result, review: review };
      this.renderFeedback(result, review);
      this.emit();
      this.setStatus('Check finished. Correctness: ' + Core.ratingLabel('correctness', result.ratings.correctness) +
        '. Convincingness: ' + Core.ratingLabel('convincingness', result.ratings.convincingness) + '.');
      this.feedbackHeading.focus();
    } catch (error) {
      if (this.destroyed) return;
      this.setStatus(error && error.name === 'AbortError'
        ? 'Check cancelled. Your comment is unchanged.'
        : (error && error.message ? error.message : 'The check could not finish.') + ' Your comment is unchanged.');
    } finally {
      this.checking = false;
      if (!this.destroyed) this.refresh();
    }
  };

  function ratingRow(axis, level) {
    var row = el('div', 'tutorial-design-review__rating tutorial-design-review__rating--' + level);
    row.append(el('dt', null, axis === 'correctness' ? 'Correctness' : 'Convincingness'));
    var value = el('dd');
    var meter = el('span', 'tutorial-design-review__meter');
    meter.setAttribute('aria-hidden', 'true');
    var marks = Core.ratingMarks(axis, level);
    for (var i = 0; i < 2; i++) meter.append(el('span', 'tutorial-design-review__mark' + (i < marks ? ' tutorial-design-review__mark--on' : '')));
    value.append(meter, el('strong', null, Core.ratingLabel(axis, level)), document.createTextNode(' '),
      el('span', 'tutorial-design-review__explanation', Core.ratingExplanation(axis, level)));
    row.append(value);
    return row;
  }

  Review.prototype.renderFeedback = function (result, review) {
    this.ratings.replaceChildren(ratingRow('correctness', result.ratings.correctness),
      ratingRow('convincingness', result.ratings.convincingness));
    this.coachingList.replaceChildren();
    var attempt = this.record.checks.length;
    var lines = Core.coaching(this.spec, result.verdicts, attempt);
    if (result.coaching) {
      const coaching = result.coaching;
      const item = el('li');
      item.append(el('strong', null, coaching.status === 'generated' ? 'Feedback for your next revision: ' : 'Course hints: '),
        document.createTextNode(coaching.status === 'generated' ? coaching.text :
          (COACHING_PROBLEMS[coaching.reason] || COACHING_PROBLEMS.unavailable) +
          ' Use the hints below, revise your comment, and check again.'));
      this.coachingList.append(item);
      // The small model can ask a less precise question than the course hint.
      // Keep that authored guidance available even after a usable generation.
      if (!lines.length) lines.push(coaching.hint);
    }
    var self = this;
    lines.forEach(function (line) {
      var item = el('li');
      item.append(el('strong', null, (CRITERION_NAMES[line.criterion] || 'Diagram evidence') + ': '), document.createTextNode(line.text));
      self.coachingList.append(item);
    });
    Core.wrongClaimNotes(this.spec, review, result.verdicts).forEach(function (note) {
      var item = el('li', 'tutorial-design-review__claim');
      item.append(el('strong', null, 'About your claim: '), document.createTextNode(note));
      self.coachingList.append(item);
    });
    if (result.unread && result.unread.length) {
      this.coachingList.append(el('li', null, 'The assistant’s answer about ' +
        result.unread.map(function (name) { return CRITERION_NAMES[name].toLowerCase(); }).join(' and ') +
        ' could not be read, so it counts as not found. Check again, or compare with the expert review.'));
    }
    if (!lines.length && !result.coaching) {
      this.coachingList.append(el('li', null, 'Your comment names the flaw, traces what goes wrong, and fixes the cause. Compare it with the expert review to check the details.'));
    }
    this.quoteList.replaceChildren();
    Object.keys(CRITERION_NAMES).forEach(function (criterion) {
      var quote = result.quotes && result.quotes[criterion];
      var item = el('li');
      item.append(el('strong', null, CRITERION_NAMES[criterion] + ': '),
        document.createTextNode(quote ? '“' + quote + '”' : 'not found'));
      self.quoteList.append(item);
    });
    this.feedback.hidden = false;
    this.stale.hidden = true;
  };

  Review.prototype.compare = function () {
    if (!this.record.passed) {
      if (!Core.canCompare(this.spec, this.textarea.value)) return;
      clearTimeout(this.saveTimer);
      this.record = Core.reveal(this.record, this.spec, this.textarea.value);
      this.emit();
      this.showDiagrams(true);
      this.refresh();
    }
    this.renderLesson(true);
  };

  /** Instructor mode: the expert review without a comparison or a record. */
  Review.prototype.showExpertReview = function () {
    this.renderLesson(false);
    this.showDiagrams(true);
  };

  Review.prototype.destroy = function () {
    if (this.destroyed) return;
    if (this.saveTimer) this.saveDraft();
    this.destroyed = true;
    this.events.abort();
    if (this.showingDiagrams && this.runtime && typeof this.runtime.hideAuthoredDiagrams === 'function') {
      this.runtime.hideAuthoredDiagrams();
    }
    this.body.replaceChildren();
  };

  function hostsWithin(root) {
    if (!root) return [];
    var hosts = Array.prototype.slice.call(root.querySelectorAll('[data-design-review]'));
    if (root.matches && root.matches('[data-design-review]')) hosts.unshift(root);
    return hosts;
  }

  function initFrom(root, options) {
    options = options || {};
    hostsWithin(root).forEach(function (host) {
      if (instances.has(host)) instances.get(host).destroy();
      try {
        instances.set(host, new Review(host, options));
      } catch (error) {
        var body = host.querySelector('[data-design-review-body]');
        if (body) body.replaceChildren(el('p', 'tutorial-design-review__status', 'This review could not load: ' + error.message));
      }
    });
    return Promise.resolve();
  }

  function destroyWithin(root) {
    hostsWithin(root).forEach(function (host) {
      var review = instances.get(host);
      if (!review) return;
      review.destroy();
      instances.delete(host);
    });
  }

  function showExpertReviewsWithin(root) {
    hostsWithin(root).forEach(function (host) {
      var review = instances.get(host);
      if (review) review.showExpertReview();
    });
  }

  window.DesignReview = {
    initFrom: initFrom,
    destroyWithin: destroyWithin,
    showExpertReviewsWithin: showExpertReviewsWithin,
  };
})();
