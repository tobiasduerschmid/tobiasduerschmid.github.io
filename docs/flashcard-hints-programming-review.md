# Programming flashcard hint review

All 324 current cards in the 24 component decks below were reviewed with their answers. This change supplies 214 optional hints and leaves 110 cards unhinted. The two compatibility aggregates, `cs131_functional.yml` and `cs131_python.yml`, were also inspected; they contain deck references and no separate cards. These are authored scaffolds, not runtime-generated answers or a measured learning intervention.

The review follows the project Pedagogical Advisor practice/memory route: preserve an initial retrieval attempt, offer one useful next reasoning action on request, then leave a meaningful prediction, derivation, design decision or explanation for the learner. A hint may recall an easier prerequisite but should not supply the target result, final code or classification. Basic application can benefit from a concrete trace; a high difficulty label alone does not justify a hint.

Source paths below identify the actual repository lessons inspected. Lecture-specific language rules stated by the cards are kept distinct from the earlier web prerequisites used to reason about them. Neither the attached teaching PDF nor student learning outcomes were evaluated by this content subtask.

## Current-master reconciliation

The final content baseline is master `5361c5cb`. All 324 current question/answer pairs were compared with the original reviewed content, and substantive revisions and new questions were manually reviewed against their prerequisites. Language-label additions such as “In Python…” are preserved exactly. The Haskell and Python splits move hints with their actual cards rather than leaving them on the compatibility aggregates.

Of the original 207 hints, 201 remain attached to surviving or moved cards. Six formerly hinted questions were removed or replaced upstream, and their hints were not copied onto unrelated questions. Thirteen current questions received newly authored hints, and two existing hints were revised for changed prompts, yielding 214 hints.

The prerequisite source comparison found the foundational material used here unchanged: current Python and Node chapters add advanced-deck embeds, while the C, CS131 refresher and Haskell tutorials have small explanatory or exercise-metadata edits. The current sources were checked alongside the changed questions.

Explicit moves required for formerly numeric card IDs:

- `nodejs_syntax_explain.yml` card `6` → `nodejs_functional_advanced.yml` card `explain-6`.
- `nodejs_syntax_generate.yml` cards `5` and `7` → `nodejs_functional_advanced.yml` cards `write-5` and `write-7`.
- `python_syntax_explain.yml` card `21` → `python_functional_advanced.yml` card `21`.

Removed or replaced older hinted IDs: `cs131-v2-functional-card-puzzle-negative-section`, `cs131-functional-card-sum-and-product`, `cs131-python-card-default-set`, `cs131-python-card-independent-deep-items`, `cs131-python-card-copy-not-depth`, `cs131-python-card-cycle-copy`.

The 13 newly hinted questions are:

- `cs131-v3-control-card-blocking-operation`.
- `cs131-v3-haskell-card-infer-composed-result`.
- `cs131-functional-card-first-class-functions`.
- `cs131-v3-haskell-card-partial-subtraction`.
- `cs131-v3-haskell-card-tree-recursive-search`.
- `cs131-v3-haskell-card-recursion-parentheses`.
- `cs131-functional-card-inference-is-static`.
- `cs131-v3-haskell-card-nested-list-type`.
- `cs131-functional-card-ord-constraint`.
- `cs131-functional-card-mapper-filter-reducer`.
- `cs131-python-card-default-list-rebind`.
- `cs131-python-card-base-initializer`.
- `cs131-python-card-string-argument`.

Revised existing hints: `cs131-functional-card-evaluation-order` now traces the selected conditional expression; `cs131-v2-implementation-card-target-backend` now distinguishes the shared intermediate representation, target assembly and machine code boundaries.

## Coverage

