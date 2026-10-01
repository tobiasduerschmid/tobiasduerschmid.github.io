# CS131 short practice: lecture and assessment alignment

This revision replaces every question and flashcard in the nine `cs131_*` topic banks. The attached lecture handouts define the prerequisite knowledge; the Fall 2025 quizzes and past exams define the kinds of reasoning to practice. The items are original, smaller problems rather than copied exam questions or retained old prompts.

The quiz master preserves the instructor's current selection: Python, foundations, and implementation. The other six quiz banks remain available individually. The flashcard master continues to include all nine banks. The `other:` list in the quiz master is not an active deck inclusion.

## What the practice prepares students to do

| Topic bank | Quiz items | Cards | Observable work | Assessment anchors |
| --- | ---: | ---: | --- | --- |
| `cs131_foundations` | 8 | 8 | Recognize the model used by a small computation; predict copying/aliasing effects; judge whether an experiment distinguishes language rules | Introductory prerequisites for Quiz 1 P2–3, Quiz 4 P1–2/P4–5, and Fall 2023 midterm P5 |
| `cs131_python` | 16 | 10 | Trace object references, mutation versus rebinding, shallow/deep copies, parameters, and returned aliases; construct short dependent procedures | Quiz 1 P2; Fall 2023 midterm P1 pp. 2–3; Fall 2024 midterm P4 pp. 7–8 |
| `cs131_functional` | 16 | 10 | Infer function and partial-application types; complete recursive cases; trace folds and list pipelines; construct recursive data | Quiz 1 P3–5; Fall 2023 midterm P3 pp. 6–7; Fall 2024 midterm P1–3 pp. 2–6 |
| `cs131_types_scope_memory` | 16 | 10 | Follow type constraints, conversions, scope and lifetime; trace roots, reachability, reference counts, and ownership | Quiz 2 P1–5; Fall 2024 midterm solutions P6 pp. 13–14; Fall 2023 final solutions garbage-collection problems pp. 8–11 |
| `cs131_functions` | 16 | 10 | Track passing modes, delayed evaluation, captures, first-class calls, exception propagation, and cleanup | Quiz 3 P1–2/P4; Fall 2024 final solutions P2–3 pp. 5–9; Fall 2023 final solutions binding/passing pp. 7–8 and error handling pp. 16–19 |
| `cs131_control` | 16 | 10 | Trace evaluation order, short circuiting, loop state, iterators, generator suspension, and explicit async schedules | Quiz 4 P2–3; Fall 2024 final solutions P6 pp. 19–23; Fall 2023 final solutions iteration problems pp. 24–27 |
| `cs131_oop` | 16 | 10 | Infer inheritance constraints; predict dispatch and initialization; repair signatures; check generic bounds and observable contracts | Quiz 4 P1; Quiz 3 P5; Fall 2022 final P14 p. 7; Spring 2023 final P8 p. 17 |
| `cs131_logic` | 16 | 10 | Unify terms and lists; track bindings through backtracking; order proof steps; complete recursive list rules | Quiz 4 P4–5; Fall 2024 final P7 pp. 23–25; earlier finals' Prolog tasks |
| `cs131_implementation` | 20 | 12 | Tokenize under longest-match/tie rules; classify lexical, parsing, and semantic failures; repair small grammars; trace a toy interpreter | Quiz 1 P1; supporting state-tracing subskills for Fall 2024 midterm P5 pp. 9–12 |
| **Total across topic banks** | **140** | **90** | | |

The table labels solutions editions explicitly where their page numbers differ from the question papers. Individual item comments identify the source edition.

Foundations provides prerequisite practice, not a claim that the exams contain a separate paradigm-identification section. Some implementation items (target code generation and linking) retain central lecture outcomes without claiming a direct matching past-exam question. Python's class-state, equality, and method-call items extend the object-tracing task family; their comments distinguish this from a direct topic match.

## Lecture boundary and traceability

