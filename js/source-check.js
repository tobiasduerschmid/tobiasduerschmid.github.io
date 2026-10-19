/**
 * Source checks for learner code. Each language's own tools decide what is an
 * error; this module only locates the results and adds fix hints. Nothing runs
 * the learner's code.
 *
 *   Python      CPython's ast (syntax) and pyflakes (undefined names), through
 *               SEBookPythonAst
 *   TypeScript  the TypeScript compiler (syntax) and Monaco's TypeScript
 *               service, with the standard library typings (names and types)
 *   C++         the tree-sitter grammar (syntax) and clang -fsyntax-only in
 *               js/cpp-worker.js, with the standard library headers
 *   Java        the tree-sitter grammar (syntax), then type names resolved
 *               against the example's declarations, its imports, and java.lang
 *               (no Java compiler runs in the browser)
 *
 * Semantic checks run only on source that parses.
 *
 * check(language, source) resolves to problems in source order:
 *   [{ kind: 'syntax' | 'semantic', line, column, endLine, endColumn, message, hint }]
 * Positions are 1-based and the end is exclusive, matching Monaco ranges.
 * `hint` suggests a fix and may be empty. A check rejects when its tools cannot
 * load; a C++ check replaced by a newer one rejects with `superseded: true`.
 * prepare(language) starts loading that language's tools ahead of a check.
 */
