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
        { input: 'no match here', shouldMatch: false, label: 'no "print"' }
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
      id: 'meta character-1', type: 'free',
      section: 'Meta Characters',
      title: 'Digit Detector',
      goal: 'Match every individual digit. Use the meta character <code>\\d</code>.',
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
      id: 'meta character-2', type: 'free',
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
        { input: 'Go!', shouldMatch: true },
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
      sampleText: 'Schedule: standup at 09:30, lunch at 12:00, review at 15:45. Note: 9:5 is not valid. Neither is 123:456.',
      solution: '\\d{2}:\\d{2}',
      tests: [
        { input: '09:30', shouldMatch: true, label: 'valid time' },
        { input: '12:00', shouldMatch: true, label: 'noon' },
        { input: '9:30', shouldMatch: false, label: 'single-digit hour — should NOT match' }
      ],
      hiddenTests: [
        { input: '23:59', shouldMatch: true },
        { input: 'ab:cd', shouldMatch: false }
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

    // ═══ Section 7: Greedy vs. Lazy ════════════════════════════════════════
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
        { input: '<b>bold</b>', shouldMatch: false, label: 'entire element — should NOT be one match' }
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
        { input: '"hello"', shouldMatch: true, label: 'first quoted string' },
        { input: '"goodbye"', shouldMatch: true, label: 'second quoted string' },
        { input: '"hello" and she replied "goodbye"', shouldMatch: false, label: 'should NOT match across quotes' }
      ],
      hiddenTests: [
        { input: '""', shouldMatch: true },
        { input: 'no quotes', shouldMatch: false }
      ]
    },

    // ═══ Section 8: Groups & Capturing ═════════════════════════════════════
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

    // ═══ Section 9: Lookaheads & Lookbehinds ═══════════════════════════════
    {
      id: 'look-1', type: 'free',
      section: 'Lookaheads & Lookbehinds',
      title: 'Dollar Amounts',
      goal: 'Match the numeric amount after a <code>$</code> sign — but do NOT include the <code>$</code> in the match. Use a positive lookbehind: <code>(?&lt;=\\$)</code>.',
      sampleText: 'Prices: \$25, €30, \$100, £50, \$7.99, ¥500, \$0.50, and €12.50 on sale.',
      solution: '(?<=\\$)[\\d.]+',
      tests: [
        { input: '$25', shouldMatch: true, label: 'dollar amount (match the number)' },
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
      goal: 'Validate that the entire string has at least one digit <strong>and</strong> at least one uppercase letter. Chain positive lookaheads <code>(?=.*\\d)</code> and <code>(?=.*[A-Z])</code> at the start.',
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
    },
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
            { regexHL: [0, 1], strHL: [9, 9], strMatch: null, desc: 'Engine tries <code>g</code> in "cargo". Previous char is <code>r</code> (word char). <code>\\b</code> <strong>not satisfied</strong>. Fails immediately.' },
            { regexHL: [2, 2], strHL: [14, 14], strMatch: [14, 14], desc: 'Engine reaches final "go". <code>\\b</code> satisfied. <code>g</code> matches, <code>o</code> matches.' },
            { regexHL: [4, 5], strHL: [16, 16], strMatch: [14, 15], desc: '<code>\\b</code>: end of string = boundary. <strong>Match #2: "go"</strong>. Only standalone words matched!' }
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
    } else {
      if (rEl) { rEl.innerHTML = '&#10007; Not quite — ' + fails + ' test case' + (fails > 1 ? 's' : '') + ' failed (including hidden tests).'; rEl.className = 'rt-result rt-result-fail'; rEl.style.display = 'block'; }
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