| Deck | Cards reviewed | Hints | Omitted |
| --- | ---: | ---: | ---: |
| `c.yml` | 14 | 8 | 6 |
| `cs131_control.yml` | 10 | 7 | 3 |
| `cs131_foundations.yml` | 8 | 4 | 4 |
| `cs131_functions.yml` | 10 | 9 | 1 |
| `cs131_haskell_advanced.yml` | 17 | 12 | 5 |
| `cs131_haskell_basic.yml` | 16 | 5 | 11 |
| `cs131_haskell_intermediate.yml` | 14 | 11 | 3 |
| `cs131_implementation.yml` | 12 | 10 | 2 |
| `cs131_logic.yml` | 10 | 10 | 0 |
| `cs131_oop.yml` | 10 | 8 | 2 |
| `cs131_python_classes_defaults.yml` | 8 | 7 | 1 |
| `cs131_python_copies.yml` | 6 | 6 | 0 |
| `cs131_python_references.yml` | 7 | 7 | 0 |
| `cs131_types_scope_memory.yml` | 10 | 9 | 1 |
| `java_syntax_explain.yml` | 15 | 14 | 1 |
| `java_syntax_generate.yml` | 15 | 11 | 4 |
| `nodejs_functional_advanced.yml` | 8 | 3 | 5 |
| `nodejs_syntax_explain.yml` | 17 | 6 | 11 |
| `nodejs_syntax_generate.yml` | 14 | 4 | 10 |
| `python_functional_advanced.yml` | 6 | 6 | 0 |
| `python_syntax_explain.yml` | 37 | 23 | 14 |
| `python_syntax_generate.yml` | 24 | 16 | 8 |
| `react_syntax_explain.yml` | 18 | 8 | 10 |
| `react_syntax_generate.yml` | 18 | 10 | 8 |

## c.yml

Prerequisite grounding: `_data/tutorials/c.yml`: malloc/free, arrays and pointer decay, structs, linked lists; `SEBook/tools/c.md`: C interfaces and linking; `_data/tutorials/cs131-refresher.yml`: value/reference/pointer semantics.

Hint design: Storage-lifetime traces, row-major indexing, preserving overwritten values, representation constraints, and following library code through delivery.

Hinted IDs: `6`, `7`, `8`, `10`, `11`, `12`, `13`, `14`.

Omitted IDs: `1`, `2`, `3`, `4`, `5`, `9`.

Omission judgment: Cards 1–2 retrieve allocation/string facts; 4–5 retrieve representation/formatting rules; 9 retrieves the library role. Card 3 asks for a language-design explanation whose useful cue would largely restate its answer, so it remains unhinted.

## cs131_control.yml

Prerequisite grounding: `_data/tutorials/java-cs131.yml`: Evaluation and Short-Circuiting, Iterables and Iterator State; `SEBook/tools/python.md`: Iterables and Independent Iterators, Generators, Concurrency.

Hint design: Trace evaluated operands, independent traversal state, pause/resume points, and control ownership before interpreting output.

Hinted IDs: `cs131-v2-control-card-short-circuit`, `cs131-v3-control-card-blocking-operation`, `cs131-v2-control-card-iterator-state`, `cs131-v2-control-card-generator-pause`, `cs131-v2-control-card-iterator-boundary`, `cs131-v2-control-card-inline-scheduled`, `cs131-v2-control-card-await-purpose`.

Omitted IDs: `cs131-v2-control-card-safe-guard`, `cs131-v2-control-card-grouping`, `cs131-v2-control-card-range-generator`.

Omission judgment: The safe-guard prompt already supplies the crucial safety ordering. The range-generator item primarily retrieves one construct, while grouping directly asks for the grouping-versus-execution distinction. The new blocking-operation item benefits from tracing when the scheduler can regain control.

## cs131_foundations.yml

Prerequisite grounding: `_data/tutorials/cs131-refresher.yml`: Value, Reference, and Pointer Semantics; Mutation Versus Rebinding; Recursion With No Loops Allowed.

Hint design: Use distinct storage boxes or aliases, design an observable mutation experiment, and unwind recursive results from the base case.

Hinted IDs: `cs131-v2-foundations-card-value-update`, `cs131-v2-foundations-card-reference-update`, `cs131-v2-foundations-card-separate-tests`, `cs131-v2-foundations-card-functional-construction`.

Omitted IDs: `cs131-v2-foundations-card-object-model`, `cs131-v2-foundations-card-relational-model`, `cs131-v2-foundations-card-independent-dimensions`, `cs131-v2-foundations-card-evaluate-claim`.

