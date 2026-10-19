# Live UML from source

The class and sequence chapters embed small Python/Java/C++/TypeScript exercises with
`{% include uml-code-lab.html example="visibility" %}`. Set `uml_code_labs: true`
in the chapter front matter. Examples live in `_data/uml_code_labs.yml`:
`title`, `type` (`class` or `sequence`), `explanation`, and `python`/`java`/`cpp`/`typescript`
objects containing `code` and one brief `task`.
`_data/uml_code_languages.yml` defines the ordered language options, labels,
and source filenames for both the interactive controls and static fallbacks.

All inferred diagrams offer **Design focus** and **Implementation details** for
the same current code. Chapter labs open in Implementation details so learners
can inspect source conventions before abstracting them. Tutorials, generated
Python workspaces, and the JS/TypeScript diagnostic page start in Design focus;
full screen and detached views inherit the tutorial's current selection.
The shared `uml-view-controls.js` component
exposes native pressed buttons, a hover explanation, and an on-page explanation
(once per chapter page). It adds no saved preference or editor state.

`UMLLive` retains raw analyzer results; `client.project(result, {language, view})`
selects the display view without reanalyzing or changing source. Design focus
uses UML primitive names and omits empty no-argument constructors and no-result suffixes
from class diagrams. Relationships, sequence calls, order, and creation
events remain intact. Implementation details retains source types and members.
Constructors with parameters or behavior remain in both views.
Design names hide Python privacy/dunder markers while preserving UML visibility;
constructors use their class name, and internal snake_case stays intact.
TypeScript's `constructor(...)` likewise displays as `ClassName(...)`.
Unknown types remain unknown; abstraction is not verification of requirements.
The pure `js/uml-diagram-views.js` module maps recognized type and member-name positions.
`js/uml-expression-views.js` provides `UMLExpressionViews.projectSequence`,
`projectExpression`, and `projectLoop` for recognized conditions, loops and
assignments. UML does not prescribe an expression language; these labels use
an SEBook pseudocode convention. The projection preserves the underlying
control flow and call order.
It retains protocol behavior, relationship facts,
diagnostics, and source maps. Java boxed primitives retain nullability as
`Optional<…>`; C++ unsigned integers retain the nonnegative constraint as
`Integer {>=0}`. Sequence reply types and expression labels may change, while
their participants, evaluation order, and control-flow structure do not.
Matching projected types cannot prove that implementations
are equivalent. Lifecycle lessons may use the projection's `retainConstruction`
option when constructor operations are the subject of the lesson.
Tutorial grading keeps the raw results. Fullscreen and detached views use the
same selection; the existing `uml-sync-*` channel carries `rawDiagrams`,
`language`, `diagramView`, and `classLayout`, with `uml-view-change` requesting a
view change. `css/uml-view-controls.css` owns both themes and light-only print;
printing retains the selected view label alongside the diagram.

Keep each exercise about one concept. Ask for a consequence that requires
tracing the code, distinguishing two cases, or constructing a counterexample;
avoid prompts whose edit instruction gives away the answer. Learners predict
before editing; the explanation stays collapsed. The
source is analyzed locally, never executed. Inference is a source sketch,
not a complete compiler, runtime trace, or proof of ownership/lifetimes.
Verify both starter code and the suggested edit with the real analyzers.
Keep C++ examples focused on the UML concept: omit incidental qualifiers such
as `explicit` and method `const` when the exercise does not depend on them.
The `message_receivers` lab distinguishes variable names from object identity:
changing a reference's initializer moves a call between two existing objects,
while the call site and number of instances stay the same.
Named receivers take precedence over class-based inference; self-calls stay
on the current object's lifeline in the shared analyzers. Java and TypeScript copy known
object identity through simple reference declarations and assignments, with
bindings scoped to each followed method.
Diagram text alternatives state zero-or-more bounds explicitly and keep
separate conditional frames distinct even when their guards are identical.
For associations and shared aggregation, a field's multiplicity describes
targets per source object. The reverse end stays unspecified: a nullable
`Roster*` gives each student zero or one roster, but multiple students can
reference that same roster. No one-student constraint is inferred.

Keep the counterexample and expected result in the collapsed explanation.
The source analyzer shows possible paths, not evaluated branch outcomes or
unrolled loop counts; those predictions require reasoning about the code.

Sequence results include `sequenceWarnings: [{code, message}]` for known
approximations, separately from blocking `errors`. Recursion detection does not
prove nontermination: recursive expansion and the depth limit both stop safely,
with distinct warnings. Unknown calls, deferred execution, unsupported syntax,
ambiguous dispatch, C++ argument order, and approximated control flow report why the sequence may
be incomplete. Warnings are deduplicated by category for each analysis.
`js/uml-sequence-diagnostics.js` owns this contract and embeds a warning note in
the generated sequence so it remains visible in tutorials, popouts, and exports.
Chapter labs also announce it in their existing status region. Valid class
diagrams remain usable; a subsequent clean edit removes the warning.

