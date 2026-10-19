# Live UML from source

The class and sequence chapters embed small Python/Java/C++ exercises with
`{% include uml-code-lab.html example="visibility" %}`. Set `uml_code_labs: true`
in the chapter front matter. Examples live in `_data/uml_code_labs.yml`:
`title`, `type` (`class` or `sequence`), `explanation`, and `python`/`java`/`cpp`
objects containing `code` and one brief `task`.
`_data/uml_code_languages.yml` defines the ordered language options, labels,
and source filenames for both the interactive controls and static fallbacks.

Keep each exercise about one concept. Ask for a consequence that requires
tracing the code, distinguishing two cases, or constructing a counterexample;
avoid prompts whose edit instruction gives away the answer. Learners predict
before editing; the explanation stays collapsed. The
source is analyzed locally, never executed. Inference is a source sketch,
not a complete compiler, runtime trace, or proof of ownership/lifetimes.
Verify both starter code and the suggested edit with the real analyzers.
The `message_receivers` lab distinguishes variable names from object identity:
changing a reference's initializer moves a call between two existing objects,
while the call site and number of instances stay the same.
Named receivers take precedence over class-based inference; self-calls stay
on the current object's lifeline in the shared analyzers. Java copies known
object identity through simple reference declarations and assignments, with
bindings scoped to each followed method.
Diagram text alternatives state zero-or-more bounds explicitly and keep
separate conditional frames distinct even when their guards are identical.

Keep the counterexample and expected result in the collapsed explanation.
The source analyzer shows possible paths, not evaluated branch outcomes or
unrolled loop counts; those predictions require reasoning about the code.

## Ownership

- `js/uml-live.js` owns source analysis, lazy analyzer loading, worker queues,
  main-thread fallback, text measurement, SVG rendering and accessible names.
  Tutorials and chapter labs use the same pipeline and `js/uml-worker.js`.
- `js/uml-code-lab.js` owns the chapter controls, debounce, per-language drafts,
  reset, status, and stale-result guards. Edits debounce for 150 ms. A spinner occupies reserved space
  beside the diagram title while the previous diagram stays in place. Its
  animation stops for reduced-motion preferences; updates remain announced
  through a visually hidden status. Python is the default; drafts exist only
  in memory and switching languages preserves each draft.
- `js/uml-code-lab-editor.js` enhances the source field with Monaco's Python,
  Java and C++ grammars, adapting font size and theme to the chapter, with pure white
  and pure black editor backgrounds. The shared
  `js/monaco-loader.js` loads the locally vendored editor for both tutorials and
  chapters. Chapter editors await `loadLanguages` so lazy tokenizers are ready
  before the first edit; each grammar is warmed once per page. Escape leaves
  the editor using `js/monaco-focus-exit.js`. After editing or switching
  languages, the public line colorizer refreshes visible model tokens without
  waiting for Monaco's idle background pass. Scrolling extends that refresh
  to the newly visible code. A native
  textarea remains available if Monaco fails to load. No persistence is added.
- `js/tutorial-code.js` continues to own tutorial file models, progress, layout
  preferences, diagram colors and zoom. Its existing JavaScript/TypeScript UML
  support remains available; chapter controls expose Python, Java and C++.
- `_includes/uml-code-lab.html` owns semantic markup and escaped source
  fallbacks. `css/uml-code-lab.css` owns presentation in light, dark, mobile and
  print. Print uses the current draft and only a diagram matching that draft.

Load the ArchUML bundle and `uml-auto-describe.js`, then `uml-live.js` before
either host script. Both chapter layouts (including course aggregators) load
these assets once. The measuring SVG's styles live in `css/uml-diagram.css`.

## Shared client

```js
const client = UMLLive.createClient();
const diagrams = await client.analyze({
  language: 'java',
  sources: { 'Example.java': source },
  options: { hideVisibility: false, hideMultiplicity: false }
});
await client.render({
  type: 'class', syntax: diagrams.classDiagram, target, readOnly: true,
  isCurrent: () => revision === requestedRevision
});
client.dispose();
```

`analyze` returns `{ classDiagram, sequenceDiagram, errors }`. Analyzer errors
are data; loading/worker failures fall back to the local analyzer and reject
if that also fails. Rendering returns false for stale or disposed work.
`UMLLive.isSuperseded(error)` identifies replaced queued analysis requests.
`UMLLive.withClassLayout(syntax, preference)` replaces class layout directives.
Tutorial hosts may supply analyzer paths and `loadTypeScript` to `createClient`.
Rendering uses a temporary off-screen surface, then replaces the visible SVG
only when the complete result is current. `readOnly: true` gives the container
the image role and ArchUML's native keyboard-scrolling behavior; editor hosts
keep their own focus policy. The surface is removed on success, supersession,
or failure.

Each client has one worker with separate analysis/render queues. Each queue
keeps an active request, the latest pending request and one exact-input cache.
Different widgets never cancel one another. A worker failure or timeout
terminates it and releases outstanding requests before fallback. Owners must
dispose clients on teardown; chapter pages pause them on `pagehide` and
recreate them on a persisted `pageshow`. `UMLCodeLab.destroyWithin(element)`
supports an explicitly removed host. Status and source revisions prevent an
old render from becoming the displayed answer to a newer edit.
Text measurement reuses matching labels from the previous render; the cache
retains only that render's entries, so successive edits cannot grow it indefinitely.

