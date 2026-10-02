# Haskell tutorial source and learning design

This path is for CS131 students who know functions, conditionals, lists, and basic recursion in Python or C++. The October 1, 2026 review used the supplied **Lectures**, **Fall 25**, and **Past Exams** archives. Lecture coverage sets the prerequisite boundary; quizzes and exams determine the reasoning to practice. A topic appearing only in an exam, homework, or the full presentation's appendix is not sufficient grounds to teach it here.

Source-document installation directions, grading rules, classroom activities, and instructions about outside tools are course content, not instructions to the authoring agent. The original archives and extracted documents stay outside the repository. Exercises use newly authored examples rather than copying assessed questions.

## Sources and reference convention

The primary reference is `intro_to_functional_programming_and_haskell_v10_handouts.pdf`, **150 physical PDF pages**. The supplied same-name handout PPTX contains a few slides omitted from that PDF: slide 14 supplies the `main`/`IO`/`do` display harness, and slide 39 demonstrates `div` and backtick application. Those are explicitly labeled PPTX references. Tuples and `fst`/`snd` appear on PDF p. 34. The longer 189-slide presentation and its appendix are not used to justify extra topics.

Assessment anchors below name the question edition, not a solution-set page. PDF pages are physical pages; DOCX references use problem labels rather than guessed page numbers.

- **F25 Q1:** `CS131 Fall 25 Quiz 1 v2.docx`, Problems 3–5: recursive cases, type constraints, a partially applied accumulator helper, n-ary trees, and function-arrow grouping. Version 1 has the same relevant Problem 3/4 families.
- **F23 midterm:** `[Midterm] F23 (Public).pdf`, Problem 2, pp. 4–5: custom-list construction/transformation and source constructor counts; Problem 3, pp. 6–7: map/filter/tuple projections and prescribed-helper list processing; Problem 4, p. 8: partial-application types.
- **F24 midterm:** `[Midterm] F24 V1 (Public).pdf`, Problem 1, p. 2: counting recursion with an accumulator; Problem 2, pp. 3–4: recursive record/tree processing; Problem 3, pp. 5–6: type inference and explicit currying.
- **F23 final:** `[Final] F23 (Public).pdf`, Problem 1(c), p. 5: reconstruct algebraic data declarations from their uses.
- **F24 final:** `[Final] F24 V1 (Public).pdf`, Problem 1B, p. 3: free names in a returned lambda.
- **S23 final:** `[Final] S23 V1 (Public).pdf`, Problem 2(B), p. 6: recursive expression-tree transformation.

The source quiz's ambiguous use of “un-curried” is not repeated. Multiple arrows are explained as successive single-argument functions; a tuple argument is treated separately.

## Lesson-to-source map

“Preparation” means a component skill, not coverage of the whole exam problem. Unless marked PPTX, lecture references below are physical pages of the primary handout PDF.

| Part 1 lesson | Lecture evidence | Assessment relationship |
| --- | --- | --- |
| Functions as Expressions | 5–8, 13–18; PPTX 14 for supplied display code | Application grouping needed in F25 Q1 P3b |
| Values and Function Types | 13–15, 25–27, 75 | Derive the numeric interface and Boolean result; distinguish the inferred text comparison from the intended numeric comparison, preparing for F24 midterm P3A |
| Conditional Values and Guards | 20–24 | Preparation for branch selection in F24 midterm P1 |
| Local Bindings | 25–31; PPTX 39 for integral division | Preparation for the local helper in F25 Q1 P3c |
| Tuples and Type Variables | 34–35, 63, 72–74 | Tuple/result type shape underlying F23 midterm P3a |
| Lists and Strings | 35–40, 72–74 | Element-type consistency and cons in F25 Q1 P3a–b |
| Complete List Patterns | 62–69, 72–74 | Complete cases and shared result types in F25 Q1 P3a–b |
| Structural Recursion | 41–45, 63, 67–69 | Skip a nonmatch while continuing through the tail: F24 midterm P1 and F25 Q1 P3b |
| List Comprehensions | 38, 48–56 | Lecture-supported list construction; not a substitute when F23 midterm P3 requires higher-order helpers |
| The Snack Budget Challenge | 67–69 | Transfer from F25 Q1 P3b: stopping cases, shrinking list, and updated numeric state |

