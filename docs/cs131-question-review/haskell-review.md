# Haskell practice review — 2026-10-14

Reviewed all **52 original quiz questions and 46 original flashcards**. Final decks contain **54 questions and 47 cards**. Every original ID is accounted for below. No original item was silently dropped: seven flashcard objectives were replaced with new IDs; retained/revised objectives keep their IDs.

## Evidence and teaching boundary

Sources supplied by the user:

- `Lectures (Public)/intro_to_functional_programming_and_haskell_td.pptx`: read slides 1–151 (including core definitions, application, guards, local bindings, lists, comprehensions, patterns, types, map/filter/fold, closures, currying, constructors, and immutable structures). Appendix material was not needed to add new objectives.
- `Homeworks (Public)/Homework Problems (Public).docx`: read HASKELL1–10 and ADVHASKELL1–8. These permit pure-function classification, recursive production/repair, list comprehension, helper accumulators, higher-order functions, closure capture, partial types, constructor processing, and allocation reasoning.
- `Past Quizzes (Public)/CS131 Fall 25 Quiz 1 v2.docx`: Problems 3a–c (types, recursive completion, partial accumulator application), 4a–b (recursive ADT declaration and aggregation), 5 (arrow grouping).
- `Past Exams (Public)/[Midterm] F23 (Public).pdf`: Problems 2–4, pp. 4–9 (constructor creation, recursive processing, map/filter/fold construction, higher-order type inference, partial application).
- `Past Exams (Public)/[Midterm] F24 V1 (Public).pdf`: Problems 1–3, pp. 2–6 (nested list recursion and accumulation, recursive tree search, polymorphic higher-order types, explicit currying).

Lecture comments already attached to retained items remain with them. Each item now also identifies a homework operation; past-assessment comments are retained or supplemented where directly applicable. Replaced objectives label their previous source as superseded and cite the actual replacement source. Examples vary from the assessments to require transfer, not answer memorization.

## Pedagogical findings and changes

The original strongest items asked students to trace recursion, distinguish transformation from selection, infer types from uses, or repair an omitted recursive call. Those remain. The main weaknesses were a few fact-list cards, unnecessarily obscure notation, and explanations that overgeneralized lecture simplifications.

The revisions follow construct alignment (perform the operations assessed), retrieval practice (produce small definitions/types/results), and cognitive-load discipline (each prompt targets a specific distinction). Six former trace MCQs are now short write-ins. Meaningful distractors remain on conceptual discrimination questions. The two Parsons items retain 4 and 5 fragments: the pipeline requires filtering before squaring; the currying prompt explicitly fixes parameter order, so the exact-order grader has no semantically interchangeable accepted order.

Replaced recall objectives: historical names/dates; a broad imperative-versus-functional checklist; GHCi command bundles; REPL/Prelude vocabulary; print-versus-putStrLn formatting; the special negative-section parsing exception; sum/product terminology alone. Replacements cover accumulator state, recursive precedence repair, nested/list/string type shapes, composed higher-order types, subtraction argument order, and constructor branch production. These facts may remain in the course, but they are not useful substitutes for the required programming operations in a practice workout.

Corrected or qualified: every expression does not necessarily finish; pure functions may read immutable constants; `where` is convenient across guards but equivalent calculations can be expressed using `let` and nested `if`; a compiler may diagnose unreachable guards without rejecting the definition; lazy evaluation needs finite demand and a productive search; garbage collection is not an unconditional constant-cost operation. Left-section notation was replaced by explicitly taught prefix partial application. Fold-right grouping is supplied, because the lecture principally explains fold-left and the homework permits either fold.

## Final deck counts

| Deck | Quiz questions | Flashcards | Quiz formats |
| --- | ---: | ---: | --- |
| Basic Haskell | 17 | 16 | 11 single, 4 multiple, 2 write-in |
| Intermediate Haskell | 18 | 14 | 13 single, 3 write-in, 1 multiple, 1 parsons |
| Advanced Haskell | 19 | 17 | 14 single, 1 write-in, 1 parsons, 3 multiple |

Basic covers syntax, purity, expressions, local bindings, and data construction. Intermediate covers list recursion, comprehension, types, and map/filter/fold. Advanced covers closure capture, partial application/currying, composed function types, constructors, recursive data, and sharing. A deck's name denotes prerequisites; item difficulty remains calibrated separately.

