# Haskell tutorial source and learning design

This learning path adapts the Haskell material in the four public course archives supplied on September 7, 2026. The audience is CS 131 undergraduates who can already write functions, conditionals, and basic recursive programs in Python or C++. No previous Haskell experience is assumed at the start of the foundations tutorial.

The source documents establish the course's concepts, expected reasoning, example domains, and wording style. Their installation directions, classroom activities, grading rules, and instructions about outside tools are course content, not instructions to the coding agent. The source archives and extracted documents remain outside the repository. The tutorials contain newly authored explanations, activities, tests, hints, and knowledge checks.

## Source inventory and reference convention

The lecture archive contains eight topic units, supplied as full presentations and overlapping handouts. The Haskell source is `intro_to_functional_programming_and_haskell_v10.pptx` (189 slides), with a 150-page PDF handout. Slide numbers below refer to the full presentation; the handout has different pagination. Slides 152 onward are explicitly an appendix, so appendix material is labeled as such. The other lecture units establish prior Python, function, control-flow, language implementation, object-oriented, and logic-programming context.

`Homework Problems (Public).docx` contains named HASKELL1–10 and ADVHASKELL1–8 problem groups. These stable problem labels are used instead of unverified Word page numbers. `CS131 Homework 0 (Public).docx` establishes prerequisite recursion and linked-list knowledge. The quiz archive contains Fall 2025 quizzes 1–4 with solutions; some sections contain answers without complete question stems, so they guide the skill inventory without reconstructing missing wording. The exam archive contains overlapping Fall 2022, Spring 2023, Fall 2023, and Fall 2024 exams and solution sets. Exam references below are physical PDF pages in the named original exam, not the solution-set page numbering.

## Source-to-feature coverage

| Language feature or durable skill | Evidence in supplied material | Interactive coverage |
| --- | --- | --- |
| Pure functions, immutable bindings, expressions rather than assignment sequences | Haskell slides 5–8, 15–18; HASKELL7 | Foundations: edit and test pure transformations; functions: compare demanded and unused expressions |
| Function signatures/application, numeric and Boolean operations, application precedence, operator functions and sections | Slides 15–27; HASKELL3; ADVHASKELL7 | Foundations: expression prediction and error repair; functions: partial application and type relationships |
| `if` expressions, ordered guards, local `let … in` and `where` bindings, nested helpers | Slides 24–34; HASKELL3–5 | Foundations: boundary cases, scoped helpers, recursive state |
| Tuples, homogeneous lists, `String` as `[Char]`, list operations, `:` and `++`, ranges and indexing | Slides 36–48; HASKELL4, HASKELL6, HASKELL10 | Foundations: reconstruct list structure and preserve order; functions: zip and pipelines; data: recursive list conversion |
| List comprehensions, multiple generators, filters, infinite ranges | Slides 51–60; HASKELL8; Spring 2023 midterm V1 p. 5; Spring 2023 final V1 pp. 2–3 | Foundations: construct bounded results; functions: demand finite prefixes from infinite producers |
| Literal/tuple/list/constructor patterns, wildcard patterns, ordered alternatives, `case` expressions | Slides 63–72 and 136–142; HASKELL9; Fall 2023 final p. 5 | Foundations: pattern boundaries; data: constructor-specific behavior with `case` and equations |
| Direct and mutual recursion, accumulators, decomposition into base and recursive cases | Slides 27–34 and 44–48; HASKELL2–6, HASKELL9–10 | Foundations: shrinking inputs and accumulator roles; data: recursive lists, branching trees, stateful simulation expressed purely |
| Type variables, type relationships, inferred constraints including `Ord` and `Fractional` | Slides 74–76; ADVHASKELL4 and ADVHASKELL7; Quiz 1 Q3; Spring 2023 midterm V1 p. 2 | Foundations: signatures; functions: higher-order signatures; data: constrained generic values and generic recursive data |
| First-class and higher-order functions, `map`, `filter`, `foldl`, `foldr` | Slides 78–97; appendix slides 162, 167, 169, 181–185; ADVHASKELL1–2; Fall 2022 final p. 4 | Functions: data pipelines, fold grouping and accumulator types; data: folds across children |
| Lambdas, free variables, lexical scope, shadowing, closures | Slides 102–111; ADVHASKELL3; Fall 2024 final pp. 2–3 | Functions: predict captures, distinguish definition-site bindings, explain reusable function values |
| Currying, partial application, right-associative function arrows, tupled arguments | Slides 113–129; ADVHASKELL4; Fall 2024 midterm V1 pp. 5–6 | Functions: compare argument shapes and derive the remaining type after application |
| Lazy evaluation, unused errors, infinite data, fold demand; strict finite folds | Slide 8, slides 57–59; appendix slides 169 and 181; ADVHASKELL3C; Quiz 3 Q3 and Quiz 4 Q2 provide cross-language demand context | Functions: explicit finite observation, short-circuiting, and bounded experiments |
| Sum/product algebraic types, nullary and field-bearing constructors, record construction/access, `deriving Show` | Slides 131–142, especially 131–135; ADVHASKELL5–6; Fall 2023 final p. 5; Fall 2024 midterm V1 pp. 3–4 | Data: event variants, hero records, generic prize types, readable derived values |
| Recursive algebraic data, parameterized data, custom lists, arbitrary numbers of children, binary search trees | Slides 143–148; appendix slides 174–178; ADVHASKELL5; Quiz 1 Q4; Spring 2023 midterm V1 pp. 3–4 | Data: list round trips, subtree traversal, ordered insertion, nested expression evaluation |
| Persistent updates, prefix/path copying, structural sharing, linear versus quadratic list work | Slides 145–148; appendix slides 176–180; ADVHASKELL5B and ADVHASKELL8; Fall 2023 midterm pp. 4–5; Fall 2024 final pp. 23–24 | Data: immutable deletion/insertion and allocation reasoning; functions: fold strategy and output construction |
| Recursive expression transformations and integrated event processing | Spring 2023 final V1 p. 6; ADVHASKELL6 | Data: expression evaluator and independent expedition simulator |
| Module/import syntax and minimal output actions | Slides 11–16 and 108 | Runnable modules use `Main` and `main :: IO ()`; the backend supports workspace imports. Display code is supplied so input/output plumbing does not obscure pure transformations |