The brief and detailed diagram text alternatives retain inference warnings too.
An exhausted work budget is a blocking sequence error: no partial or warning-only
sequence is published, while the independently inferred class diagram survives.
Budgets cover expressions and calls as well as statements; a large single
expression must not bypass them.

Java and TypeScript assign fresh lifelines to separate allocations, including
repeated method invocations, and preserve existing aliases when a variable is
reassigned. Java binds supplied object arguments to method parameters. Java,
TypeScript, and C++ isolate alternative reference states and keep a definite
identity at a join only when the considered paths agree. C++ also isolates
per-object field writes. Otherwise an `identity` warning accompanies a symbolic
receiver. This is a bounded abstraction, not whole-program points-to analysis.

Java, TypeScript, and C++ include loop initialization, condition calls, increments,
and rechecks in evaluation order. The initial `while`/`for` check precedes the
loop; the repeated check follows the body and increment. A `do` check follows
the first body. TypeScript logical operands (`&&`, `||`, `??`) use `opt` and
ternary alternatives use `alt`; each branch starts from the same incoming state.
Java cleanup follows the try/catch alternatives, and Java/TypeScript switch
selector calls precede their cases. Early exits, exceptions, optional calls,
unresolved dispatch, and deferred execution retain specific warnings wherever
their full semantics are not modeled. The diagrams do not decide whether
conditions are true or prove that a loop or recursive call terminates.

The research rationale, screened sources, and remaining architectural choices
are recorded in [the sequence inference evidence review](uml-sequence-research-evidence.md).

## Ownership

- `js/sebook-code-preferences.js` owns the shared language preference. Every
  SEBook language selector (chapter examples, labs, and Observer lesson views)
  follows it across the page, navigation, reloads, and other open tabs. Explicit
  selections and language-specific view links write `sebook-code-language` to localStorage. Python
  is the default and the first fallback when a language is unavailable; otherwise
  the example uses its authored default or first option. Fallbacks never overwrite
  the preference. `ts` and `typescript` refer to the same saved language. Settings
  exposes the choice, and the storage inventory can delete it. If storage is
  blocked, selectors still synchronize for the current page.
- `js/sebook-language-viewport.js` preserves the active selector's viewport
  position while synchronized examples resize, including delayed Monaco and
  diagram updates. The preference module emits `sebook:before-code-language-change`
  before notifying views and `sebook:code-language-changed` afterward. Both chapter
  layouts and the Observer reader load the viewport module before their views.
  External preference changes anchor visible prose when no selector is focused.
  The next scroll/navigation gesture releases the anchor; no position is persisted.
- `js/sebook-language-switcher.js` owns the language tabs shared with static
  code examples: selection, arrow/Home/End keys, and tab/panel accessibility.
  Both SEBook layouts load the preference module and then this script before
  the lab controls. Tabs use the shared
  `.inline-language-tabs` styles; an empty `data-language-panel` identifies the
  lab's single editor/diagram panel. Changes emit `sebook:languagechange`.
- `js/uml-live.js` owns source analysis, lazy analyzer loading, worker queues,
  main-thread fallback, text measurement, SVG rendering and accessible names.
  Tutorials and chapter labs use the same pipeline and `js/uml-worker.js`.
- `js/uml-code-lab.js` owns the chapter controls, debounce, per-language drafts,
  reset, status, and stale-result guards. Edits debounce for 150 ms. Each edit
  is checked before analysis; code that checks cleanly updates the diagram at
  once. While the check reports a problem, the previous diagram stays
  unchanged. Once typing pauses for half a second, a small "!" badge appears beside
  the diagram title and the editor marks the problems. Hovering or clicking the
  badge shows each problem's position, message, and fix hint; Escape closes the
  details. A visually hidden status announces the pause. Unedited starter code skips
  the check; a browser test proves every starter passes it. A checker that
  cannot load does not block the diagram. Focusing the editor area starts
  loading the selected language's checker. A spinner occupies reserved space
  beside the diagram title while the previous diagram stays in place. Its
  animation stops for reduced-motion preferences; updates remain announced
  through a visually hidden status. Python is the default; drafts exist only
  in memory and switching languages preserves each draft.
- `js/source-check.js` (`SEBookSourceCheck.check(language, source)`) reports
  syntax problems, then semantic ones, decided by each language's own tools:
  Python uses CPython's `ast` and pyflakes (undefined names) through
  `js/python-ast-service.js`. TypeScript uses the compiler's parse diagnostics,
  then Monaco's TypeScript service (with standard-library typings). C++ uses the
  tree-sitter grammar, then `clang -fsyntax-only` in `js/cpp-worker.js` (with
  standard headers). Java uses the tree-sitter grammar, then resolves type names
  against the example's declarations, its imports, and `java.lang`. No Java
  compiler runs in the browser, and a wildcard import disables that name check.
  The module only adds positions and fix hints; it never executes code. The
  tree-sitter files are vendored under `js/vendor/tree-sitter/`.
