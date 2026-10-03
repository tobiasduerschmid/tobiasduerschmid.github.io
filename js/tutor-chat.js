/**
 * TutorChat — Rule-based hint engine with optional Chrome AI chat.
 *
 * When tests fail, a hint panel appears below the test results with specific,
 * condition-matched hints for each failed check. Authored hints take priority
 * over generated guidance.
 * If Chrome's Prompt API (Gemini Nano) is available, a chat input also appears
 * so students can ask follow-up questions.
 *
 * The rule-based hints are the primary feedback mechanism — they always work,
 * even without Chrome AI.
 */
(function () {
  'use strict';

  // ─── Feature flag ───────────────────────────────────────────────────────────
  var ENABLE_AI_CHAT = false; // set to true to enable Chrome Prompt API chat

  // ─── State ──────────────────────────────────────────────────────────────────
  var session = null;
  var chatEl = null;
  var messagesEl = null;
  var inputEl = null;
  var sendBtn = null;
  var statusEl = null;
  var generating = false;
  let currentHintGroups = [];

  // ─── Public API ─────────────────────────────────────────────────────────────

  var TutorChat = {};

  TutorChat.onTestFailure = function (tutorial) {
    var stepContent = tutorial.stepContentEl || tutorial.instructionsEl || tutorial.root;
    var panel = stepContent && stepContent.querySelector('.tvm-test-panel');
    if (!panel) return;

    _removePanel();

    currentHintGroups = _generateHintGroups(tutorial);

    // Only show if there are actual hints
    if (currentHintGroups.length === 0) return;

    // Several small checks may share the same advice. Keep their criterion
    // groups for context, but show each identical hint only once in the panel.
    _buildUI(panel, _finalizeHints(currentHintGroups.flatMap(function (group) { return group.hints; })));

    if (ENABLE_AI_CHAT) _initAIChat(tutorial);
  };

  TutorChat.onTestPass = function () { _destroy(); };
  TutorChat.onStepChange = function () { _destroy(); };

  // ─── Rule-Based Hint Engine ─────────────────────────────────────────────────

  function _generateHintGroups(tutorial) {
    var step = tutorial.steps[tutorial.currentStep];
    var tests = step.tests || [];
    var results = tutorial._testResults || [];
    var backend = (tutorial.config && tutorial.config.backend) || tutorial.backend || '';
    var output = (tutorial.outputPre && tutorial.outputPre.textContent) || '';
    var studentCode = _getStudentCode(tutorial, step);
    const groups = [];
    tests.forEach(function (test, index) {
      if (results[index] === true) return;
      let hints = _toArray(test.hints)
        .filter(function (hint) {
          return _evaluateHintCondition(hint.condition, studentCode, backend, output);
        })
        .map(function (hint) { return _normalizeHintRecord(hint, test.description || 'Hint'); })
        .filter(Boolean);

      if (backend === 'uml-editor') {
        const records = tutorial._testHintRecords || [];
        // Assertion diagnostics are feedback from the actual diagram check,
        // not a comparison with a model solution. Keep them with their check.
        const diagnostics = _toArray(records[index])
          .map(function (hint) { return _normalizeHintRecord(hint, 'Naming nudge'); })
          .filter(Boolean);
        hints = diagnostics.concat(hints);
        // An empty diagram has no useful naming diagnostic yet. Preserve the
        // UML editor's no-nudge behavior until a check provides guidance.
        if (hints.length === 0) return;
      } else if (hints.length === 0) {
        hints = _fallbackHints(test, studentCode, step);
      }
      if (hints.length === 0) hints = [{
        icon: '\uD83D\uDCA1', title: test.description || 'Hint',
        body: 'Compare the failing check with the task instructions. Trace a small example through your current attempt and identify where its behavior differs.'
      }];
      groups.push({ testIndex: index, description: test.description || 'Check ' + (index + 1),
        hints: _finalizeHints(hints) });
    });
    return groups;
  }

  function _fallbackHints(test, studentCode, step) {
    let hints = [];
    if (/runs? without errors|no errors|script runs/i.test(test.description)) hints.push({
      icon: '\u26A0\uFE0F', title: 'Your code has an error',
      body: 'Click **\u25B6 Run** to see the error message in the output panel. Read it carefully \u2014 it tells you the line number and what went wrong.'
    });
    hints = hints.concat(_diffHints(studentCode, _getSolutionCode(step), [test]));
    const descriptionHint = _hintFromTestDescription(test.description || '', studentCode);
    if (descriptionHint) hints.push(descriptionHint);
    return hints;
  }

  function _normalizeHintRecord(hint, fallbackTitle) {
    if (!hint) return null;
    if (typeof hint === 'string') {
      return {
        icon: '\uD83D\uDCA1',
        title: fallbackTitle || '',
        body: hint,
        dedupeKey: '\n' + hint
      };
    }
    var body = hint.body || hint.text || hint.message || '';
    if (!body) return null;
    return {
      icon: hint.icon || '\uD83D\uDCA1',
      title: hint.title || fallbackTitle || '',
      body: body,
      // An explicit title can distinguish advice with the same body. A title
      // inherited from the test description must not duplicate shared advice.
      dedupeKey: (hint.title || '') + '\n' + body
    };
  }

  function _toArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  }

  function _finalizeHints(hints) {
    const seen = new Set();
    return hints.filter(function (h) {
      var key = h.dedupeKey || h.title + '\n' + h.body;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Strip comments from source code based on the tutorial backend language.
   */
  function _stripComments(code, backend) {
    switch (backend) {
      case 'haskell':
        return _stripHaskellComments(code);
      case 'pyodide':
        return code.replace(/#.*$/gm, '');
      case 'browser':
      case 'react':
        return code
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
      case 'sql':
        return code.replace(/--.*$/gm, '');
      case 'prolog':
        return code
          .replace(/%.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
      case 'v86': // shell/C/git — support both # and //
        return code
          .replace(/#.*$/gm, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
      default:
        return code
          .replace(/#.*$/gm, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
    }
  }

  // Use the same tokenizer as the Haskell source analyses. Mask comment gaps
  // while keeping tokens, strings, line breaks, and regex anchors intact.
  function _stripHaskellComments(code) {
    const syntax = window.SEBookHaskellSyntax;
    if (!syntax) return '';
    let tokens;
    try { tokens = syntax.tokenize(code); }
    catch (error) {
      if (error instanceof syntax.UnsupportedSyntax) return '';
      throw error;
    }
    let cursor = 0;
    const pieces = tokens.map(function (token) {
      const gap = code.slice(cursor, token.offset).replace(/\S/g, ' ');
      cursor = token.offset + token.text.length;
      return gap + token.text;
    });
    pieces.push(code.slice(cursor).replace(/\S/g, ' '));
    return pieces.join('');
  }

  /**
   * Safely compile a regex pattern (returns null if invalid).
   * Pattern may be a bare regex body (e.g. "\bvar\b") or a full slash form
   * with flags (e.g. "/\bvar\b/i"). Defaults to no flags.
   */
  function _compileRegex(pattern) {
    try {
      var slashMatch = pattern.match(/^\/(.+)\/([a-z]*)$/i);
      if (slashMatch) return new RegExp(slashMatch[1], slashMatch[2]);
      return new RegExp(pattern);
    } catch (e) {
      return null;
    }
  }

  /**
   * Evaluate a hint condition against the student's code.
   * Supported conditions:
   *   (none / falsy)            → always true
   *   "source_contains: X"      → true if student source contains X (substring)
   *   "source_missing: X"       → true if student source does NOT contain X
   *   "code_contains: X"        → true if code (comments stripped) contains X
   *   "code_missing: X"         → true if code (comments stripped) does NOT contain X
   *   "code_matches: <regex>"   → true if code (comments stripped) matches regex
   *   "code_not_matches: <re>"  → true if code (comments stripped) does NOT match regex
   *   "source_matches: <regex>" → true if full source matches regex (incl. comments)
   *   "output_contains: X"      → true if output contains X
   *   "output_missing: X"       → true if output does NOT contain X
   *
   * Regex patterns may be written bare ("\\bvar\\b") or slash-delimited with
   * flags ("/\\bvar\\b/i"). Invalid patterns fall through and return true so
   * the hint still surfaces rather than silently hide.
   */
  function _evaluateHintCondition(condition, studentCode, backend, output) {
    if (!condition) return true;
    var m;
    m = condition.match(/^source_contains:\s*(.+)$/i);
    if (m) return studentCode.indexOf(m[1].trim()) !== -1;
    m = condition.match(/^source_missing:\s*(.+)$/i);
    if (m) return studentCode.indexOf(m[1].trim()) === -1;
    var stripped = _stripComments(studentCode, backend);
    m = condition.match(/^code_contains:\s*(.+)$/i);
    if (m) return stripped.indexOf(m[1].trim()) !== -1;
    m = condition.match(/^code_missing:\s*(.+)$/i);
    if (m) return stripped.indexOf(m[1].trim()) === -1;
    m = condition.match(/^code_matches:\s*(.+)$/i);
    if (m) {
      var re = _compileRegex(m[1].trim());
      return re ? re.test(stripped) : true;
    }
    m = condition.match(/^code_not_matches:\s*(.+)$/i);
    if (m) {
      var reN = _compileRegex(m[1].trim());
      return reN ? !reN.test(stripped) : true;
    }
    m = condition.match(/^source_matches:\s*(.+)$/i);
    if (m) {
      var reS = _compileRegex(m[1].trim());
      return reS ? reS.test(studentCode) : true;
    }
    m = condition.match(/^output_contains:\s*(.+)$/i);
    if (m) return output.indexOf(m[1].trim()) !== -1;
    m = condition.match(/^output_missing:\s*(.+)$/i);
    if (m) return output.indexOf(m[1].trim()) === -1;
    return true; // unknown condition type → show hint
  }

  function _getStudentCode(tutorial, step) {
    var code = '';
    if (!tutorial.editorModels) {
      if (typeof tutorial.currentSource === 'function') return tutorial.currentSource();
      if (tutorial.sourceEl) return tutorial.sourceEl.value || '';
      return '';
    }
    var paths = (step.files || []).map(function (f) { return f.path; });
    if (tutorial.activeFileName && paths.indexOf(tutorial.activeFileName) === -1) {
      paths.push(tutorial.activeFileName);
    }
    paths.forEach(function (path) {
      var entry = tutorial.editorModels[path];
      if (entry) code += entry.model.getValue() + '\n';
    });
    return code;
  }

  function _getSolutionCode(step) {
    var code = '';
    if (step.solution && step.solution.files) {
      step.solution.files.forEach(function (f) { code += (f.content || '') + '\n'; });
    }
    return code;
  }

  // Compare student code to solution and generate specific hints
  function _diffHints(studentCode, solutionCode, failingTests) {
    var hints = [];
    if (!solutionCode.trim()) return hints;

    // Check for missing key constructs
    var constructs = [
      ];

    constructs.forEach(function (c) {
      var inSolution = c.pattern.test(solutionCode);
      c.pattern.lastIndex = 0; // reset regex
      var inStudent = c.pattern.test(studentCode);
      c.pattern.lastIndex = 0;
      if (inSolution && !inStudent) {
        hints.push({
          icon: '\uD83D\uDD0D',
          title: 'Missing: ' + c.name,
          body: c.hint
        });
      }
    });

    // Check for hardcoded values that should use variables
    // (solution uses variable references, student uses literals)
    if (/f["']|`\$\{|\{[a-z_]+\}/.test(solutionCode) &&
        !/f["']|`\$\{|\{[a-z_]+\}/.test(studentCode) &&
        /["'][^"']*["']/.test(studentCode)) {
      // Check if the test mentions variables/literals
      var mentionsVars = failingTests.some(function (t) {
        return /variable|literal|hard.?code|f-string|template/i.test(t.description);
      });
      if (mentionsVars) {
        hints.push({
          icon: '\uD83D\uDD04',
          title: 'Use variables instead of hardcoded values',
          body: 'Your code has the right output, but it uses hardcoded text instead of the variables defined at the top of the file. Use an **f-string** or **template literal** to reference the variables.'
        });
      }
    }

    return hints;
  }

  // Generate a hint from the test description itself
  function _hintFromTestDescription(desc, studentCode) {
    var lower = desc.toLowerCase();

    // "Output contains 'X'" — check if student prints X
    var containsMatch = desc.match(/output contains\s+['"](.+?)['"]/i);
    if (containsMatch) {
      var expected = containsMatch[1];
      // If the expected text doesn't appear in student code at all
      if (studentCode.indexOf(expected) === -1) {
        return {
          icon: '\uD83D\uDCCB',
          title: 'Expected output: "' + expected + '"',
          body: 'The test expects your output to contain **"' + expected + '"**. Make sure your `print()` or `console.log()` produces this text.'
        };
      }
    }

    // "uses X, not Y" pattern
    if (/uses?\s+\w+.*not\s+\w+/i.test(lower)) {
      return {
        icon: '\uD83D\uDD04',
        title: 'Check how you wrote it',
        body: 'The test "' + desc + '" is checking *how* your code is written, not just the output. Look at the specific requirement \u2014 what syntax or approach should you use?'
      };
    }

    return null;
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────

  function _buildUI(panel, hints) {
    chatEl = document.createElement('div');
    chatEl.className = 'tvm-tutor-chat collapsed';

    // Header
    var header = document.createElement('button');
    header.type = 'button';
    header.className = 'tvm-tutor-header';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML =
      '<span class="tvm-tutor-icon" aria-hidden="true">\uD83D\uDCA1</span>' +
      '<span>Hints</span>' +
      '<span class="tvm-tutor-toggle" aria-hidden="true">\u25BC</span>';
    header.addEventListener('click', function () {
      var collapsed = chatEl.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', String(!collapsed));
    });
    chatEl.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'tvm-tutor-body';

    // Hints area (always shown)
    if (hints.length > 0) {
      var hintsEl = document.createElement('div');
      hintsEl.className = 'tvm-tutor-hints';
      hints.forEach(function (h) {
        var hintDiv = document.createElement('div');
        hintDiv.className = 'tvm-tutor-hint';
        hintDiv.innerHTML =
          '<div class="tvm-tutor-hint-title">' + h.icon + ' ' + _escapeHtml(h.title) + '</div>' +
          '<div class="tvm-tutor-hint-body">' + (window.marked ? window.marked.parse(h.body) : _escapeHtml(h.body)) + '</div>';
        hintsEl.appendChild(hintDiv);
      });
      body.appendChild(hintsEl);
    }

    // AI chat elements (only created when feature flag is on)
    if (ENABLE_AI_CHAT) {
      statusEl = document.createElement('div');
      statusEl.className = 'tvm-tutor-status';
      statusEl.setAttribute('role', 'status');
      statusEl.setAttribute('aria-live', 'polite');
      statusEl.setAttribute('aria-atomic', 'true');
      statusEl.style.display = 'none';
      body.appendChild(statusEl);

      messagesEl = document.createElement('div');
      messagesEl.className = 'tvm-tutor-messages';
      messagesEl.style.display = 'none';
      body.appendChild(messagesEl);

      var inputRow = document.createElement('div');
      inputRow.className = 'tvm-tutor-input-row';
      inputRow.style.display = 'none';

      inputEl = document.createElement('input');
      inputEl.className = 'tvm-tutor-input';
      inputEl.placeholder = 'Ask the AI tutor a follow-up question\u2026';
      inputEl.disabled = true;
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _onSend(); }
      });

      sendBtn = document.createElement('button');
      sendBtn.className = 'tvm-tutor-send';
      sendBtn.textContent = 'Send';
      sendBtn.disabled = true;
      sendBtn.addEventListener('click', _onSend);

      inputRow.appendChild(inputEl);
      inputRow.appendChild(sendBtn);
      body.appendChild(inputRow);
    }

    chatEl.appendChild(body);
    panel.appendChild(chatEl);
    chatEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function _showStatus(html) {
    if (!statusEl) return;
    statusEl.innerHTML = html;
    statusEl.style.display = '';
  }

  function _appendMessage(role, text) {
    if (!messagesEl) return null;
    var div = document.createElement('div');
    div.className = 'tvm-tutor-msg ' + role;
    if (role === 'assistant' && window.marked) {
      div.innerHTML = window.marked.parse(text);
    } else {
      div.textContent = text;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function _showTyping() {
    if (!messagesEl) return null;
    var div = document.createElement('div');
    div.className = 'tvm-tutor-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function _removePanel() {
    if (session) { try { session.destroy(); } catch (e) { /* ok */ } }
    session = null;
    if (chatEl && chatEl.parentNode) chatEl.parentNode.removeChild(chatEl);
    chatEl = null;
    messagesEl = null;
    inputEl = null;
    sendBtn = null;
    statusEl = null;
    generating = false;
  }

  function _destroy() {
    _removePanel();
    currentHintGroups = [];
  }

  // ─── AI Chat (optional — Chrome Prompt API) ────────────────────────────────

  async function _initAIChat(tutorial) {
    if (typeof LanguageModel === 'undefined') return; // no Chrome AI — hints only

    var avail;
    try { avail = await LanguageModel.availability(); } catch (e) { return; }
    if (avail === 'unavailable') return;

    // Show the chat input
    var inputRow = chatEl && chatEl.querySelector('.tvm-tutor-input-row');
    if (inputRow) inputRow.style.display = '';
    _showStatus('Loading AI tutor\u2026');

    var systemPrompt = _buildSystemPrompt(tutorial);

    try {
      session = await LanguageModel.create({
        initialPrompts: [{ role: 'system', content: systemPrompt }],
        monitor: function (m) {
          m.addEventListener('downloadprogress', function (e) {
            _showStatus('Downloading AI model\u2026 ' + Math.round(e.loaded * 100) + '%');
          });
        }
      });
    } catch (e) {
      if (statusEl) statusEl.style.display = 'none';
      if (inputRow) inputRow.style.display = 'none';
      return;
    }

    if (statusEl) statusEl.style.display = 'none';
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (messagesEl) messagesEl.style.display = '';
  }

  function _buildSystemPrompt(tutorial) {
    var step = tutorial.steps[tutorial.currentStep];
    var tests = step.tests || [];
    var results = tutorial._testResults || [];

    var passing = [], failing = [];
    tests.forEach(function (t, i) {
      if (results[i] === true) passing.push(t.description);
      else failing.push(t.description);
    });

    var studentCode = _getStudentCode(tutorial, step);

    // Include the rule-based hints so the LLM can build on them
    var hintsText = currentHintGroups.map(function (group) {
      return group.hints.map(function (hint) {
        return '- ' + group.description + ': ' + hint.body;
      }).join('\n');
    }).join('\n');

    var instructions = step.instructions || '';
    if (instructions.length > 1000) instructions = instructions.substring(0, 1000) + '\n[truncated]';

    return [
      'You are a Socratic tutor. The student is working on: "' + step.title + '".',
      '',
      'Step instructions:',
      instructions,
      '',
      'Tests passing: ' + (passing.join(', ') || 'none'),
      'Tests failing: ' + (failing.join(', ') || 'none'),
      '',
      'The student has already seen these hints:',
      hintsText || '(none)',
      '',
      'Student code:',
      studentCode,
      '',
      'Rules:',
      '- NEVER show corrected code or reveal the solution.',
      '- Ask ONE guiding question per response.',
      '- Keep responses to 2-3 sentences.',
      '- Build on the hints above — go deeper, not broader.',
      '- Reference specific line numbers or variable names from the student\'s code.',
    ].join('\n');
  }

  function _onSend() {
    if (!inputEl || !session || generating) return;
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    _getAssistantResponse(text);
  }

  async function _getAssistantResponse(userText) {
    if (!session || generating) return;
    generating = true;
    if (inputEl) inputEl.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    _appendMessage('user', userText);
    var typingEl = _showTyping();

    try {
      var result = await session.prompt(userText);
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);

      if (result && result.trim()) {
        _appendMessage('assistant', result.trim());
      } else {
        _appendMessage('assistant', 'Try re-reading the failing test description \u2014 what specific thing is it checking for?');
      }
    } catch (e) {
      if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
      _appendMessage('assistant', 'Error: ' + e.message);
    }

    generating = false;
    if (inputEl) inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) inputEl.focus();
  }

  // ─── Expose ─────────────────────────────────────────────────────────────────
  window.TutorChat = TutorChat;
})();