Omission judgment: Paradigm recognition and independent language dimensions are direct conceptual retrieval. The evaluate-claim item already identifies argument modification; naming its missing rule in a hint would supply the requested answer. Basic value/reference tracing still receives a representational cue because it requires applying a rule to a call.

## cs131_functions.yml

Prerequisite grounding: `_data/tutorials/cs131-refresher.yml`: Mutation Versus Rebinding; `SEBook/tools/python.md`: Closures and exception propagation; `_data/tutorials/java-cs131.yml`: Exceptions and Cleanup; `SEBook/tools/haskell.md`: demand and closures.

Hint design: Separate parameter names from reachable objects, compare evaluation reuse, trace captured state and unwinding, and evaluate post-failure guarantees independently.

Hinted IDs: `cs131-v2-functions-card-reference`, `cs131-v2-functions-card-rebind`, `cs131-v2-functions-card-name-need`, `cs131-v2-functions-card-distinguish-passing`, `cs131-v2-functions-card-value-capture`, `cs131-v2-functions-card-closure-make`, `cs131-v2-functions-card-unwind`, `cs131-v2-functions-card-basic-strong`, `cs131-v2-functions-card-result-optional`.

Omitted IDs: `cs131-v2-functions-card-cleanup`.

Omission judgment: The cleanup item already names the resource, risky operation, and required unconditional cleanup; its remaining task is retrieval of the try/finally construction.

## cs131_haskell_advanced.yml

Prerequisite grounding: `SEBook/tools/haskell.md`: Evaluation follows need, application grouping, list patterns, higher-order functions, closures, currying, persistent data; `_data/tutorials/haskell.yml`; `_data/tutorials/haskell-functions.yml`; `_data/tutorials/haskell-data.yml`.

Hint design: Propagate types through composition, expand folds, distinguish accepting and returning functions, track fixed operands and captured bindings, and decompose persistent-tree recursion.

Hinted IDs: `cs131-v3-haskell-card-infer-composed-result`, `cs131-v2-functional-card-puzzle-demand-undefined`, `cs131-functional-card-first-class-functions`, `cs131-v2-functional-card-puzzle-closure-keeps-binding`, `cs131-v2-functional-card-partial-application-higher-order`, `cs131-v3-haskell-card-partial-subtraction`, `cs131-v2-functional-card-preserve-function-argument`, `cs131-v2-functional-card-curried-function-production`, `cs131-v2-functional-card-recursive-total-completion`, `cs131-functional-card-append-cost`, `cs131-functional-card-tree-path-copying`, `cs131-v3-haskell-card-tree-recursive-search`.

Omitted IDs: `cs131-functional-card-closure-definition`, `cs131-functional-card-uncurry-lambdas`, `cs131-functional-card-define-variants`, `cs131-v3-haskell-card-process-variants`, `cs131-v2-functional-card-constructor-recursive-field`.

Omission judgment: Closure definition, uncurrying notation, variant declaration and recursive constructor-field naming are direct conceptual or syntax retrieval. The new process-variants prompt gives every case and result; a hint would mainly supply pattern-matching notation.

## cs131_haskell_basic.yml

Prerequisite grounding: `SEBook/tools/haskell.md`: Evaluation follows need, application grouping, list patterns, higher-order functions, closures, currying, persistent data; `_data/tutorials/haskell.yml`; `_data/tutorials/haskell-functions.yml`; `_data/tutorials/haskell-data.yml`.

Hint design: Trace selected branches, identify the actual recursive argument, and propagate types through tuple selection and list construction.

Hinted IDs: `cs131-functional-card-evaluation-order`, `cs131-v3-haskell-card-recursion-parentheses`, `cs131-functional-card-inference-is-static`, `cs131-v2-functional-card-puzzle-negative-argument`, `cs131-v3-haskell-card-nested-list-type`.