Both `cs131_functional.yml` files are `active: false` compatibility aggregates listing the three new decks. They contain no duplicate items. The parent task owns master-deck integration.

## Verification

- YAML parses; required fields, answer-index ranges, feedback indices, supported types, and write-in exclusions pass.
- 101 globally unique item IDs across the six leaf files; original-ID accounting is complete.
- `scripts/audit_mcq_tells.py` reports **zero flags** for each of the three new quiz files.
- `git diff --check` passes for the eight Haskell files.
- Independent review confirmed the six typed outputs and both Parsons orders. It also tightened the accumulator prompt to require the updated running total as an argument, and specified that `Single` returns its stored field.
- Every choice answer was reviewed against the language semantics and provided source. Existing applied examples retain their checked answers except the documented revisions.
- All six exact write-in programs executed successfully in the repository's real MicroHs runtime. Results: application precedence `9`; digit recursion `4`; dependent-generator count `10`; positional fold `241`; right/left folds `3 -9`; lambda shadowing `30`.
- Additional MicroHs checks passed for recursive accumulator empty/nonempty cases, countdown termination, three guard partitions, all Charge variants, zero-parent tree aggregation, positive/negative recursive tree searches, composed function result, partial exponent/subtraction, both Parsons expressions, and lazy demand. The demanded error raised the expected runtime error.
- MicroHs inferred `combine :: (a -> b) -> (b -> c) -> a -> (b,c)` and the alpha-equivalent `judge :: (b -> a) -> (a -> Int) -> [b] -> Bool`, confirming the authored types. Detailed run evidence: `haskell-runtime-results.json` beside this report.
- No runtime, frontend, styling, keyboard, or storage behavior changed. Content uses existing text/code-block rendering and quiz formats. Parent task handles build/render integration.

## Complete original-item disposition

Sources in the table use homework section labels from `Homework Problems (Public).docx`; precise original lecture slide ranges and assessment locations remain in the YAML. The replacement/revision reasoning is specific to each changed item.

### Quizzes