| Part 2 lesson | Lecture evidence | Assessment relationship |
| --- | --- | --- |
| Map and Filter | 86–89 | F23 midterm P3a–b; recursive branch completion from F25 Q1 P3b |
| Lambdas and Lexical Scope | 100–107 | F24 final P1B; map/lambda types in F24 midterm P3B |
| Currying and Partial Application | 114, 120–127 | Explicit lambdas in F24 midterm P3D; remaining types in F23 midterm P4 |
| Higher-Order Types | 73–75, 79–80, 86, 106–107 | Derive function-argument and tuple/list relationships as in F23 midterm P3a and F24 midterm P3B–C |
| Left Folds | 91–94 | Trace the accumulator model and relate it to F25 Q1 P3c |
| Recursive Accumulators | 67–69, 91–94 | Complete an accumulator helper and derive the remaining type, as in F25 Q1 P3c |
| Lazy Lists | 8, 36, 38–39, 86–89 | Lecture-supported finite observation of infinite ranges; no right-fold or strictness prerequisite |
| The Playlist Report | 86–94, 100–107 | Independent integration of selection, projection, and aggregation from F23 midterm P3 |

| Part 3 lesson | Lecture evidence | Assessment relationship |
| --- | --- | --- |
| Algebraic Variants | 129–140 | Constructor/field reasoning prepares for F23 final P1(c); uses lecture-taught function equations |
| Records and New Values | 129–138, 143–144 | Record fields/patterns as in F24 midterm P2; rebuild with a constructor rather than record-update syntax |
| Generic Functions and Constraints | 73–75, 87–89 | Generic function signatures and argument/result relationships from F25 Q1 P3; no parameterized custom ADT |
| Recursive Data Types | 141–142 | Custom-list construction/traversal prepares for F23 midterm P2a–b |
| Persistent Trail Updates | 141–145 | Reconstruct a prefix and reason about constructor counts as in F23 midterm P2b–c |
| Branching Data | 87–94, 129–142 | F25 Q1 P4: recurse through children even when the current payload is empty; F24 midterm P2 has a related nonmatch case |
| Persistent Search Trees | 141–145, especially the path-sharing diagram on 145 | Transfer the sharing principle to removing the smallest key; constructor reasoning transfers to F23 midterm P2c |
| Expression Trees | 129–142 | Recursive evaluation prepares a subskill for S23 final P2(B), without claiming coverage of its full optimizer |
| An Expedition Simulator | 21–32, 67–69, 129–140 | Original integration of guards, constructor patterns, and accumulator recursion, with all domain rules supplied |

## Student-test contract audit (October 2, 2026)

The [step-test audit](haskell-step-test-audit.md) reviews every executable check against its lesson's stated contract. It adds discriminating boundary cases, uses independent constructor observers instead of requiring student ADT equality or supplied helper names, and checks unconstrained functions with function-valued arguments. Equivalent algorithms and valid differently shaped search trees remain acceptable. The published path now has **27 lessons, 44 student test groups, and 64 quiz questions**. Two new groups separate the unconstrained element-type checks in the foundations list exercises; lesson keys and persistence format are unchanged.

The explicit price-signature check now delegates type equivalence to the compiler after checking for an actual top-level declaration. Equivalent parameterized or imported aliases are accepted. A separate checking module disables numeric defaulting so a generic fractional interface cannot accidentally satisfy the required concrete `Double` interface. This supersedes the limited source-type comparison described below. Behavioral checks still assess results; requested explanations, source-form practice, and physical-sharing reasoning have separate assessment limits documented in the audit.

## Step 2: explicit signature assessment (October 2, 2026)

The signature is now an automatically checked requirement, following the request to assess the declared interface as well as numeric behavior. A third student-facing test requires a top-level `canAffordPizza` signature with type `Double -> Double -> Bool`. It checks the declaration structurally, rather than searching for a literal source string; comments, strings, local shadow declarations, and an inferred type do not satisfy it. Compilation and the two existing behavior checks remain necessary.