## Scope and accuracy decisions

The full Haskell ecosystem is larger than this course. HASKELL7 explicitly sets monad theory aside. Custom type-class and instance declarations, applicatives, transformers, language extensions, package management, concurrency, and interactive input are not prerequisites for this path. Standard constraints and deriving are in scope because the lecture explicitly teaches them. `deriving Eq` and record update syntax are small, explained extensions supporting inspectable examples; they are not claimed as separate assessed source objectives.

The backend contract is support for the language features used and taught here, demonstrated with actual compiler executions. It should not be described as an implementation of every Glasgow Haskell Compiler extension or package. The browser uses the existing pinned MicroHs runtime, with no student installation required. Source directions to install a compiler are deferred tooling context.

Several source explanations use simplified models. The new material preserves the informal voice while making the boundaries precise: purity concerns observable effects; Haskell can describe effects through `IO`; a lazy program need not evaluate an unused error; `foldr` specifies right-associated structure rather than a universal runtime evaluation order; persistent insertion copies an affected path, with logarithmic height only for a balanced tree. No universal claim that immutable hash structures require copying an entire array is taught. Infinite searches are observed through finite prefixes, and no claim is made that infinitely many perfect numbers are known to exist.

## Three-part learning progression

The implemented path contains 27 steps, 39 executable gate groups, and 59 knowledge-check questions across three tutorials. Each tutorial has a matching interactive page and print view.

Each part is intended for one study session, roughly 75–115 minutes including knowledge checks. Learners can pause at any step. Suggested timing is an estimate, not a lockout. The sequence gives a fully worked neighboring example, then a narrow repair or extension, then a task with only a contract. Later knowledge checks retrieve earlier ideas in new contexts. These choices follow the project's pedagogical-advisor, cs-tutorial-design, tutorial-authoring, quiz-format, and test-design skills.