Omitted IDs: `cs131-functional-card-pure-function-properties`, `cs131-functional-card-definition-not-assignment`, `cs131-v3-haskell-card-string-tail`, `cs131-functional-card-read-signature`, `cs131-functional-card-translate-call`, `cs131-functional-card-prefix-and-infix`, `cs131-functional-card-guard-syntax`, `cs131-functional-card-let-or-where`, `cs131-functional-card-tuple-or-list`, `cs131-functional-card-cons-and-append`, `cs131-functional-card-ranges`.

Omission judgment: Pure-function properties, definition semantics, head/tail string operations, signature reading, call/operator notation, guards, let/where, tuple/list notation, cons/append and ranges are direct rule or syntax retrieval. Their examples already identify the operation; a cue would mostly decode it. The revised inference item now requires diagnosing inconsistent element types, so it receives a reasoning cue.

## cs131_haskell_intermediate.yml

Prerequisite grounding: `SEBook/tools/haskell.md`: Evaluation follows need, application grouping, list patterns, higher-order functions, closures, currying, persistent data; `_data/tutorials/haskell.yml`; `_data/tutorials/haskell-functions.yml`; `_data/tutorials/haskell-data.yml`.

Hint design: Separate demand for shape from demand for values, infer element transformations and required type capabilities, track recursive results, and plan collection stages.

Hinted IDs: `cs131-functional-card-finite-demand`, `cs131-v2-functional-card-write-alternating-selection`, `cs131-functional-card-write-comprehension`, `cs131-v2-functional-card-puzzle-generator-order`, `cs131-v2-functional-card-infer-duplicate-map-type`, `cs131-functional-card-ord-constraint`, `cs131-functional-card-mapper-filter-reducer`, `cs131-v2-functional-card-pipeline-debugging`, `cs131-v2-functional-card-fold-working-steps`, `cs131-v2-functional-card-puzzle-folds-build-lists`, `cs131-functional-card-mapreduce-parallelism`.

Omitted IDs: `cs131-v3-haskell-card-accumulator-update`, `cs131-v2-functional-card-empty-and-singleton-cases`, `cs131-functional-card-list-pattern-shapes`.

Omission judgment: The accumulator-update prompt already specifies the head, running total and required updated accumulator. Empty/singleton cases already give the required behavior, while list-pattern shapes directly test notation. Additional cues would nearly supply these answers.

## cs131_implementation.yml

Prerequisite grounding: `SEBook/tools/compilers.md`: Front Ends, Ambiguity, Precedence; `_data/tutorials/compilers.yml`: Identifier Boundaries, Operator Precedence, Parenthesized Expressions, Statement Sequences.

Hint design: Compare match length before rule order, align tokens with grammar positions, derive minimal expansions and parse roots, and separate lexical information from semantic declarations.

Hinted IDs: `cs131-v2-implementation-card-longest-match`, `cs131-v2-implementation-card-keyword-fix`, `cs131-v2-implementation-card-phase-reason`, `cs131-v2-implementation-card-optional-language`, `cs131-v2-implementation-card-build-grammar`, `cs131-v2-implementation-card-parse-witness`, `cs131-v2-implementation-card-precedence-tree`, `cs131-v2-implementation-card-semantic-evidence`, `cs131-v2-implementation-card-target-backend`, `cs131-v2-implementation-card-declaration-diagnostic`.

Omitted IDs: `cs131-v2-implementation-card-map-update`, `cs131-v2-implementation-card-program-repair`.

Omission judgment: The map-update and single-line arithmetic repair items already provide the operational steps; hints would either repeat basic arithmetic or give the required number.

## cs131_logic.yml

Prerequisite grounding: `_data/tutorials/prolog.yml`: Terms and Unification, Joined Rules, Proof Order and Backtracking, Ground Negation, List Patterns, Recursive List Construction, Removal and Extra Answers, Adjacent Runs; `_data/tutorials/prolog-search.yml`: Negation After Generation, Collected Answers and Duplicates.

Hint design: Trace shared bindings, proof paths, head/tail decomposition, and progress toward a smaller recursive goal.