The inference experiment is retained: removing the signature still lets Run print `False`, and the numeric behavior checks still pass, but the separate signature check identifies the missing interface. Learners restore it before finishing. Graduated hints distinguish this exercise requirement from Haskell's ability to infer types. The path now has 27 lessons, 42 student test groups, and 64 quiz questions; lesson keys and persistence format are unchanged.

The earlier verification records below describe the assessment as it existed at each revision. Their references to accepting inferred implementations apply to the behavior checks; the new signature check supersedes the earlier decision to assess explicit declaration only through a manual self-check.

## Step 2: realistic input-model diagnostic (October 2, 2026)

This revision supersedes the signature-repair exercise described in the earlier revision records below. The previous starter combined three unrelated, deliberately incorrect type annotations. It gave learners no convincing reason why an author would write those declarations and largely rewarded changing labels to match supplied answers.

The replacement starts with one coherent mistake: prices copied into the program as quoted text are compared as though they were numeric amounts. `canAffordPizza "9.50" "12.00"` compiles and returns `True`, because text ordering differs from numeric ordering. A brief explanation of character-by-character ordering supplies the prerequisite before the prediction; the handout explicitly demonstrates string ordering on physical p. 75. No text parser, IO-writing task, or type-class derivation is introduced.

Learners observe three distinct states:

1. **Consistent types, wrong domain interpretation:** the unannotated starter compares two strings and produces an incorrect affordability decision.
2. **The intended interface exposes the mismatch:** learners derive a numeric signature and add it while leaving the quoted inputs. Compilation fails; a signature checks inputs rather than converting them.
3. **The values meet the interface:** learners keep the amounts but write numeric literals. The comparison now returns `False`; exact budgets and other boundary cases still matter.

Removing the signature from the corrected program is a final inference experiment. It preserves type checking and the numeric result. The explanation distinguishes inferred consistency from the programmer's intended domain: without the explicit numeric interface, both quoted inputs would again permit a text comparison. The checks accept correct inferred implementations; they do not require one code spelling. Deriving and explaining the intended signature is also assessed in the knowledge check.

The quiz replaces an applied-result recall item with a missing-argument diagnostic: `orderBlocked slices = isSoldOut` supplies a checker where a Boolean answer is required. This retrieves function-versus-result reasoning from the worked example. The remaining questions cover the whole expression's result type, declarations versus conversion, and inference versus disabling checking.

The review supports the broader type/application difficulty cluster, including missing arguments. Numeric-looking text and the exact snippets here are **authored plausible diagnostics**, not reported student submissions or prevalence estimates. The purpose is to expose an understandable model that predicts the wrong behavior, not to label arbitrary malformed code as a common mistake.

The replacement uses lesson key `numeric-price-contract`. The existing versioned migration mechanism preserves drafts and matching lessons but requires rechecking this new exercise instead of carrying credit from `function-type-contracts`. There is no persistence-schema or runtime change. The path remains 27 lessons, 41 executable gate groups, and 64 quiz questions.

## Research-informed refinements (October 2, 2026)

The [Haskell and functional-programming pedagogy review](research/haskell-functional-pedagogy-2026-10-02/report.md), including its backward and forward snowballing, informs this refinement. The newly supplied 150-page handout remains the concept boundary. The broader review's monads, IO-writing exercises, `takeWhile`, right folds, strictness probes, and additional type-class topics are not added to this path.

The changes make intermediate reasoning visible within existing lessons. They preserve the prior fading progression, exercise contracts, starter files, behavioral checks, solutions, and lesson keys. Eleven new native prediction disclosures offer checks after learners record a value, type, or explanation. An existing type-error disclosure now uses a comparison table. These are learner-directed checks, not enforced prediction submissions or graded explanations. No runtime feature or storage change is necessary; existing native disclosures and semantic tables supply the interaction and visual support.