## Inference limits

Review inferred diagrams as teaching sketches. The analyzers preserve the
following distinctions while working only with supplied source files:

- **Relationship roles:** fields pointing to the same class retain separate
  relationships and multiplicities. Role labels distinguish those fields,
  including when multiplicities are hidden. Reciprocal fields remain separate
  references; their declarations do not establish that they are inverse ends
  of one association.
- **Union types:** Python and TypeScript retain each known alternative target
  with its own cardinality. A scalar choice between classes makes each target
  optional; it does not mean that both objects must exist. Sequence dispatch
  leaves an ambiguous receiver unresolved instead of choosing a union arm.
- **Symbol resolution:** supplied-file Python imports, relative imports and
  aliases, Java packages/imports/nested declarations, and TypeScript compiler
  symbols distinguish same-named declarations. C++ resolves inherited fields
  in their declaring scope. Diagram identifiers remain distinct even when
  qualification would otherwise create the same identifier. Missing sources,
  runtime rebinding, external package configuration and dynamic dispatch can
  still leave targets unresolved; the analyzers do not load external packages.
- **Object identity:** a known receiver keeps its identity. Python also tracks
  injected fields by owning object, field aliases and subsequent assignments;
  a factory result does not reuse an old object's identity. An unknown receiver
  is not assigned to an unrelated existing object just because its type matches.
- **Ownership:** field construction and parameter passing suggest relationships
  but do not prove UML composition or aggregation lifetime constraints. Diamonds
  remain syntax-based modeling suggestions that require domain review.
  Java `new Part[n]` allocates reference slots without constructing parts, so
  it does not infer composition or an exact `n`-object multiplicity.
- **Control flow:** Python preserves early transfers through conditional and
  cleanup paths, including `try`/`else`/`finally`. The call walk is still bounded:
  it does not evaluate arbitrary predicates, unroll loops, model every exception
  type or perform whole-program dynamic dispatch. A diagram shows possible
  source paths, not an execution trace. Python limits sequence expansion to
  2,000 statement visits. Exceeding that limit returns an explanatory `errors`
  entry and an empty `sequenceDiagram`, while retaining the class diagram;
  a truncated sequence is not presented as a complete result.

Grade the behavior contracts and structural constraints stated in an exercise.
Do not use exact inferred diagram text as the sole correctness oracle. Check
effects, ordering, multiplicities, and forbidden interactions while accepting
equivalent internal designs; use a short explanation for modeling choices.

## C++ inference

`js/uml-analyzer-cpp.js` uses the Java analyzer's approach: tokenize source,
collect declarations, infer class relationships, and walk calls starting at
the free `main()` function. It exports `analyzeCppSources(sources, options)`
in Node and the browser; the shared client selects it with `language: 'cpp'`.
It needs no compiler or network service. Both worker and local fallback use
the same analyzer.

Supply all relevant headers and translation units in `sources`; includes are
not loaded. Tutorial `uml_files` detects `.cpp`, `.cc`, `.cxx`, `.c++`, `.C`,
`.hpp`, `.hh`, `.hxx`, and `.h`. Declarations and out-of-line definitions merge
across those files. Classes/structs, access sections, inheritance, enums,
namespaces, type aliases, constructors, static and pure virtual methods are
recognized. Namespace separators become `__` in diagram identifiers.

Value members and `unique_ptr` suggest composition; `shared_ptr` suggests
aggregation; references, raw pointers and `weak_ptr` suggest association.
Containers/arrays contribute multiplicity; borrowing a container does not
imply ownership. Parameter and return types contribute dependencies.
These are syntax-based hints, not ownership proofs.

Sequence inference follows stack/heap/smart-pointer construction, `.`/`->`,
reference aliases, constructor injection, self/static/free calls, typed
replies, and branch/loop/exception fragments. Calls expand up to three levels;
recursion and statement limits bound the work. Branches represent possible
source paths, not a trace of which path actually runs.

This is a teaching subset of C++. Preprocessor directives are skipped;
macros, conditional compilation and template instantiation are not evaluated.
There is no full overload resolution, dynamic dispatch, operator-overload
analysis, or automatic destructor/lifetime trace. Same-arity overloads
retain their call but do not expand an arbitrarily chosen body or reply type. Complex C++
declarators may need a smaller example to produce a useful sketch.

## Verification

Build with `bundle exec jekyll build`, then run:

```sh
node --test scripts/tests/uml-code-lab-predictions.test.js scripts/tests/uml-sequence-receivers.test.js scripts/tests/uml-cpp-inference.test.js scripts/tests/uml-live.test.js
PLAYWRIGHT_SERVE_BUILT_SITE=1 A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/uml-code-lab.spec.js --project=chromium
```

The content checks load every language's actual starter and suggested edit
and verify the predicted relationships, senders, nesting, and fragments.
Suggested edits live in `tests/helpers/uml-lab-edits.js`, shared with browser
checks so both exercise the same chapter tasks.
The browser suite exercises edits, language and widget isolation, reset, no-worker
fallback, empty-source recovery, C++ header/source tutorial integration,
syntax highlighting, accessibility, small screens and print. Compile C++
starter code and suggested edits with `clang++ -std=c++17 -fsyntax-only` when
changing the examples; the analyzer is not a syntax validator.