Hinted IDs: `cs131-v2-logic-card-unify-repeated`, `cs131-v2-logic-card-ground-negation`, `cs131-v2-logic-card-two-step-order`, `cs131-v2-logic-card-duplicate-reason`, `cs131-v2-logic-card-list-decomposition`, `cs131-v2-logic-card-squeeze-equal`, `cs131-v2-logic-card-shared-team-rule`, `cs131-v2-logic-card-list-repair`, `cs131-v2-logic-card-recursion-repair`, `cs131-v2-logic-card-double-elements`.

Omitted IDs: none.

Omission judgment: No omissions: every item requires applying a relation, tracing a proof, repairing a recursive clause, or constructing a rule. No item is merely a fact, acronym, or operator-name recall question. Hints withhold final bindings, answer order, and complete clauses.

## cs131_oop.yml

Prerequisite grounding: `_data/tutorials/java-cs131.yml`: Interfaces and Subtyping, Overriding and Overloading, Parametric Polymorphism; `SEBook/tools/java.md`: encapsulation and generic bounds; `SEBook/tools/python.md`: Inheritance, Initialization, and Dispatch.

Hint design: Separate declaring class from receiver, construction dependencies from destruction order, and a generic body’s permitted types from its current callers.

Hinted IDs: `cs131-v2-oop-card-access-reason`, `cs131-v2-oop-card-lifetime-trace`, `cs131-v2-oop-card-base-virtual`, `cs131-v2-oop-card-explicit-base`, `cs131-v2-oop-card-init-completion`, `cs131-v2-oop-card-generic-diagnosis`, `cs131-v2-oop-card-design-bound`, `cs131-v2-oop-card-delegation-method`.

Omitted IDs: `cs131-v2-oop-card-receiver-call`, `cs131-v2-oop-card-subtype-chain`.

Omission judgment: The explicit-self rewrite and simple subtype-chain question are direct applications of one already stated relationship; a useful cue would largely expose their short answers.

## cs131_python_classes_defaults.yml

Prerequisite grounding: `SEBook/tools/python.md`: Objects, Copies, Calls & Inheritance, mutable defaults, cyclic graphs and copy boundaries; `_data/tutorials/python.yml`: Names/Objects, Lists of References, Copies, Mutable Defaults; `_data/tutorials/cs131-refresher.yml`: Mutation Versus Rebinding.

Hint design: Separate definition time from call time, look up initializer behavior, and trace class stamps, receiver state and overridden methods.

Hinted IDs: `cs131-v2-python-card-class-stamps-not-live-links`, `cs131-v2-python-card-custom-equality-change`, `cs131-v2-python-card-explain-overridden-hook`, `cs131-python-card-default-snapshot`, `cs131-python-card-default-list-rebind`, `cs131-python-card-supplied-empty`, `cs131-python-card-base-initializer`.

Omitted IDs: `cs131-python-card-duck-typed-call`.

Omission judgment: The duck-typed-call item directly retrieves dynamic attribute lookup. Naming the lookup mechanism in a hint would substantially answer its short conceptual question.

## cs131_python_copies.yml

Prerequisite grounding: `SEBook/tools/python.md`: Objects, Copies, Calls & Inheritance, mutable defaults, cyclic graphs and copy boundaries; `_data/tutorials/python.yml`: Names/Objects, Lists of References, Copies, Mutable Defaults; `_data/tutorials/cs131-refresher.yml`: Mutation Versus Rebinding.

Hint design: Choose the copy boundary from the ownership contract and trace shared children separately from the outer containers.

Hinted IDs: `cs131-v2-python-card-compare-shallow-children`, `cs131-v2-python-card-evaluate-double-shallow-copy`, `cs131-python-card-tuple-replace`, `cs131-python-card-copy-dictionary-boundary`, `cs131-v2-python-card-write-independent-nested-edit`, `cs131-python-card-returned-alias-repair`.

Omitted IDs: none.

Omission judgment: No omissions: each item requires applying copy semantics to an object graph or designing a targeted independent edit. Hints do not enumerate final values or supply copy code.

## cs131_python_references.yml

Prerequisite grounding: `SEBook/tools/python.md`: Objects, Copies, Calls & Inheritance, mutable defaults, cyclic graphs and copy boundaries; `_data/tutorials/python.yml`: Names/Objects, Lists of References, Copies, Mutable Defaults; `_data/tutorials/cs131-refresher.yml`: Mutation Versus Rebinding.