| Original item ID | Disposition / destination | Evidence | Review reasoning |
| --- | --- | --- | --- |
| cs131-functional-identify-pure-function | Revised; basic | HASKELL7 A (classify purity); lecture slides 5–6 (pure functions, side effects) | Clarified that purity allows immutable external constants. |
| cs131-functional-purity-benefits | Retained; basic | HASKELL7 A; ADVHASKELL3 C (purity and repeated calls); lecture slide 6 (why purity matters) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-binding-twice | Retained; basic | HASKELL7 (immutable bindings); lecture slides 5, 7 (immutable bindings) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-unused-binding | Retained; basic | ADVHASKELL3 C (unused failing argument); lecture slide 8 (evaluation follows need) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-nested-call-syntax | Retained; basic | HASKELL3 B (application precedence); lecture slides 19–20 (application groups to the left) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-puzzle-application-binds-first | Revised → write-in; basic | HASKELL3 B (application precedence); lecture slides 19–20 (calling functions) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-functional-equivalent-groupings | Retained; basic | HASKELL3 B; HASKELL4 A (calls and tuples); lecture slides 19–21 (nested calls with few parentheses) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-if-needs-else | Revised; basic | HASKELL3 C (conditional recursion); lecture slide 24 (if is an expression) | Removed the false claim that every expression successfully yields a value. |
| cs131-v2-functional-puzzle-guard-order | Revised; basic | HASKELL3 C (guards); lecture slides 25–26 (guards) | Removed an unnecessary map prerequisite and an overly broad compiler claim. |
| cs131-functional-recursion-digit-count | Revised → write-in; basic | HASKELL3 C; HASKELL5 B (recursive progress); lecture slides 27–28 (recursion with guards, trace-through) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-functional-where-across-guards | Revised; basic | HASKELL4 A (where and let scope); lecture slides 30–32 (let versus where) | Kept useful scoping distinction without implying let cannot express equivalent behavior. |
| cs131-functional-helper-sees-parameter | Retained; basic | HASKELL5 A (nested helper scope); lecture slides 33–34 (nested functions in where) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-tuple-selection | Retained; basic | HASKELL4 A (tuples); lecture slides 36–37 (tuples, fst and snd) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-valid-lists | Retained; basic | HASKELL6; HASKELL10 B (list/tuple shapes); lecture slide 38 (lists hold one element type) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-zip-after-drop | Retained; basic | HASKELL6 (list operations); lecture slides 39–40 (list operations) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-range-step | Retained; basic | HASKELL5 A; HASKELL8 A (ranges); lecture slide 41 (ranges) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-puzzle-lazy-search | Revised; intermediate | HASKELL8 A (finite demand from infinite candidates); lecture slides 8, 41 (infinite lists) | Used explicitly taught lambda syntax instead of requiring an operator section. |
| cs131-functional-append-one-element | Retained; basic | HASKELL6 C–D (cons versus append); lecture slide 42 (: and ++) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-skip-recursive-step | Retained; intermediate | HASKELL9 A (dropping elements); lecture slides 44–48, 66–71 (list recursion) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-pairwise-recursion-trace | Retained; intermediate | HASKELL9–10 (recursive list patterns); lecture slides 66–71 (list patterns in recursion) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-recursive-selection-repair | Retained; intermediate | HASKELL6 C (recursive selection); lecture slides 44–48, 66–69 (list recursion) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-comprehension-guard | Retained; intermediate | HASKELL8 A–B (comprehension guards); lecture slides 51–56 (comprehensions with a guard) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-dependent-generator-count | Revised → write-in; intermediate | HASKELL8 A (comprehensions); lecture slide 59 (dependent generators); lecture slides 57–59 (multiple and dependent generators) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-functional-quicksort-duplicates | Revised; intermediate | HASKELL6 C; lecture slide 60 (partitioning); lecture slide 60 (quicksort with comprehensions) | Recalibrated a routine trace with one missing equality case. |
| cs131-functional-literal-pattern-order | Retained; intermediate | HASKELL9 A.2 (equation order); lecture slides 63–65 (patterns with constants; first match wins) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-nested-pattern-bindings | Retained; intermediate | HASKELL9 A (list patterns); lecture slides 66–70 (list pattern cheat sheet) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-same-element-type-constraint | Retained; intermediate | ADVHASKELL7 (type constraints from uses); lecture slides 73–75 (type variables) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-infer-fractional | Retained; intermediate | ADVHASKELL7 (type inference); lecture slide 76 (Fractional); lecture slide 76 (type classes inferred from operations) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-return-function-type | Retained; intermediate | ADVHASKELL2 A; ADVHASKELL3 (returned functions); lecture slides 78–81 (returning functions) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-map-boolean-results | Retained; intermediate | ADVHASKELL1 A–B (map/filter distinction); lecture slides 83–90 (mappers and filters) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-pipeline-order-counterexample | Retained; intermediate | ADVHASKELL1 B (pipeline tracing); lecture slides 83–90, 97 (map-filter-reduce pipelines) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-fold-positional-accumulator | Revised → write-in; intermediate | ADVHASKELL1 A.3; ADVHASKELL2 B.7 (fold accumulator); lecture slides 91–95 (foldl and its accumulator) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-v2-functional-fold-string-order | Retained; intermediate | ADVHASKELL1 A.3 (fold order); lecture slides 42, 91–96 (foldl that builds a list) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-puzzle-fold-direction | Revised → write-in; intermediate | ADVHASKELL1 A.3 (foldl/r; grouping supplied); lecture slides 91–96 (foldl and foldr) | Added explicit grouping definitions so the exercise tests tracing rather than untaught foldr implementation recall. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-v2-functional-assemble-select-square-sum | Retained; intermediate | ADVHASKELL1 A–B (compose filter/map/fold); lecture slides 83–96 (filter, map, then reduce) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-puzzle-let-shadowing | Retained; advanced | ADVHASKELL3 A (lexical closure capture); lecture slides 29–30, 102–107 (let, closures) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-free-and-bound | Revised; advanced | ADVHASKELL3 A.1–3 (captured variables); lecture slides 106–107 (free and bound variables) | Bound the free-variable question to the data variables, excluding implicit operator names. |
| cs131-functional-lambda-shadows-parameter | Revised → write-in; advanced | ADVHASKELL3 A.4–5 (shadowing and lambda application); lecture slide 110 (lambdas and closures challenge) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. Requires a produced output instead of recognizing a distractor; exact program executed in MicroHs. |
| cs131-functional-partial-application-type | Retained; advanced | ADVHASKELL4 A.2 (partial application types); lecture slides 113–117 (partial function application) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-partially-applied-fold-type | Retained; advanced | ADVHASKELL4 A.2; ADVHASKELL7 (higher-order partial types); lecture slides 91–95, 113–117 (partially applied fold) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-puzzle-left-section | Revised; advanced | ADVHASKELL4; lecture slide 22 (prefix operators); lecture slides 22, 116–117 (operators as partially applied functions) | Replaced left-section notation with the prefix partial application explicitly taught in the lecture. |
| cs131-v2-functional-puzzle-curried-map | Retained; advanced | ADVHASKELL4 B; ADVHASKELL7 (higher-order partial application); lecture slides 118–128 (currying) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-function-argument-parentheses | Retained; advanced | ADVHASKELL4 A.1 (arrow grouping); lecture slides 80, 125 (function-valued parameters in curried types) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-assemble-explicit-currying | Retained; advanced | ADVHASKELL4 C.4 (nested lambdas); lecture slides 122–124 (currying by hand) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-adt-values | Retained; advanced | ADVHASKELL5 A.1 (constructor fields); lecture slides 131–135 (algebraic data types and constructors) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-constructor-pattern-order | Retained; advanced | ADVHASKELL5 A.2 (constructor patterns); lecture slides 136–142 (pattern matching on variants; first match wins) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-recursive-constructor-values | Retained; advanced | ADVHASKELL5 A.1 (recursive constructors); lecture slides 143–145 (a list built from an algebraic type) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-tree-pruning-counterexample | Revised; advanced | ADVHASKELL5 C.2 (traverse child trees); lecture slides 136–145 (recursion over an algebraic type) | Recalibrated reasoning that combines recursive constructors, pattern order, and a fold. |
| cs131-functional-immutable-point-update | Retained; advanced | ADVHASKELL5 B (immutable updates); lecture slides 131–135, 143–145 (records; updates build new values) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-append-cost | Retained; advanced | ADVHASKELL8 (list copying cost); lecture slides 144–145 (adding to the end of an immutable list) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-bst-path-copy | Revised; advanced | ADVHASKELL5 B (path copying); lecture slide 146 (tree insertion); lecture slide 146 (inserting into an immutable binary search tree) | Replaced an approximate logarithm fact with a concrete path-copying allocation trace. |
| cs131-functional-immutability-tradeoffs | Revised; advanced | ADVHASKELL5 B; ADVHASKELL8 (versions and sharing); lecture slides 147–150 (garbage collection; pros and cons of immutability) | Applied immutability benefits to an explicit two-version scenario and avoided a claim about all language implementations. |

