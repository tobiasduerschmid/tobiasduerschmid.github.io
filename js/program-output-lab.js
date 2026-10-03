/**
 * ProgramOutputLab — "predict → run → reveal" cards for short programs.
 *
 * A front end over UnixCommandLab (unix-command-lab.js, which must be loaded
 * first). Each program is shown as the source file that a command such as
 * `python3 <file>` or `runghc <file>` runs, so the card keeps the shell lab's
 * exact layout, prediction box, reveal burst, confetti, reduced-motion gates,
 * and print behaviour. This module adds only what depends on the language:
 * the run command, syntax colouring, and — for languages that report a crash
 * on stderr — what counts as a correct prediction of that crash.
 *
 * Spec:
 *   {
 *     "language": "python",             // a key of LANGUAGES below
 *     "file": "alerts.py",              // optional; per-language default
 *     "code": "print('hi')",
 *     "description": "markdown shown before the run",
 *     "predict": true,                  // true: write the prediction in a box;
 *                                       // false: predict in your head
 *     "predictPrompt": "string",        // optional custom prompt
 *     "stdin": "typed input",           // optional
 *     "files": [ { "name": "data.txt", "content": "..." } ],  // optional
 *     "output": {
 *       "stdout": "hi",
 *       "stderr": "Traceback …",        // optional; exit defaults to 1 if set
 *       "exit": 0                       // optional
 *     },
 *     "accept": ["…"],                  // optional explicit correct predictions
 *     "notice": "markdown explanation revealed after the run"
 *   }
 *
 * Usage:
 *   <div data-program-output-lab>
 *     <script type="application/json"> { … spec … } </script>
 *   </div>
 */
