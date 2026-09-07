# CS 131 practice content map

The CS 131 collection contains 144 original quiz questions and 88 flashcards in nine topic pairs. `CS131_master` combines the quiz decks and the corresponding flashcard decks through the existing SE Gym aggregation mechanism. Each topic is also available independently. Source documents were used as evidence about course concepts and assessment emphasis; their classroom, grading, and installation instructions were not treated as requests to execute those actions.

## Learning objectives and topic coverage

The audience is undergraduate programmers learning to transfer their knowledge across language designs. The collection asks learners to predict behavior, explain the governing rule, distinguish plausible alternatives, and justify choices under explicit constraints. Introductory paradigm coverage is intentionally smaller than the substantive technical units.

| Topic deck | Quizzes | Cards | Evidence learners should produce | Source anchors |
| --- | ---: | ---: | --- | --- |
| `cs131_foundations` | 8 | 6 | Recognize computational models; separate syntax from semantics; design discriminating experiments; evaluate language trade-offs | `intro_lecture_v2.pptx` slides 16, 20–30, 36–43; homework PYTHON2 |
| `cs131_python` | 17 | 10 | Trace object sharing, rebinding, shallow/deep copying, identity, class state, initialization, and mutable defaults | `essential_python.pptx` slides 2–10, 12–17; homework PYTHON2–5; Quiz 1 Q2; Fall 2024 midterm Q4 pp. 7–8 |
| `cs131_functional` | 16 | 10 | Reason about purity and demand; decompose lists recursively; combine map/filter/fold; infer type relationships; apply currying, closures, and algebraic variants | `intro_to_functional_programming_and_haskell_v10.pptx` slides 5–8, 25–27, 44–110, 113–148; homework HASKELL3–9 and ADVHASKELL; Quiz 1 Q4; Fall 2024 midterm Q3 pp. 5–6 |
| `cs131_types_scope_memory` | 18 | 12 | Distinguish type inference/checking, compatibility, and conversion domains; trace lexical/dynamic scope and delayed evaluation; reason about roots, cycles, relocation, moves, and borrows | Intro slide 23; homework TYPING2–10 and DATA1–5; Quiz 2 Q1–5; Fall 2024 midterm Q5 pp. 9–12 |
| `cs131_functions` | 18 | 10 | Predict parameter and capture effects; evaluate optional/result/error contracts; trace exception cleanup; justify generic operations from bounds | `function_palooza_v8.pptx` slides 9–27, 34–69, 75–109; homework FUNC1–5, FUNC7; Quiz 3 Q1, Q4–5; Spring 2023 final pp. 10, 13–15; Fall 2023 final pp. 12–15 |
| `cs131_control` | 18 | 10 | Separate grouping from evaluation order; trace short-circuiting, loop exits, iterator state and generator suspension; reason about synchronization and cooperative scheduling | `control_palooza_v7.pptx` slides 2–30, 39–98; homework CTRL1–3; Quiz 3 Q3 and Quiz 4 Q3 |
| `cs131_oop` | 17 | 10 | Distinguish encapsulation, reuse, and subtyping; preserve contracts; predict dispatch, initialization, repeated inheritance, and prototype receiver behavior | `oop_palooza_v7.pptx` slides 31–76, 79–114, 118–126; homework OOP1–3, OOP5; Quiz 2 Q2(a); Quiz 4 Q1 |
| `cs131_logic` | 16 | 10 | Interpret relations, unification, conjunction, search order, recursive list rules, negation, and a bounded cut example | `logic_palooza_v6.pptx` core slides and cut appendix; homework LOGIC2–8; Quiz 4 Q4–5; Fall 2022 final pp. 10–11, Fall 2023 final pp. 22–24, Fall 2024 final pp. 23–25, Spring 2023 final p. 11 |
| `cs131_implementation` | 16 | 10 | Distinguish lexing, parsing, semantic checking, and linking; preserve precedence; evaluate compiler reuse and interpreter state | `pl_implementation_palooza.pptx` slides 3–37, 40–49; homework TOOLS1–5; Quiz 1 Q1 |
| **Total** | **144** | **88** | | |