### Flashcards

| Original item ID | Disposition / destination | Evidence | Review reasoning |
| --- | --- | --- | --- |
| cs131-functional-card-pure-function-properties | Revised; basic | HASKELL7 A (purity); lecture slides 5–6 (pure functions) | Kept concise foundational retrieval, corrected immutable-constant qualification. |
| cs131-functional-card-evaluation-order | Revised; basic | ADVHASKELL3 C (lazy demand); lecture slide 8 (order of evaluation) | Replaced an overgeneralized evaluation-order claim with a concrete demand trace. |
| cs131-functional-card-definition-not-assignment | Retained; basic | HASKELL7 (immutable bindings); lecture slides 5, 7 (immutable bindings) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-imperative-versus-functional | Replaced → cs131-v3-haskell-card-accumulator-update; intermediate | HASKELL5 B; HASKELL6 E (accumulator helper); slides 27–34, 91–95 (recursive accumulator) | Replaced a broad paradigm checklist with accumulator-recursion production. |
| cs131-functional-card-history | Replaced → cs131-v3-haskell-card-infer-composed-result; advanced | ADVHASKELL7 (higher-order type inference); slides 73–80, 125 (higher-order types) | Replaced historical names and dates with multi-stage higher-order type inference. |
| cs131-functional-card-ghci-commands | Replaced → cs131-v3-haskell-card-recursion-parentheses; basic | HASKELL3 B (non-progressing recursive call); slides 19–20, 27–28 (recursive application) | Replaced command memorization with the recursion-precedence repair required by homework. |
| cs131-functional-card-repl-and-prelude | Replaced → cs131-v3-haskell-card-string-tail; basic | HASKELL1 A.3; HASKELL6 (strings and list operations); slides 39, 43 (strings as lists) | Replaced REPL acronym/Prelude recall with string-as-list prediction. |
| cs131-functional-card-read-signature | Retained; basic | HASKELL3 A.1 (type signatures); lecture slides 15–17 (function definitions and signatures) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-inference-is-static | Revised; basic | HASKELL6; ADVHASKELL7 (type constraints); lecture slide 18 (type inference) | Made static type inference concrete and removed an overbroad numeric-conversion claim. |
| cs131-functional-card-translate-call | Retained; basic | HASKELL3 B (application grouping); lecture slides 19–21 (calling functions) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-puzzle-negative-argument | Retained; basic | HASKELL3 B (negative input and parentheses); lecture slides 19–20 (calling functions) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-prefix-and-infix | Retained; basic | HASKELL5 A (infix mod); lecture slides 22, 40 (prefix and infix notation) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-guard-syntax | Revised; basic | HASKELL3 C.2 (write guards); lecture slides 25–26 (guards) | Changed guard syntax recall into a short definition with a boundary case. |
| cs131-functional-card-let-or-where | Revised; basic | HASKELL4 A.2–3 (where/let distinction); lecture slides 30–32 (let versus where) | Corrected the claim that where is mandatory; targeted the actual scope distinction. |
| cs131-functional-card-tuple-or-list | Retained; basic | HASKELL4 A; HASKELL6 (tuples and lists); lecture slides 36–38 (tuples and lists) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-cons-and-append | Retained; basic | HASKELL6 C–D (building lists); lecture slide 42 (: and ++) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-ranges | Retained; basic | HASKELL8 A (ranges); lecture slide 41 (ranges) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-finite-demand | Revised; intermediate | HASKELL8 A (finite demand); lecture slides 8, 41 (infinite lists and demand) | Qualified termination as evaluation of the requested finite list. |
| cs131-v2-functional-card-puzzle-demand-undefined | Revised; advanced | ADVHASKELL3 C; lecture slide 47 (error and demand); slides 8, 39, 47 (lazy demand; error expression) | Kept demand analysis but replaced untaught undefined with the lecture's explicit error expression. |
| cs131-v2-functional-card-puzzle-print-versus-putstrln | Replaced → cs131-v3-haskell-card-nested-list-type; basic | HASKELL4 A; HASKELL10 B (nested list/tuple shapes); slides 36–38, 73–75 (nested types) | Replaced print formatting trivia with nested data-shape typing. |
| cs131-v2-functional-card-empty-and-singleton-cases | Retained; intermediate | HASKELL9–10 (base cases); lecture slides 66–71 (list patterns) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-write-alternating-selection | Retained; intermediate | HASKELL9 A (bounded list patterns); lecture slides 66–71 (list patterns) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-write-comprehension | Retained; intermediate | HASKELL8 A–B (write comprehensions); lecture slides 51–56 (comprehensions) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-puzzle-generator-order | Retained; intermediate | HASKELL8 (comprehensions); lecture slides 53–59 (generator order); lecture slides 57–59 (multiple generators) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-list-pattern-shapes | Retained; intermediate | HASKELL9 A (list patterns); lecture slides 66–70 (list pattern cheat sheet) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-infer-duplicate-map-type | Retained; intermediate | ADVHASKELL7 (map type inference); lecture slides 73–75, 87–88 (type variables, map) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-ord-constraint | Revised; intermediate | ADVHASKELL7; lecture slide 76 (Ord); lecture slide 76 (type classes) | Turned type-class definition recall into signature construction. |
| cs131-functional-card-first-class-functions | Revised; advanced | ADVHASKELL2 A (higher-order functions); lecture slides 78–82 (first-class and higher-order functions) | Replaced a four-property list with recognition of higher-order behavior in code. |
| cs131-functional-card-mapper-filter-reducer | Revised; intermediate | ADVHASKELL1 (map/filter/fold construction); lecture slides 83–86 (mappers, filters, and reducers) | Anchored map/filter/fold discrimination to a concrete pipeline. |
| cs131-v2-functional-card-pipeline-debugging | Retained; intermediate | ADVHASKELL1 A (select rather than transform); lecture slides 83–90 (map and filter) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-fold-working-steps | Retained; intermediate | ADVHASKELL1 A.3; ADVHASKELL2 B.7 (fold accumulator); lecture slides 91–95 (foldl trace-through) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-puzzle-folds-build-lists | Revised; intermediate | ADVHASKELL1 A.3 (foldl/r; grouping supplied); lecture slides 91–96 (foldl and foldr) | Provided fold grouping to keep the item within taught application rather than foldr implementation recall. |
| cs131-functional-card-mapreduce-parallelism | Revised; intermediate | ADVHASKELL1 B; HASKELL7 (pure map); lecture slides 97–99 (map-reduce at industrial scale) | Applied purity to an actual split-map computation. |
| cs131-functional-card-closure-definition | Revised; advanced | ADVHASKELL3 A.1–3 (closure capture); lecture slides 102–107 (closures) | Restricted free-variable identification to the named data variables. |
| cs131-v2-functional-card-puzzle-closure-keeps-binding | Retained; advanced | ADVHASKELL3 A (lexical capture); lecture slides 102–107 (closures capture bindings) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-partial-application-higher-order | Retained; advanced | ADVHASKELL4 A.2; ADVHASKELL7 (partial application types); lecture slides 113–117 (partial function application) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-puzzle-negative-section | Replaced → cs131-v3-haskell-card-partial-subtraction; advanced | ADVHASKELL4 (partial application); lecture slide 22 (prefix operators); slides 22, 113–117 (prefix partial application) | Replaced the special negative-section syntax trap with ordinary prefix partial application. |
| cs131-v2-functional-card-preserve-function-argument | Retained; advanced | ADVHASKELL4 A.1 (arrow parentheses); lecture slides 80, 125 (function-valued parameters in curried types) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-curried-function-production | Retained; advanced | ADVHASKELL4 C.4 (explicit currying); lecture slides 122–124 (currying by hand) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-uncurry-lambdas | Retained; advanced | ADVHASKELL4 C.3–4 (nested lambdas); lecture slides 123–129 (currying challenge) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-define-variants | Retained; advanced | ADVHASKELL5 A.1 (define constructors); lecture slides 131–135 (defining algebraic data types) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-sum-and-product | Replaced → cs131-v3-haskell-card-process-variants; advanced | ADVHASKELL5 A.2; ADVHASKELL6 (constructor branches); slides 131–142 (constructor pattern matching) | Replaced sum/product vocabulary with constructor-based function production. |
| cs131-v2-functional-card-constructor-recursive-field | Retained; advanced | ADVHASKELL5 C.1 (recursive child list); lecture slides 143–145 (recursive algebraic types) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-v2-functional-card-recursive-total-completion | Retained; advanced | ADVHASKELL5 A.2–3 (recursive ADT processing); lecture slides 143–145 (processing a list built from an algebraic type) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-append-cost | Retained; advanced | ADVHASKELL8 (append cost); lecture slides 143–145 (adding to an immutable list) | Useful course-grounded retrieval or application with a valid answer and diagnostic feedback. |
| cs131-functional-card-tree-path-copying | Revised; advanced | ADVHASKELL5 B; lecture slides 146–147 (sharing and reachability); lecture slides 146–147 (immutable trees, garbage collection) | Removed the unqualified claim that garbage collection never changes asymptotic cost. |

