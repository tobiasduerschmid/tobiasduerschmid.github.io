// RegEx Interactive Tutorial Engine
// Supports: free-text exercises, Micro Parsons (drag-and-drop), Fixer Upper (debug),
// engine visualizer, real-time highlighting, and test-case validation.

(function () {
  'use strict';

  // ── Exercise Data ──────────────────────────────────────────────────────────
  // Types: 'free' (type regex), 'parsons' (drag-and-drop fragments), 'fixer' (debug broken regex)

  var EXERCISES = [

    // ═══ Section 1: Literal Matching ═══════════════════════════════════════
    {
      id: 'literal-1', type: 'parsons',
      section: 'Literal Matching',
      title: 'Build Your First Pattern',
      goal: 'Arrange the fragments to build a regex that matches <code>print</code> in the text.',
      sampleText: 'The print function can print any value. To pretty-print JSON, use json.dumps. Don\'t forget to add a print statement for debugging — printf is different.',
      fragments: ['p', 'r', 'i', 'n', 't'],
      solution: 'print',
      tests: [
        { input: 'print this', shouldMatch: true, label: 'contains "print"' },
        { input: 'sprint away', shouldMatch: true, label: '"print" inside "sprint"' },
        { input: 'no match here', shouldMatch: false, label: 'no "print"' },
        { input: 'a priori', shouldMatch: false, label: 'has "pri" but not "print"' }
      ],
      hiddenTests: [
        { input: 'PRINT', shouldMatch: false },
        { input: 'printer', shouldMatch: true }
      ]
    },
    {
      id: 'literal-2', type: 'free',
      section: 'Literal Matching',
      title: 'Your Turn',
      goal: 'Type a regex to match every occurrence of <code>error</code> in the text.',
      sampleText: 'System log: error in module A. No error found in module B. Warning: terror alert is not an error. Error handling improved.',
      solution: 'error',
      tests: [
        { input: 'error occurred', shouldMatch: true, label: 'contains "error"' },
        { input: 'all clear', shouldMatch: false, label: 'no "error"' },
        { input: 'Error', shouldMatch: false, label: 'capital E — should NOT match (case sensitive)' }
      ],
      hiddenTests: [
        { input: 'terror', shouldMatch: true },
        { input: 'ERROR', shouldMatch: false }
      ]
    },

    // ═══ Section 2: Character Classes ══════════════════════════════════════
    {
      id: 'charclass-1', type: 'parsons',
      section: 'Character Classes',
      title: 'Build a Vowel Matcher',
      goal: 'Arrange fragments to match any lowercase vowel.',
      sampleText: 'Regular expressions give programmers superpowers for text manipulation and data extraction.',
      fragments: ['[', 'a', 'e', 'i', 'o', 'u', ']'],
      solution: '[aeiou]',
      tests: [
        { input: 'hello', shouldMatch: true, label: 'has vowels' },
        { input: 'xyz', shouldMatch: false, label: 'no vowels' },
        { input: 'HELLO', shouldMatch: false, label: 'uppercase — should NOT match' }
      ],
      hiddenTests: [
        { input: 'aeiou', shouldMatch: true },
        { input: 'bcdfg', shouldMatch: false }
      ]
    },
    {
      id: 'charclass-2', type: 'free',
      section: 'Character Classes',
      title: 'Not a Letter',
      goal: 'Match every character that is <strong>not</strong> a letter. Use <code>[^...]</code> to negate.',
      sampleText: 'Score: 42 points! Time remaining: 3:30. Player #7 wins $100.',
      solution: '[^a-zA-Z]',
      tests: [
        { input: '123', shouldMatch: true, label: 'all digits — should match' },
        { input: 'abc', shouldMatch: false, label: 'all letters — should NOT match' },
        { input: 'hi!', shouldMatch: true, label: 'has punctuation — should match' }
      ],
      hiddenTests: [
        { input: ' ', shouldMatch: true },
        { input: 'ABCdef', shouldMatch: false }
      ]
    },

    // ═══ Section 3: Meta Characters ════════════════════════════
    {
      id: 'meta-character-1', type: 'free',
      section: 'Meta Characters',
      title: 'Digit Detector',
      goal: 'Match every individual digit.',
      sampleText: 'Invoice #8842: 3 items at $15 each, total $45. Tax ID: 9021-XB. Ref code: A1B2C3.',
      solution: '\\d',
      tests: [
        { input: 'Room 101', shouldMatch: true, label: 'contains digits' },
        { input: 'hello', shouldMatch: false, label: 'no digits' },
        { input: '42!', shouldMatch: true, label: 'digits with punctuation' }
      ],
      hiddenTests: [
        { input: '0', shouldMatch: true },
        { input: 'abc', shouldMatch: false }
      ]
    },
    {
      id: 'meta-character-2', type: 'free',
      section: 'Meta Characters',
      title: 'File Extensions',
      goal: 'Match file extensions: a literal dot followed by one or more lowercase letters. The dot <code>.</code> is a wildcard — escape it as <code>\\.</code> to match a real dot.',
      sampleText: 'Files: report.pdf, data.csv, photo.jpg, README, notes.txt, archive.tar.gz, config.yaml',
      solution: '\\.[a-z]+',
      tests: [
        { input: '.txt', shouldMatch: true, label: 'dot + letters' },
        { input: 'txt', shouldMatch: false, label: 'no dot — should NOT match' },
        { input: '.a', shouldMatch: true, label: 'single-letter extension' }
      ],
      hiddenTests: [
        { input: '.PDF', shouldMatch: false },
        { input: '.json', shouldMatch: true }
      ]
    },

    // ═══ Section 4: Anchors (moved earlier per pedagogy) ══════
    {
      id: 'anchor-0', type: 'free',
      section: 'Anchors',
      title: 'The Challenge (Try Before You Learn!)',
      goal: 'Can you write a regex that matches <strong>only</strong> if the <em>entire</em> string is digits? Try <code>\\d+</code> — does it work? It shouldn\'t pass all the tests. Read the section above to discover why, then fix your answer.',
      sampleText: null,
      solution: '^\\d+$',
      tests: [
        { input: '12345', shouldMatch: true, label: 'all digits — should match' },
        { input: 'abc', shouldMatch: false, label: 'all letters — should NOT match' },
        { input: '123abc', shouldMatch: false, label: 'mixed — should NOT match' },
        { input: '', shouldMatch: false, label: 'empty — should NOT match' }
      ],
      hiddenTests: [
        { input: ' 42 ', shouldMatch: false },
        { input: '007', shouldMatch: true }
      ]
    },
    {
      id: 'anchor-1', type: 'parsons',
      section: 'Anchors',
      title: 'Build a Full-String Validator',
      goal: 'Arrange fragments so the regex matches <strong>only</strong> if the <em>entire</em> string is digits. Use <code>^</code> (start) and <code>$</code> (end) anchors.',
      sampleText: null,
      fragments: ['^', '\\d', '+', '$'],
      solution: '^\\d+$',
      tests: [
        { input: '12345', shouldMatch: true, label: 'all digits' },
        { input: '123abc', shouldMatch: false, label: 'mixed — should NOT match' },
        { input: '', shouldMatch: false, label: 'empty — should NOT match' },
        { input: '007', shouldMatch: true, label: 'leading zeros OK' }
      ],
      hiddenTests: [
        { input: ' 123', shouldMatch: false },
        { input: '42', shouldMatch: true }
      ]
    },
    {
      id: 'anchor-2', type: 'free',
      section: 'Anchors',
      title: 'Stand-Alone Words',
      goal: 'Match only the standalone word <code>go</code> — not inside "goal" or "cargo". Use word boundaries <code>\\b</code>.',
      sampleText: 'Ready, set, go! The goal is to outperform the algorithm. Let\'s go before the cargo ship departs. Go ahead.',
      solution: '\\bgo\\b',
      showVisualizer: true,
      tests: [
        { input: "let's go", shouldMatch: true, label: '"go" as a word' },
        { input: 'goal', shouldMatch: false, label: '"goal" — should NOT match' },
        { input: 'cargo', shouldMatch: false, label: '"cargo" — should NOT match' }
      ],
      hiddenTests: [
        { input: 'go', shouldMatch: true },
        { input: 'Go!', shouldMatch: false },
        { input: 'ongoing', shouldMatch: false }
      ]
    },
    {
      id: 'anchor-3', type: 'fixer',
      section: 'Anchors',
      title: 'Fix the Username Validator',
      goal: 'This regex is supposed to validate that a username is <strong>only</strong> alphanumeric characters. But it incorrectly accepts <code>admin!@#</code>. Fix it!',
      sampleText: null,
      brokenRegex: '[a-zA-Z0-9]+',
      solution: '^[a-zA-Z0-9]+$',
      hint: 'Without anchors, the regex finds "admin" as a substring match and considers it a success — ignoring the rest.',
      tests: [
        { input: 'admin', shouldMatch: true, label: 'valid username' },
        { input: 'user123', shouldMatch: true, label: 'alphanumeric' },
        { input: 'admin!@#', shouldMatch: false, label: 'special chars — should NOT match' },
        { input: '', shouldMatch: false, label: 'empty — should NOT match' }
      ],
      hiddenTests: [
        { input: 'hello world', shouldMatch: false },
        { input: 'Test', shouldMatch: true }
      ]
    },

    // ═══ Section 5: Quantifiers ════════════════════════════════════════════
    {
      id: 'quant-1', type: 'free',
      section: 'Quantifiers',
      title: 'ZIP Code Spotter',
      goal: 'Match numbers that are <strong>exactly 5 digits</strong> — not shorter, not longer. Combine <code>\\b</code>, <code>\\d</code>, and <code>{n}</code>.',
      sampleText: 'Locations: New York 10001, Los Angeles 90210, Chicago 60601, apt 42, serial 1234567, code 999.',
      solution: '\\b\\d{5}\\b',
      tests: [
        { input: '90210', shouldMatch: true, label: 'exactly 5 digits' },
        { input: '123', shouldMatch: false, label: '3 digits — too short' },
        { input: '1234567', shouldMatch: false, label: '7 digits — too long' }
      ],
      hiddenTests: [
        { input: '00000', shouldMatch: true },
        { input: '12 34', shouldMatch: false }
      ]
    },
    {
      id: 'quant-2', type: 'free',
      section: 'Quantifiers',
      title: 'Star vs. Plus',
      goal: 'Match strings that start with one or more <code>a</code> followed by a <code>b</code>. Notice: <code>a*b</code> would also match a lone <code>b</code> — but <code>a+b</code> requires at least one <code>a</code>.',
      sampleText: 'Test: ab, aab, aaab, b, xb, aaa, aaaab.',
      solution: 'a+b',
      tests: [
        { input: 'ab', shouldMatch: true, label: 'one a + b' },
        { input: 'aaab', shouldMatch: true, label: 'multiple a\'s + b' },
        { input: 'b', shouldMatch: false, label: 'lone b — should NOT match (need at least one a)' },
        { input: 'aaa', shouldMatch: false, label: 'no b — should NOT match' }
      ],
      hiddenTests: [
        { input: 'aab', shouldMatch: true },
        { input: 'bb', shouldMatch: false }
      ]
    },
    {
      id: 'quant-3', type: 'free',
      section: 'Quantifiers',
      title: 'Singular or Plural',
      goal: 'Match both <code>file</code> and <code>files</code> — the trailing <code>s</code> should be optional.',
      sampleText: 'Upload your file here. Multiple files are supported. The file manager shows all files in the current directory.',
      solution: 'files?',
      tests: [
        { input: 'file', shouldMatch: true, label: 'singular' },
        { input: 'files', shouldMatch: true, label: 'plural' },
        { input: 'fil', shouldMatch: false, label: 'too short — should NOT match' }
      ],
      hiddenTests: [
        { input: 'profile', shouldMatch: true },
        { input: 'filed', shouldMatch: true }
      ]
    },

    // ═══ Section 6: Alternation & Combining ════════════════════════════════
    {
      id: 'combine-1', type: 'free',
      section: 'Alternation & Combining',
      title: 'Spelling Variants',
      goal: 'Match both <code>grey</code> and <code>gray</code>.',
      sampleText: 'The grey sky turned dark gray by evening. Is it grey or gray? The greyhound ran across the gravel path, its grey fur blending into gray fog.',
      solution: 'gr[ae]y',
      tests: [
        { input: 'grey', shouldMatch: true, label: 'British spelling' },
        { input: 'gray', shouldMatch: true, label: 'American spelling' },
        { input: 'gravy', shouldMatch: false, label: '"gravy" — should NOT match' }
      ],
      hiddenTests: [
        { input: 'gry', shouldMatch: false },
        { input: 'greyhound', shouldMatch: true }
      ]
    },
    {
      id: 'combine-2', type: 'free',
      section: 'Alternation & Combining',
      title: 'Time Format',
      goal: 'Match times in <code>HH:MM</code> format — exactly two digits, a colon, two digits.',
      sampleText: 'Schedule: standup at 09:30, lunch at 12:00, review at 15:45. Note: 9:5 is not valid format.',
      solution: '\\d{2}:\\d{2}',
      tests: [
        { input: '09:30', shouldMatch: true, label: 'valid time' },
        { input: '12:00', shouldMatch: true, label: 'noon' },
        { input: '9:30', shouldMatch: false, label: 'single-digit hour — should NOT match' }
      ],
      hiddenTests: [
        { input: '23:59', shouldMatch: true },
        { input: 'ab:cd', shouldMatch: false },
        { input: '09:3', shouldMatch: false }
      ]
    },
    {
      id: 'combine-3', type: 'fixer',
      section: 'Alternation & Combining',
      title: 'Fix the Date Validator',
      goal: 'This regex is supposed to validate dates in <code>MM/DD</code> format. But it accepts <code>99/99</code> and rejects nothing. Debug it — the month should be 01–12 and the day 01–31.',
      sampleText: null,
      brokenRegex: '\\d{2}/\\d{2}',
      solution: '^(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])$',
      hint: 'The current pattern accepts any two digits for month and day. You need to restrict the ranges, and add anchors.',
      tests: [
        { input: '03/15', shouldMatch: true, label: 'valid date' },
        { input: '12/25', shouldMatch: true, label: 'December 25' },
        { input: '99/99', shouldMatch: false, label: 'invalid — should NOT match' },
        { input: '00/15', shouldMatch: false, label: 'month 00 — should NOT match' }
      ],
      hiddenTests: [
        { input: '01/01', shouldMatch: true },
        { input: '13/01', shouldMatch: false },
        { input: '12/32', shouldMatch: false }
      ]
    },

  ];

  // ── Visualizer Step Data ───────────────────────────────────────────────────

  var VISUALIZER_STEPS = {
    'anchor-2': {
      title: 'How the Engine Processes <code>\\bgo\\b</code>',
      scenarios: [
        {
          label: 'Word Boundary Matching',
          input: 'go! goal cargo go',
          regex: '\\bgo\\b',
          steps: [
            { regexHL: [0, 1], strHL: [0, 0], strMatch: null, desc: '<code>\\b</code> checks for a word boundary at position 0. Start of string = boundary. <strong>Satisfied.</strong>' },
            { regexHL: [2, 2], strHL: [0, 0], strMatch: [0, 0], desc: '<code>g</code> matches <code>g</code>. Advance.' },
            { regexHL: [3, 3], strHL: [1, 1], strMatch: [0, 1], desc: '<code>o</code> matches <code>o</code>. Advance.' },
            { regexHL: [4, 5], strHL: [2, 2], strMatch: [0, 1], desc: '<code>\\b</code>: next char is <code>!</code> (non-word). Boundary exists. <strong>Match #1: "go"</strong>' },
            { regexHL: [0, 1], strHL: [4, 4], strMatch: null, desc: 'Engine tries <code>g</code> in "goal". <code>\\b</code> satisfied (after space). <code>g</code> matches, <code>o</code> matches.' },
            { regexHL: [4, 5], strHL: [6, 6], strMatch: [4, 5], desc: '<code>\\b</code>: next char is <code>a</code> (word char). <strong>No boundary! Match fails.</strong> "goal" rejected.' },
            { regexHL: [0, 1], strHL: [12, 12], strMatch: null, desc: 'Engine tries <code>g</code> in "cargo". Previous char is <code>r</code> (word char). <code>\\b</code> <strong>not satisfied</strong>. Fails immediately.' },
            { regexHL: [2, 2], strHL: [15, 15], strMatch: [15, 16], desc: 'Engine reaches final "go". <code>\\b</code> satisfied. <code>g</code> matches, <code>o</code> matches.' },
            { regexHL: [4, 5], strHL: [17, 17], strMatch: [15, 16], desc: '<code>\\b</code>: end of string = boundary. <strong>Match #2: "go"</strong>. Only standalone words matched!' }
          ]
        }
      ]
    }
  };

  // ── State ──────────────────────────────────────────────────────────────────

  var completedExercises = loadProgress();

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('regex-tutorial-progress') || '{}'); }
    catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem('regex-tutorial-progress', JSON.stringify(completedExercises)); }
    catch (e) { /* ignore */ }
  }

  // ── Regex Helpers ──────────────────────────────────────────────────────────

  function tryCompile(pattern, flags) {
    if (!pattern) return null;
    try { return new RegExp(pattern, flags || 'g'); }
    catch (e) { return { error: e.message }; }
  }

  function findMatches(regex, text) {
    if (!regex || regex.error || !text) return [];
    var matches = [], m, safety = 0;
    regex.lastIndex = 0;
    while ((m = regex.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      if (m[0].length === 0) regex.lastIndex++;
      if (++safety > 1000) break;
    }
    return matches;
  }

  function testRegex(pattern, input) {
    var re = tryCompile(pattern, 'g');
    if (!re || re.error) return false;
    re.lastIndex = 0;
    return re.test(input);
  }

  // ── HTML Helpers ───────────────────────────────────────────────────────────

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightText(text, matches) {
    if (!matches.length) return esc(text);
    var result = '', last = 0;
    matches.sort(function (a, b) { return a.start - b.start; });
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (m.start < last) continue;
      result += esc(text.substring(last, m.start));
      result += '<span class="rt-match">' + esc(text.substring(m.start, m.end)) + '</span>';
      last = m.end;
    }
    result += esc(text.substring(last));
    return result;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function renderExercise(ex, container) {
    var done = !!completedExercises[ex.id];
    var h = '<div class="mathjax_ignore rt-exercise' + (done ? ' rt-complete' : '') + '" id="ex-' + ex.id + '">';
    h += '<div class="rt-ex-header"><span class="rt-ex-title">' + ex.title + '</span>';
    h += '<span class="rt-ex-status">' + (done ? '&#10003;' : '') + '</span></div>';
    h += '<p class="rt-goal">' + ex.goal + '</p>';

    // Sample text
    if (ex.sampleText !== null) {
      h += '<div class="rt-text-box"><div class="rt-text-label">Sample Text</div>';
      h += '<div class="rt-sample" data-exid="' + ex.id + '">' + esc(ex.sampleText) + '</div></div>';
    }

    // Input area depends on type
    if (ex.type === 'parsons') {
      h += renderParsonsInput(ex);
    } else if (ex.type === 'fixer') {
      h += renderFixerInput(ex);
    } else {
      h += renderFreeInput(ex);
    }

    h += '<div class="rt-error" data-exid="' + ex.id + '"></div>';

    // Tests
    h += '<div class="rt-tests" data-exid="' + ex.id + '"><div class="rt-tests-label">Test Cases</div>';
    for (var i = 0; i < ex.tests.length; i++) {
      var t = ex.tests[i];
      h += '<div class="rt-test" data-index="' + i + '"><span class="rt-test-icon">&#9679;</span> ';
      h += '<code class="rt-test-input">' + esc(t.input || '""') + '</code> ';
      h += '<span class="rt-test-label">— ' + t.label + '</span></div>';
    }
    h += '</div>';

    // Visualizer
    if (ex.showVisualizer && VISUALIZER_STEPS[ex.id]) {
      h += '<div class="rt-viz-wrap" data-exid="' + ex.id + '">' + renderVisualizer(ex.id) + '</div>';
    }

    // Actions
    h += '<div class="rt-actions">';
    h += '<button class="rt-btn rt-btn-check" data-exid="' + ex.id + '">Check Answer</button>';
    h += '<button class="rt-btn rt-btn-skip" data-exid="' + ex.id + '">Skip &rarr;</button>';
    h += '</div>';
    h += '<div class="rt-result" data-exid="' + ex.id + '"></div>';

    // Print-only answer
    if (ex.solution) {
      h += '<div class="rt-print-answer"><strong>Solution:</strong> <code>' + esc(ex.solution) + '</code></div>';
    }

    h += '</div>';
    container.innerHTML += h;
  }

  function renderFreeInput(ex) {
    return '<div class="rt-input-wrap"><span class="rt-delim">/</span>' +
      '<input type="text" class="rt-input" data-exid="' + ex.id + '" placeholder="type your regex here" spellcheck="false" autocomplete="off">' +
      '<span class="rt-delim">/g</span></div>';
  }

  function renderFixerInput(ex) {
    return '<div class="rt-fixer-label">Broken regex (edit to fix):</div>' +
      '<div class="rt-input-wrap rt-input-fixer"><span class="rt-delim">/</span>' +
      '<input type="text" class="rt-input" data-exid="' + ex.id + '" value="' + esc(ex.brokenRegex) + '" spellcheck="false" autocomplete="off">' +
      '<span class="rt-delim">/g</span></div>' +
      (ex.hint ? '<details class="rt-hint"><summary>Why is it broken?</summary><p>' + ex.hint + '</p></details>' : '');
  }

  function renderParsonsInput(ex) {
    var h = '<div class="rt-parsons" data-exid="' + ex.id + '">';
    h += '<div class="rt-parsons-label">Drag fragments into the answer box:</div>';
    h += '<div class="rt-parsons-bank" data-exid="' + ex.id + '">';
    // Shuffle fragments
    var frags = ex.fragments.slice();
    for (var i = frags.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = frags[i]; frags[i] = frags[j]; frags[j] = tmp;
    }
    for (var i = 0; i < frags.length; i++) {
      h += '<span class="rt-frag" draggable="true" data-frag="' + esc(frags[i]) + '">' + esc(frags[i]) + '</span>';
    }
    h += '</div>';
    h += '<div class="rt-parsons-target" data-exid="' + ex.id + '">';
    h += '<span class="rt-delim">/</span>';
    h += '<span class="rt-parsons-drop" data-exid="' + ex.id + '"></span>';
    h += '<span class="rt-delim">/g</span>';
    h += '</div>';
    h += '<button class="rt-btn rt-btn-clear" data-exid="' + ex.id + '">Clear</button>';
    // Hidden input for the assembled regex
    h += '<input type="hidden" class="rt-input" data-exid="' + ex.id + '">';
    h += '</div>';
    return h;
  }

  // ── Visualizer ─────────────────────────────────────────────────────────────

  function renderVisualizer(exId) {
    var data = VISUALIZER_STEPS[exId];
    if (!data) return '';
    var h = '<div class="rt-viz"><div class="rt-viz-title">' + data.title + '</div>';
    for (var s = 0; s < data.scenarios.length; s++) {
      var sc = data.scenarios[s];
      var k = exId + '-' + s;
      h += '<div class="rt-viz-sc" data-k="' + k + '">';
      h += '<div class="rt-viz-sc-label">' + sc.label + '</div>';
      h += '<div class="rt-viz-row"><span class="rt-viz-rl">Regex:</span><code class="rt-viz-re" data-k="' + k + '">' + esc(sc.regex) + '</code></div>';
      h += '<div class="rt-viz-row"><span class="rt-viz-rl">String:</span><code class="rt-viz-str" data-k="' + k + '">' + esc(sc.input) + '</code></div>';
      h += '<div class="rt-viz-desc" data-k="' + k + '">Press <strong>Step</strong> or <strong>Play</strong> to begin.</div>';
      h += '<div class="rt-viz-ctrls">';
      h += '<button class="rt-viz-btn" data-a="reset" data-k="' + k + '">&#8634; Reset</button>';
      h += '<button class="rt-viz-btn" data-a="prev" data-k="' + k + '">&larr; Back</button>';
      h += '<button class="rt-viz-btn rt-viz-btn-p" data-a="next" data-k="' + k + '">Step &rarr;</button>';
      h += '<button class="rt-viz-btn" data-a="play" data-k="' + k + '">&#9654; Play</button>';
      h += '<span class="rt-viz-counter" data-k="' + k + '">0 / ' + sc.steps.length + '</span>';
      h += '</div></div>';
    }
    h += '</div>';
    return h;
  }

  var vizState = {};

  function updateViz(k) {
    var parts = k.split('-');
    var exId = parts.slice(0, -1).join('-');
    var scIdx = parseInt(parts[parts.length - 1], 10);
    var data = VISUALIZER_STEPS[exId];
    if (!data) return;
    var sc = data.scenarios[scIdx];
    var st = (vizState[k] || { step: -1 }).step;

    var counter = document.querySelector('.rt-viz-counter[data-k="' + k + '"]');
    if (counter) counter.textContent = (st + 1) + ' / ' + sc.steps.length;

    var descEl = document.querySelector('.rt-viz-desc[data-k="' + k + '"]');
    if (descEl) descEl.innerHTML = st < 0 ? 'Press <strong>Step</strong> or <strong>Play</strong> to begin.' : sc.steps[st].desc;

    var reEl = document.querySelector('.rt-viz-re[data-k="' + k + '"]');
    if (reEl) {
      if (st < 0) { reEl.innerHTML = esc(sc.regex); }
      else {
        var s = sc.steps[st], chars = sc.regex.split(''), html = '';
        for (var i = 0; i < chars.length; i++) {
          var cls = (i >= s.regexHL[0] && i <= s.regexHL[1]) ? ' class="rt-viz-hl-re"' : '';
          html += '<span' + cls + '>' + esc(chars[i]) + '</span>';
        }
        reEl.innerHTML = html;
      }
    }

    var strEl = document.querySelector('.rt-viz-str[data-k="' + k + '"]');
    if (strEl) {
      if (st < 0) { strEl.innerHTML = esc(sc.input); }
      else {
        var s = sc.steps[st], chars = sc.input.split(''), html = '';
        for (var i = 0; i < chars.length; i++) {
          var cls = [];
          if (s.strMatch && i >= s.strMatch[0] && i <= s.strMatch[1]) cls.push('rt-viz-hl-m');
          if (i === s.strHL[0]) cls.push('rt-viz-cur');
          html += '<span' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' + esc(chars[i]) + '</span>';
        }
        strEl.innerHTML = html;
      }
    }
  }

  function vizAction(k, action) {
    var parts = k.split('-');
    var exId = parts.slice(0, -1).join('-');
    var scIdx = parseInt(parts[parts.length - 1], 10);
    var data = VISUALIZER_STEPS[exId];
    if (!data) return;
    var sc = data.scenarios[scIdx];
    if (!vizState[k]) vizState[k] = { step: -1, timer: null };
    var s = vizState[k];
    if (s.timer) { clearInterval(s.timer); s.timer = null; }

    if (action === 'next' && s.step < sc.steps.length - 1) s.step++;
    else if (action === 'prev' && s.step > -1) s.step--;
    else if (action === 'reset') s.step = -1;
    else if (action === 'play') {
      if (s.step >= sc.steps.length - 1) s.step = -1;
      s.timer = setInterval(function () {
        if (s.step < sc.steps.length - 1) { s.step++; updateViz(k); }
        else { clearInterval(s.timer); s.timer = null; }
      }, 1800);
      s.step++;
    }
    updateViz(k);
  }

  // ── Exercise Logic ─────────────────────────────────────────────────────────

  function getPattern(exId) {
    var el = document.querySelector('.rt-input[data-exid="' + exId + '"]');
    return el ? el.value : '';
  }

  function onInput(exId) {
    var pattern = getPattern(exId);
    var ex = EXERCISES.filter(function (e) { return e.id === exId; })[0];
    if (!ex) return;

    var compiled = tryCompile(pattern, 'g');
    var errEl = document.querySelector('.rt-error[data-exid="' + exId + '"]');

    if (compiled && compiled.error) {
      if (errEl) { errEl.textContent = compiled.error; errEl.style.display = 'block'; }
      clearSample(exId); clearTests(exId);
      return;
    }
    if (errEl) errEl.style.display = 'none';

    // Highlight sample text
    if (ex.sampleText !== null) {
      var sEl = document.querySelector('.rt-sample[data-exid="' + exId + '"]');
      if (sEl && compiled) sEl.innerHTML = highlightText(ex.sampleText, findMatches(compiled, ex.sampleText));
      else if (sEl) sEl.innerHTML = esc(ex.sampleText);
    }

    // Update test icons
    var testEls = document.querySelectorAll('.rt-tests[data-exid="' + exId + '"] .rt-test');
    for (var i = 0; i < ex.tests.length; i++) {
      var t = ex.tests[i], el = testEls[i];
      if (!el) continue;
      if (!pattern) { el.className = 'rt-test'; el.querySelector('.rt-test-icon').innerHTML = '&#9679;'; continue; }
      var matches = testRegex(pattern, t.input);
      var ok = (matches === t.shouldMatch);
      el.className = 'rt-test ' + (ok ? 'rt-test-pass' : 'rt-test-fail');
      el.querySelector('.rt-test-icon').innerHTML = ok ? '&#10003;' : '&#10007;';
    }

    // Hide previous result
    var rEl = document.querySelector('.rt-result[data-exid="' + exId + '"]');
    if (rEl) rEl.style.display = 'none';
  }

  function clearSample(exId) {
    var ex = EXERCISES.filter(function (e) { return e.id === exId; })[0];
    if (!ex || ex.sampleText === null) return;
    var el = document.querySelector('.rt-sample[data-exid="' + exId + '"]');
    if (el) el.innerHTML = esc(ex.sampleText);
  }

  function clearTests(exId) {
    var els = document.querySelectorAll('.rt-tests[data-exid="' + exId + '"] .rt-test');
    for (var i = 0; i < els.length; i++) {
      els[i].className = 'rt-test';
      els[i].querySelector('.rt-test-icon').innerHTML = '&#9679;';
    }
  }

  function getFailureHint(ex, pattern) {
    // Check visible tests for specific failure patterns to give targeted guidance
    var falsePositives = 0, falseNegatives = 0;
    for (var i = 0; i < ex.tests.length; i++) {
      var t = ex.tests[i];
      var matched = testRegex(pattern, t.input);
      if (matched && !t.shouldMatch) falsePositives++;
      if (!matched && t.shouldMatch) falseNegatives++;
    }
    if (falsePositives > 0 && falseNegatives === 0) {
      return 'Your pattern is matching text it shouldn\'t. Check the failing tests — what is your regex accepting that it should reject?';
    } else if (falseNegatives > 0 && falsePositives === 0) {
      return 'Your pattern is too strict — it\'s missing valid matches. Look at what the failing tests have in common.';
    } else if (falsePositives > 0 && falseNegatives > 0) {
      return 'Some matches are wrong and some are missing. Review the failing tests: what does your pattern match that it shouldn\'t, and what does it miss?';
    }
    return 'Check the test cases with <strong>&#10007;</strong> marks and think about what your pattern is doing differently than expected.';
  }

  // ── Self-Explanation Prompts ─────────────────────────────────────────────

  var SELF_EXPLANATIONS = {
    'literal-1': { q: 'Why does this pattern also match "print" inside "sprint"?', a: 'Literal patterns match anywhere in the string — they don\'t care about word boundaries. The engine scans left to right and finds the substring "print" wherever it appears.' },
    'literal-2': { q: 'Why does your regex match "error" inside "terror" but not "Error"?', a: 'Literal matching is case-sensitive by default. The lowercase "error" appears as a substring in "terror", but "Error" with a capital E is a different character sequence.' },
    'charclass-1': { q: 'What would happen if you added A-Z inside the brackets?', a: 'The character class [aeiouAEIOU] would also match uppercase vowels. Character classes match any single character listed inside the brackets.' },
    'charclass-2': { q: 'Why does [^a-zA-Z] match spaces and digits, not just punctuation?', a: 'The negated class [^a-zA-Z] matches any character that is NOT a letter — that includes digits, spaces, punctuation, and any other non-letter character.' },
    'meta-character-1': { q: 'What is the difference between \\d and [0-9]?', a: 'They are functionally equivalent — \\d is a shorthand for the character class [0-9]. Meta characters exist for convenience so you don\'t have to write the full class every time.' },
    'meta-character-2': { q: 'Why do we need \\. instead of just . to match a literal dot?', a: 'The dot . is a metacharacter (wildcard) that matches ANY character. To match an actual period, you must escape it with a backslash, telling the engine to treat it literally.' },
    'anchor-0': { q: 'Why did \\d+ fail to reject "123abc"?', a: 'Without anchors, the regex engine looks for a matching substring anywhere in the input. It found "123" inside "123abc" and reported success — it doesn\'t care about the rest of the string. Anchors (^ and $) force the match to span the entire input.' },
    'anchor-1': { q: 'What would happen without the ^ and $ anchors?', a: 'Without anchors, \\d+ would match any sequence of digits anywhere in a string — "abc123def" would match on the "123" substring. Anchors force the entire string to consist of digits.' },
    'anchor-2': { q: 'Why does \\b reject "go" inside "cargo" but accept "go" after punctuation?', a: '\\b matches the boundary between a word character (\\w) and a non-word character. In "cargo", both sides of "go" are word characters. After punctuation or at string edges, there\'s a word/non-word boundary.' },
    'anchor-3': { q: 'When should you always use anchors in a regex?', a: 'Whenever you\'re validating that an entire input matches a format (usernames, passwords, ZIP codes, etc.). Without ^ and $, the regex can succeed by matching any valid substring, ignoring invalid characters elsewhere.' },
    'quant-1': { q: 'Why do we need \\b on both sides of \\d{5}?', a: 'Without word boundaries, \\d{5} would match the first 5 digits of a longer number like "1234567". The \\b anchors ensure the 5 digits stand alone as a complete unit.' },
    'quant-2': { q: 'When would you use a* instead of a+?', a: 'Use a* when the element is truly optional (zero occurrences is valid). Use a+ when at least one occurrence is required. Getting this wrong is one of the most common regex bugs.' },
    'quant-3': { q: 'What does the ? quantifier do differently than * or +?', a: 'The ? means "zero or one" — it makes the preceding element optional but doesn\'t allow more than one. It\'s like a binary switch: the element is either there or not.' },
    'combine-1': { q: 'Could you solve this with alternation (|) instead of a character class?', a: 'Yes! gr[ae]y and grey|gray produce the same matches. Character classes are more concise for single-character variations. Alternation is needed for multi-character alternatives.' },
    'combine-2': { q: 'Would this pattern accept "25:99" as a valid time?', a: 'Yes — \\d{2}:\\d{2} only checks that there are exactly two digits, a colon, and two digits. It doesn\'t validate ranges (hours 00-23, minutes 00-59). Range validation requires more complex patterns.' },
    'combine-3': { q: 'Why is range validation with regex so much more verbose than a simple if-statement?', a: 'Regex operates character by character, not on numeric values. It can\'t compute "is this number ≤ 12" — it must enumerate valid character patterns (0 followed by 1-9, or 1 followed by 0-2). For numeric ranges, code-level validation is often cleaner.' }
  };

  function showSelfExplanation(ex) {
    var data = SELF_EXPLANATIONS[ex.id];
    if (!data) return;
    var exEl = document.getElementById('ex-' + ex.id);
    if (!exEl) return;
    // Don't add if already present
    if (exEl.querySelector('.rt-self-explain')) return;
    var html = '<div class="rt-self-explain">' +
      '<p class="rt-se-title"><strong>Explain it to yourself</strong></p>' +
      '<p class="rt-se-question"><strong>' + data.q + '</strong></p>' +
      '<p class="rt-se-think">Think about your answer, then click below to check.</p>' +
      '<details class="rt-se-answer"><summary>Reveal explanation</summary>' +
      '<p>' + data.a + '</p></details></div>';
    var resultEl = exEl.querySelector('.rt-result');
    if (resultEl) resultEl.insertAdjacentHTML('afterend', html);
  }

  function checkAnswer(exId) {
    var pattern = getPattern(exId);
    var ex = EXERCISES.filter(function (e) { return e.id === exId; })[0];
    if (!ex) return;
    var rEl = document.querySelector('.rt-result[data-exid="' + exId + '"]');

    if (!pattern) {
      if (rEl) { rEl.textContent = 'Please enter a regex pattern.'; rEl.className = 'rt-result rt-result-fail'; rEl.style.display = 'block'; }
      return;
    }

    var all = ex.tests.concat(ex.hiddenTests || []);
    var fails = 0;
    for (var i = 0; i < all.length; i++) {
      if (testRegex(pattern, all[i].input) !== all[i].shouldMatch) fails++;
    }

    if (fails === 0) {
      completedExercises[ex.id] = true;
      saveProgress();
      var exEl = document.getElementById('ex-' + ex.id);
      if (exEl) exEl.classList.add('rt-complete');
      var stEl = exEl ? exEl.querySelector('.rt-ex-status') : null;
      if (stEl) stEl.innerHTML = '&#10003;';
      if (rEl) { rEl.innerHTML = '&#10003; <strong>Correct!</strong> All test cases passed.'; rEl.className = 'rt-result rt-result-pass'; rEl.style.display = 'block'; }
      updateProgress();
      showSelfExplanation(ex);
    } else {
      var hint = getFailureHint(ex, pattern);
      if (rEl) { rEl.innerHTML = '&#10007; Not quite — ' + fails + ' test case' + (fails > 1 ? 's' : '') + ' failed (including hidden tests). ' + hint; rEl.className = 'rt-result rt-result-fail'; rEl.style.display = 'block'; }
    }
  }

  function skipExercise(exId) {
    for (var i = 0; i < EXERCISES.length; i++) {
      if (EXERCISES[i].id === exId && i < EXERCISES.length - 1) {
        var next = document.getElementById('ex-' + EXERCISES[i + 1].id);
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  // ── Parsons Drag & Drop ────────────────────────────────────────────────────

  var dragFrag = null;

  function initParsons() {
    document.addEventListener('dragstart', function (e) {
      if (e.target.classList.contains('rt-frag')) {
        dragFrag = e.target;
        e.target.classList.add('rt-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-frag'));
      }
    });
    document.addEventListener('dragend', function (e) {
      if (e.target.classList.contains('rt-frag')) {
        e.target.classList.remove('rt-dragging');
        dragFrag = null;
      }
    });
    document.addEventListener('dragover', function (e) {
      if (e.target.closest('.rt-parsons-drop') || e.target.closest('.rt-parsons-bank')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }
    });
    document.addEventListener('drop', function (e) {
      var drop = e.target.closest('.rt-parsons-drop');
      var bank = e.target.closest('.rt-parsons-bank');
      if (drop && dragFrag) {
        e.preventDefault();
        drop.appendChild(dragFrag);
        updateParsonsValue(drop.getAttribute('data-exid'));
      } else if (bank && dragFrag) {
        e.preventDefault();
        bank.appendChild(dragFrag);
        updateParsonsValue(bank.getAttribute('data-exid'));
      }
    });
    // Click to toggle between bank and drop zone (mobile-friendly)
    document.addEventListener('click', function (e) {
      var frag = e.target.closest('.rt-frag');
      if (!frag) return;
      var parent = frag.parentElement;
      var exId = parent.getAttribute('data-exid');
      if (!exId) return;
      if (parent.classList.contains('rt-parsons-bank')) {
        var drop = document.querySelector('.rt-parsons-drop[data-exid="' + exId + '"]');
        if (drop) { drop.appendChild(frag); updateParsonsValue(exId); }
      } else if (parent.classList.contains('rt-parsons-drop')) {
        var bank = document.querySelector('.rt-parsons-bank[data-exid="' + exId + '"]');
        if (bank) { bank.appendChild(frag); updateParsonsValue(exId); }
      }
    });
  }

  function updateParsonsValue(exId) {
    var drop = document.querySelector('.rt-parsons-drop[data-exid="' + exId + '"]');
    if (!drop) return;
    var frags = drop.querySelectorAll('.rt-frag');
    var val = '';
    for (var i = 0; i < frags.length; i++) val += frags[i].getAttribute('data-frag');
    var input = document.querySelector('.rt-input[data-exid="' + exId + '"]');
    if (input) input.value = val;
    onInput(exId);
  }

  function clearParsons(exId) {
    var drop = document.querySelector('.rt-parsons-drop[data-exid="' + exId + '"]');
    var bank = document.querySelector('.rt-parsons-bank[data-exid="' + exId + '"]');
    if (!drop || !bank) return;
    var frags = drop.querySelectorAll('.rt-frag');
    for (var i = 0; i < frags.length; i++) bank.appendChild(frags[i]);
    updateParsonsValue(exId);
  }

  // ── Progress ───────────────────────────────────────────────────────────────

  function updateProgress() {
    var total = EXERCISES.length, done = 0;
    for (var i = 0; i < total; i++) if (completedExercises[EXERCISES[i].id]) done++;
    var pct = Math.round((done / total) * 100);
    var bar = document.getElementById('rt-progress-fill');
    var label = document.getElementById('rt-progress-label');
    if (bar) bar.style.width = pct + '%';
    if (label) label.textContent = done + ' / ' + total + ' exercises completed';
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    // Group exercises by section
    var secs = [], secMap = {};
    for (var i = 0; i < EXERCISES.length; i++) {
      var ex = EXERCISES[i];
      if (!secMap[ex.section]) { secMap[ex.section] = []; secs.push(ex.section); }
      secMap[ex.section].push(ex);
    }

    // Render into containers
    for (var s = 0; s < secs.length; s++) {
      var name = secs[s];
      var cont = document.querySelector('.rt-section[data-section="' + name + '"]');
      if (!cont) continue;
      var exs = secMap[name];
      for (var j = 0; j < exs.length; j++) renderExercise(exs[j], cont);
    }

    // Events
    document.addEventListener('input', function (e) {
      if (e.target.classList.contains('rt-input')) onInput(e.target.getAttribute('data-exid'));
    });
    document.addEventListener('click', function (e) {
      var btn;
      if ((btn = e.target.closest('.rt-btn-check'))) { checkAnswer(btn.getAttribute('data-exid')); return; }
      if ((btn = e.target.closest('.rt-btn-skip'))) { skipExercise(btn.getAttribute('data-exid')); return; }
      if ((btn = e.target.closest('.rt-btn-clear'))) { clearParsons(btn.getAttribute('data-exid')); return; }
      if ((btn = e.target.closest('.rt-viz-btn'))) { vizAction(btn.getAttribute('data-k'), btn.getAttribute('data-a')); return; }
    });

    initParsons();
    updateProgress();

    // Trigger onInput for fixer exercises (they have pre-filled values)
    var fixerInputs = document.querySelectorAll('.rt-input-fixer .rt-input');
    for (var i = 0; i < fixerInputs.length; i++) {
      onInput(fixerInputs[i].getAttribute('data-exid'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