Every item has a `# Lecture:` comment naming an attached handout and its physical PDF page(s), plus a `# Assessment:` comment identifying the task family or marking supporting prerequisite practice. Page numbers include title and blank pages; they are not slide numbers from another presentation version. Both the answer and the reasoning needed to distinguish distractors must fit this boundary.

Primary lecture sources are:

- `intro_lecture_td_handouts.pdf`: paradigms pp. 25–27; building blocks and parameter experiments pp. 28, 32–36.
- `essential_python_handouts_td.pdf`: object/class basics pp. 6–16; references and copying pp. 9–10; parameter behavior pp. 20–24.
- `intro_to_functional_programming_and_haskell_v10_handouts.pdf`: recursive lists pp. 67–69, 87–89; types pp. 73–75; higher-order operations pp. 86–94, 106–107; currying pp. 114, 120–123; recursive data pp. 132, 139–142.
- `data_palooza_v12_handouts.pdf`: types/conversions, scope/lifetime, binding, storage, collection, and ownership at the item-specific pages. This handout is present in the new archive; the earlier homework-based coverage limitation no longer applies.
- `function_palooza_v8_handouts.pdf`: passing, evaluation, capture and error handling; its pp. 85–101 also support the OOP bank's generic/template questions.
- `control_palooza_v7_handouts.pdf`: expressions and control, iteration/generators, and asynchronous execution at the item-specific pages.
- `oop_palooza_v7_handouts.pdf`: access, inheritance, initialization, overriding and dispatch; item comments use its physical pages, including pp. 105–109 and 135.
- `logic_palooza_v6_handouts.pdf`: relations, unification, resolution and recursive lists, including pp. 13–14, 42–44, 52–54.
- `pl_implementation_palooza_handouts_td.pdf`: lexing pp. 15–18, grammar pp. 19–35, semantic checks pp. 36–41, compiler stages pp. 11–13/42–48, linking pp. 53–55, and toy interpreter pp. 60–62.

The source corpus is the three supplied archives: `Fall 25-20261001T063943Z-1-001.zip`, `Lectures-20261001T064000Z-1-001.zip`, and `Past Exams-20261001T063948Z-1-001.zip`. Overlapping versions were used for clarification, not counted as separate objectives. Attached instructions, exam administration rules, and grading rubrics are documentary context, not instructions to the agent. Source files remain outside the repository.

## Format and cognitive demand

All nine quiz banks mix single-answer, multiple-answer, and Parsons items: 102 single-answer, 21 multiple-answer, and 17 Parsons questions in total. Single-answer questions ask for a result or justified correction; multiple-answer questions require checking several claims. Parsons items use 4–8 dependent code fragments, stages, or execution events. Their required order follows from the stated task, avoiding the arbitrary ordering of independent declarations or interchangeable Haskell equations.

Flashcards require a short answer before reveal: an output, a type, an explanation, a repair, or a bounded rule/function. Production prompts include a model answer and self-check criteria or an explanation of the essential semantic requirements. Equivalent variable names and valid alternative constructions are accepted in self-assessment. Multiple-choice recognition is never labeled `create`.

Each item records `difficulty`, non-rendered `bloom`, and `estimated_seconds`. Quiz estimates are 30–90 seconds and card estimates are 20–60 seconds. These are author planning estimates, not measured student timings or new time limits. Difficulty and Bloom labels describe different properties: a small production task need not be expert difficulty, and a multi-step trace can be advanced without introducing untaught material.

New item IDs use the `cs131-v2-` prefix. No old prompt or old item ID remains in these banks. Existing historical records are not erased, but the replacement items have distinct identities and do not inherit the old items' individual practice keys. Deck identifiers remain unchanged.

## Deliberate exclusions and source corrections