Hint design: Draw caller names, local parameters, container slots and child objects separately; track whether an operation changes a binding or the reachable object.

Hinted IDs: `cs131-v2-python-card-track-container-slot`, `cs131-v2-python-card-repair-reset-procedure`, `cs131-v2-python-card-method-result-alias`, `cs131-v2-python-card-create-two-observable-results`, `cs131-python-card-holder-local`, `cs131-python-card-string-argument`, `cs131-python-card-two-parameter-child`.

Omitted IDs: none.

Omission judgment: No omissions: each card requires a concrete alias trace, a behavioral repair or a multi-part explanation. The string-argument hint asks where a replacement value must travel without writing the repair.

## cs131_types_scope_memory.yml

Prerequisite grounding: `_data/tutorials/java-cs131.yml`: Static Types and Execution Stages, Values and Object References; `_data/tutorials/haskell.yml`: Values and Function Types; `SEBook/tools/python.md`: names, objects, reachability, scope; `_data/tutorials/c.yml`: stack/heap lifetime.

Hint design: Use sets of representable values, distinct lookup paths, object-reference graphs, and an ownership ledger. Collector questions use the algorithm named in the card plus prior graph/reachability reasoning; the source review does not claim the web tutorials fully teach each collector.

Hinted IDs: `cs131-v2-types-card-infer`, `cs131-v2-types-card-constraints`, `cs131-v2-types-card-narrowing-witness`, `cs131-v2-types-card-lexical-dynamic`, `cs131-v2-types-card-hidden-live`, `cs131-v2-types-card-marking`, `cs131-v2-types-card-cycle`, `cs131-v2-types-card-owner`, `cs131-v2-types-card-collector-choice`.

Omitted IDs: `cs131-v2-types-card-alias-example`.

Omission judgment: The alias-example prompt already specifies creation, aliasing, and mutation in order. Additional scaffolding would be close to its three-line solution.

## java_syntax_explain.yml

Prerequisite grounding: `SEBook/tools/java.md`: Primitives and Wrappers, Identity, Encapsulation, Information Hiding, Interfaces, Inheritance, Generics, Collections, Exceptions; `_data/tutorials/java-cs131.yml`: corresponding concept practice.

Hint design: Trace implicit conversions, separate object identity from content, test client dependency on representation, and separate static interface checking from runtime dispatch.

Hinted IDs: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `13`, `14`, `15`.

Omitted IDs: `12`.

Omission judgment: Card 12 directly asks for the caller obligation associated with checked exceptions. Naming either obligation in a hint would be the requested conceptual answer.

## java_syntax_generate.yml

Prerequisite grounding: `SEBook/tools/java.md`: Java interfaces, encapsulation, generic bounds, collection contracts and exceptions; `_data/tutorials/java-cs131.yml`: Parametric Polymorphism and Exceptions.

Hint design: Derive state changes and interfaces from the contract, handle absent data before unboxing, and choose types that enforce required invariants.

Hinted IDs: `2`, `3`, `4`, `6`, `7`, `8`, `9`, `10`, `12`, `14`, `15`.

Omitted IDs: `1`, `5`, `11`, `13`.

Omission judgment: Cards 1, 5, 11 and 13 primarily retrieve `.equals`, an explicitly specified interface/implementation skeleton, the named try/catch/finally construction, and the named enhanced loop/interface combination. The prompts already supply their useful decomposition.

## nodejs_functional_advanced.yml

Prerequisite grounding: `SEBook/tools/nodejs.md`: Array Methods and Higher-Order Functions; `_data/tutorials/nodejs.yml`: Array Transformation, callback inputs and array results.

Hint design: Trace the accumulator, distinguish selecting existing elements from transforming them, and derive an update from the empty-input result.

Hinted IDs: `explain-6`, `write-5`, `write-7`.

Omitted IDs: `explain-5`, `explain-12`, `explain-20`, `write-6`, `write-18`.

Omission judgment: The remaining map, filter and find examples, doubling prompt and first-match prompt directly retrieve or recognize one named operation. The question already supplies the useful decomposition.