## Added items

- `cs131-v3-haskell-nary-total-step`: quiz, Advanced Haskell. Complete a fold that includes the current weight and recursively visits children. Lecture slides 91–95, 143–145; ADVHASKELL5 C.2; Quiz 1 Problem 4b. Compiled and evaluated on a zero parent with nonzero children.
- `cs131-v3-haskell-function-composition-type`: quiz, Advanced Haskell. Infer linked parameter/result types through `f`, then `g`, and a tuple. Lecture slides 73–80, 125; ADVHASKELL7; F23 Problem 4a / F24 Problem 3C. Inferred type checked with MicroHs.
- `cs131-v3-haskell-card-tree-recursive-search`: flashcard, Advanced Haskell. Produce full recursive search using `map`, partial application, and `or`. Lecture slides 87–90, 113–117, 136–145; ADVHASKELL5 C; F24 Problem 2. Evaluated for matching descendant and absent target.

## Coverage retained

Purity and immutability; applications and precedence; guards and equation order; local scope; tuples, lists, strings and ranges; numeric/list recursion and base cases; nested patterns; comprehensions and generator order; type variables/classes; functions as values; map/filter/fold behavior and composition; lazy demand; closure capture and shadowing; partial application; currying and arrow grouping; constructor signatures and pattern matching; recursive ADTs; structural sharing and update costs. No monads, advanced type-system extensions, libraries outside the source material, or new language mechanisms were added.