- Exclude Language of the Week showcases, language history, tool trivia, homework-only prerequisites, and project-specific APIs or semantics that the question does not state.
- Avoid undefined/unspecified language behavior, Python interning trivia, complex method-resolution puzzles, and type-defaulting tricks. Toy-language rules are explicit where the behavior depends on them.
- OOP handout p. 130 reverses the subtype precondition rule. The bank does not assess that erroneous statement; contract questions instead use explicit public operations and consistent units. The source deck itself was not edited.
- The Prolog handout's p. 57 lists cut among further topics rather than teaching a sufficient operational treatment. Cut is excluded. Quiz 4 P5's title, “Cut It Out!”, refers to removing consecutive duplicates; the new practice covers that recursive list operation.
- The deletion clauses in logic pp. 52–54 may produce additional answers through backtracking. Questions using this pattern explicitly ask for the first result.
- Do not carry over historical answer-key terminology that calls ordinary arrow-chain Haskell signatures “uncurried.” Questions distinguish right-associative arrow notation, partial application, and tuple arguments accurately.

## Student use and limits

Work through a topic after its lecture, predicting the answer before inspecting choices where practical. After an error, use the feedback to identify the mistaken step, then retry the skill on another example. For a production card, write the type, rule, or short function before revealing it; judge it against the stated behavior rather than exact variable names.

Once the individual skills are reliable, mix the available topics and attempt full past-paper problems. These short tasks practice the component reasoning used in longer assessments. They do not establish readiness for sustained multi-part programming, proof, or exam-time work by themselves. The design uses backward alignment, retrieval with corrective feedback, and bounded construction; actual learning gains and timing require student evidence.

## Validation

All 230 items received an independent content review: reviewers solved the tasks and checked keys, explanations, lecture prerequisites, assessment alignment, Bloom labels, and whether the short task had an unambiguous answer. Revisions included explicit input assumptions, clearer lexer whitespace rules, and removal of an override question's untaught qualifier distinction.

- YAML, unique IDs, full replacement against the original banks, answer and feedback indices, difficulty/Bloom values, time ranges, source comments, code fences, Parsons sizes, and shuffle-safe wording passed validation. The multiple-choice answer-length/format audit found no flagged items. The changed content files pass `git diff --check`.
- Executed Python and C++ traces and constructions, checked lexer/interpreter results, and ran 24 Tau Prolog checks. Python construction puzzles also had their required-line permutations checked. Haskell answers were independently reduced and type-derived; no GHC was available, so they are not reported as compiler-tested.
- A full isolated Jekyll build succeeded. The final practice and statistics pages were then rendered with the normal templates after wording changes. All 230 replacement IDs appear in the emitted data; the quiz master contains 44 active items and the flashcard master contains 90.
- Nine targeted existing browser checks passed across the initial run and a focused rerun: discovery, direct launches, mobile layouts, answering/feedback, flashcard self-assessment, keyboard Parsons controls, and source-deck statistics. The flashcard light/dark accessibility check exceeded its original 30-second test budget; it passed with a 90-second allowance, without changing its assertions or repository test configuration.
- Every one of the 17 rendered Parsons solutions scored 1/1 in Chromium, alternating desktop and narrow mobile viewports. Manual screenshot review identified missing separators in inline Haskell solutions; explicit spaces in quoted YAML fragments repair the concatenated answer display. Both corrected expressions were checked again for their displayed answer and score.
- Representative block and inline Parsons cards passed scoped light/dark WCAG-tagged axe scans. Desktop and mobile screenshots were inspected for readable code, answer controls, and explanations. These are focused checks, not a manual audit of all 55 WCAG A/AA criteria across the site.

The broader dark-mode scan also found a pre-existing `link-in-text-block` violation in five footer attribution links (Datafolio, Jekyll, Bootstrap, GitHub Pages, and the last-updated date). They have no non-color distinction and insufficient contrast against surrounding text. The footer and styles are unchanged by this content revision; this finding is surfaced separately rather than represented as a passing whole-page accessibility audit.