(function () {
  'use strict';

  var DEFAULT_PROMPT = 'Predict exactly what the program prints:';
  var MENTAL_PREDICTION_PLACEHOLDER =
    'Predict the output in your head, then press Run to check.';
  var NUMBER_PATTERN = '\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b';

  // A Python crash is only "predicted" if the student foresaw it, so stdout
  // alone must not earn the celebration. Accept the printed lines followed by
  // either the final traceback line ("UnboundLocalError: cannot access …") or
  // just the exception's name.
  function pythonCrashPredictions(stdout, stderr) {
    var tracebackLines = stderr.trim().split('\n');
    var exceptionLine = tracebackLines[tracebackLines.length - 1].trim();
    var exceptionName = exceptionLine.split(':')[0];
    var printed = stdout ? stdout.replace(/\n+$/, '') + '\n' : '';
    return [printed + exceptionLine, printed + exceptionName];
  }

  // Per-language data. Patterns are regular-expression source strings; the
  // tokenizer tries comment, string, number, then identifier at each position.
  var LANGUAGES = {
    python: {
      defaultFile: 'main.py',
      command: function (file) { return 'python3 ' + file; },
      comment: '#[^\\n]*',
      string: '(?:[rRbBfFuU]{1,2})?(?:"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\')',
      identifier: '[A-Za-z_]\\w*',
      keywords: [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
        'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
        'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
        'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
        'while', 'with', 'yield',
      ],
      builtins: [
        'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float',
        'id', 'input', 'int', 'isinstance', 'iter', 'len', 'list', 'map',
        'max', 'min', 'next', 'object', 'open', 'print', 'range', 'repr',
        'reversed', 'round', 'set', 'sorted', 'str', 'sum', 'super', 'tuple',
        'type', 'zip',
      ],
      capitalizedAreTypes: false,
      crashPredictions: pythonCrashPredictions,
    },
    haskell: {
      defaultFile: 'Main.hs',
      command: function (file) { return 'runghc ' + file; },
      comment: '--[^\\n]*|\\{-[\\s\\S]*?-\\}',
      // A character literal holds exactly one (possibly escaped) character,
      // so a prime inside a name such as `rate'` is never read as a quote:
      // the identifier pattern consumes the whole name first.
      string: '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])\'',
      identifier: "[A-Za-z_][\\w']*",
      keywords: [
        'case', 'class', 'data', 'deriving', 'do', 'else', 'if', 'import',
        'in', 'infix', 'infixl', 'infixr', 'instance', 'let', 'module',
        'newtype', 'of', 'then', 'type', 'where',
      ],
      builtins: [
        'abs', 'concat', 'div', 'drop', 'elem', 'error', 'filter', 'foldl',
        'foldr', 'fst', 'head', 'length', 'map', 'max', 'min', 'mod', 'not',
        'otherwise', 'print', 'product', 'putStrLn', 'replicate', 'reverse',
        'show', 'snd', 'subtract', 'succ', 'sum', 'tail', 'take',
        'takeWhile', 'undefined', 'zip',
      ],
      capitalizedAreTypes: true,
      crashPredictions: null,
    },
  };

  // ---------------------------------------------------------------------------
  // Syntax colouring. A deliberately small tokenizer: it only has to cover the
  // short teaching programs these cards show, and it never changes the text —
  // every character of the source ends up in the output exactly once.
  // ---------------------------------------------------------------------------
  function compileHighlighter(language) {
    var pattern = new RegExp([
      '(' + language.comment + ')',
      '(' + language.string + ')',
      '(' + NUMBER_PATTERN + ')',
      '(' + language.identifier + ')',
    ].join('|'), 'g');
    var keywords = new Set(language.keywords);
    var builtins = new Set(language.builtins);

    function tokenKind(match) {
      if (match[1]) return 'comment';
      if (match[2]) return 'string';
      if (match[3]) return 'number';
      if (keywords.has(match[4])) return 'keyword';
      if (builtins.has(match[4])) return 'builtin';
      if (language.capitalizedAreTypes && /^[A-Z]/.test(match[4])) return 'type';
      return null;  // ordinary identifier: plain text
    }

    return function highlight(source) {
      var fragment = document.createDocumentFragment();
      var text = String(source == null ? '' : source);
      var consumed = 0;
      var match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        var kind = tokenKind(match);
        if (!kind) continue;
        if (match.index > consumed) {
          fragment.appendChild(document.createTextNode(text.slice(consumed, match.index)));
        }
        var token = document.createElement('span');
        token.className = 'program-lab__tok program-lab__tok--' + kind;
        token.textContent = match[0];
        fragment.appendChild(token);
        consumed = match.index + match[0].length;
      }
      if (consumed < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(consumed)));
      }
      return fragment;
    };
  }

  Object.keys(LANGUAGES).forEach(function (name) {
    LANGUAGES[name].highlight = compileHighlighter(LANGUAGES[name]);
  });

  function decorateSourceFile(file, body) {
    var language = LANGUAGES[file.language];
    if (!language) return;
    body.classList.add('program-lab__source');
    body.textContent = '';
    body.appendChild(language.highlight(file.content));
  }

  // ---------------------------------------------------------------------------
  // Spec translation.
  // ---------------------------------------------------------------------------
  function acceptedPredictions(spec, language, output) {
    if (spec.accept) return spec.accept;
    if (output.stderr && language.crashPredictions) {
      return language.crashPredictions(output.stdout, output.stderr);
    }
    return null;  // the shell lab's default stdout comparison
  }

  function toCommandLabSpec(spec) {
    var language = LANGUAGES[spec.language];
    if (!language) throw new Error('Unknown program language: ' + spec.language);
    var file = spec.file || language.defaultFile;
    var output = spec.output || {};
    var stderr = output.stderr || '';
    return {
      command: language.command(file),
      description: spec.description,
      predict: spec.predict,
      predictPrompt: spec.predictPrompt || DEFAULT_PROMPT,
      placeholder: spec.predict ? null : MENTAL_PREDICTION_PLACEHOLDER,
      input: {
        stdin: spec.stdin,
        files: [{ name: file, content: spec.code, language: spec.language }]
          .concat(spec.files || []),
      },
      output: {
        stdout: output.stdout,
        stderr: stderr,
        exit: output.exit != null ? output.exit : (stderr ? 1 : 0),
        files: output.files,
      },
      accept: acceptedPredictions(spec, language, output),
      notice: spec.notice,
    };
  }

  // ---------------------------------------------------------------------------
  function initFrom(root) {
    if (!window.UnixCommandLab) {
      console.error('ProgramOutputLab needs unix-command-lab.js to load first.');
      return;
    }
    var nodes = (root || document).querySelectorAll('[data-program-output-lab]');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el.getAttribute('data-program-lab-init')) return;
      el.setAttribute('data-program-lab-init', '1');
      try {
        var spec = window.UnixCommandLab.readSpec(el, 'data-program-output-lab');
        window.UnixCommandLab.create(el, toCommandLabSpec(spec), {
          decorateFileBody: decorateSourceFile,
        });
        el.classList.add('program-lab', 'program-lab--' + spec.language);
      } catch (e) {
        console.error('ProgramOutputLab init failed:', e, el);
      }
    });
  }

  window.ProgramOutputLab = {
    initFrom: initFrom,
    toCommandLabSpec: toCommandLabSpec,
    highlight: function (language, source) { return LANGUAGES[language].highlight(source); },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initFrom(document); });
  } else {
    initFrom(document);
  }
})();