The dedicated data/types lecture deck was not present in the archive. The types/scope/memory topic therefore draws its detailed scope from the supplied homework and assessments, with the introduction's building-block overview as lecture context. It does not claim coverage of an unseen lecture.

Each question and flashcard has a stable ID, a calibrated `difficulty`, a non-rendered `bloom` field, and a YAML comment identifying source locations. Slide numbers refer to the named full presentation, not a differently paginated handout. Exam page references are physical PDF pages; question labels identify the conceptual source rather than a copied question.

| Bloom process | Quiz questions | Flashcards |
| --- | ---: | ---: |
| Understand | 22 | 19 |
| Apply | 49 | 14 |
| Analyze | 49 | 23 |
| Evaluate | 24 | 11 |
| Create | 0 | 21 |

The quizzes comprise 106 single-answer, 32 multiple-answer, and 6 Parsons items. Creation is elicited through constructed flashcard responses rather than recognition of a prewritten choice. Basic concept questions support retrieval without requiring slide trivia.

## Parsons practice

Six additional Parsons problems ask learners to assemble dependency-driven code in commonly used languages. They live in the existing topic decks, so the master quiz includes them automatically. Each has 4–6 movable lines and 1–2 semantic distractors. These are Apply/Analyze tasks: learners reconstruct a solution rather than author unrestricted programs.

| Topic | Language | Task | Movable lines |
| --- | --- | --- | ---: |
| Python object semantics | Python | Copy nested rows before an isolated update | 4 |
| Functions | C++ | Grant bounded capacity and update the caller through a reference | 5 |
| Functions | JavaScript | Track differences between successive readings in a closure | 6 |
| Control | Python | Lazily accumulate running totals | 5 |
| Control | JavaScript | Resolve dependent lookups before enriching the returned object | 6 |
| Object-oriented programming | Java | Return a sorted snapshot without exposing private array storage | 5 |

The JavaScript closure's outer function is fixed in the prompt. This avoids two semantically valid placements of closing braces that the existing exact-order grader would treat differently. The other problems use actual data and control dependencies to determine order. Distractor feedback explains failures such as aliasing a nested row, subtracting an unfulfillable request, resetting a closure's baseline, terminating a generator, and storing an unresolved promise.

## Excluded Language of the Week slides

The user's exclusion applies to showcase segments, rather than the course's main teaching languages. Core Haskell, Python, and Prolog remain included.

| Presentation | Excluded slide | Showcase |
| --- | ---: | --- |
| `essential_python.pptx` | 11 | OpenCL |
| `intro_to_functional_programming_and_haskell_v10.pptx` | 35 | APL |
| `intro_to_functional_programming_and_haskell_v10.pptx` | 112 | Go |
| `function_palooza_v8.pptx` | 3 | Forth |
| `function_palooza_v8.pptx` | 72 | Lean |
| `function_palooza_v8.pptx` | 73 | Rust |
| `control_palooza_v7.pptx` | 15 | Ruby |
| `oop_palooza_v7.pptx` | 28 | PostScript |
| `oop_palooza_v7.pptx` | 78 | Mojo |
| `logic_palooza_v6.pptx` | 33 | Brewin |
| `pl_implementation_palooza.pptx` | 38 | OpenCL |

No showcase-language biography, date, popularity, or identifying trivia is assessed. General ownership concepts remain in scope because homework DATA2 and Quiz 2 Q5 assess them independently of the Rust showcase. Likewise, ordinary compiler examples and prototype semantics are retained where taught outside showcases. Installation tasks, course policy, jokes, and memorization of slide wording are excluded.

## Pedagogical design

The design follows backward alignment: each topic's observable objectives determine the evidence elicited by its items. Quizzes use new scenarios and semantic near-neighbors to distinguish partial understanding. Single-choice items require a reasoned decision; multiple-choice items require examining each claim, with feedback for both incorrect selections and important omissions.

Flashcards require learners to formulate explanations before revealing answers. Bounded production tasks supply a model response and explicit self-check criteria. Their `create` metadata describes what the learner produces; they are self-assessed practice, not automatically verified programming assessments. Difficulty is judged separately from Bloom level, so small, tightly constrained creation tasks need not be expert difficulty.