| Lesson focus | New reasoning activity | Handout pages | Research connection and limit |
| --- | --- | --- | --- |
| Foundations: type errors | Compare declared types with conflicting evidence from bodies and calls; explain why the highlighted expression is not necessarily the faulty requirement. | 13–15, 25–27 | Tirronen et al. document observed type/application errors; they do not establish the prevalence of a particular belief. |
| Foundations: polymorphic tuples | Predict values and types for two uses of one signature; distinguish relationships within a use from separate instantiations. One new quiz item transfers this to another function. | 34–35, 72–74 | The snowballed worked-type study observed specific type-variable confusions in a small exploratory study, supporting a diagnostic opportunity rather than a universal deficit claim. |
| Foundations: recursive results | Predict the smaller call's result, then explain how the current row combines with it. Contrast an empty inner row with an empty outer list. | 41–45, 63, 67–69 | Adjacent functional-programming research shows that correct final answers can coexist with unsound traces. The table describes equations and complete values, not a required evaluation schedule. |
| Functions: transformations and types | Record intermediate lists and their types before nesting map/filter; derive the types of a function argument, input, and result with less support. | 73–75, 79–80, 86–89, 106–107 | Racket studies motivate intermediate-representation practice; Haskell transfer and learning gains remain unmeasured. |
| Functions: currying | Group the arrow type and application separately, then identify the remaining function. | 114, 120–127 | Worked-type evidence and authoritative semantics inform the distinction; association is not execution order. |
| Functions: folds and lazy lists | Contrast element and accumulator types; use subtraction to expose grouping; trace the finite search needed for two matching outputs. | 8, 36, 38–39, 86–94 | Short semantic traces and discriminating examples support explanation. Fold association does not imply immediate accumulator evaluation. No infinite failed search is requested. |
| Data: constructors and generic functions | Contrast a constructor, its constructed value, and an interpreter result; diagnose a shadowed constructor pattern; compare independent signatures that reuse `a`. | 73–75, 129–140 | Retrieves earlier application, pattern, and type relationships in a new data context; diagnostic examples are newly authored. |
| Data: recursive structures and persistence | Separate a node's contribution from its whole subtree; distinguish empty payloads from absent nodes; count reconstructed ancestors under an explicit source-level model. | 87–94, 141–145 | Makes intermediate results and the limits of an explanatory model explicit. Counts do not measure physical allocations or assume balanced trees. |