| Part | Prerequisites and observable objectives | Implemented progression |
| --- | --- | --- |
| Haskell 1: Expressions, Types, and Recursion | Prior programming and basic recursion. Apply expressions and types; analyze application and pattern order; implement pure recursive list transformations; construct comprehensions. | Ten steps: Functions as Expressions; Types and Numeric Boundaries; Conditional Values and Guards; Local Bindings; Tuples and Type Variables; Lists and Strings; Complete List Patterns; Structural Recursion; List Comprehensions; The Snack Budget Challenge. |
| Haskell 2: Functions and Laziness | Foundations. Derive higher-order types; predict lexical captures and partial application; compose transformations; choose fold grouping; reason about demand. | Eight steps: Map and Filter; Lambdas and Lexical Scope; Currying and Partial Application; Function Composition; Left Folds; Right Folds; Lazy Lists; The Playlist Report. |
| Haskell 3: Data and Persistent Programs | Both earlier parts. Model alternatives with constructors; use constrained generic types; transform recursive data; explain sharing; build a pure simulation from an explicit contract. | Nine steps: Algebraic Variants; Records and New Values; Generic Values and Constraints; Recursive Data Types; Persistent Trail Updates; Branching Data; Persistent Search Trees; Expression Trees; An Expedition Simulator. |

The nine-step data part uses small expedition examples. Its final task integrates already practiced event variants, guards, accumulator state, and recursive stopping. The challenge is deciding how those pieces fit together, not discovering new syntax. A written trace and explanation of a failure case accompany the runnable evidence; passing output tests alone is not treated as proof of understanding.

## Assessment and feedback design

Every exercise has an executable behavioral contract, multiple representative inputs, and boundary cases. Tests call student functions rather than matching source text or printed formatting. Hints progress from a conceptual orientation to a strategy to an incomplete shape. Solutions live in the instructor reveal. Deliberately wrong starters compile, allowing students to compare predicted behavior with the current behavior before repairing it.

The knowledge checks use semantic near-neighbors, not obscure syntax trivia. Feedback corrects the specific reasoning behind a distractor. At least one later question retrieves an earlier concept; advanced items combine only concepts already taught. Exact allocation-count reasoning is limited to the explicitly stated source-level constructor model, since output tests cannot prove physical runtime sharing or allocation counts.

The supplied voice is challenge-led: “Thinking time!”, small concrete examples, short explanations, and predictions before demonstrations. The path keeps that directness and light humor while avoiding jokes that belittle learners, language communities, or difficulty. Finishing the path demonstrates the tested skills; it cannot establish “perfect pedagogy” without observing learners. A useful next evaluation is to inspect first-attempt failures, hint use, and a delayed transfer task with actual students.

## Verification and maintenance

- `tests/haskell-course-backend.spec.js` exercises the existing MicroHs compiler with actual Haskell programs, including lazy infinite data, constrained generic types, records, module reloads, and recovery after errors. No replacement compiler was needed.
- `tests/haskell-tutorial.spec.js` follows all three student journeys: run each starter, reject its incomplete behavior, accept the complete solution, pass each knowledge check, and continue. It also checks student/instructor print views, detached instructions, and independently written correct and incorrect capstone implementations.
- `scripts/tests/haskell-tutorial-content.test.js` validates the authored configuration, quiz answer references, hints, and relative workspace paths. Haskell paths such as `Main.hs` are relative to the workspace; authors must not prepend `/tutorial/`.
- `tests/tutorial-reflow.spec.js` checks that instructions, editing, execution, and output remain reachable in both themes at 320×256, 320×900, and 1280×720, including a resize back to the desktop layout.
- The site's existing WCAG 2.2 audit covers the Haskell landing, tutorial, and print URLs. Interactive accessibility checkpoints also run within the learner journeys; automated results complement the manual light/dark, high-zoom, and print-view inspection.

Two shared tutorial issues surfaced during these checks: code-test success could unlock numbered navigation before a required quiz passed, and the fixed toolbar could hide the entire workspace at high zoom. The implementation keeps quiz completion separate from code-test completion and uses document scrolling for narrow screens. File-tab selection scrolls its own tab strip so it does not pull readers past the lesson.