(function (global) {
  'use strict';

  const scriptURL = name => new URL(name, document.currentScript.src).href;
  const TREE_SITTER = scriptURL('vendor/tree-sitter/web-tree-sitter-0.25.10/tree-sitter.js');
  const GRAMMARS = {
    java: scriptURL('vendor/tree-sitter/tree-sitter-java-0.23.5/tree-sitter-java.wasm'),
    cpp: scriptURL('vendor/tree-sitter/tree-sitter-cpp-0.23.4/tree-sitter-cpp.wasm')
  };
  const TYPESCRIPT = scriptURL('vendor/typescript/5.9.3/typescript.min.js');
  const CPP_WORKER = scriptURL('cpp-worker.js');
  const COMPILER_TIMEOUT_MS = 60000;
  const MAX_PROBLEMS = 10;
  const CLOSERS = { '(': ')', '[': ']', '{': '}' };
  const OPENERS = { ')': '(', ']': '[', '}': '{' };

  /** Memoize a loader; a failed load is retried by the next call. */
  function once(load) {
    let loading = null;
    return () => {
      if (!loading) loading = load().catch(error => { loading = null; throw error; });
      return loading;
    };
  }

  function hintFor(message, hints) {
    for (const [pattern, hint] of hints) {
      const match = message.match(pattern);
      if (match) return typeof hint === 'function' ? hint(match) : hint;
    }
    return '';
  }

  /** Underline the word starting at a 1-based position, or one character. */
  function wordRange(source, line, column) {
    const text = (source.split('\n')[line - 1] || '').slice(column - 1);
    const word = /^[A-Za-z_]\w*/.exec(text);
    return { line, column, endLine: line, endColumn: column + (word ? word[0].length : 1) };
  }

  /* Python: CPython's messages for syntax, pyflakes' for undefined names. */

  const PYTHON_HINTS = [
    [/^expected ':'/, "Lines that start a block (class, def, if, for, while, …) end with ':'."],
    [/^expected an indented block/, "Indent the block's first line by 4 spaces, or write 'pass' to keep the block empty."],
    [/^unindent does not match/, 'Line this up with the indentation of the block it belongs to.'],
    [/^unexpected indent/, "Remove the extra indentation, or end the line above with ':' to start a block."],
    [/^'(.)' was never closed/, match => `Add the matching '${CLOSERS[match[1]]}'.`],
    [/^unmatched '(.)'/, match => `Remove it, or add the '${OPENERS[match[1]]}' it should close.`],
    [/^unterminated (triple-quoted )?string literal/, 'Close the string with the same quotes it starts with.'],
    [/^invalid syntax/, 'Look for a typo, a missing comma, or a missing operator here.'],
    [/^undefined name '(.+)'/, match => `Define ${match[1]} in this example, or import it from the standard library.`]
  ];

  async function checkPython(source) {
    const { problems } = await global.SEBookPythonAst.check([{ filename: 'example.py', content: source }]);
    return problems.map(problem => ({
      kind: problem.kind,
      line: problem.line,
      column: problem.column,
      endLine: problem.endLine,
      endColumn: problem.endColumn,
      // CPython and pyflakes write phrases; the hint follows as its own sentence.
      message: /[.?!]$/.test(problem.message) ? problem.message : problem.message + '.',
      hint: hintFor(problem.message, PYTHON_HINTS)
    }));
  }

  /* TypeScript: compiler parse diagnostics, then the language service's errors. */

  const loadTypeScript = once(() => global.ts ? Promise.resolve(global.ts) : new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TYPESCRIPT;
    script.onload = () => resolve(global.ts);
    script.onerror = () => {
      script.remove();
      reject(new Error('Could not load the TypeScript checker.'));
    };
    document.head.appendChild(script);
  }));

  // Monaco 0.44 does not expose TypeScript's ModuleDetectionKind enum.
  const MODULE_DETECTION_FORCE = 3;
  const DIAGNOSTIC_CATEGORY_ERROR = 1;
  let typeScriptCheckCount = 0;

  /** Monaco shares one program per page; each checked source must be its own module. */
  const loadTypeScriptService = once(async () => {
    const monaco = await global.SEBookMonaco.loadLanguages(['typescript']);
    const defaults = monaco.languages.typescript.typescriptDefaults;
    defaults.setCompilerOptions({ ...defaults.getCompilerOptions(), moduleDetection: MODULE_DETECTION_FORCE });
    return monaco;
  });

  const TYPESCRIPT_HINTS = [
    [/^'(.+)' expected\.$/, match => `Add '${match[1]}' here.`],
    [/^Expression expected\.$/, 'Complete the expression here, for example with a value or a name.'],
    [/^Identifier expected\./, 'Add a name here.'],
    [/^Type expected\.$/, 'Add a type here, for example number or string.'],
    [/^Declaration or statement expected\.$/, "Look for an extra '}' or a typo before this point."],
    [/^Unterminated string literal\.$/, 'Close the string with the same quote it starts with.'],
    [/^Cannot find name '(.+?)'\./, match => `Declare ${match[1]} in this example; only built-in types are available.`]
  ];

  function typeScriptProblem(ts, kind, file, diagnostic) {
    const start = file.getLineAndCharacterOfPosition(diagnostic.start);
    const end = file.getLineAndCharacterOfPosition(diagnostic.start + Math.max(1, diagnostic.length));
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    return {
      kind,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1,
      message,
      hint: hintFor(message, TYPESCRIPT_HINTS)
    };
  }

  async function checkTypeScript(source) {
    const ts = await loadTypeScript();
    const file = ts.createSourceFile('example.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (file.parseDiagnostics.length) {
      return file.parseDiagnostics.map(diagnostic => typeScriptProblem(ts, 'syntax', file, diagnostic));
    }
    const monaco = await loadTypeScriptService();
    const uri = monaco.Uri.parse(`file:///sebook-source-check/${++typeScriptCheckCount}.ts`);
    const model = monaco.editor.createModel(source, 'typescript', uri);
    try {
      const worker = await (await monaco.languages.typescript.getTypeScriptWorker())(uri);
      const diagnostics = await worker.getSemanticDiagnostics(uri.toString());
      return diagnostics
        .filter(diagnostic => diagnostic.category === DIAGNOSTIC_CATEGORY_ERROR)
        .map(diagnostic => typeScriptProblem(ts, 'semantic', file, diagnostic));
    } finally {
      model.dispose();
    }
  }

  /* Java and C++ syntax: tree-sitter error and missing nodes. */

  const loadTreeSitter = once(async () => {
    const { Parser, Language } = await import(TREE_SITTER);
    await Parser.init();
    return { Parser, Language };
  });
  const grammarLoads = {};

  function parserFor(language) {
    if (!grammarLoads[language]) {
      grammarLoads[language] = once(async () => {
        const { Parser, Language } = await loadTreeSitter();
        const parser = new Parser();
        parser.setLanguage(await Language.load(GRAMMARS[language]));
        return parser;
      });
    }
    return grammarLoads[language]();
  }

  async function withTree(language, source, read) {
    const tree = (await parserFor(language)).parse(source);
    try {
      return read(tree.rootNode);
    } finally {
      tree.delete();
    }
  }

  function at(point, length = 1) {
    return { line: point.row + 1, column: point.column + 1, endLine: point.row + 1, endColumn: point.column + 1 + length };
  }

  function described(type) {
    if (!/^[a-z_]+$/.test(type)) return `'${type}'`;
    if (type === 'identifier') return 'a name';
    if (type.endsWith('identifier')) return 'a ' + type.replace(/_identifier$/, '') + ' name';
    return 'a ' + type.replace(/_/g, ' ');
  }

  function leaves(node, visit) {
    if (node.childCount === 0) visit(node);
    else for (const child of node.children) leaves(child, visit);
  }

  function syntaxProblem(position, message, hint) {
    return { kind: 'syntax', ...position, message, hint };
  }

  /** Brackets the parser saw but never paired explain most cascading errors. */
  function bracketProblems(root) {
    const open = [];
    const found = [];
    leaves(root, token => {
      if (token.isMissing) return;
      if (CLOSERS[token.type]) open.push(token);
      else if (OPENERS[token.type]) {
        if (open.length && open[open.length - 1].type === OPENERS[token.type]) open.pop();
        else found.push(syntaxProblem(at(token.startPosition), `Unmatched '${token.type}'.`,
          `Remove it, or add the '${OPENERS[token.type]}' it should close.`));
      }
    });
    for (const token of open) {
      found.push(syntaxProblem(at(token.startPosition), `'${token.type}' is never closed.`,
        `Add the matching '${CLOSERS[token.type]}'.`));
    }
    return found;
  }

  function missingHint(node, language) {
    if (node.type === ';') {
      const previous = node.previousSibling;
      if (language === 'cpp' && previous && /^(class|struct|union|enum)_specifier$/.test(previous.type)) {
        return "In C++, a class or struct definition ends with '};'.";
      }
      return "End the statement with ';'.";
    }
    if (OPENERS[node.type]) return `Add '${node.type}' to close the '${OPENERS[node.type]}' before it.`;
    return `Add ${described(node.type)} here.`;
  }

  function errorNodeProblems(node, language, found) {
    if (node.isMissing) {
      found.push(syntaxProblem(at(node.startPosition), `Missing ${described(node.type)}.`, missingHint(node, language)));
    } else if (node.type === 'ERROR') {
      let first = null;
      leaves(node, token => { first = first || token; });
      const text = first.text.split('\n')[0];
      found.push(syntaxProblem(at(first.startPosition, Math.max(1, text.length)),
        `Unexpected '${text.length > 24 ? text.slice(0, 24) + '…' : text}'.`,
        "Look for a typo here, or a missing ';', ')' or '}' just before it."));
    } else if (node.hasError) {
      for (const child of node.children) errorNodeProblems(child, language, found);
    }
  }

  function treeSitterSyntax(language, source) {
    return withTree(language, source, root => {
      if (!root.hasError) return [];
      const brackets = bracketProblems(root);
      if (brackets.length) return brackets;
      const found = [];
      errorNodeProblems(root, language, found);
      return found;
    });
  }

  /* Java semantics: type names must be declared, imported, or in java.lang. */

  // Public java.lang types (Java 21), which every Java file can use unimported,
  // plus `var`, which the grammar reads as a type name.
  const JAVA_IMPLICIT_TYPES = new Set(('var Appendable AutoCloseable Boolean Byte Character CharSequence Class ' +
    'ClassLoader ClassValue Cloneable Comparable Deprecated Double Enum Float FunctionalInterface ' +
    'InheritableThreadLocal Integer Iterable Long Math Module ModuleLayer Number Object Override Package ' +
    'Process ProcessBuilder ProcessHandle Readable Record Runnable Runtime SafeVarargs ScopedValue Short ' +
    'StackTraceElement StackWalker StrictMath String StringBuffer StringBuilder StringTemplate ' +
    'SuppressWarnings System Thread ThreadGroup ThreadLocal Throwable Void ' +
    'ArithmeticException ArrayIndexOutOfBoundsException ArrayStoreException ClassCastException ' +
    'ClassNotFoundException CloneNotSupportedException EnumConstantNotPresentException Exception ' +
    'IllegalAccessException IllegalArgumentException IllegalCallerException IllegalMonitorStateException ' +
    'IllegalStateException IllegalThreadStateException IndexOutOfBoundsException InstantiationException ' +
    'InterruptedException LayerInstantiationException MatchException NegativeArraySizeException ' +
    'NoSuchFieldException NoSuchMethodException NullPointerException NumberFormatException ' +
    'ReflectiveOperationException RuntimeException SecurityException StringIndexOutOfBoundsException ' +
    'TypeNotPresentException UnsupportedOperationException WrongThreadException ' +
    'AbstractMethodError AssertionError BootstrapMethodError ClassCircularityError ClassFormatError Error ' +
    'ExceptionInInitializerError IllegalAccessError IncompatibleClassChangeError InstantiationError ' +
    'InternalError LinkageError NoClassDefFoundError NoSuchFieldError NoSuchMethodError OutOfMemoryError ' +
    'StackOverflowError ThreadDeath UnknownError UnsatisfiedLinkError UnsupportedClassVersionError ' +
    'VerifyError VirtualMachineError').split(' '));
  const JAVA_TYPE_DECLARATIONS = new Set(['class_declaration', 'interface_declaration', 'enum_declaration',
    'record_declaration', 'annotation_type_declaration']);

  function javaImportedName(node) {
    const name = node.namedChildren.find(child => child.type === 'scoped_identifier' || child.type === 'identifier');
    return name.type === 'scoped_identifier' ? name.childForFieldName('name').text : name.text;
  }

  function javaUnknownTypes(source) {
    return withTree('java', source, root => {
      const known = new Set(JAVA_IMPLICIT_TYPES);
      const references = [];
      let wildcardImport = false;
      (function visit(node) {
        if (node.type === 'import_declaration') {
          if (node.children.some(child => child.type === 'asterisk')) wildcardImport = true;
          else known.add(javaImportedName(node));
          return;
        }
        // Qualified names (java.util.List, Map.Entry) name their own package or owner.
        if (node.type === 'scoped_type_identifier') return;
        if (JAVA_TYPE_DECLARATIONS.has(node.type)) known.add(node.childForFieldName('name').text);
        if (node.type === 'type_identifier') {
          if (node.parent.type === 'type_parameter') known.add(node.text);
          else references.push(node);
        }
        for (const child of node.namedChildren) visit(child);
      })(root);
      // A wildcard import's package contents are unknown here, so any name may come from it.
      if (wildcardImport) return [];
      return references.filter(node => !known.has(node.text)).map(node => ({
        kind: 'semantic',
        ...at(node.startPosition, node.text.length),
        message: `cannot find symbol: class ${node.text}.`,
        hint: `Declare ${node.text} in this example, or import it from the Java standard library.`
      }));
    });
  }

  /* C++ semantics: clang reports what would stop the code from compiling. */

  function supersededError() {
    return Object.assign(new Error('A newer C++ check replaced this one.'), { superseded: true });
  }

  /** One compiler worker per page; only the newest waiting check runs next. */
  const clang = (() => {
    let worker = null;
    let nextId = 0;
    let active = null;
    let queued = null;

    function fail(error) {
      for (const request of [active, queued]) {
        if (!request) continue;
        clearTimeout(request.timer);
        request.reject(error);
      }
      active = queued = null;
      if (worker) worker.terminate();
      worker = null;
    }

    function ensureWorker() {
      if (worker) return worker;
      worker = new Worker(CPP_WORKER, { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (data.type === 'error') fail(new Error(data.message || 'The C++ compiler failed.'));
        if (data.type !== 'check_done' || !active || active.id !== data.id) return;
        clearTimeout(active.timer);
        active.resolve(data.stderr);
        active = null;
        dispatch();
      };
      worker.onerror = event => fail(new Error(event.message || 'The C++ compiler failed to load.'));
      return worker;
    }

    function dispatch() {
      if (active || !queued) return;
      active = queued;
      queued = null;
      active.id = ++nextId;
      active.timer = setTimeout(() => fail(new Error('The C++ compiler check timed out.')), COMPILER_TIMEOUT_MS);
      try {
        ensureWorker().postMessage({ type: 'check', id: active.id, filename: 'example.cpp', code: active.source });
      } catch (error) {
        fail(error);
      }
    }

    return {
      prepare: ensureWorker,
      compile(source) {
        return new Promise((resolve, reject) => {
          if (queued) queued.reject(supersededError());
          queued = { source, resolve, reject };
          dispatch();
        });
      }
    };
  })();

  const CPP_HINTS = [
    [/^expected class name/, 'Declare the base class before this class, or use a standard-library class such as std::exception.'],
    [/^unknown type name '(.+)'/, match => `Declare ${match[1]} before using it, or include the standard header that defines it.`],
    [/^use of undeclared identifier '(.+)'/, match => `Declare ${match[1]} before using it, or check its spelling.`],
    [/^no (?:type|member) named '(.+)' in/, match => `Check the spelling of ${match[1]}, or declare it there.`],
    [/^'(.+)' file not found/, 'Only standard-library headers are available in this example.']
  ];

  async function clangProblems(source) {
    const stderr = await clang.compile(source);
    const problems = [];
    for (const [, line, column, message] of stderr.matchAll(/^\/check\/example\.cpp:(\d+):(\d+): (?:fatal )?error: (.+)$/gm)) {
      problems.push({
        kind: 'semantic',
        ...wordRange(source, Number(line), Number(column)),
        message: /[.?!]$/.test(message) ? message : message + '.',
        hint: hintFor(message, CPP_HINTS)
      });
    }
    return problems;
  }

  /* Orchestration */

  function syntaxThenSemantics(syntax, semantics) {
    return async source => {
      const syntaxProblems = await syntax(source);
      return syntaxProblems.length ? syntaxProblems : semantics(source);
    };
  }

  const checkers = {
    python: checkPython,
    typescript: checkTypeScript,
    java: syntaxThenSemantics(source => treeSitterSyntax('java', source), javaUnknownTypes),
    cpp: syntaxThenSemantics(source => treeSitterSyntax('cpp', source), clangProblems)
  };

  const preparers = {
    python: () => global.SEBookPythonAst.check([]),
    typescript: () => Promise.all([loadTypeScript(), loadTypeScriptService()]),
    java: () => parserFor('java'),
    cpp: () => { clang.prepare(); return parserFor('cpp'); }
  };

  async function check(language, source) {
    if (!Object.hasOwn(checkers, language)) throw new Error('No source checker for ' + language + '.');
    const problems = await checkers[language](source);
    return problems
      .sort((a, b) => a.line - b.line || a.column - b.column)
      .slice(0, MAX_PROBLEMS);
  }

  function prepare(language) {
    // Best effort: check() reports a tool that fails to load.
    Promise.resolve().then(preparers[language]).catch(() => {});
  }

  global.SEBookSourceCheck = { check, prepare };
})(window);