The master lists make cross-topic retrieval possible while the existing SE Gym retains source-deck identity for progress and topic statistics. The existing practice mechanism supplies spacing; no new scheduling or persistence behavior is introduced. Sources for the design rationale are the project's pedagogical-advisor references on backward design, Bloom's revised taxonomy, item writing, feedback, and effective learning techniques, alongside the quiz-format authoring rules.

## Originality review

All 226 original quiz/flashcard items and the six new Parsons problems were compared with the supplied lecture, homework, quiz-solution, and exam text. This review replaced 77 existing items whose code or scenarios were too close to a source example. Revisions change the operation, data relationships, or judgment required, rather than only renaming variables or changing numbers. For example, scalar capture traces became mutable-vector snapshots and copied-pointer lifetime questions; range generators became conditional-yield traces and overlapping-pair generators; arithmetic parser examples became command sequences and conditional-expression trees; processor-switching questions became diagnostics and semantic-preservation decisions.

Standard concepts, terminology, and minimal language syntax remain shared because they are the subject matter. Source comments identify conceptual provenance. The new scenarios are not presented as source quotations, and incomplete answer-key-only documents are not treated as evidence of unseen question text. The Language of the Week exclusions still apply throughout.

## Accuracy decisions

The OOP presentation's slide 114 reverses the subtype-precondition rule. The new practice uses the correct requirement: inherited preconditions cannot be strengthened, and postconditions cannot be weakened. This is supported by [Liskov and Wing's behavioral subtyping criterion](https://www.cs.cmu.edu/Groups/venari/subtype-toplas.html) and the explicit rule in [Eiffel's Design by Contract documentation](https://www.eiffel.org/doc/solutions/Design_by_Contract_and_Assertions). The supplied source slides were not edited.

Questions state the language or toy semantics when behavior depends on them. In particular, implicit numeric conversion does not prove unsafe typing; runtime checks do not prove dynamic typing; syntax does not establish semantic validity; pure reference counting is distinguished from counting augmented with cycle detection; logical identity is distinguished from physical location. Call-by-name/need examples explicitly specify effects and caching. Prolog examples specify search order or finite failure where needed.

## Source archive inventory

- Lectures: eight core units, with full presentations and overlapping handout versions.
- Quiz solutions: Fall 2025 quizzes 1–4. Some solution documents contain answer keys rather than complete stems; these guide concept selection without inventing missing source wording.
- Homeworks: `CS131 Homework 0 (Public).docx` supplies prerequisite calibration in parameter passing (Q1–2), recursion, inheritance/polymorphism, and linked lists. `Homework Problems (Public).docx` supplies the topical PYTHON, TOOLS, HASKELL, ADVHASKELL, TYPING, DATA, FUNC, CTRL, OOP, and LOGIC problem groups.
- Past exams: Fall 2022, Spring 2023, Fall 2023, and Fall 2024 midterm/final materials, including variants and solution sets. Variants are overlapping evidence, not counted as separate curricular objectives.

The archives and extracted source documents stay outside the repository. Only the original practice content and this map are added.

## Validation

All 144 quiz questions and 88 flashcards passed schema, answer-index, feedback-key, stable-ID, Bloom-value, and master-deck reference checks. The multiple-choice authoring audit found no answer-length or phrasing tells. Topic authors cross-reviewed answer keys, assumptions, and feedback. The six Parsons solutions were executed in Python, JavaScript, C++, and Java. Every permutation of the correct lines was also checked for the two Python and two JavaScript problems; the closure scaffold was revised after this exposed an alternative brace ordering. Revised Python, JavaScript, and C++ examples were executed where appropriate. Haskell, Prolog, and intentionally undefined C++ behavior were reviewed manually.

The full Jekyll build passed. Seven existing SE Gym checks passed for deck discovery, quiz and flashcard launches, master-deck source tracking, narrow-screen layouts, and Parsons keyboard controls. The project's WCAG 2.2 AA audit passed for the SE Gym page with no findings; this was a scoped check, not a whole-site audit. Browser review confirmed the new master counts, quiz feedback, flashcard answer reveal, self-assessment, and focus progression, with visual checks in light and dark mode. The new Parsons exercises were also checked using their numbered keyboard controls and answer feedback.
