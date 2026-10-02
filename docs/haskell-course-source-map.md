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
| Values and Function Types | 13–15, 25–27 | Derive numeric/text input types and Boolean result types as preparation for F24 midterm P3A |
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

## Changes made after the review

Removed numeric conversion with `fromIntegral`, Haskell `case/of`, record-update syntax, parameterized custom ADTs, composition operators `.`/`$`, detailed `foldr` behavior, strict-fold advice, and demand/error probes. Merely naming `foldr` on handout p. 91 does not teach its behavior. None of these topics remains as a required or optional extension in the learner tutorials.

Part 1 now develops type inference through a concrete input/result procedure, tuple relationships, and list-element constraints. The types lesson asks students to repair conflicting signatures on correct pizza-order comparisons: fractional amounts require `Double`, full topping names require `String`, and comparisons produce `Bool`. Learners predict compiler errors, repair only the declarations, and investigate why a signature neither converts quoted numbers nor turns off inference when removed. It replaces the fractional-division repair, which assessed arithmetic rather than type reasoning, and uses a new stable lesson key so prior completion does not credit the replacement. A missing recursive branch asks students to distinguish continuing after a nonmatch from stopping or recurring on unchanged input.

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

The three-part path retains 27 lessons: ten foundations, eight functions, and nine data lessons. It has 40 executable gate groups and 63 knowledge-check questions, including single-answer, multiple-answer, and Parsons formats. Each tutorial has an interactive and print view. The progression is prediction and explanation, a worked neighboring example, a focused repair or completion, and an independent capstone. Knowledge checks retrieve prior concepts while varying input shapes, boundaries, and type relationships. Bloom-level variety comes from tracing, applying, deriving, diagnosing, and independently writing code; recognition items are not labeled as unrestricted creation.

The suggested 80–115-minute sessions are planning estimates, not measured student completion times. Learners should split the modules into sittings. Short paper exercises—derive a signature, trace one call, complete a recursive branch—bridge the editor-based feedback to timed assessment. Students still need to attempt complete past-paper problems, including prescribed-helper tasks and larger data transformations. Passing these tutorial checks alone does not demonstrate readiness for an entire exam.

Tests observe the stated function behavior across boundaries and representative inputs. Hints move from the relevant concept to a strategy to an incomplete shape. Reference solutions remain instructor reveals. A new negative capstone implementation isolates the missing defensive-healing cap; independent correct implementations ensure graders do not mandate the reference algorithm.

Stable lesson keys use the existing progress-migration mechanism. Saved drafts and completion for matching lessons survive, while old completion for replaced lessons is not transferred. The shared migration notice no longer promises that required checks may be skipped. No storage key or persistence schema is added.

## Verification

Validation of the replacement types lesson on October 2, 2026:

- An isolated Jekyll build succeeds, and the rendered tutorial configuration matches the current YAML. The replacement lesson's structure and quiz answer indices are valid; the multiple-choice answer-tell audit flags no questions.
- The focused browser test verifies that incompatible signatures and quoted numeric inputs fail before output, while the corrected and inferred signatures both run and pass the exercise checks. The complete ten-step foundations journey and both student/instructor print views also pass with interactive accessibility checks enabled.
- A saved version-2 workspace retains completion for matching lessons and removes old completion for the replacement types lesson. The scoped automated WCAG page audit reports zero findings; this does not certify the whole site.
- The broader content test currently fails at Step 1 because the foundations lessons no longer open with the literal `### Why this matters` heading required by that test. The two other Haskell modules pass that content test.

Validation of the October 1, 2026 edition (before the replacement types lesson):

- All three tutorial schema checks pass; the multiple-choice answer-tell audit flags no questions.
- A full isolated Jekyll build succeeds. After the final example revisions, all Haskell pages were rendered again and their embedded configurations compared with the reviewed YAML.
- The final ten browser checks pass: three complete learner journeys through all 27 lessons, three saved-progress migrations, three student/instructor print views, and detached quiz instructions. Every authored starter runs but fails at least one intended check; every model solution passes. Quiz completion and navigation work throughout.
- Three independent capstone browser checks and eight existing Python progress-migration regression checks also pass. Separate real-MicroHs runs verify alternative algorithms, focused faulty implementations, and the new worked examples and quiz traces.
- Interactive accessibility checks pass on the exercised states. Manual inspection covers light/dark readability and keyboard-only Parsons assembly. These scoped checks do not certify every site page or establish measured learning gains.
- The staged diff is whitespace-clean. Concurrent debugger and Prolog work is excluded from this content-and-progress revision.