- `js/python-ast-service.js` is the page's single Pyodide worker client for
  refactoring analysis (`analyze`) and source checks (`check`).
- `js/uml-code-lab-editor.js` enhances the source field with Monaco's Python,
  Java, C++ and TypeScript grammars, adapting font size and theme to the chapter, with pure white
  and pure black editor backgrounds. The shared
  `js/monaco-loader.js` loads the locally vendored editor for both tutorials and
  chapters. Chapter editors await `loadLanguages` so lazy tokenizers are ready
  before the first edit; each grammar is warmed once per page. Its height
  follows its content, including wrapped lines on
  narrow screens. It shows the source check's problems as Monaco markers (hover,
  or F8 for the problem panel); Monaco's own TypeScript validation is off so
  problems are not repeated. Python editors offer the tutorial refactorings
  (`js/tutorial-refactorings.js`) from the editor menu (right-click or
  Shift+F10); the controller attaches on first focus, so Pyodide loads only for
  learners who edit. Escape leaves
  the editor using `js/monaco-focus-exit.js`. After editing or switching
  languages, the public line colorizer refreshes visible model tokens without
  waiting for Monaco's idle background pass. Scrolling extends that refresh
  to the newly visible code. A native
  textarea remains available if Monaco fails to load. Source drafts are not saved.
- `js/tutorial-code.js` continues to own tutorial file models, progress, layout
  preferences, diagram colors and zoom. Its existing JavaScript/TypeScript UML
  support uses the same local compiler as the chapter controls.
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
if that also fails. Analysis and rendering have a ten-second worker deadline.
A timeout terminates the worker, rejects the stalled operation, and starts
the newest queued edits in a fresh worker. Timed-out work never falls back
to the main thread, so it cannot freeze the editor. Rendering returns false
for stale or disposed work.
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
- **Ownership:** Java, Python, and JavaScript/TypeScript stored references use
  ordinary associations. Allocation, injection, and collection storage do not
  establish composition or aggregation. C++ value members and `unique_ptr`
  provide lifetime/exclusive-ownership evidence for composition; raw pointers,
  references, and `shared_ptr` retain ordinary associations. No analyzer invents
  reverse multiplicity from a field declaration. Java `new Part[n]` allocates
  reference slots without constructing parts; it establishes neither composition
  nor an exact `n`-object multiplicity.
- **Multiplicity evidence:** Java scalar references allow `0..1`; containers
  allow `*`. Python and TypeScript explicit nonoptional annotations express `1`,
  nullable alternatives express `0..1`, and collections express `*`. A reference
  inferred from an unannotated assignment keeps an unspecified bound. Python
  annotations describe a contract rather than runtime enforcement. C++ values
  and references express `1`, nullable pointers express `0..1`, and collections
  express `*`. Neither display view strengthens these source claims.
- **Control flow:** Python preserves early transfers through conditional and
  cleanup paths, including `try`/`else`/`finally`. The call walk is still bounded:
  it does not evaluate arbitrary predicates, unroll loops, model every exception
  type or perform whole-program dynamic dispatch. A diagram shows possible
  source paths, not an execution trace. Python, Java and JavaScript/TypeScript
  limit sequence expansion to 2,000 statement visits; C++ allows 5,000.
  Exceeding the limit returns an explanatory `errors`
  entry and an empty `sequenceDiagram`, while retaining the class diagram;
  a truncated sequence is not presented as a complete result.

Grade the behavior contracts and structural constraints stated in an exercise.
Do not use exact inferred diagram text as the sole correctness oracle. Check
effects, ordering, multiplicities, and forbidden interactions while accepting
equivalent internal designs; use a short explanation for modeling choices.

## TypeScript inference

`language: 'typescript'` selects the existing JavaScript/TypeScript analyzer,
`js/uml-analyzer-js.js`, through the shared client. Both the worker and its
local fallback load the pinned TypeScript 5.9.3 compiler from
`js/vendor/typescript/5.9.3/`; inference does not depend on a CDN. Parsing uses
the compiler's AST and supplied-file symbol resolution. Imports never fetch
files, and source code never executes. Syntax diagnostics include the file,
line and column, allowing an incomplete edit to recover on the next update.
This is syntax analysis, not a full TypeScript type check.

Class inference recognizes classes, interfaces, enums, visibility, inheritance,
constructor parameter properties, typed fields, nullable and union types,
collections, relative imports and type aliases. Stored scalar references retain
their target multiplicity, while the unknown inverse end stays unspecified.