## nodejs_syntax_explain.yml

Prerequisite grounding: `SEBook/tools/nodejs.md`: array reduction, The Event Loop in Detail, Modern Asynchrony, optional chaining and nullish defaults; `_data/tutorials/nodejs.yml`: Array Transformation, The Blocked Chef, From Callbacks to async/await.

Hint design: Separate scheduling, completion and value delivery; test missing values against valid falsy ones.

Hinted IDs: `9`, `10`, `11`, `14`, `15`, `16`.

Omitted IDs: `1`, `2`, `3`, `4`, `7`, `8`, `13`, `17`, `18`, `19`, `21`.

Omission judgment: Omitted items are basic declaration, equality, interpolation, arrow-function, destructuring, printing, absence/property access, serialization and conditional-syntax recognition. The short examples contain the whole operation, so a cue would largely translate it for the learner.

## nodejs_syntax_generate.yml

Prerequisite grounding: `SEBook/tools/nodejs.md`: map/filter/reduce, callbacks, Promises, independent operations and nullish defaults; `_data/tutorials/nodejs.yml`: array transformation and asynchronous work.

Hint design: Plan asynchronous stages, separate starting independent work from waiting, and connect callbacks to completion.

Hinted IDs: `10`, `11`, `14`, `16`.

Omitted IDs: `1`, `2`, `3`, `4`, `8`, `9`, `12`, `17`, `19`, `20`.

Omission judgment: Omitted prompts directly retrieve syntax or APIs for declarations, comparison, interpolation, arrow functions, destructuring, timer scheduling, serialization, empty values and for-of. Their prompts already name or narrowly specify the operation.

## python_functional_advanced.yml

Prerequisite grounding: `SEBook/tools/python.md`: Lambdas, Higher-Order Functions, Currying, Closures, Iterators and Generators; `_data/tutorials/python.yml`: names, objects, lists of references and function calls.

Hint design: Separate function creation from execution, follow captured bindings and mutation, and identify the state retained across successive calls or resumptions.

Hinted IDs: `21`, `python-course-card-closure-mutation`, `python-course-card-generator-observes-mutation`, `python-course-card-iterable-iterator`, `python-course-write-closure`, `python-course-write-generator`.

Omitted IDs: none.

Omission judgment: No omissions: all six cards require explaining a particular capture or suspension trace, or constructing a function with a stateful contract. The hints preserve the requested outputs and implementation decisions.

## python_syntax_explain.yml

Prerequisite grounding: `SEBook/tools/python.md`: scope, references, copying, defaults, inheritance/MRO, abstract interfaces, closures, iterators/generators, exceptions and concurrency; `_data/tutorials/python.yml`: the foundational object-reference and call models.

Hint design: Apply the reference model to specific alias paths; separate definitions from execution; distinguish returned values, object mutation, and binding changes; trace suspension and cleanup.

Hinted IDs: `python-course-card-super-order`, `python-course-card-purity-boundary`, `python-course-card-abstract-versus-error`, `13`, `14`, `15`, `16`, `17`, `18`, `19`, `20`, `22`, `23`, `24`, `25`, `27`, `28`, `python-course-card-local-before-assignment`, `python-course-card-variadic-child`, `python-course-card-classmethod`, `python-course-card-finally-return`, `python-course-card-coroutine-task`, `python-course-card-runtime-types`.

Omitted IDs: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `26`, `python-course-card-import-environment`.

Omission judgment: Numeric IDs 1–12 directly decode basic syntax or a standard-library call. Card 26 requires recalling the rounding convention; giving it would effectively answer the card. The environment item already supplies the diagnostic commands and asks their direct role, so no additional cue was added.

## python_syntax_generate.yml

Prerequisite grounding: `SEBook/tools/python.md`: comprehensions, ownership, copy boundaries, closures, recursion, iteration and concurrency; `_data/tutorials/python.yml`: Lists of References, Objects & Member References, Copies, Mutable Defaults, Comprehensions, Regex and sys.argv.

Hint design: Translate multi-part contracts into stages, check boundary inputs, preserve the requested identity/ownership behavior, and separate task creation from waiting.

