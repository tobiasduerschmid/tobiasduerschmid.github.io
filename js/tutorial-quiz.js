/**
 * SebookQuiz — shared quiz renderer + interaction engine.
 *
 * Used by tutorial-code.js (main view) AND the instructions popup HTML
 * so quizzes work identically in both windows. NO duplication.
 *
 * Public API:
 *   SebookQuiz.shuffle(arr)          → in-place Fisher-Yates
 *   SebookQuiz.buildHTML(opts)       → string of quiz HTML
 *     opts: { stepIndex, quiz, escapeHtml, renderMarkdown }
 *   SebookQuiz.attach(opts)          → attach behaviour to a host already
 *                                      containing the quiz HTML.
 *     opts: { hostEl, controlsEl, stepIndex, minScore, onPass, onClose }
 *   SebookQuiz.mount(opts)           → buildHTML + setInnerHTML + attach
 *     opts: same as buildHTML + attach combined.
 *
 * The host (main or popup) is responsible for:
 *   - Showing/hiding the quiz panel and the step content panel
 *   - Tracking quizPassed + advancing to the next step on onPass
 *   - Optional: rendering question markdown via renderMarkdown helper
 */
(function () {
  'use strict';

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function _identityEscape(s) {
    var d = document.createElement('div'); d.textContent = s == null ? '' : String(s);
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _identityMarkdown(s) {
    if (window.marked && window.marked.parse) return window.marked.parse(s || '');
    return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '<br><br>');
  }
  function enterKeyLabel() {
    var platform = '';
    if (navigator.userAgentData && navigator.userAgentData.platform) platform = navigator.userAgentData.platform;
    else platform = navigator.platform || '';
    return /Mac|iPhone|iPad|iPod/i.test(platform) ? 'Return' : 'Enter';
  }
  function buildAnswerShortcutHint(count, isMultiple) {
    var pairs = [];
    for (var i = 0; i < count && i < ALPHABET.length; i++) {
      var label = ALPHABET[i];
      var number = i < 9 ? '<span class="key-sep">/</span><kbd>' + (i + 1) + '</kbd>' : '';
      pairs.push('<span class="quiz-shortcut-pair"><kbd>' + label + '</kbd>' + number + '</span>');
    }
    if (!pairs.length) return '';
    return '<p class="quiz-shortcuts-hint">Shortcuts: '
      + pairs.join('<span class="shortcut-list-sep"> </span>')
      + ' select answers' + (isMultiple ? '; <kbd>' + enterKeyLabel() + '</kbd> submits.' : '.') + '</p>';
  }
  function buildNextShortcutHint() {
    return '<p class="quiz-next-shortcut-hint">Shortcut: <kbd>' + enterKeyLabel()
      + '</kbd> moves to the next question.</p>';
  }
  function buildParsonsShortcutHint(count) {
    var keys = [];
    for (var i = 0; i < count && i < 9; i++) {
      keys.push('<kbd>' + (i + 1) + '</kbd>');
    }
    if (!keys.length) return '';
    return '<p class="parsons-shortcuts-hint">Shortcuts: '
      + keys.join('<span class="shortcut-list-sep"> </span>')
      + ' move numbered lines; <kbd>' + enterKeyLabel() + '</kbd> checks the order.</p>';
  }

  // ---------------------------------------------------------------------------
  // HTML builder
  // ---------------------------------------------------------------------------
  function buildHTML(opts) {
    var stepIndex = opts.stepIndex;
    var quiz = opts.quiz;
    var escapeHtml = opts.escapeHtml || _identityEscape;
    var renderMarkdown = opts.renderMarkdown || _identityMarkdown;
    var doShuffle = quiz.shuffle !== false;
    var minPct = Math.round((quiz.min_score !== undefined ? quiz.min_score : 0.8) * 100);
    var nextStepNum = stepIndex + 2;
    var isFinalQuiz = !!opts.isFinalQuiz;

    function appendAnswerBadges(labels, noteText) {
      if (!labels.length) return '';
      var html = '';
      if (noteText) html += '<span class="optional-answer-note">' + escapeHtml(noteText) + '</span>';
      html += labels.map(function (label) {
        return '<span class="correct-label-badge">' + label + '</span>';
      }).join('');
      return html;
    }

    var questions = (quiz.questions || []).map(function (q) {
      if (q.type === 'parsons') {
        var allLines = (q.lines || []).slice();
        var distractors = (q.distractors || []);
        var correctOrder = allLines.slice();
        var items = allLines.map(function (line, i) {
          return { line: line, correctPos: i, isDistractor: false };
        }).concat(distractors.map(function (line) {
          return { line: line, correctPos: -1, isDistractor: true };
        }));
        shuffle(items);
        return {
          question: q.question || '', type: 'parsons', explanation: q.explanation || '',
          shuffledItems: items, correctOrder: correctOrder, distractors: distractors,
          options: [], correctOriginals: [], correctLabels: [],
        };
      }
      var opts2 = (q.options || []).map(function (text, oi) { return { text: text, originalIndex: oi }; });
      if (doShuffle) shuffle(opts2);
      var correctOriginals = q.type === 'multiple'
        ? (q.correct_indices || []).map(String).sort() : [String(q.correct_index || 0)];
      var optionalOriginals = q.type === 'multiple'
        ? (q.optional_indices || []).map(String).sort() : [];
      var correctLabels = [];
      var optionalLabels = [];
      opts2.forEach(function (opt, oi) {
        if (correctOriginals.indexOf(String(opt.originalIndex)) !== -1) correctLabels.push(ALPHABET[oi]);
        if (optionalOriginals.indexOf(String(opt.originalIndex)) !== -1) optionalLabels.push(ALPHABET[oi]);
      });
      return {
        question: q.question || '', type: q.type || 'single', explanation: q.explanation || '',
        options: opts2, correctOriginals: correctOriginals, optionalOriginals: optionalOriginals,
        correctLabels: correctLabels, optionalLabels: optionalLabels,
        option_feedback: q.option_feedback || null,
      };
    });
    if (doShuffle) shuffle(questions);

    var html = '<div class="tvm-quiz-gate-header"><span class="tvm-quiz-gate-icon">&#128203;</span>'
      + '<div>' + (isFinalQuiz
        ? '<strong>Final Knowledge Check</strong><p>Score ≥' + minPct + '% to complete the tutorial</p>'
        : '<strong>Knowledge Check</strong><p>Score ≥' + minPct + '% to continue to Step ' + nextStepNum + '</p>')
      + '</div></div>';

    html += '<div class="quiz-container" id="tvm-quiz-' + stepIndex + '">';
    html += '<div class="quiz-header">';
    if (quiz.title) html += '<div class="quiz-title-row"><h2>' + escapeHtml(quiz.title) + '</h2></div>';
    html += '<div class="quiz-progress-bar"><div class="progress-fill" style="width:0%"></div></div></div>';
    html += '<div class="quiz-questions">';
    questions.forEach(function (q, qi) {
      html += '<div class="quiz-question-card' + (qi === 0 ? ' active' : '')
        + '" data-question-index="' + qi + '" data-type="' + q.type + '">';
      html += '<div class="question-text">' + renderMarkdown(q.question) + '</div>';

      if (q.type === 'parsons') {
        html += '<div class="parsons-container">';
        html += '<div class="parsons-label">Drag lines into the solution area in the correct order'
          + (q.distractors.length ? ' (some lines are distractors that should not be used)' : '') + ':</div>';
        html += '<div class="parsons-bank" data-qi="' + qi + '">';
        q.shuffledItems.forEach(function (item, itemIndex) {
          var shortcut = itemIndex < 9 ? String(itemIndex + 1) : '';
          html += '<div class="parsons-line" draggable="true" data-line="'
            + escapeHtml(item.line) + '" data-distractor="' + item.isDistractor
            + '" data-correct-pos="' + item.correctPos + '"'
            + (shortcut ? ' data-shortcut-index="' + shortcut + '" aria-keyshortcuts="' + shortcut + ' Space"' : ' aria-keyshortcuts="Space"')
            + ' tabindex="0" role="button" aria-label="' + escapeHtml('Line ' + (itemIndex + 1) + ': ' + item.line) + '">'
            + '<span class="parsons-shortcut-label" aria-hidden="true">' + (itemIndex + 1) + '</span>'
            + '<span class="parsons-grip">&#8942;&#8942;</span>'
            + '<code>' + escapeHtml(item.line) + '</code></div>';
        });
        html += '</div>';
        html += '<div class="parsons-separator"><span>&#8595; Drop here &#8595;</span></div>';
        html += '<div class="parsons-target" data-qi="' + qi + '"></div>';
        html += '<div class="parsons-actions">'
          + '<button class="parsons-check-btn" data-qi="' + qi + '">Check Order</button>'
          + '<button class="parsons-reset-btn" data-qi="' + qi + '">Reset</button></div>';
        html += '</div>';
        html += buildParsonsShortcutHint(q.shuffledItems.length);
        html += '<div class="parsons-correct-data hidden" data-correct="'
          + escapeHtml(JSON.stringify(q.correctOrder)) + '"></div>';
        html += '<div class="quiz-correct-answers">Correct order:<br><span class="correct-labels"><code>'
          + q.correctOrder.map(function (l) { return escapeHtml(l); }).join('</code><br><code>')
          + '</code></span></div>';
      } else {
        var optionFeedback = q.option_feedback || {};
        html += '<div class="quiz-options" role="' + (q.type === 'multiple' ? 'group' : 'radiogroup') + '" aria-label="Answer options">';
        q.options.forEach(function (opt, oi) {
          html += '<button class="quiz-option" role="' + (q.type === 'multiple' ? 'checkbox' : 'radio') + '" aria-checked="false" data-index="' + String(opt.originalIndex) + '"'
            + ' data-correct="' + q.correctOriginals[0] + '"'
            + ' data-correct-indices="' + q.correctOriginals.join(',') + '"'
            + ' data-optional-indices="' + q.optionalOriginals.join(',') + '"'
            + ' aria-keyshortcuts="' + ALPHABET[oi] + (oi < 9 ? ' ' + (oi + 1) : '') + '">'
            + '<span class="option-checkbox"></span><span class="option-label">' + ALPHABET[oi] + '</span>'
            + '<span class="option-content">' + renderMarkdown(opt.text) + '</span></button>';
          var fb = optionFeedback[opt.originalIndex];
          if (fb == null) fb = optionFeedback[String(opt.originalIndex)];
          if (fb) {
            html += '<div class="option-feedback is-hidden" role="note" data-for-index="'
              + String(opt.originalIndex) + '">' + renderMarkdown(fb) + '</div>';
          }
        });
        html += '</div>';
        if (q.type === 'multiple') html += '<button class="submit-answer-btn" disabled aria-keyshortcuts="Enter">Submit Answer</button>';
        html += buildAnswerShortcutHint(q.options.length, q.type === 'multiple');
        html += '<div class="quiz-correct-answers">Correct Answer'
          + (q.type === 'multiple' ? 's' : '') + ': <span class="correct-labels">'
          + appendAnswerBadges(q.correctLabels)
          + appendAnswerBadges(q.optionalLabels, 'Optional:')
          + '</span></div>';
      }
      html += '<div class="quiz-explanation hidden"><div class="explanation-title">Explanation</div>'
        + '<div class="explanation-text">' + renderMarkdown(q.explanation) + '</div>'
        + '<button class="next-btn">' + (qi < questions.length - 1 ? 'Next Question' : 'See Results') + '</button>'
        + buildNextShortcutHint() + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="quiz-results hidden"><div class="results-content">'
      + '<h4>Knowledge Check Complete!</h4>'
      + '<div class="score-display">Your Score: <span class="current-score">0</span>'
      + '<span style="font-size:0.95em;font-weight:400;"> / ' + questions.length + '</span></div>'
      + '<p class="score-summary"></p><div class="tvm-quiz-threshold">Passing score: ' + minPct + '%</div>'
      + '<div class="results-actions">'
      + (isFinalQuiz ? '' : '<button class="tvm-quiz-continue-btn hidden">Continue to Step ' + nextStepNum + ' →</button>')
      + '<button class="restart-btn">Try Again</button></div>'
      + '<p class="quiz-result-shortcut-hint hidden"></p></div></div></div>';
    html += '<div class="tvm-quiz-avatar-wrap" aria-hidden="true" style="display:none"></div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Behaviour attachment — wires up clicks, drag/drop, scoring, completion.
  // ---------------------------------------------------------------------------
  function attach(opts) {
    var hostEl = opts.hostEl;
    var controlsEl = opts.controlsEl;
    var stepIndex = opts.stepIndex;
    var minScore = (opts.minScore !== undefined && opts.minScore !== null) ? opts.minScore : 0.8;
    var onPass = opts.onPass || function () {};
    var isFinalQuiz = !!opts.isFinalQuiz;

    var container = hostEl && hostEl.querySelector('.quiz-container');
    if (!container) return;

    function parseIndexList(value) {
      if (!value) return [];
      return value.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    }
    function isAcceptedMultiple(selectedIndices, requiredIndices, optionalIndices) {
      var selectedSet = new Set(selectedIndices);
      var allowed = new Set(requiredIndices.concat(optionalIndices));
      return requiredIndices.every(function (i) { return selectedSet.has(i); })
          && selectedIndices.every(function (i) { return allowed.has(i); });
    }
    function statusEl() { return controlsEl && controlsEl.querySelector('.tvm-quiz-status'); }
    function isEditableShortcutTarget(target) {
      if (!target) return false;
      var tag = (target.tagName || '').toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
    }
    function answerShortcutIndex(e) {
      if (!e || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return -1;
      if (isEditableShortcutTarget(e.target)) return -1;
      var key = e.key || '';
      if (/^[1-9]$/.test(key)) return parseInt(key, 10) - 1;
      if (key.length === 1) {
        var upper = key.toUpperCase();
        if (/^[A-Z]$/.test(upper)) return upper.charCodeAt(0) - 65;
      }
      return -1;
    }
    function setShortcutHintVisible(card, visible) {
      var hint = card && card.querySelector('.quiz-shortcuts-hint');
      if (hint) hint.classList.toggle('hidden', !visible);
    }
    function submitMultipleShortcut(e, card) {
      if (!e || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isEditableShortcutTarget(e.target)) return false;
      if ((e.key || '') !== 'Enter') return false;
      if (!card || card.dataset.type !== 'multiple') return false;
      if (card.querySelector('.quiz-explanation:not(.hidden)')) return false;
      var sub = card.querySelector('.submit-answer-btn');
      if (!sub || sub.disabled || sub.classList.contains('hidden')) return false;
      e.preventDefault();
      sub.click();
      return true;
    }
    function nextQuestionShortcut(e, card) {
      if (!e || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isEditableShortcutTarget(e.target)) return false;
      if ((e.key || '') !== 'Enter') return false;
      if (!card || !card.querySelector('.quiz-explanation:not(.hidden)')) return false;
      var next = card.querySelector('.next-btn');
      if (!next) return false;
      e.preventDefault();
      next.click();
      return true;
    }
    function focusNextQuestionButton(card) {
      var next = card && card.querySelector('.next-btn');
      if (!next || typeof next.focus !== 'function') return;
      setTimeout(function () {
        try { next.focus({ preventScroll: true }); }
        catch (err) { next.focus(); }
      }, 0);
    }
    function focusQuizAction(button) {
      if (!button || typeof button.focus !== 'function') return;
      setTimeout(function () {
        try { button.focus({ preventScroll: true }); }
        catch (err) { button.focus(); }
      }, 0);
    }
    function moveParsonsLine(line, card) {
      if (!line || !card || card.querySelector('.quiz-explanation:not(.hidden)')) return false;
      var parent = line.parentElement;
      if (!parent) return false;
      if (parent.classList.contains('parsons-bank')) {
        var target = card.querySelector('.parsons-target');
        if (target) target.appendChild(line);
      } else if (parent.classList.contains('parsons-target')) {
        var bank = card.querySelector('.parsons-bank');
        if (bank) bank.appendChild(line);
      } else {
        return false;
      }
      if (typeof line.focus === 'function') {
        try { line.focus({ preventScroll: true }); }
        catch (err) { line.focus(); }
      }
      return true;
    }
    function parsonsShortcut(e, card) {
      if (!e || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isEditableShortcutTarget(e.target)) return false;
      if (!card || card.dataset.type !== 'parsons') return false;
      if (card.querySelector('.quiz-explanation:not(.hidden)')) return false;
      var key = e.key || '';
      if (key === 'Enter') {
        var check = card.querySelector('.parsons-check-btn');
        if (!check || check.disabled) return false;
        e.preventDefault();
        check.click();
        return true;
      }
      if (key === ' ' || key === 'Spacebar') {
        var focusedLine = e.target && e.target.closest ? e.target.closest('.parsons-line') : null;
        if (!focusedLine) return false;
        e.preventDefault();
        return moveParsonsLine(focusedLine, card);
      }
      if (/^[1-9]$/.test(key)) {
        var line = card.querySelector('.parsons-line[data-shortcut-index="' + key + '"]');
        if (!line) return false;
        e.preventDefault();
        return moveParsonsLine(line, card);
      }
      return false;
    }
    function focusActiveAnswer() {
      if (typeof document.hasFocus === 'function' && !document.hasFocus()) return;
      var card = cards[currentQ];
      if (!card || !card.classList.contains('active')) return;
      var target = card.querySelector('.quiz-option:not([disabled])') || card.querySelector('.parsons-line');
      if (!target || typeof target.focus !== 'function') return;
      setTimeout(function () {
        try { target.focus({ preventScroll: true }); }
        catch (err) { target.focus(); }
      }, 0);
    }

    var progressBar = container.querySelector('.progress-fill');
    var resultsArea = container.querySelector('.quiz-results');
    var scoreDisplay = container.querySelector('.current-score');
    var cards = container.querySelectorAll('.quiz-question-card');
    var total = cards.length, currentQ = 0, score = 0;

    function updateProgress() {
      if (progressBar) progressBar.style.width = (currentQ / total * 100) + '%';
      var s = statusEl();
      if (s) s.textContent = 'Question ' + (currentQ + 1) + ' / ' + total;
    }
    function showQ(idx) {
      cards.forEach(function (c) { c.classList.remove('active'); });
      if (cards[idx]) cards[idx].classList.add('active');
      var sub = cards[idx] && cards[idx].querySelector('.submit-answer-btn');
      if (sub) sub.disabled = true;
      updateProgress();
      if (hostEl) hostEl.scrollTop = 0;
      focusActiveAnswer();
    }
    function revealOptionFeedback(card, idx) {
      var fb = card.querySelector('.option-feedback[data-for-index="' + idx + '"]');
      if (fb) fb.classList.remove('is-hidden');
    }
    function validateSingle(opt, card) {
      var optionsEls = card.querySelectorAll('.quiz-option');
      var exp = card.querySelector('.quiz-explanation');
      var ca = card.querySelector('.quiz-correct-answers');
      var ok = opt.dataset.correct === opt.dataset.index;
      optionsEls.forEach(function (o) { o.setAttribute('disabled', 'true'); });
      if (ok) { opt.classList.add('correct'); score++; if (typeof window.spawnConfettiIfMore === 'function') window.spawnConfettiIfMore(opt); }
      else {
        opt.classList.add('incorrect');
        var correct = null;
        for (var i = 0; i < optionsEls.length; i++) {
          if (optionsEls[i].dataset.index === opt.dataset.correct) { correct = optionsEls[i]; break; }
        }
        if (correct) correct.classList.add('correct');
        revealOptionFeedback(card, opt.dataset.index);
      }
      setShortcutHintVisible(card, false);
      if (ca) ca.style.display = 'flex';
      if (exp) exp.classList.remove('hidden');
      focusNextQuestionButton(card);
    }
    function handleOption(e) {
      var opt = e.currentTarget;
      var card = opt.closest('.quiz-question-card');
      if (!card || card.querySelector('.quiz-explanation:not(.hidden)')) return;
      if (card.dataset.type === 'multiple') {
        opt.classList.toggle('selected');
        opt.setAttribute('aria-checked', opt.classList.contains('selected') ? 'true' : 'false');
        var sub = card.querySelector('.submit-answer-btn');
        if (sub) sub.disabled = (card.querySelectorAll('.quiz-option.selected').length === 0);
      } else {
        card.querySelectorAll('.quiz-option').forEach(function (o) { o.setAttribute('aria-checked', 'false'); });
        opt.setAttribute('aria-checked', 'true');
        validateSingle(opt, card);
      }
    }
    function handleSubmit(e) {
      var card = e.currentTarget.closest('.quiz-question-card');
      var optionsEls = card.querySelectorAll('.quiz-option');
      var sel = card.querySelectorAll('.quiz-option.selected');
      var exp = card.querySelector('.quiz-explanation');
      var ca = card.querySelector('.quiz-correct-answers');
      var selI = Array.prototype.map.call(sel, function (o) { return o.dataset.index; }).sort();
      var first = card.querySelector('.quiz-option');
      var corI = parseIndexList(first.dataset.correctIndices);
      var optI = parseIndexList(first.dataset.optionalIndices);
      var correctSet = new Set(corI);
      var optionalSet = new Set(optI);
      var allowedSet = new Set(corI.concat(optI));
      optionsEls.forEach(function (o) { o.setAttribute('disabled', 'true'); });
      e.currentTarget.classList.add('hidden');
      if (isAcceptedMultiple(selI, corI, optI)) {
        sel.forEach(function (o) { o.classList.add('correct'); });
        score++;
        if (typeof window.spawnConfettiIfMore === 'function') window.spawnConfettiIfMore(card);
      } else {
        optionsEls.forEach(function (o) {
          var isSel = o.classList.contains('selected');
          var commissionErr = isSel && !allowedSet.has(o.dataset.index);
          var omissionErr = !isSel && correctSet.has(o.dataset.index);
          if (correctSet.has(o.dataset.index) || (isSel && optionalSet.has(o.dataset.index))) {
            o.classList.add('correct');
          } else if (commissionErr) {
            o.classList.add('incorrect');
          }
          if (commissionErr || omissionErr) {
            revealOptionFeedback(card, o.dataset.index);
          }
        });
      }
      setShortcutHintVisible(card, false);
      if (ca) ca.style.display = 'flex';
      if (exp) exp.classList.remove('hidden');
      focusNextQuestionButton(card);
    }
    function nextQ() { currentQ++; if (currentQ < total) showQ(currentQ); else finishQuiz(); }
    function finishQuiz() {
      cards.forEach(function (c) { c.classList.remove('active'); });
      if (resultsArea) resultsArea.classList.remove('hidden');
      if (scoreDisplay) scoreDisplay.textContent = score;
      if (progressBar) progressBar.style.width = '100%';
      var st = statusEl();
      var passed = (score / total) >= minScore;
      var summary = container.querySelector('.score-summary');
      var contBtn = container.querySelector('.tvm-quiz-continue-btn');
      var restBtn = container.querySelector('.restart-btn');
      var resultHint = container.querySelector('.quiz-result-shortcut-hint');
      var focusBtn = null;
      if (passed) {
        if (summary) summary.textContent = isFinalQuiz
          ? 'Tutorial complete — great job!'
          : "Great job! You're ready for the next step.";
        if (contBtn) contBtn.classList.remove('hidden');
        if (restBtn) restBtn.classList.add('hidden');
        if (st) st.textContent = isFinalQuiz ? '✓ Tutorial Complete' : '✓ Passed';
        if (resultHint) {
          if (contBtn) {
            resultHint.innerHTML = 'Shortcut: <kbd>' + enterKeyLabel() + '</kbd> continues.';
            resultHint.classList.remove('hidden');
          } else {
            resultHint.textContent = '';
            resultHint.classList.add('hidden');
          }
        }
        if (contBtn) focusBtn = contBtn;
        if (isFinalQuiz) onPass(stepIndex);
      } else {
        var needed = Math.round(minScore * total);
        if (summary) summary.textContent = 'You scored ' + score + '/' + total + '. Need at least '
          + needed + ' (' + Math.round(minScore * 100) + '%) to continue. Review and try again!';
        if (contBtn) contBtn.classList.add('hidden');
        if (restBtn) restBtn.classList.remove('hidden');
        if (st) st.textContent = '✗ ' + score + '/' + total;
        if (resultHint) {
          resultHint.innerHTML = 'Shortcut: <kbd>' + enterKeyLabel() + '</kbd> tries again.';
          resultHint.classList.remove('hidden');
        }
        focusBtn = restBtn;
      }
      if (hostEl) hostEl.scrollTop = 0;
      focusQuizAction(focusBtn);
    }
    function restartQuiz() {
      currentQ = 0; score = 0;
      if (resultsArea) resultsArea.classList.add('hidden');
      cards.forEach(function (card) {
        var optionsEls = card.querySelectorAll('.quiz-option');
        var exp = card.querySelector('.quiz-explanation');
        var sub = card.querySelector('.submit-answer-btn');
        var ca = card.querySelector('.quiz-correct-answers');
        optionsEls.forEach(function (o) {
          o.classList.remove('correct', 'incorrect', 'selected');
          if (o.hasAttribute('aria-checked')) o.setAttribute('aria-checked', 'false');
          o.removeAttribute('disabled');
        });
        card.querySelectorAll('.option-feedback').forEach(function (el) {
          el.classList.add('is-hidden');
        });
        if (exp) exp.classList.add('hidden');
        if (sub) { sub.classList.remove('hidden'); sub.disabled = true; }
        if (ca) ca.style.display = '';
        setShortcutHintVisible(card, true);
        // Reset Parsons
        var bank = card.querySelector('.parsons-bank');
        var target = card.querySelector('.parsons-target');
        if (bank && target) {
          target.querySelectorAll('.parsons-line').forEach(function (el) {
            el.classList.remove('parsons-correct', 'parsons-incorrect');
            el.setAttribute('draggable', 'true');
            bank.appendChild(el);
          });
          bank.querySelectorAll('.parsons-line').forEach(function (el) {
            el.classList.remove('parsons-correct', 'parsons-incorrect');
            el.setAttribute('draggable', 'true');
          });
          var checkBtn = card.querySelector('.parsons-check-btn');
          var resetBtn = card.querySelector('.parsons-reset-btn');
          if (checkBtn) checkBtn.disabled = false;
          if (resetBtn) resetBtn.disabled = false;
        }
      });
      showQ(0);
    }

    container.querySelectorAll('.quiz-option').forEach(function (b) { b.addEventListener('click', handleOption); });
    container.querySelectorAll('.submit-answer-btn').forEach(function (b) { b.addEventListener('click', handleSubmit); });
    container.querySelectorAll('.next-btn').forEach(function (b) { b.addEventListener('click', nextQ); });
    container.addEventListener('keydown', function (e) {
      var card = cards[currentQ];
      if (!card || !card.classList.contains('active')) return;
      if (nextQuestionShortcut(e, card)) return;
      if (parsonsShortcut(e, card)) return;
      if (submitMultipleShortcut(e, card)) return;
      var idx = answerShortcutIndex(e);
      if (idx < 0) return;
      if (card.dataset.type !== 'single' && card.dataset.type !== 'multiple') return;
      if (card.querySelector('.quiz-explanation:not(.hidden)')) return;
      var options = card.querySelectorAll('.quiz-option');
      if (idx >= options.length) return;
      e.preventDefault();
      if (typeof options[idx].focus === 'function') {
        try { options[idx].focus({ preventScroll: true }); }
        catch (err) { options[idx].focus(); }
      }
      options[idx].click();
    });
    var rBtn = container.querySelector('.restart-btn');
    if (rBtn) rBtn.addEventListener('click', restartQuiz);
    var cBtn = container.querySelector('.tvm-quiz-continue-btn');
    if (cBtn) cBtn.addEventListener('click', function () { onPass(stepIndex); });

    // ── Parsons Problem drag-and-drop ────────────────────────────────────
    var parsonsDragEl = null;
    container.addEventListener('dragstart', function (e) {
      if (e.target.classList.contains('parsons-line')) {
        parsonsDragEl = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    container.addEventListener('dragend', function (e) {
      if (e.target.classList.contains('parsons-line')) {
        e.target.classList.remove('dragging');
        parsonsDragEl = null;
      }
    });
    container.addEventListener('dragover', function (e) {
      var zone = e.target.closest('.parsons-target') || e.target.closest('.parsons-bank');
      if (zone && parsonsDragEl) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var afterEl = _getParsonsInsertAfter(zone, e.clientY);
        if (afterEl) zone.insertBefore(parsonsDragEl, afterEl);
        else zone.appendChild(parsonsDragEl);
      }
    });
    container.addEventListener('drop', function (e) {
      var zone = e.target.closest('.parsons-target') || e.target.closest('.parsons-bank');
      if (zone && parsonsDragEl) {
        e.preventDefault();
        var afterEl = _getParsonsInsertAfter(zone, e.clientY);
        if (afterEl) zone.insertBefore(parsonsDragEl, afterEl);
        else zone.appendChild(parsonsDragEl);
      }
    });
    container.addEventListener('click', function (e) {
      var line = e.target.closest('.parsons-line');
      if (!line) return;
      var parent = line.parentElement;
      if (!parent) return;
      var card = line.closest('.quiz-question-card');
      if (!card || card.querySelector('.quiz-explanation:not(.hidden)')) return;
      if (parent.classList.contains('parsons-bank')) {
        var tgt = card.querySelector('.parsons-target');
        if (tgt) tgt.appendChild(line);
      } else if (parent.classList.contains('parsons-target')) {
        var bnk = card.querySelector('.parsons-bank');
        if (bnk) bnk.appendChild(line);
      }
    });
    function _getParsonsInsertAfter(zone, y) {
      var els = Array.prototype.slice.call(zone.querySelectorAll('.parsons-line:not(.dragging)'));
      for (var i = 0; i < els.length; i++) {
        var box = els[i].getBoundingClientRect();
        if (y < box.top + box.height / 2) return els[i];
      }
      return null;
    }

    container.querySelectorAll('.parsons-check-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.quiz-question-card');
        if (!card) return;
        var target = card.querySelector('.parsons-target');
        var correctData = card.querySelector('.parsons-correct-data');
        if (!target || !correctData) return;
        var correct = JSON.parse(correctData.dataset.correct);
        var placedEls = Array.prototype.slice.call(target.querySelectorAll('.parsons-line'));
        var isCorrect = placedEls.length === correct.length
          && placedEls.every(function (el, i) {
            return el.dataset.correctPos === String(i) || el.dataset.line === correct[i];
          });
        placedEls.forEach(function (el, i) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          if (i < correct.length && (el.dataset.correctPos === String(i) || el.dataset.line === correct[i])) {
            el.classList.add('parsons-correct');
          } else {
            el.classList.add('parsons-incorrect');
          }
        });
        card.querySelectorAll('.parsons-bank .parsons-line').forEach(function (el) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          if (el.dataset.distractor === 'true') el.classList.add('parsons-correct');
          else el.classList.add('parsons-incorrect');
        });
        card.querySelectorAll('.parsons-line').forEach(function (el) { el.setAttribute('draggable', 'false'); });
        btn.disabled = true;
        var resetBtn = card.querySelector('.parsons-reset-btn');
        if (resetBtn) resetBtn.disabled = true;
        if (isCorrect) {
          score++;
          if (typeof window.spawnConfettiIfMore === 'function') window.spawnConfettiIfMore(card);
        }
        var ca = card.querySelector('.quiz-correct-answers');
        var exp = card.querySelector('.quiz-explanation');
        if (ca) ca.style.display = 'flex';
        if (exp) exp.classList.remove('hidden');
        focusNextQuestionButton(card);
      });
    });
    container.querySelectorAll('.parsons-reset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.quiz-question-card');
        if (!card) return;
        var bank = card.querySelector('.parsons-bank');
        var target = card.querySelector('.parsons-target');
        if (!bank || !target) return;
        target.querySelectorAll('.parsons-line').forEach(function (el) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          bank.appendChild(el);
        });
      });
    });
    showQ(0);
  }

  // ---------------------------------------------------------------------------
  // Quiz avatar — shows the saved SE Gym hero below the quiz when one exists.
  // Clones the SVG from a <template id="quiz-avatar-tpl"> injected by the
  // tutorial layout and popup HTML, then applies the avatar via HeroAvatar.
  // ---------------------------------------------------------------------------
  function _mountQuizAvatar(hostEl) {
    if (!window.HeroAvatar) return;
    var state = HeroAvatar.loadAvatar();
    if (!state) return;
    var tpl = document.getElementById('quiz-avatar-tpl');
    if (!tpl || !tpl.content) return;
    var wrap = hostEl && hostEl.querySelector('.tvm-quiz-avatar-wrap');
    if (!wrap) return;
    var clone = tpl.content.cloneNode(true);
    wrap.innerHTML = '';
    wrap.appendChild(clone);
    var svgEl = wrap.querySelector('[data-gym-hero-svg]');
    if (!svgEl) return;
    HeroAvatar.applyToSvg(svgEl, state);
    wrap.style.display = '';
  }

  // ---------------------------------------------------------------------------
  // mount = buildHTML + setInnerHTML + attach (the common entry point)
  // ---------------------------------------------------------------------------
  function mount(opts) {
    var hostEl = opts.hostEl;
    if (!hostEl) return;
    // If caller supplied a pre-built quizHTML (e.g. from a popup that
    // received the rendered HTML over BroadcastChannel), use that.
    // Otherwise build from the quiz spec locally.
    var html = opts.quizHTML != null ? opts.quizHTML : buildHTML(opts);
    hostEl.innerHTML = html;
    hostEl.scrollTop = 0;
    attach({
      hostEl: hostEl,
      controlsEl: opts.controlsEl,
      stepIndex: opts.stepIndex,
      minScore: opts.minScore !== undefined ? opts.minScore
        : (opts.quiz && opts.quiz.min_score !== undefined ? opts.quiz.min_score : 0.8),
      isFinalQuiz: !!opts.isFinalQuiz,
      onPass: opts.onPass,
    });
    _mountQuizAvatar(hostEl);
  }

  window.SebookQuiz = {
    shuffle: shuffle,
    buildHTML: buildHTML,
    attach: attach,
    mount: mount,
  };
})();