Sequence inference starts at top-level statements, follows constructors and
methods to a bounded depth, and preserves named receivers, simple aliases,
typed arguments, self-calls, replies and control-flow fragments. Local bindings
stay scoped. Branches start with independent bindings; a join preserves object
identity only when every considered path agrees. Uncalled callbacks are not
executed, and `finally` calls follow the try/catch alternatives.

The sequence is a source sketch. Callback invocation, overload resolution,
dynamic dispatch, complex expressions, exact short-circuit behavior, and
path-sensitive exits across nested control flow are not fully modeled.
Use small examples and review the inferred interactions before grading them.

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
syntax highlighting in all four languages, syntax and undefined-base-class
problems in all four languages, refactoring, accessibility, small screens and
print. A browser test runs every starter through `SEBookSourceCheck`, since
unedited starters render without a check.


## Teaching the two views

Chapter labs begin in **Implementation details** and invite a comparison with
**Design focus** before the existing prediction/edit task. Tutorials default to
Design focus. Both views describe the current source: they are not a target
model or evidence that requirements have been met. Language tabs retain separate
examples and drafts rather than translating edits.

Design focus uses UML `Integer`, `Boolean`, `String`, `UnlimitedNatural`, and
`Real`. Shared collection labels are `Sequence<T>`, `Set<T>`, `Map<K,V>`, and
`Tuple<...>`. It preserves optionality, unknown information, visibility, relationships, and
multiplicities. Python naming markers are removed for design display, with
initializers displayed under their class name and protocol operations retained
without paired markers. Source names remain if normalization would collide;
TypeScript constructors also display under their class name. Implementation
details always exposes the original identifiers. Empty no-argument constructors and known no-result return suffixes can be
suppressed. Constructors with parameters or initialization behavior remain,
as do protocol operations. The
implementation view supplies the original source spellings. Primitive mapping
is an abstraction, not a claim of equal numeric range, precision, encoding,
nullability, or runtime checking. `UnlimitedNatural` requires an explicit
unlimited case; a finite unsigned integer is not that UML primitive.

Expression labels use **SEBook design pseudocode**, not executable OCL or a
universal UML expression grammar. Recognized logical operators use `and`, `or`,
and `not`; collection loops use `for each … in …`. A C-style loop retains its
start, condition, and update as separate parts, and a do-while loop says that
the body runs before its test. A recognized assignment uses `:=`. Source
short-circuit behavior, evaluation order, and truthiness still apply. Equality
variants, bitwise operators (`&`, `|`, `^`), and unsupported constructs retain
native notation where rewriting would require type or semantic evidence.
Changing the display does not evaluate a guard or prove that its expression
has no side effects.

This convention follows UML's choice of expression language rather than
pretending that one programming notation is mandated by UML. The supplied
**OMG Unified Modeling Language 2.5.1** (December 2017,
formal/2017-12-05), §7.6.4 (p. 36), §8.3.3.3–8.3.4.2 (pp. 71–72), and
§17.6.4.2 (p. 585), permits language-specific or natural-language expressions
and specifies Boolean interaction guards; §7.8.3.6 (p. 41) requires constraint
evaluation to have no side effects. The public specification is available from
[OMG](https://www.omg.org/spec/UML/2.5.1/PDF).
The supplied **The Unified Modeling Language Reference Manual**, James
Rumbaugh, Ivar Jacobson, and Grady Booch (Addison Wesley Longman, copyright
1999; first printing December 1998; ISBN 0-201-30998-X), agrees in its
“constraint” (pp. 235–236), “guard condition” (pp. 291–292), and “OCL”
(pp. 367–368) entries. This supplied edition is distinct from the 2004 second
edition cited elsewhere in the book. OCL describes constraints and queries;
our assignment and loop labels are pseudocode, not OCL actions.

The [class chapter](../SEBook/uml_class_diagram.md) contains the compact mapping
and a compare-before-edit prompt; the sequence chapter asks whether abstracting
a reply type changes its recipient or timing. The Python ownership tutorial
separates its labeled domain reference (diamonds justified by requirements) from
its expected inferred source structure (associations). This keeps the deliberate
gap available for students to explain rather than disguising it as a parser rule.

Content audit: authored class diagrams in SEBook chapters and tutorials use
canonical primitive spellings; executable Python, Java, C++, and TypeScript
source retains native types. Python starter/solution signatures and stored fields
in UML labs and the two UML tutorials are annotated, except the deliberately
untyped starter in the type-annotation exercise. Target constructors retain their required parameters and initialization
responsibilities; only empty no-argument constructors may be omitted. Model/prose callout
anchors were updated alongside displayed signatures. Other domain-specific
classes (`Date`, `Money`, `Object`, and user-defined types) are retained.
