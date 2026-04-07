/**
 * TutorChat — Rule-based hint engine with optional Chrome AI chat.
 *
 * When tests fail, a hint panel appears below the test results with specific,
 * actionable hints derived by comparing the student's code against the solution.
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
  var currentHints = [];

  // ─── Public API ─────────────────────────────────────────────────────────────

  var TutorChat = {};

  TutorChat.onTestFailure = function (tutorial) {
    var panel = tutorial.stepContentEl.querySelector('.tvm-test-panel');
    if (!panel) return;

    var prev = panel.querySelector('.tvm-tutor-chat');
    if (prev) prev.remove();

    // Generate rule-based hints
    currentHints = _generateHints(tutorial);

    // Only show if there are actual hints
    if (currentHints.length === 0) return;

    _buildUI(panel, currentHints);

    if (ENABLE_AI_CHAT) _initAIChat(tutorial);
  };

  TutorChat.onTestPass = function () { _destroy(); };
  TutorChat.onStepChange = function () { _destroy(); };

  // ─── Rule-Based Hint Engine ─────────────────────────────────────────────────

  function _generateHints(tutorial) {
    var step = tutorial.steps[tutorial.currentStep];
    var tests = step.tests || [];
    var results = tutorial._testResults || [];
    var backend = tutorial.config.backend;
    var output = (tutorial.outputPre && tutorial.outputPre.textContent) || '';
    var hints = [];

    // Get student code from all step files + active file
    var studentCode = _getStudentCode(tutorial, step);
    var solutionCode = _getSolutionCode(step);

    // Get failing test info
    var failingTests = [];
    tests.forEach(function (t, i) {
      if (results[i] !== true) failingTests.push(t);
    });

    if (failingTests.length === 0) return hints;

    // --- Hint generators (order = display order, generic first) ---

    // 1. Code is empty or just comments
    var stripped = studentCode.replace(/^\s*#.*$/gm, '').replace(/^\s*\/\/.*$/gm, '').trim();
    if (!stripped || stripped.length < 10) {
      hints.push({
        icon: '\u270F\uFE0F',
        title: 'Your code is mostly empty',
        body: 'Read the task instructions above and start writing your solution. The comments in the editor describe what you need to do.'
      });
      return hints;
    }

    // 2. Syntax/runtime error detection (any test matching "runs without errors")
    var hasRunError = failingTests.some(function (t) {
      return /runs? without errors|no errors|script runs/i.test(t.description);
    });
    if (hasRunError) {
      hints.push({
        icon: '\u26A0\uFE0F',
        title: 'Your code has an error',
        body: 'Click **\u25B6 Run** to see the error message in the output panel. Read it carefully \u2014 it tells you the line number and what went wrong.'
      });
    }

    // 3. Diff-based hints: find what's in the solution but missing from student code
    var diffHints = _diffHints(studentCode, solutionCode, failingTests);
    hints = hints.concat(diffHints);

    // 4. Test-description-based hints
    failingTests.forEach(function (t) {
      var desc = t.description;
      var h = _hintFromTestDescription(desc, studentCode);
      if (h) hints.push(h);
    });

    // 5. YAML-defined hints (most specific — shown last)
    failingTests.forEach(function (t) {
      if (!t.hints || !t.hints.length) return;
      t.hints.forEach(function (h) {
        if (_evaluateHintCondition(h.condition, studentCode, backend, output)) {
          hints.push({
            icon: '\uD83D\uDCA1',
            title: h.title || t.description,
            body: h.text
          });
        }
      });
    });

    // Deduplicate by title
    var seen = {};
    hints = hints.filter(function (h) {
      if (seen[h.title]) return false;
      seen[h.title] = true;
      return true;
    });

    // Cap at 3 hints to avoid overwhelming the student
    return hints.slice(0, 3);
  }

  /**
   * Strip comments from source code based on the tutorial backend language.
   */
  function _stripComments(code, backend) {
    switch (backend) {
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

  /**
   * Evaluate a hint condition against the student's code.
   * Supported conditions:
   *   (none / falsy)         → always true
   *   "source_contains: X"   → true if student source contains X
   *   "source_missing: X"    → true if student source does NOT contain X
   *   "code_contains: X"     → true if student code (comments stripped) contains X
   *   "code_missing: X"      → true if student code (comments stripped) does NOT contain X
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
    m = condition.match(/^output_contains:\s*(.+)$/i);
    if (m) return output.indexOf(m[1].trim()) !== -1;
    m = condition.match(/^output_missing:\s*(.+)$/i);
    if (m) return output.indexOf(m[1].trim()) === -1;
    return true; // unknown condition type → show hint
  }

  function _getStudentCode(tutorial, step) {
    var code = '';
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
      { pattern: /\bdef\s+\w+/g, name: 'function definition', hint: 'You may need to define a function. Check the task instructions for what function name to use.' },
      { pattern: /\bclass\s+\w+/g, name: 'class definition', hint: 'The solution uses a class. Have you defined one?' },
      { pattern: /\bfor\s+/g, name: 'for loop', hint: 'Consider using a **for loop** to iterate over the data.' },
      { pattern: /\bwhile\s+/g, name: 'while loop', hint: 'A **while loop** might help here.' },
      { pattern: /\breturn\b/g, name: 'return statement', hint: 'Your function needs to **return** a value, not just print it.' },
      { pattern: /\bimport\s+/g, name: 'import', hint: 'You may need to **import** a module. Check which modules the task mentions.' },
      { pattern: /\.filter\s*\(/g, name: '.filter()', hint: 'Try using `.filter()` to select elements from the array.' },
      { pattern: /\.map\s*\(/g, name: '.map()', hint: 'Try using `.map()` to transform each element.' },
      { pattern: /\.reduce\s*\(/g, name: '.reduce()', hint: 'Try using `.reduce()` to combine values into one result.' },
      { pattern: /=>\s*[{(]/g, name: 'arrow function', hint: 'The task asks for an **arrow function** (`=>`). Try converting your function declaration.' },
      { pattern: /\bconsole\.log\b/g, name: 'console.log', hint: 'You need to print output with `console.log()`.' },
      { pattern: /\bprint\s*\(/g, name: 'print()', hint: 'Use `print()` to display output.' },
      { pattern: /f["']/g, name: 'f-string', hint: 'Use an **f-string** (`f"..."`) with `{variable}` to insert variable values into the string.' },
      { pattern: /\$\{/g, name: 'template literal', hint: 'Use a **template literal** (backtick string) with `${variable}` for string interpolation.' },
      { pattern: /===\s/g, name: 'strict equality (===)', hint: 'Use `===` instead of `==` for strict type checking.' },
      { pattern: /\bconst\b/g, name: 'const declaration', hint: 'If a value never changes, declare it with `const` instead of `let`.' },
      { pattern: /\.toFixed\s*\(/g, name: '.toFixed()', hint: 'Use `.toFixed()` to format a number to a specific number of decimal places.' },
      { pattern: /:\.\d+f/g, name: 'format specifier (:.2f)', hint: 'Use `:.2f` inside f-string braces to format a number to 2 decimal places, e.g., `{gpa:.2f}`.' },
      { pattern: /sys\.argv/g, name: 'sys.argv', hint: 'Use `sys.argv` to read command-line arguments. `sys.argv[1]` is the first argument.' },
      { pattern: /sys\.stderr/g, name: 'sys.stderr', hint: 'Print error messages to `sys.stderr` using `print(..., file=sys.stderr)`.' },
      { pattern: /sys\.exit/g, name: 'sys.exit()', hint: 'Use `sys.exit(1)` to exit with an error code when something goes wrong.' },
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
    var header = document.createElement('div');
    header.className = 'tvm-tutor-header';
    header.innerHTML =
      '<span class="tvm-tutor-icon">\uD83D\uDCA1</span>' +
      '<span>Hints</span>' +
      '<button class="tvm-tutor-toggle">\u25BC</button>';
    header.addEventListener('click', function () {
      chatEl.classList.toggle('collapsed');
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

  function _destroy() {
    if (session) { try { session.destroy(); } catch (e) { /* ok */ } }
    session = null;
    currentHints = [];
    if (chatEl && chatEl.parentNode) chatEl.parentNode.removeChild(chatEl);
    chatEl = null;
    messagesEl = null;
    inputEl = null;
    sendBtn = null;
    statusEl = null;
    generating = false;
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
    var hintsText = currentHints.map(function (h) {
      return '- ' + h.title + ': ' + h.body;
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
