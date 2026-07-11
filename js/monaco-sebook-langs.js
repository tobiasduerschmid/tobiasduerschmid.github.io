/**
 * Shared Monaco language + theme registration for the SE Book tutorial
 * engine and its popout windows.
 *
 * Loaded by both `tutorial-code.js` (main page) and the per-popup HTML
 * files (`tutorial-tab-popup.html`, `tutorial-pane-popup.html`). Without
 * this, popups would only see Monaco's bare CDN languages — no `jsx`,
 * `shell-sebook`, `prolog`, no enriched Python f-string tokens, and no
 * sebook-light/sebook-dark themes.
 *
 * Idempotent: safe to call repeatedly. Uses a window-level guard so
 * registering twice in the same context is a no-op.
 */
(function () {
  'use strict';

  var LANG_MAP = {
    sh: 'shell-sebook', bash: 'shell-sebook', zsh: 'shell-sebook',
    py: 'python', js: 'javascript', jsx: 'jsx', json: 'json',
    ts: 'typescript', tsx: 'jsx',
    yml: 'yaml', yaml: 'yaml', md: 'markdown',
    css: 'css', txt: 'plaintext', c: 'c', h: 'c', cpp: 'cpp',
    makefile: 'makefile', Makefile: 'makefile',
    pl: 'prolog', pro: 'prolog',
    java: 'java',
    hs: 'haskell', lhs: 'haskell',
  };

  function detectLanguage(filename) {
    if (!filename) return 'plaintext';
    if (/^[Mm]akefile$/.test(filename)) return 'makefile';
    var ext = filename.split('.').pop().toLowerCase();
    return LANG_MAP[ext] || 'plaintext';
  }

  function register(monaco) {
    if (!monaco || !monaco.languages) return;
    if (monaco.__sebookRegistered) return;
    monaco.__sebookRegistered = true;

    // ---- Custom shell language ----
    monaco.languages.register({ id: 'shell-sebook' });
    monaco.languages.setLanguageConfiguration('shell-sebook', {
      brackets: [['{', '}'], ['[', ']']],
      autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' },
      { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
      surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }],
    });
    monaco.languages.setMonarchTokensProvider('shell-sebook', {
      keywords: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'until', 'function'],
      builtins: ['echo', 'set', 'cd', 'pwd', 'export', 'local', 'read', 'return', 'exit', 'grep', 'wc',
        'head', 'sort', 'uniq', 'cut', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'whoami', 'date', 'sleep', 'which'],
      tokenizer: {
        root: [
          [/^#!.*$/, 'comment.shell-sebook'],
          [/\b(if|then|else|elif|fi|for|in|do|done|case|esac|while|until|function)\b/, 'keyword.shell-sebook'],
          [/[\[\]]/, 'keyword.shell-sebook'],
          [/[a-zA-Z_][\w]*(?==)/, 'variable.shell-sebook'],
          [/[a-zA-Z_][\w]*/, { cases: { '@builtins': 'command.shell-sebook', '@default': 'command.shell-sebook' } }],
          [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'],
          [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
          [/#.*$/, 'comment.shell-sebook'],
          [/"/, { token: 'string.shell-sebook', next: '@string' }],
          [/'/, { token: 'string.shell-sebook', next: '@sstring' }],
          [/\d+/, 'command.shell-sebook'],
          [/;;/, 'command.shell-sebook'],
          [/[ \t\r\n]+/, 'white'],
          [/[{}()]/, 'command.shell-sebook'],
          [/[<>|&;$]/, 'operator.shell-sebook'],
          [/-[\w-]+/, 'attribute.name.shell-sebook'],
          [/\+[\w-]+/, 'attribute.name.shell-sebook'],
        ],
        string: [
          [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
          [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'],
          [/[^\\"$]+/, 'string.shell-sebook'],
          [/\\./, 'string.shell-sebook'],
          [/"/, { token: 'string.shell-sebook', next: '@pop' }],
        ],
        sstring: [
          [/[^\\']+/, 'string.shell-sebook'],
          [/\\./, 'string.shell-sebook'],
          [/'/, { token: 'string.shell-sebook', next: '@pop' }],
        ],
        interpolation: [
          [/\)/, { token: 'variable.shell-sebook', next: '@pop' }],
          { include: 'root' },
        ],
      },
    });

    // ---- Prolog Monarch tokenizer ----
    monaco.languages.register({ id: 'prolog' });
    monaco.languages.setLanguageConfiguration('prolog', {
      comments: { lineComment: '%', blockComment: ['/*', '*/'] },
      brackets: [['(', ')'], ['{', '}'], ['[', ']']],
      autoClosingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' },
        { open: '"', close: '"' }, { open: "'", close: "'" }
      ],
      surroundingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' }
      ],
    });
    monaco.languages.setMonarchTokensProvider('prolog', {
      keywords: ['is', 'not', 'true', 'fail', 'halt', 'assert', 'retract', 'asserta', 'assertz',
        'retractall', 'findall', 'bagof', 'setof', 'forall', 'between', 'succ', 'plus',
        'length', 'append', 'member', 'last', 'reverse', 'msort', 'sort', 'nth0', 'nth1',
        'write', 'writeln', 'nl', 'read', 'atom', 'number', 'var', 'nonvar', 'integer', 'float',
        'atom_string', 'atom_chars', 'atom_length', 'number_chars', 'number_codes',
        'char_code', 'sub_atom', 'atom_concat', 'copy_term', 'functor', 'arg',
        'ground', 'compound', 'callable', 'throw', 'catch'],
      operators: [':-', '?-', '-->', '->', ';', '\\+', '=', '\\=', '==', '\\==', '=:=', '=\\=',
        '<', '>', '>=', '=<', '@<', '@>', '@>=', '@=<', '+', '-', '*', '/', '//', 'mod',
        'rem', '**', 'is', '=..', '\\'],
      tokenizer: {
        root: [
          [/%.*$/, 'comment'],
          [/\/\*/, 'comment', '@blockComment'],
          [/\?-/, 'keyword'],
          [/:-/, 'keyword'],
          [/!/, 'keyword'],
          [/_[A-Za-z0-9_]*/, 'variable'],
          [/[A-Z_][A-Za-z0-9_]*/, 'variable'],
          [/'/, 'string', '@quotedAtom'],
          [/"/, 'string', '@string'],
          [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
          [/0[xX][0-9a-fA-F]+/, 'number'],
          [/0[oO][0-7]+/, 'number'],
          [/0[bB][01]+/, 'number'],
          [/0'[^\s]/, 'number'],
          [/[a-z][A-Za-z0-9_]*/, {
            cases: { '@keywords': 'keyword', '@default': 'atom' }
          }],
          [/[+\-*/\\^<>=~:.?@#$&]+/, 'operator'],
          [/[\[\](){}|,;.]/, 'delimiter'],
          [/\s+/, 'white'],
        ],
        blockComment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/./, 'comment'],
        ],
        quotedAtom: [
          [/\\./, 'string'],
          [/[^'\\]+/, 'string'],
          [/'/, 'string', '@pop'],
        ],
        string: [
          [/\\./, 'string'],
          [/[^"\\]+/, 'string'],
          [/"/, 'string', '@pop'],
        ],
      },
    });

    // ---- Haskell Monarch tokenizer ----
    monaco.languages.register({ id: 'haskell' });
    monaco.languages.setLanguageConfiguration('haskell', {
      comments: { lineComment: '--', blockComment: ['{-', '-}'] },
      brackets: [['(', ')'], ['[', ']'], ['{', '}']],
      autoClosingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' },
        { open: '{', close: '}' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '{-', close: '-}' },
      ],
      surroundingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' },
        { open: '{', close: '}' }, { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });
    monaco.languages.setMonarchTokensProvider('haskell', {
      defaultToken: '',
      keywords: [
        'as', 'case', 'class', 'data', 'default', 'deriving', 'do', 'else',
        'foreign', 'hiding', 'if', 'import', 'in', 'infix', 'infixl',
        'infixr', 'instance', 'let', 'module', 'newtype', 'of', 'qualified',
        'then', 'type', 'where',
      ],
      constants: ['True', 'False', 'Nothing', 'Just', 'LT', 'EQ', 'GT'],
      tokenizer: {
        root: [
          [/--.*$/, 'comment'],
          [/\{-/, 'comment', '@blockComment'],
          [/"/, 'string', '@string'],
          [/'(?:[^'\\]|\\.)'/, 'string'],
          [/0[xX][0-9a-fA-F]+/, 'number.hex'],
          [/0[oO][0-7]+/, 'number.octal'],
          [/\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/, 'number'],
          [/[A-Z][\w']*/, {
            cases: { '@constants': 'constant', '@default': 'type' },
          }],
          [/[a-z_][\w']*/, {
            cases: { '@keywords': 'keyword', '@default': 'identifier' },
          }],
          [/[!#$%&*+./<=>?@\\^|~:\-]+/, 'operator'],
          [/[()\[\]{},;]/, 'delimiter'],
          [/\s+/, ''],
        ],
        blockComment: [
          [/[^\-{}]+/, 'comment'],
          [/\{-/, 'comment', '@push'],
          [/-\}/, 'comment', '@pop'],
          [/[\-{}]/, 'comment'],
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
        ],
      },
    });

    // ---- Makefile Monarch tokenizer ----
    // Monaco's CDN ships a basic-languages Makefile pack, but it lazy-loads
    // and colors entire recipe lines as 'string'. Registering our own
    // tokenizer here guarantees the language is ready before any model uses
    // it and gives us token names that map cleanly to the sebook themes.
    monaco.languages.register({ id: 'makefile' });
    monaco.languages.setLanguageConfiguration('makefile', {
      comments: { lineComment: '#' },
      brackets: [['(', ')'], ['{', '}']],
      autoClosingPairs: [
        { open: '(', close: ')' }, { open: '{', close: '}' },
        { open: '"', close: '"' }, { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '(', close: ')' }, { open: '{', close: '}' },
        { open: '"', close: '"' }, { open: "'", close: "'" },
      ],
    });
    monaco.languages.setMonarchTokensProvider('makefile', {
      defaultToken: '',
      directives: [
        'include', 'sinclude', '-include',
        'ifeq', 'ifneq', 'ifdef', 'ifndef',
        'else', 'endif',
        'define', 'endef',
        'override', 'export', 'unexport',
        'vpath', 'undefine', 'private',
      ],
      builtinFunctions: [
        'subst', 'patsubst', 'strip', 'findstring', 'filter', 'filter-out',
        'sort', 'word', 'words', 'wordlist', 'firstword', 'lastword',
        'dir', 'notdir', 'suffix', 'basename', 'addsuffix', 'addprefix',
        'join', 'wildcard', 'realpath', 'abspath',
        'if', 'or', 'and', 'foreach', 'call', 'value', 'eval',
        'origin', 'flavor', 'shell', 'error', 'warning', 'info',
        'guile', 'file',
      ],
      tokenizer: {
        root: [
          // Recipe lines start with a real Tab — the Tab Trap is part of
          // what the makefile tutorial teaches, so we colour the rest of
          // the line via a dedicated state.
          [/^\t/, { token: 'white', next: '@recipe' }],
          [/#.*$/, 'comment'],
          // Special targets (.PHONY, .SUFFIXES, …)
          [/^(\.[A-Z_]+)(\s*)(:)/, ['tag', '', 'delimiter']],
          // Directives (ifeq, include, define, …)
          [/^\s*(ifeq|ifneq|ifdef|ifndef|else|endif|define|endef|override|export|unexport|include|-include|sinclude|vpath|undefine|private)\b/, 'keyword'],
          // Variable assignment: NAME = … (and := ?= += !=)
          [/^([A-Za-z_][\w.-]*)(\s*)([:+?!]?=)/, ['variable', '', 'operator']],
          // Target: NAME : … (excluding := which is an assignment op)
          [/^([\w%.\-\/]+)(\s*)(:)(?!=)/, ['type', '', 'delimiter']],
          { include: '@common' },
        ],

        recipe: [
          [/$/, { token: '', next: '@pop' }],
          // Recipe modifiers: @ (silent), - (ignore errors), + (always run)
          [/^[@\-+]+/, 'operator'],
          [/#.*$/, 'comment'],
          { include: '@common' },
          [/\\./, 'string.escape'],
          [/[^#"'$\\\n]+/, ''],
        ],

        common: [
          // Automatic variables: $@ $< $^ $? $* $+ $| $%
          [/\$[@<^?*+|%]/, 'variable.predefined'],
          // $(@D), $(<F), … — directory/file modifiers on automatic vars
          [/\$\([@<^?*+|%][DF]\)/, 'variable.predefined'],
          // Escaped $$
          [/\$\$/, 'string.escape'],
          // $(VAR …) — function call or variable reference
          [/\$\(/, { token: 'variable', next: '@varParen' }],
          [/\$\{/, { token: 'variable', next: '@varBrace' }],
          // $X — single-character variable reference
          [/\$[A-Za-z_]/, 'variable'],
          [/"/, { token: 'string', next: '@dstring' }],
          [/'/, { token: 'string', next: '@sstring' }],
        ],

        varParen: [
          [/\)/, { token: 'variable', next: '@pop' }],
          [/[A-Za-z][\w.-]*/, {
            cases: {
              '@builtinFunctions': 'support.function',
              '@default': 'variable',
            },
          }],
          { include: '@common' },
          [/\(/, { token: 'variable', next: '@varParen' }],
          [/[^)$"'(]+/, ''],
        ],

        varBrace: [
          [/\}/, { token: 'variable', next: '@pop' }],
          [/[A-Za-z][\w.-]*/, 'variable'],
          { include: '@common' },
          [/[^}$"']+/, ''],
        ],

        dstring: [
          [/"/, { token: 'string', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\$\(/, { token: 'variable', next: '@varParen' }],
          [/[^"\\$]+/, 'string'],
        ],

        sstring: [
          [/'/, { token: 'string', next: '@pop' }],
          [/[^']+/, 'string'],
        ],
      },
    });

    // ---- Python tokenizer (with f-string interpolation support) ----
    monaco.languages.setMonarchTokensProvider('python', {
      defaultToken: '',
      tokenizer: {
        root: [
          [/[fF][rR]?"""/, { token: 'string.fstring', next: '@fstr_tdq' }],
          [/[rR][fF]"""/, { token: 'string.fstring', next: '@fstr_tdq' }],
          [/[fF][rR]?'''/, { token: 'string.fstring', next: '@fstr_tsq' }],
          [/[rR][fF]'''/, { token: 'string.fstring', next: '@fstr_tsq' }],
          [/[fF][rR]?"/, { token: 'string.fstring', next: '@fstr_dq' }],
          [/[rR][fF]?"/, { token: 'string.fstring', next: '@fstr_dq' }],
          [/[fF][rR]?'/, { token: 'string.fstring', next: '@fstr_sq' }],
          [/[rR][fF]?'/, { token: 'string.fstring', next: '@fstr_sq' }],
          [/[bBrRuU]{0,2}"""/, { token: 'string', next: '@str_tdq' }],
          [/[bBrRuU]{0,2}'''/, { token: 'string', next: '@str_tsq' }],
          [/[bBrRuU]{0,2}"/, { token: 'string', next: '@str_dq' }],
          [/[bBrRuU]{0,2}'/, { token: 'string', next: '@str_sq' }],
          [/#.*$/, 'comment'],
          [/@[A-Za-z_][\w.]*/, 'tag'],
          [/\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/, 'keyword'],
          [/\b(?:abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)\b/, 'support.function'],
          [/\b(?:self|cls)\b/, 'variable.language'],
          [/\b0[xX][0-9a-fA-F_]+\b/, 'number.hex'],
          [/\b0[bBoO][01_]+\b/, 'number'],
          [/\b\d[\d_]*\.[\d_]*(?:[eE][+-]?[\d_]+)?\b/, 'number.float'],
          [/\b\d[\d_]*[eE][+-]?[\d_]+\b/, 'number.float'],
          [/\b\d[\d_]*\b/, 'number'],
          [/[A-Za-z_]\w*/, 'identifier'],
          [/[+\-*/%&|^~<>=!@]+/, 'operator'],
          [/[,;:.]/, 'delimiter'],
          [/[(){}\[\]]/, '@brackets'],
          [/\s+/, ''],
        ],
        fstr_dq: [
          [/"/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/[^"\\{]+/, 'string.fstring'],
        ],
        fstr_sq: [
          [/'/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/[^'\\{]+/, 'string.fstring'],
        ],
        fstr_tdq: [
          [/"""/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/"(?!"")/, 'string.fstring'],
          [/[^"\\{]+/, 'string.fstring'],
        ],
        fstr_tsq: [
          [/'''/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/'(?!'')/, 'string.fstring'],
          [/[^'\\{]+/, 'string.fstring'],
        ],
        fstr_expr: [
          [/}/, { token: 'string.fstring.delimiter', next: '@pop' }],
          [/\(/, { token: '@brackets', next: '@fstr_paren' }],
          [/\[/, { token: '@brackets', next: '@fstr_bracket' }],
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          [/\b(?:not|and|or|in|is|if|else|for|lambda|None|True|False)\b/, 'keyword'],
          [/[A-Za-z_]\w*/, 'identifier'],
          [/\d[\d_]*\.[\d_]*(?:[eE][+-]?[\d_]+)?/, 'number.float'],
          [/\d[\d_]*/, 'number'],
          [/[+\-*/%&|^~<>=!@,.: ]+/, 'operator'],
        ],
        fstr_paren: [
          [/\)/, { token: '@brackets', next: '@pop' }],
          [/\(/, { token: '@brackets', next: '@push' }],
          [/[^()]*/, 'identifier'],
        ],
        fstr_bracket: [
          [/\]/, { token: '@brackets', next: '@pop' }],
          [/\[/, { token: '@brackets', next: '@push' }],
          [/[^[\]]*/, 'identifier'],
        ],
        str_dq: [
          [/"/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'], [/[^"\\]+/, 'string'],
        ],
        str_sq: [
          [/'/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'], [/[^'\\]+/, 'string'],
        ],
        str_tdq: [
          [/"""/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'],
          [/"(?!"")/, 'string'], [/[^"\\]+/, 'string'],
        ],
        str_tsq: [
          [/'''/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'],
          [/'(?!'')/, 'string'], [/[^'\\]+/, 'string'],
        ],
      },
    });

    // ---- JSX / TSX Monarch tokenizer ----
    monaco.languages.register({ id: 'jsx' });
    monaco.languages.setLanguageConfiguration('jsx', {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
      autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' },
        { open: '<', close: '>' },
      ],
      indentationRules: {
        increaseIndentPattern: /^.*(\{[^}"']*|\([^)"']*)$/,
        decreaseIndentPattern: /^\s*[}\)]/,
      },
    });
    monaco.languages.setMonarchTokensProvider('jsx', {
      defaultToken: '',
      tokenPostfix: '.jsx',
      keywords: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
        'false', 'finally', 'for', 'from', 'function', 'get', 'if',
        'implements', 'import', 'in', 'instanceof', 'interface', 'let',
        'new', 'null', 'of', 'package', 'private', 'protected', 'public',
        'return', 'set', 'static', 'super', 'switch', 'this', 'throw',
        'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while',
        'with', 'yield', 'async', 'await',
      ],
      typeKeywords: ['any', 'boolean', 'number', 'object', 'string', 'symbol'],
      operators: [
        '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**',
        '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^',
        '!', '~', '&&', '||', '??', '?', ':', '=', '+=', '-=', '*=',
        '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^=',
        '&&=', '||=', '??=', '...', '?.', 'as',
      ],
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
      digits: /\d+(_+\d+)*/,

      tokenizer: {
        root: [
          [/(<)(\/?)([A-Z][a-zA-Z0-9.]*)/, ['delimiter.tag', 'delimiter.tag', { token: 'type.identifier.tag', next: '@jsxTag' }]],
          [/(<)(\/?)([a-z][a-zA-Z0-9\-]*)/, ['delimiter.tag', 'delimiter.tag', { token: 'tag', next: '@jsxTag' }]],
          [/<\/>/, 'delimiter.tag'],
          [/<>/, 'delimiter.tag'],
          [/[a-zA-Z_$][\w$]*/, {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          }],
          { include: '@whitespace' },
          [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
          [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
          [/0[xX][\da-fA-F]+/, 'number.hex'],
          [/0[oO][0-7]+/, 'number.octal'],
          [/0[bB][01]+/, 'number.binary'],
          [/@digits/, 'number'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string_dq'],
          [/'/, 'string', '@string_sq'],
          [/`/, 'string.template', '@string_bt'],
          [/[{}()\[\]]/, '@brackets'],
          [/@symbols/, {
            cases: { '@operators': 'operator', '@default': '' },
          }],
          [/[;,.]/, 'delimiter'],
        ],
        jsxTag: [
          [/\s+/, ''],
          [/([\w\-]+)(\s*)(=)/, ['attribute.name', '', 'delimiter']],
          [/"[^"]*"/, 'attribute.value'],
          [/'[^']*'/, 'attribute.value'],
          [/\{/, { token: 'delimiter.bracket', next: '@jsxExpr' }],
          [/\/?>/, { token: 'delimiter.tag', next: '@pop' }],
          [/[\w\-]+/, 'attribute.name'],
        ],
        jsxExpr: [
          [/\{/, 'delimiter.bracket', '@push'],
          [/\}/, 'delimiter.bracket', '@pop'],
          { include: 'root' },
        ],
        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment'],
        ],
        string_dq: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop'],
        ],
        string_sq: [
          [/[^\\']+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop'],
        ],
        string_bt: [
          [/\$\{/, { token: 'string.template.delimiter', next: '@templateExpr' }],
          [/[^\\`$]+/, 'string.template'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/`/, 'string.template', '@pop'],
        ],
        templateExpr: [
          [/\{/, 'delimiter.bracket', '@push'],
          [/\}/, { token: 'string.template.delimiter', next: '@pop' }],
          { include: 'root' },
        ],
      },
    });

    // ---- Themes ----
    monaco.editor.defineTheme('sebook-light', {
      base: 'vs', inherit: true,
      rules: [
        { token: 'keyword.shell-sebook', foreground: '0000ff' },
        { token: 'command.shell-sebook', foreground: '267f99' },
        { token: 'variable.shell-sebook', foreground: '001080' },
        { token: 'attribute.name.shell-sebook', foreground: 'a31515' },
        { token: 'string.shell-sebook', foreground: 'a31515' },
        { token: 'comment.shell-sebook', foreground: '008000' },
        { token: 'string.fstring.delimiter', foreground: '0451a5' },
        { token: 'tag.jsx', foreground: '800000' },
        { token: 'type.identifier.tag.jsx', foreground: '267f99' },
        { token: 'delimiter.tag.jsx', foreground: '800000' },
        { token: 'attribute.name.jsx', foreground: 'e50000' },
        { token: 'attribute.value.jsx', foreground: '0451a5' },
        { token: 'variable.predefined', foreground: '0070c1', fontStyle: 'bold' },
        { token: 'support.function', foreground: '795e26' },
      ],
      colors: {},
    });
    monaco.editor.defineTheme('sebook-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: '', foreground: 'ffffff' },
        { token: 'keyword', foreground: '8ec5ff' },
        { token: 'comment', foreground: 'a8d8a8' },
        { token: 'string', foreground: 'ffb88c' },
        { token: 'number', foreground: 'd4f0b0' },
        { token: 'type', foreground: '7eecd0' },
        { token: 'function', foreground: 'fff0a0' },
        { token: 'variable', foreground: 'ffffff' },
        { token: 'identifier', foreground: 'ffffff' },
        { token: 'delimiter', foreground: 'd0d0d0' },
        { token: 'operator', foreground: 'd0d0d0' },
        { token: 'constant', foreground: 'c8b0ff' },
        { token: 'tag', foreground: '8ec5ff' },
        { token: 'attribute', foreground: 'd4f0b0' },
        { token: 'keyword.shell-sebook', foreground: '8ec5ff' },
        { token: 'command.shell-sebook', foreground: '7eecd0' },
        { token: 'variable.shell-sebook', foreground: 'd4eaff' },
        { token: 'attribute.name.shell-sebook', foreground: 'ff8e8e' },
        { token: 'string.shell-sebook', foreground: 'ffb88c' },
        { token: 'comment.shell-sebook', foreground: 'a8d8a8' },
        { token: 'string.fstring.delimiter', foreground: '8ec5ff' },
        { token: 'atom', foreground: 'ffb88c' },
        { token: 'tag.jsx', foreground: '8ec5ff' },
        { token: 'type.identifier.tag.jsx', foreground: '7eecd0' },
        { token: 'delimiter.tag.jsx', foreground: 'b5b5b5' },
        { token: 'attribute.name.jsx', foreground: 'd4eaff' },
        { token: 'attribute.value.jsx', foreground: 'ffb88c' },
        { token: 'variable.predefined', foreground: 'c8b0ff', fontStyle: 'bold' },
        { token: 'support.function', foreground: 'fff0a0' },
      ],
      colors: {
        'editor.background': '#050608',
        'editor.foreground': '#ffffff',
        'editorLineNumber.foreground': '#8a8d96',
        'editorLineNumber.activeForeground': '#ffffff',
        'editorIndentGuide.background': '#1c1d22',
        'editorIndentGuide.activeBackground': '#3e404a',
        'editor.selectionBackground': '#3a5a8c',
        'editor.inactiveSelectionBackground': '#2c3e5e',
        'editor.lineHighlightBackground': '#0d0e13',
        'editor.lineHighlightBorder': '#0d0e13',
        'editorCursor.foreground': '#ffffff',
        'editorBracketHighlight.foreground1': '#ffe066',
        'editorBracketHighlight.foreground2': '#ff8c66',
        'editorBracketHighlight.foreground3': '#a78bfa',
        'editor.findMatchBackground': '#5e4a18',
        'editor.findMatchHighlightBackground': '#3a2e10',
      },
    });
  }

  window.SebookMonacoLangs = {
    register: register,
    detectLanguage: detectLanguage,
    LANG_MAP: LANG_MAP,
    // For JSX/TSX files, main remaps the requested language to 'jsx' so the
    // custom tokenizer kicks in. Both main and popups need this remap.
    languageForFile: function (filename, requested) {
      var lang = requested;
      if (lang === 'javascript' && /\.jsx$/i.test(filename)) lang = 'jsx';
      if ((lang === 'javascript' || lang === 'typescript') && /\.tsx$/i.test(filename)) lang = 'jsx';
      return lang || detectLanguage(filename);
    },
  };
})();
