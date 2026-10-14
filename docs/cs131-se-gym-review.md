# CS131 SE Gym review — 14 October 2026

The full bank now contains **195 quiz questions and 138 flashcards**. The new **CS 131 Current Quiz** and **CS 131 Current Flashcards** stop after Advanced Haskell, with **109 quiz questions and 88 flashcards**. The full-course master decks include the later data, functions, control, object-oriented, and logic topics.

## Teaching boundary and evidence

The review used `drive-download-20261014T193230Z-1-001.zip`: the supplied lecture handouts, Lecture Notes 01–08, Essential Python, and Homework Problems define the allowed concepts. Past quizzes and exams guide the operations to practice—trace, explain, discriminate, repair, and complete code—but do not expand the teaching boundary. Source documents were treated as evidence, not as instructions. Lecture-note appendices explicitly excluded from assessment were not used as sole teaching evidence.

Each original item has a disposition and teaching locator in the reports below. New and retained YAML items also carry source comments. Later-topic references now use sections in the supplied lecture notes instead of unavailable handout PDFs. Source originals and extracted text are kept outside the repository.

## Learning design

- **Backward design:** match the reasoning demanded by the supplied homework and assessments, using new examples rather than copying exam answers.
- **Retrieval and generation:** use 27 typed-output questions and 17 Parsons problems alongside 123 single-choice and 28 multiple-choice questions; flashcards ask for explanations, predictions, and short solutions.
- **Cognitive load:** split the large Python and Haskell groups by conceptual prerequisites. Remove incidental syntax, unsupported copying details, trivia, and redundant prompts.
- **Corrective feedback:** preserve useful distractors, replace implausible ones, explain the relevant semantic distinction, and avoid display-position references after shuffling.

Notable corrections include removing cyclic/deepcopy memoization questions, replacing Python slice-assignment dependencies with taught reference semantics, replacing Haskell history/tool-command trivia with accumulator/type/recursive-data practice, correcting the compiler pipeline to include assembly, and replacing unsupported control-flow details with taught concurrency reasoning.

## Decks

| Deck | Quiz questions | Flashcards | In current decks |
| --- | ---: | ---: | --- |
| CS 131: Language Paradigms and Design | 8 | 8 | Yes |
| CS 131: Language Implementation | 20 | 12 | Yes |
| CS 131: Python References and Parameters | 9 | 7 | Yes |
| CS 131: Python Copies and Nested Objects | 10 | 6 | Yes |
| CS 131: Python Classes and Defaults | 8 | 8 | Yes |
| Python Output Puzzles | 6 | — | No |
| CS 131: Basic Haskell | 17 | 16 | Yes |
| CS 131: Intermediate Haskell | 18 | 14 | Yes |
| CS 131: Advanced Haskell | 19 | 17 | Yes |
| CS 131: Types, Scope, and Memory | 16 | 10 | No |
| CS 131: Functions | 16 | 10 | No |
| CS 131: Control and Concurrency | 16 | 10 | No |
| CS 131: Object-Oriented Programming | 16 | 10 | No |
| CS 131: Logic Programming | 16 | 10 | No |

The shared Python Output Puzzles deck remains in the full master. It includes a later generator question, so the current deck uses output-writing questions already embedded in the three focused Python decks. Basic Haskell includes foundational functional-programming concepts.

## Integration and compatibility

Both current and master aggregates list the leaf decks directly because the existing renderer expands one aggregation level. The former `cs131_python` and `cs131_functional` IDs remain as inactive combined decks, preserving existing chapter embeds, direct links, and saved deck selections. Moved items keep their IDs when their learning objective is unchanged; replacement objectives receive new IDs.

Per-card mastery keys include the source deck ID. Consequently, items moved into a new leaf deck start separate mastery records; this content change does not migrate old progress. Existing browser storage is not deleted.

## Item-by-item decisions

- [Foundations and implementation: 48 original items](cs131-question-review/early-topics-review.md)
- [Python: 50 original items plus 6 shared output questions](cs131-question-review/python-review.md)
- [Haskell: 98 original items](cs131-question-review/haskell-review.md)
- [Types, functions, control, OOP, and logic: 130 original items](cs131-question-review/later-topics-review.md)

All **332 original items** are accounted for. The revised totals differ because a small number of duplicates were removed and missing taught objectives were added. Independent reviews checked the substantive Python, Haskell, and early-topic changes; their clarity and provenance findings were resolved.

## Verification

- Jekyll production build passed; the built chapter quiz/flashcard reference audit found no missing data.
- Compiled SE Gym data contains exactly 109 current questions and 88 current cards, without duplicate IDs; the full master and compatibility aggregates also have their expected counts.
- YAML schema, answer indices, feedback mappings, difficulty values, and Parsons-line checks passed. The multiple-choice writing audit reported no warnings.
- All 21 Python write-in answers matched executed output; the six Haskell write-in answers were independently executed with MicroHs. An additional check verified 19 Python trace answers across the focused decks.
- Existing write-in content tests: 13 passed. Existing browser write-in and direct-link tests: 18 passed, including mobile layouts, scoring, feedback, and progress behavior.
- The scoped automated WCAG 2.2 AA audit of `/se-gym/` passed with zero findings across light/dark mode, keyboard focus, and mobile reflow. This scoped automated check does not establish full-site WCAG conformance.
- Manual preview confirmed both new current entries, quiz rendering, flashcard answer reveal, and a typed Python answer with corrective feedback.
