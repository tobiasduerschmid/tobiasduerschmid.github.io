// RegEx Interactive Tutorial Engine — Advanced
// Supports: free-text exercises, Micro Parsons (drag-and-drop), Fixer Upper (debug),
// engine visualizer, real-time highlighting, and test-case validation.

(function () {
  'use strict';

  // ── Exercise Data ──────────────────────────────────────────────────────────
  // Types: 'free' (type regex), 'parsons' (drag-and-drop fragments), 'fixer' (debug broken regex)

  var EXERCISES = [

    // ═══ Warm-Up Review ════════════════════════════════════════════════════
    {
      id: 'review-1', type: 'free',
      section: 'Warm-Up Review',
      title: 'Review: Standalone Numbers',
      goal: 'Match standalone integers (one or more digits) that are NOT part of a word. Combine <code>\\b</code>, <code>\\d</code>, and <code>+</code>.',
      sampleText: 'Scores: 42 points, code A7 rejected, player 3 scored 100, item99 skipped.',
      solution: '\\b\\d+\\b',
      tests: [
        { input: '42', shouldMatch: true, label: 'standalone number' },
        { input: 'A7', shouldMatch: false, label: 'letter+digit — should NOT match whole thing' },
        { input: '100', shouldMatch: true, label: 'another standalone number' }
      ],
      hiddenTests: [
        { input: '0', shouldMatch: true },
        { input: 'x', shouldMatch: false }
      ]
    },
    {
      id: 'review-2', type: 'free',
      section: 'Warm-Up Review',
      title: 'Review: Simple Email Shape',
      goal: 'Match strings that look like simple email addresses: one or more word characters, an <code>@</code>, one or more word characters, a dot, then one or more letters. Validate the entire string.',
      sampleText: null,
      solution: '^\\w+@\\w+\\.[a-zA-Z]+$',
      tests: [
        { input: 'user@example.com', shouldMatch: true, label: 'valid email shape' },
        { input: 'test@host.org', shouldMatch: true, label: 'another valid shape' },
        { input: 'no-at-sign.com', shouldMatch: false, label: 'missing @ — should NOT match' },
        { input: '@host.com', shouldMatch: false, label: 'missing username — should NOT match' }
      ],
      hiddenTests: [
        { input: 'a@b.c', shouldMatch: true },
        { input: 'user@.com', shouldMatch: false },
        { input: 'user@host', shouldMatch: false }
      ]
    },
    {
      id: 'review-3', type: 'fixer',
      section: 'Warm-Up Review',
      title: 'Review: Fix the Year Matcher',
      goal: 'This regex should match exactly 4-digit years (like 2024) as standalone numbers. But it matches "20" inside "2024" and accepts "12345". Fix it.',
      sampleText: null,
      brokenRegex: '\\d+',
      solution: '\\b\\d{4}\\b',
      hint: 'You need to constrain the length to exactly 4 digits AND ensure they stand alone (not part of a longer number).',
      tests: [
        { input: '2024', shouldMatch: true, label: '4-digit year' },
        { input: '1999', shouldMatch: true, label: 'another year' },
        { input: '12345', shouldMatch: false, label: '5 digits — should NOT match' },
        { input: '99', shouldMatch: false, label: '2 digits — should NOT match' }
      ],
      hiddenTests: [
        { input: '0001', shouldMatch: true },
        { input: '123', shouldMatch: false }
      ]
    },

    // ═══ Greedy vs. Lazy ═══════════════════════════════════════════════════
    {
      id: 'greedy-1', type: 'free',
      section: 'Greedy vs. Lazy',
      title: 'Tag Trouble',
      goal: 'Match each <em>individual</em> HTML tag (like <code>&lt;b&gt;</code> or <code>&lt;/b&gt;</code>) — not the entire string. Try <code>&lt;.*&gt;</code> first to see the greedy problem, then add <code>?</code> to make it lazy.',
      sampleText: '<b>bold</b> and <i>italic</i> text',
      solution: '<.*?>',
      showVisualizer: true,
      tests: [
        { input: '<b>', shouldMatch: true, label: 'opening tag' },
        { input: '</b>', shouldMatch: true, label: 'closing tag' },
        { input: '<b>bold</b>', shouldMatch: true, matchCount: 2, label: 'two separate tags, not one big match' },
        { input: 'bold', shouldMatch: false, label: 'plain text — should NOT match' }
      ],
      hiddenTests: [
        { input: '<i>', shouldMatch: true },
        { input: 'text', shouldMatch: false }
      ]
    },
    {
      id: 'greedy-2', type: 'free',
      section: 'Greedy vs. Lazy',
      title: 'Quoted Strings',
      goal: 'Match each individual double-quoted string separately. Use a lazy quantifier.',
      sampleText: 'He said "hello" and she replied "goodbye" before they both whispered "see you later" softly.',
      solution: '".*?"',
      tests: [
        { input: '"hello"', shouldMatch: true, label: 'quoted string' },
        { input: '"hello" and "goodbye"', shouldMatch: true, matchCount: 2, label: 'two quoted strings matched separately' },
        { input: 'no quotes here', shouldMatch: false, label: 'no quotes — should NOT match' }
      ],
      hiddenTests: [
        { input: '""', shouldMatch: true },
        { input: 'no quotes', shouldMatch: false }
      ]
    },

    // ═══ Groups & Capturing ════════════════════════════════════════════════
    {
      id: 'group-1', type: 'free',
      section: 'Groups & Capturing',
      title: 'Repeated Syllables',
      goal: 'Match the syllable <code>na</code> repeated <strong>2 or more</strong> times in a row. Use a group <code>(...)</code> with a quantifier.',
      sampleText: 'The crowd chanted: na nana nanana nananana! A banana has na but also nan. Just na alone is not enough.',
      solution: '(na){2,}',
      tests: [
        { input: 'nana', shouldMatch: true, label: '2 repetitions' },
        { input: 'nanana', shouldMatch: true, label: '3 repetitions' },
        { input: 'na', shouldMatch: false, label: 'only 1 — should NOT match' }
      ],
      hiddenTests: [
        { input: 'nananana', shouldMatch: true },
        { input: 'nan', shouldMatch: false }
      ]
    },
    {
      id: 'group-2', type: 'fixer',
      section: 'Groups & Capturing',
      title: 'Fix the Repeater',
      goal: 'This regex tries to match 3-letter airport codes (like LAX, JFK) but it incorrectly matches <code>LA</code> and <code>ABCD</code>. Fix it.',
      sampleText: null,
      brokenRegex: '[A-Z]+',
      solution: '^[A-Z]{3}$',
      hint: 'You need to specify exactly 3 letters, and use anchors to prevent partial matching.',
      tests: [
        { input: 'LAX', shouldMatch: true, label: '3 uppercase letters' },
        { input: 'JFK', shouldMatch: true, label: 'another valid code' },
        { input: 'LA', shouldMatch: false, label: 'only 2 letters — should NOT match' },
        { input: 'ABCD', shouldMatch: false, label: '4 letters — should NOT match' }
      ],
      hiddenTests: [
        { input: 'SFO', shouldMatch: true },
        { input: 'lax', shouldMatch: false },
        { input: 'A', shouldMatch: false }
      ]
    },

    // ═══ Lookaheads & Lookbehinds ══════════════════════════════════════════
    {
      id: 'look-1', type: 'free',
      section: 'Lookaheads & Lookbehinds',
      title: 'Dollar Amounts',
      goal: 'Match the numeric amount after a <code>$</code> sign — but do NOT include the <code>$</code> in the match. Hint: Use a positive lookbehind.',
      sampleText: 'Prices: \$25, €30, \$100, £50, \$7.99, ¥500, \$0.50, and €12.50 have been on sale for 30 days.',
      solution: '(?<=\\$)[\\d.]+',
      tests: [
        { input: '$25', shouldMatch: true, firstMatch: '25', label: 'match "25" only — not "$25"' },
        { input: '€30', shouldMatch: false, label: 'euro — should NOT match' },
        { input: '£50', shouldMatch: false, label: 'pound — should NOT match' }
      ],
      hiddenTests: [
        { input: '$0', shouldMatch: true },
        { input: '100', shouldMatch: false }
      ]
    },
    {
      id: 'look-2', type: 'free',
      section: 'Lookaheads & Lookbehinds',
      title: 'Password Check',
      goal: 'Validate that the entire string has at least one digit <strong>and</strong> at least one uppercase letter. Hint: Use positive lookaheads',
      sampleText: null,
      solution: '^(?=.*\\d)(?=.*[A-Z]).+$',
      tests: [
        { input: 'Hello1', shouldMatch: true, label: 'uppercase + digit' },
        { input: 'hello1', shouldMatch: false, label: 'no uppercase — should NOT match' },
        { input: 'HELLO', shouldMatch: false, label: 'no digit — should NOT match' },
        { input: 'H1', shouldMatch: true, label: 'minimal valid' }
      ],
      hiddenTests: [
        { input: 'aB3cD', shouldMatch: true },
        { input: '12345', shouldMatch: false },
        { input: 'abcde', shouldMatch: false }
      ]
    },

    // ═══ Putting It All Together ════════════════════════════════════════════
    {
      id: 'integrate-1', type: 'free',
      section: 'Putting It All Together',
      title: 'CSS Hex Color',
      goal: 'Validate a CSS hex color code: a <code>#</code> followed by exactly 3 <strong>or</strong> 6 hex digits (0-9, a-f, A-F). The entire string must match. Combine: anchors, character classes, quantifiers, alternation, and grouping.',
      sampleText: null,
      solution: '^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$',
      tests: [
        { input: '#FFF', shouldMatch: true, label: '3-digit hex' },
        { input: '#1A2B3C', shouldMatch: true, label: '6-digit hex' },
        { input: '#GGG', shouldMatch: false, label: 'invalid hex chars — should NOT match' },
        { input: '#12', shouldMatch: false, label: 'only 2 digits — should NOT match' },
        { input: '123456', shouldMatch: false, label: 'missing # — should NOT match' }
      ],
      hiddenTests: [
        { input: '#abcdef', shouldMatch: true },
        { input: '#1234', shouldMatch: false },
        { input: '#AABBCC', shouldMatch: true },
        { input: 'FFF', shouldMatch: false }
      ]
    },
    {
      id: 'integrate-2', type: 'free',
      section: 'Putting It All Together',
      title: 'Student ID Validator',
      goal: 'Validate a student ID: exactly one uppercase letter followed by exactly 9 digits (e.g., <code>A123456789</code>). The entire string must match. Combine: anchors, character classes, and quantifiers.',
      sampleText: null,
      solution: '^[A-Z]\\d{9}$',
      tests: [
        { input: 'A123456789', shouldMatch: true, label: 'valid ID' },
        { input: 'B000000001', shouldMatch: true, label: 'another valid ID' },
        { input: 'a123456789', shouldMatch: false, label: 'lowercase letter — should NOT match' },
        { input: 'AB12345678', shouldMatch: false, label: 'two letters — should NOT match' },
        { input: 'A12345', shouldMatch: false, label: 'too few digits — should NOT match' }
      ],
      hiddenTests: [
        { input: 'Z999999999', shouldMatch: true },
        { input: '1234567890', shouldMatch: false },
        { input: 'A1234567890', shouldMatch: false }
      ]
    },
    {
      id: 'integrate-3', type: 'free',
      section: 'Putting It All Together',
      title: 'Extract Prices (Dollar Only)',
      goal: 'Match dollar amounts like <code>$19.99</code> or <code>$5</code> in a string. The match should include the <code>$</code>, one or more digits, and an optional decimal part (dot + exactly 2 digits). Combine: escaping, quantifiers, grouping, and the <code>?</code> quantifier.',
      sampleText: 'Items: $19.99 widget, $5 sticker, €12.50 imported, $100.00 premium, $0.99 candy, 50 cents.',
      solution: '\\$\\d+(\\.\\d{2})?',
      tests: [
        { input: '$19.99', shouldMatch: true, label: 'dollars and cents' },
        { input: '$5', shouldMatch: true, label: 'whole dollars' },
        { input: '€12.50', shouldMatch: false, label: 'euro — should NOT match' },
        { input: '50', shouldMatch: false, label: 'plain number — should NOT match' }
      ],
      hiddenTests: [
        { input: '$0.99', shouldMatch: true },
        { input: '$100.00', shouldMatch: true },
        { input: 'free', shouldMatch: false }
      ]
    },
    {
      id: 'integrate-4', type: 'fixer',
      section: 'Putting It All Together',
      title: 'Fix the Log Extractor',
      goal: 'This regex tries to extract the word after "ERROR:" in log lines (e.g., "ERROR: timeout" should match "timeout"). But it matches the entire line instead. Fix it so it only captures the first word after "ERROR: ".',
      sampleText: null,
      brokenRegex: 'ERROR: .+',
      solution: '(?<=ERROR: )\\w+',
      hint: 'The .+ is greedy and consumes everything. You want only the first word (\\w+) after "ERROR: ". A lookbehind can check for "ERROR: " without including it in the match.',
      tests: [
        { input: 'ERROR: timeout', shouldMatch: true, firstMatch: 'timeout', label: 'match "timeout" only — not "ERROR: timeout"' },
        { input: 'ERROR: connection refused', shouldMatch: true, firstMatch: 'connection', label: 'match first word only' },
        { input: 'INFO: all good', shouldMatch: false, label: 'INFO line — should NOT match' },
        { input: 'WARNING: low memory', shouldMatch: false, label: 'WARNING line — should NOT match' }
      ],
      hiddenTests: [
        { input: 'ERROR: null', shouldMatch: true },
        { input: 'ERRORS: none', shouldMatch: false }
      ]
    }
  ];

  // ── Visualizer Step Data ───────────────────────────────────────────────────

  var VISUALIZER_STEPS = {
    'greedy-1': {
      title: 'How the Engine Processes <code>&lt;.*&gt;</code> vs <code>&lt;.*?&gt;</code>',
      scenarios: [
        {
          label: 'Greedy: <.*>',
          input: '<b>bold</b>',
          regex: '<.*>',
          steps: [
            { regexHL: [0, 0], strHL: [0, 0], strMatch: null, desc: 'Engine starts. Pattern pointer at <code>&lt;</code>, string pointer at position 0.' },
            { regexHL: [0, 0], strHL: [0, 0], strMatch: [0, 0], desc: '<strong>Match!</strong> Literal <code>&lt;</code> matches <code>&lt;</code>. Both pointers advance.' },
            { regexHL: [1, 2], strHL: [1, 1], strMatch: [0, 10], desc: '<code>.*</code> is <em>greedy</em> — it consumes <strong>everything</strong> to the end: <code>b&gt;bold&lt;/b&gt;</code>.' },
            { regexHL: [3, 3], strHL: [11, 11], strMatch: [0, 10], desc: 'Pattern needs <code>&gt;</code>, but the string pointer is past the end. <strong>Fails.</strong>' },
            { regexHL: [1, 2], strHL: [10, 10], strMatch: [0, 9], desc: '<strong>Backtrack!</strong> <code>.*</code> gives back one character. Pointer moves back to <code>&gt;</code>.' },
            { regexHL: [3, 3], strHL: [10, 10], strMatch: [0, 10], desc: 'Pattern <code>&gt;</code> matches the final <code>&gt;</code>. <strong>Match found</strong> — but it matched <em>everything</em>: <code>&lt;b&gt;bold&lt;/b&gt;</code>. Too much!' }
          ]
        },
        {
          label: 'Lazy: <.*?>',
          input: '<b>bold</b>',
          regex: '<.*?>',
          steps: [
            { regexHL: [0, 0], strHL: [0, 0], strMatch: [0, 0], desc: 'Literal <code>&lt;</code> matches <code>&lt;</code>. Both pointers advance.' },
            { regexHL: [1, 3], strHL: [1, 1], strMatch: [0, 0], desc: '<code>.*?</code> is <em>lazy</em> — it tries matching <strong>zero</strong> characters first.' },
            { regexHL: [4, 4], strHL: [1, 1], strMatch: [0, 0], desc: 'Pattern <code>&gt;</code> checks against <code>b</code>. <strong>No match.</strong>' },
            { regexHL: [1, 3], strHL: [1, 1], strMatch: [0, 1], desc: 'Lazy quantifier <em>expands</em>: <code>.*?</code> now matches 1 character (<code>b</code>).' },
            { regexHL: [4, 4], strHL: [2, 2], strMatch: [0, 1], desc: 'Pattern <code>&gt;</code> checks against <code>&gt;</code>. <strong>Match!</strong>' },
            { regexHL: [4, 4], strHL: [2, 2], strMatch: [0, 2], desc: 'Result: matched just <code>&lt;b&gt;</code>. The engine continues and finds <code>&lt;/b&gt;</code>, <code>&lt;i&gt;</code>, <code>&lt;/i&gt;</code> separately.' }
          ]
        }
      ]
    }
  };

  // ── State ──────────────────────────────────────────────────────────────────

  var completedExercises = loadProgress();

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem('regex-tutorial-advanced-progress') || '{}'); }
    catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem('regex-tutorial-advanced-progress', JSON.stringify(completedExercises)); }
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

  // Extended test: supports firstMatch (exact text of first match) and matchCount
  function checkSingleTest(pattern, t) {
    var re = tryCompile(pattern, 'g');
    if (!re || re.error) return !t.shouldMatch;
    re.lastIndex = 0;
    var matches = [], m, safety = 0;
    while ((m = re.exec(t.input)) !== null) {
      matches.push(m[0]);
      if (m[0].length === 0) re.lastIndex++;
      if (++safety > 1000) break;
    }
    var matched = matches.length > 0;
    if (matched !== t.shouldMatch) return false;
    if (matched && t.firstMatch !== undefined && matches[0] !== t.firstMatch) return false;
    if (matched && t.matchCount !== undefined && matches.length !== t.matchCount) return false;
    return true;
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
      var ok = checkSingleTest(pattern, t);
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
    'review-1': { q: 'Which three concepts from the basics did you combine here?', a: 'Word boundaries (\\b) to ensure standalone matching, the metacharacter \\d to match digits, and the quantifier + to match one or more. This is a typical integration pattern — most real regex problems require combining 3+ features.' },
    'review-2': { q: 'Why do you need \\. (escaped dot) between the domain and TLD?', a: 'An unescaped dot matches ANY character — so "user@hostXcom" would also match. Escaping the dot (\\.) ensures only a literal period separates the domain from the top-level domain.' },
    'review-3': { q: 'Why are both \\b and {4} necessary?', a: '\\d{4} alone would match the first 4 digits of "12345". \\b\\d\\b alone would match digits of any length. You need both: {4} constrains the count, \\b constrains the boundaries.' },
    'greedy-1': { q: 'In your own words, what is the difference between greedy and lazy matching?', a: 'Greedy (default): consume as much as possible, then backtrack if needed. Lazy (with ?): consume as little as possible, then expand if needed. Greedy goes big-to-small; lazy goes small-to-big.' },
    'greedy-2': { q: 'What would happen if you used a greedy ".*" between the quotes instead of lazy ".*?"?', a: 'The greedy .* would consume everything from the first opening quote to the LAST closing quote in the entire string, treating all text in between as one match.' },
    'group-1': { q: 'What is the difference between na{2,} and (na){2,}?', a: 'na{2,} means "n followed by 2 or more a\'s" (naaa...). (na){2,} means "the group na repeated 2 or more times" (nana, nanana...). Parentheses group multiple characters into a single unit.' },
    'group-2': { q: 'Why did the original [A-Z]+ match both "LA" and "ABCD"?', a: 'The + quantifier means "one or more" with no upper limit. Without {3} to specify exactly 3, and without anchors to prevent substring matching, any sequence of uppercase letters is accepted.' },
    'look-1': { q: 'Why use a lookbehind instead of just including \\$ in the pattern?', a: 'A lookbehind checks that $ precedes the match but doesn\'t include it in the result. If you used \\$[\\d.]+, the match would be "$25" (with the dollar sign). Lookbehinds let you extract just the number.' },
    'look-2': { q: 'How do chained lookaheads work together at the same position?', a: 'Each lookahead independently checks a condition from the same starting position (like a logical AND). (?=.*\\d) verifies a digit exists somewhere, (?=.*[A-Z]) verifies an uppercase letter exists. Neither consumes characters, so the string pointer stays at the start for the next check.' },
    'integrate-1': { q: 'Why is the alternation (|) inside a group, and why does the 6-digit option come first?', a: 'The group (...) contains the alternation so that ^ and $ still anchor the whole pattern. The 6-digit option comes first because regex tries alternatives left-to-right — if 3-digit came first, "AABBCC" would match only "AAB" (the first 3 hex chars).' },
    'integrate-2': { q: 'Which regex features did you combine, and why was each necessary?', a: 'Anchors (^$) to validate the full string, a character class ([A-Z]) for exactly one uppercase letter, a metacharacter (\\d) for digits, and a quantifier ({9}) for exactly 9 repetitions. Remove any one and the validation breaks.' },
    'integrate-3': { q: 'Why did you group the decimal part and make it optional?', a: 'The decimal part (.XX) is a multi-character unit — the dot and two digits must appear together or not at all. Grouping with (...) treats them as a single unit, and ? makes the whole group optional.' },
    'integrate-4': { q: 'What is the difference between using a lookbehind here versus including "ERROR: " in the match?', a: 'A lookbehind asserts that "ERROR: " precedes the current position without consuming it — so the match result is just the word (e.g., "timeout"), not "ERROR: timeout". This is useful when you want to extract data after a known prefix.' }
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
      if (!checkSingleTest(pattern, all[i])) fails++;
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