Hinted IDs: `4`, `5`, `9`, `10`, `13`, `14`, `15`, `16`, `17`, `18`, `python-course-write-independent-grid`, `python-course-write-dictionary-default`, `python-course-write-iterator`, `python-course-write-recursive-count`, `python-course-write-safe-lookup`, `python-course-write-concurrent-tasks`.

Omitted IDs: `1`, `2`, `3`, `6`, `7`, `8`, `11`, `12`.

Omission judgment: Omitted prompts retrieve individual formatting, arithmetic, context-manager, enumerate, regex-extraction, type-inspection or search constructs. No hint is needed where the question already specifies that single operation.

## react_syntax_explain.yml

Prerequisite grounding: `SEBook/tools/react.md`: State, Functional updates, Lists/Keys/Conditional Rendering, Lifting State Up, effects; `_data/tutorials/react.yml`: state, collections, conditional rendering, composition; `SEBook/tools/nodejs.md`: callbacks and array methods.

Hint design: Trace one value through the event/state/render cycle, evaluate conditions on a boundary value, and distinguish new object construction from mutation.

Hinted IDs: `8`, `9`, `10`, `14`, `15`, `16`, `17`, `18`.

Omitted IDs: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `11`, `12`, `13`.

Omission judgment: Omitted items directly recognize JSX, props, children, a state declaration, an event handler, list rendering, a ternary, an image tag, inline-style syntax, or the empty-dependency effect convention. No extra method selection or multi-step trace is needed.

## react_syntax_generate.yml

Prerequisite grounding: `SEBook/tools/react.md`: State, Functional updates, Lists/Keys/Conditional Rendering, Lifting State Up, effects; `_data/tutorials/react.yml`: Props, useState, Lists & Keys, Conditional Rendering, Composition.

Hint design: Decompose combined rendering requirements, choose stable identity, construct immutable updates, and trace parent-owned state through callbacks.

Hinted IDs: `3`, `6`, `8`, `9`, `11`, `13`, `14`, `15`, `16`, `18`.

Omitted IDs: `1`, `2`, `4`, `5`, `7`, `10`, `12`, `17`.

Omission judgment: Omitted prompts directly retrieve interpolation, inline-style notation, useState declaration, a single click handler, ternary rendering, children, className or fragment syntax. Their hints would chiefly supply the sought notation.

## Content verification and limits

- All 24 component YAML files parse successfully. Removing `hint` fields yields exactly the parsed master `5361c5cb` content, including IDs, questions, answers, explanations, difficulty, ordering and metadata. Both aggregate files remain unchanged from that baseline.
- Hints contain no completed code blocks or numeric output solutions. Each was checked against its question and answer for technical consistency and remaining learner work.
- An independent reviewer inspected all 207 original hinted pairs and found no newly introduced technical inaccuracies. Three leakage refinements were applied: `python_syntax_explain.yml` card 16 now asks the learner to track receiver identity; `cs131-v2-functions-card-unwind` asks for the stack and handler relationship without stating the skipped-print result; and `cs131-v2-types-card-collector-choice` asks the learner to account for collection operations without naming the repeated copying.
- The independent reviewer also checked all 15 authored additions/revisions for current master. Its two further refinements were applied: `cs131-python-card-default-list-rebind` now asks the learner to trace references without stating the default-reset conclusion, and `cs131-python-card-base-initializer` uses the precise term “initializer lookup.” The other 13 passed that review without requested changes.
- Runtime rendering, keyboard interaction, accessibility and browser coverage belong to the shared feature validation; this file does not claim those checks passed.
- Existing answer caveats were preserved rather than folded into this feature: `c.yml` card 5 prints a platform-dependent `sizeof(int)` but gives 4; `c.yml` card 10 assumes allocation succeeds before dereferencing; `java_syntax_explain.yml` card 15 proposes keys based on names without stating uniqueness; `nodejs_syntax_generate.yml` card 10 asks for `/api/user` but its example uses an example.com URL and catches rejected promises without checking HTTP status. These do not change the selected hint strategy, but merit a separate answer review.