Three sources added through snowballing directly inform these decisions: [Tirronen and Isomöttönen's worked-type study](https://doi.org/10.1017/S0956796814000021), [Rivera et al.'s *Map, Filter, and Conquer*](https://doi.org/10.1145/3724363.3729111), and [Tunnell Wilson, Fisler, and Krishnamurthi's recursion-tracing study](https://doi.org/10.1145/3159450.3159479). Their methods, access status, and limitations are recorded in the review. This implementation is research-informed design, not evidence of improved retention or transfer in this course.

**Source correction:** physical handout p. 17 presents a numeric result for `f g 2` where the displayed definitions make it ill-typed. The tutorial retains the correct rule: application groups left, while function arrows group right. It does not copy that transcript or equate syntactic association with strict evaluation order.

Quiz revisions target constructor versus value types, recursive subtree counts, source-constructor counts, accumulator types, and noncommutative fold grouping. The independent programming challenges remain intact; the new reveals explain neighboring examples or observable results without supplying their target implementations. Existing selected retrieval prompts and suggested breaks remain. Additional explanation is optional to reveal, and students can record predictions in notes rather than learning a new interaction format.

## Haskell 1: fading and diagnostic reasoning (October 2, 2026)

Steps 3–10 now move from completing supplied branches and bindings to writing whole definitions. Support is renewed briefly when recursion is introduced: a worked example and a correct base case remain, while students write the recursive case. The final two tasks provide contracts, type signatures, and runnable placeholders, with implementation choices left to the learner. `TODO` placeholders are explicitly unfinished code, not examples of mistaken reasoning. Worked examples teach a neighboring problem; target-specific implementation clues live in optional hints.

This applies worked-example fading and self-explanation rather than assuming that any difficulty promotes learning. Renkl et al. found benefits for near transfer when worked solution steps were progressively removed; that does not establish far transfer or measured learning gains for this tutorial. [Renkl et al. (2002), *From Example Study to Problem Solving: Smooth Transitions Help Learning*](https://doi.org/10.1080/00220970209599510).

### Research used and its limits

The review used **SciSpace and Sider Scholar** to find primary studies, then inspected their full text. The supplied lecture remained the boundary for required Haskell concepts. The source files were read locally; they were not uploaded to either research service.

- **Haskell error patterns:** Tirronen, Uusi-Mäkelä, and Isomöttönen document list/element confusion (§6.1.1), scope and type/value confusion (§6.2.2), and incomplete or shadowed patterns (§6.3.1). Their participants had prior programming experience. The authors caution that observed errors depend on the tasks, and code alone does not establish intent. Our diagnostic examples are newly authored illustrations, not quoted student submissions or prevalence estimates. [*Understanding beginners’ mistakes with Haskell* (2015)](https://doi.org/10.1017/S0956796815000179).
- **Copying is not evidence of generation:** Singer and Archibald distinguish copied from modified inputs in learner interaction logs (§3.2), and report syntax/scoping difficulties (§3.3). The logs do not establish mastery; some errors reflect the restricted REPL. This supports checking what learners actually write without treating every error as conceptual. [*Functional Baby Talk* (2018)](https://arxiv.org/pdf/1805.05126).
- **Short semantic traces:** Vasconcelos uses guard-order comparisons and recursive base-case traces (§3). This is a classroom experience report with a small feedback sample, not a controlled demonstration of efficacy. We use short traces as explanatory support before students construct a different function. [*Teaching Introductory Functional Programming Using Haskelite* (2025)](https://arxiv.org/html/2508.03640v1).

### Decisions for each revised step

| Step | What students now produce | Reasoning to make visible | Support retained / removed |
| --- | --- | --- | --- |
| 3 — Conditions | Diagnose a practice-win reward bug, then complete the upper-limit and ordinary stock branches | A first matching guard selects a result; later guards do not overwrite it. This is a lecture-derived diagnostic hypothesis, not a measured claim about frequency. | Keep full `if` and guard examples plus the lower-limit branch. Add a separate reward gate covering all Boolean combinations. |
| 4 — Local bindings | Write the discount and final result, then translate `where` to `let` | Naming a derived value does not update the original binding; local scope determines available names. The update expectation is an authored contrast. | Keep only the subtotal and binding layout. Remove the trivial missing-fee repair. |
| 5 — Tuples | Choose the argument pattern and write the whole result expression | Distinguish input values, type variables, and a newly constructed pair; predict both the new and original pair | Keep a different tuple example and the signature. Remove the target's supplied destructuring pattern. |
| 6 — Lists | Diagnose a String-versus-list-of-Strings append error, then construct `bookend` | Explain element types on both sides of an operator; whole strings can be single list elements | Retain small operator examples. Supply no pieces of the target result. |
| 7 — Patterns | Repair an exact-length predicate, then choose all equations for `swapFront` | Exact-length matching differs from prefix matching; valid short inputs must remain covered | Retain `replaceHead` and a pattern reference. Remove the assessed swap expression from ordinary instructions. |
| 8 — Recursion | Write the nonempty counting case and explain the smaller problem's result | A nonmatching head does not imply an empty tail; separate calls have separate bindings | Retain the `joinRows` example and counting base case. Remove the target recurrence from the main instructions. |
| 9 — Comprehensions | Write the output expression, generators, and qualifiers | Result tuple shape, enumeration order, and selection are separate decisions | Retain compact syntax examples. Remove the almost-complete target comprehension. |
| 10 — Integration | Plan cases, invent a discriminating input, and implement the complete function | An affordable prefix requires cumulative accounting and a stopping rule | Keep the behavioral contract and examples. Move case decomposition to hints; remove the misleading filter implementation. |

The stable lesson keys remain because the topic sequence and existing target-function contracts are retained. Behavioral gates accept equivalent implementations. Explanations, hand traces, temporary helper repairs, and the `let`/`where` rewrite are self-check activities; the automatic gates verify the required functions' outputs, not those reflective activities or a particular coding style. Demonstrating independent performance still requires attempting the task before consulting hints or solutions.

## Changes made after the review

Removed numeric conversion with `fromIntegral`, Haskell `case/of`, record-update syntax, parameterized custom ADTs, composition operators `.`/`$`, detailed `foldr` behavior, strict-fold advice, and demand/error probes. Merely naming `foldr` on handout p. 91 does not teach its behavior. None of these topics remains as a required or optional extension in the learner tutorials.

Part 1 develops type inference through a concrete input/result procedure, tuple relationships, and list-element constraints. Its current types lesson diagnoses a runnable quoted-price comparison, then uses a learner-derived numeric signature to expose the unintended input representation. Learners repair the sample values and investigate why an annotation neither converts text nor turns off inference when removed. This supersedes both the earlier conflicting-signature exercise and the original fractional-division repair. A missing recursive branch asks students to distinguish continuing after a nonmatch from stopping or recurring on unchanged input.

Part 2 replaces composition and right-fold lessons with higher-order type derivation and recursive accumulators. Explicit currying includes constructing nested lambdas. Left-fold exercises separate the accumulator's type from the element type and trace argument order. Lazy-list practice stays within ranges, filtering, and taking a finite prefix.

Part 3 uses concrete recursive data types. Generic-function practice uses tuples and the taught `Ord` constraint. Constructor equations and explicit reconstruction replace unsupported syntax. Source-level allocation reasoning counts visited/reconstructed nodes under a stated model, not physical runtime allocations or an unconditional logarithmic bound. The final simulator has two suggested checkpoints, and a new grading case checks that healing is capped even in defensive mode.

The provided module/display harness and equality/printing support let learners observe their functions. Writing IO actions, instances, or compiler configuration is not an assessed topic. The unchanged backend demo is hidden from the tutorial index and is not a fourth course module.

## Different examples, shared skills

The example review compares the required operation and data shape, not just names and constants. The aim is to make students reconstruct the reasoning rather than recognize a slide's answer.

| Lecture example family | Tutorial application |
| --- | --- |
| Squaring/tripling and arithmetic application | Money remaining after buying two pizzas |
| Grade classification with ordered thresholds | Clamp a signed stock adjustment to a permitted interval |
| Tuple swapping and first/second list selectors | Duplicate a selected tuple field; swap the first two entries while retaining the rest |
| Numeric triangle/pair enumeration | Select routes from two supplied candidate lists |
| Affine slope/intercept closure | Configure a reusable list window with captured start and length |
| Scalar currying and tax/multiplication examples | A polymorphic fallback-list interface and a per-element discount transformation |
| Sum/subtraction reductions | Reconstruct decimal digits; accumulate two classification counts |
| Two-value generic maximum | Select generic list entries within supplied bounds |
| Insert a binary-search-tree key | Remove the smallest key while reusing its surviving subtree |
| Colors/shapes and area computation | Expedition events, immutable records, route trees, and expression evaluation |

Foundational notation such as a function arrow, constructor pattern, or the type of `map` necessarily stays the same. The surrounding examples change the operation or combine taught ideas in a different setting; they introduce no new language prerequisite.

## Learning design and practical limits

The three-part path retains 27 lessons: ten foundations, eight functions, and nine data lessons. It has 41 executable gate groups and 64 knowledge-check questions, including single-answer, multiple-answer, and Parsons formats. Each tutorial has an interactive and print view. The progression combines prediction and explanation, worked neighboring examples, selected diagnostic repairs, faded completion, and independent construction; Haskell 1 uses the step-specific progression above. Knowledge checks retrieve prior concepts while varying input shapes, boundaries, and type relationships. Bloom-level variety comes from tracing, applying, deriving, diagnosing, and independently writing code; recognition items are not labeled as unrestricted creation.

The suggested 80–115-minute sessions are planning estimates, not measured student completion times. Learners should split the modules into sittings. Short paper exercises—derive a signature, trace one call, complete a recursive branch—bridge the editor-based feedback to timed assessment. Students still need to attempt complete past-paper problems, including prescribed-helper tasks and larger data transformations. Passing these tutorial checks alone does not demonstrate readiness for an entire exam.

Tests observe the stated function behavior across boundaries and representative inputs. Hints move from the relevant concept to a strategy to an incomplete shape. Reference solutions remain instructor reveals. A new negative capstone implementation isolates the missing defensive-healing cap; independent correct implementations ensure graders do not mandate the reference algorithm.

Stable lesson keys use the existing progress-migration mechanism. Saved drafts and completion for matching lessons survive, while old completion for replaced lessons is not transferred. The shared migration notice no longer promises that required checks may be skipped. No storage key or persistence schema is added.

## Verification

Validation of the October 2, 2026 explicit-signature assessment:

- All 56 focused unit/content checks pass: 32 declaration-matching cases, 21 unchanged alias-cycle regressions, and the three Haskell content-schema checks. Cases distinguish missing, commented, string-contained, local, expression-level, generic, and wrongly grouped declarations from valid formatting, grouped names, `Prelude` qualification, and same-file zero-argument type synonyms.
- The final Jekyll build succeeds. All 13 real-browser backend/cycle regressions pass after extracting the shared tokenizer/layout code. The complete foundations journey, student/instructor print views, and expanded price diagnostic also pass with interactive accessibility checkpoints.
- The price diagnostic confirms that inferred, commented-out, and generic interfaces leave exactly the signature test failing while the numeric checks pass. A standard declaration and an equivalent multiline, right-associated declaration pass all three tests. Run still succeeds during the inference experiment.
- A supplemental real-runtime probe confirms that the correct numeric declaration with quoted sample values fails all three tests: a failed module compilation does not falsely pass the signature gate's `True` command. Scoped screen/print accessibility checks pass 4/4 over the foundations live page, print page, and runtime frame with zero automated findings; this is scoped verification, not whole-site certification.
- Manual visual inspection covers the signature failure and its hints in light, dark, and 320-pixel views. The existing live result announcement identifies the sole failed requirement, and the Hints control retains visible keyboard focus. No new controls, styles, persistence keys, or worker protocol messages were introduced.
- Initial browser launches were blocked by macOS sandbox permissions before test execution; rerunning the same checks with the required browser-launch permission succeeds. The declaration checker intentionally has bounded syntax support, documented in the tutorial-authoring skill; it is not a general Haskell type-equivalence engine.

Validation of the October 2, 2026 realistic Step 2 diagnostic:

- The final Jekyll build succeeds. Both built live and print pages include the final signature self-check paragraph. The refreshed rendering probe verifies keyboard operation and retained focus for both disclosures, automatic print expansion, 320-pixel reflow, and zero page errors.
- All three content-schema checks pass, and the foundations multiple-choice answer-cue audit reports no flags. A parsed comparison with the pre-revision file confirms that only Step 2 changed: the other nine lessons and all top-level settings are preserved. Step 2 still has two executable gate groups and four quiz questions.
- The complete ten-step foundations journey, student/instructor print checks, and focused price diagnostic pass in the real MicroHs runtime with interactive accessibility checkpoints. The diagnostic verifies the runnable text comparison, rejection after adding only the numeric signature, correct numeric behavior, correct inferred behavior, and rejection of a type-correct reversed comparison by the exercise checks.
- Both the existing foundations legacy-progress migration and the new version-2 replacement migration pass. Matching lesson credit and learner drafts survive reload; credit for the old types exercise does not bypass the replacement. The new test initially tried to select the still-locked replacement directly; its corrected setup follows normal Next navigation from the credited preceding lesson. No runtime change was needed.
- Scoped screen and print accessibility audits pass with zero findings. Both native disclosures render and operate correctly; light, dark, narrow, and print views were visually inspected. These checks cover the changed foundations surfaces, not whole-site certification or measured learning gains.
- Behavioral gates deliberately accept an inferred numeric implementation. The instructions explicitly identify deriving and explaining the numeric signature as a self-check; successful execution alone does not establish that understanding.

Validation of the October 2, 2026 research-informed refinement:

- A final Jekyll build and the reference/quiz audits pass. All three content-schema checks pass. All 64 questions were inspected by the answer-cue audit, with no length or formatting flags. Parsed comparisons preserve the 27 lesson keys, all 41 executable gate groups, starter files, solutions, and top-level settings from the start of this refinement.
- The combined real-backend and tutorial browser run passed 20 of 21 checks initially: backend contracts, all three complete learner journeys, independent capstone implementations, all three student/instructor print checks, and the types-error checks passed. The remaining detached-window test exposed a pre-existing test assumption: detaching instructions selects Debug, so its final assertion could not find the hidden Steps navigation. A two-line test-only correction selects Steps through its accessible button before checking the synchronized lesson; the isolated regression then passes with interactive accessibility checks enabled. No runtime behavior or assertion was removed.
- A supplemental program executed in the real MicroHs runtime passes all 11 checks for the newly authored examples, including polymorphic calls, recursive intermediate results, independent type-variable names, fold values, and constructor-pattern shadowing.
- All 13 instruction disclosures, including the 11 new ones, begin closed in live lessons. Enter opens them with visible retained focus; Space closes them. All nine enclosed tables expose headers and data rows. Instruction disclosures open automatically in print.
- Open-state accessibility and 320-pixel reflow probes pass in all three modules, with no page errors. Visual review covers the new recursion, fold, and subtree tables in light, dark, narrow, and print views. A separate live keyboard inspection confirms the constructor reveal's focus and table rendering.
- The scoped screen WCAG audit passes all three checks over the six live/print pages with zero findings. An additional actual print-media audit passes over the same six pages under a saved dark-mode preference, also with zero findings. These automated and manual checks cover the changed tutorial surfaces; they are not a whole-site conformance certification or a measurement of student learning.
- The final diff is whitespace-clean. The implementation changes three tutorial data files, this source map, and the narrow detached-window test correction. Existing independent edits to the foundations tutorial and project skills are preserved.

Validation of the October 2, 2026 fading revision:

- All three Haskell content-schema checks pass; all 23 Haskell 1 knowledge-check questions are unchanged and produce no answer-tell warnings.
- The full ten-step browser journey passes with interactive accessibility checkpoints enabled: each starter fails at least one required check, each reference solution passes, and quizzes unlock the next step.
- Independent capstone implementations and both student/instructor print views pass their existing browser checks.
- Ten real-MicroHs authoring probes verify the diagnostic examples, the wrong base-case and premature-stop contrasts, generator-order behavior, and valid nested-`if` and `let` alternatives.
- The final live and print pages render through Jekyll. Scoped screen and print accessibility audits report no findings; this is automated evidence for these pages, not a whole-site conformance certification.
- Steps 1–2, all ten motivational openers, quiz content, lesson keys, and existing behavioral gate expressions are preserved. Step 3 adds a separate gate for the reward rules.

Validation of the replacement types lesson on October 2, 2026:

- An isolated Jekyll build succeeds, and the rendered tutorial configuration matches the current YAML. The replacement lesson's structure and quiz answer indices are valid; the multiple-choice answer-tell audit flags no questions.
- The focused browser test verifies that incompatible signatures and quoted numeric inputs fail before output, while the corrected and inferred signatures both run and pass the exercise checks. The complete ten-step foundations journey and both student/instructor print views also pass with interactive accessibility checks enabled.
- A saved version-2 workspace retains completion for matching lessons and removes old completion for the replacement types lesson. The scoped automated WCAG page audit reports zero findings; this does not certify the whole site.
- At that earlier point, the broader content test failed because Step 1 lacked the required `### Why this matters` opening. The subsequent motivation update restored all ten openings; the current content checks pass.

Validation of the October 1, 2026 edition (before the replacement types lesson):

- All three tutorial schema checks pass; the multiple-choice answer-tell audit flags no questions.
- A full isolated Jekyll build succeeds. After the final example revisions, all Haskell pages were rendered again and their embedded configurations compared with the reviewed YAML.
- The final ten browser checks pass: three complete learner journeys through all 27 lessons, three saved-progress migrations, three student/instructor print views, and detached quiz instructions. Every authored starter runs but fails at least one intended check; every model solution passes. Quiz completion and navigation work throughout.
- Three independent capstone browser checks and eight existing Python progress-migration regression checks also pass. Separate real-MicroHs runs verify alternative algorithms, focused faulty implementations, and the new worked examples and quiz traces.
- Interactive accessibility checks pass on the exercised states. Manual inspection covers light/dark readability and keyboard-only Parsons assembly. These scoped checks do not certify every site page or establish measured learning gains.
- The staged diff is whitespace-clean. Concurrent debugger and Prolog work is excluded from this content-and-progress revision.
