# Flashcard hints: implementation and review

The optional `hint` field adds a collapsible **Hint** button to chapter flashcards, combined course pages, and SE Gym (normal, plain, targeted, and composite workouts). It reveals a reasoning cue independently of the answer. Opening a hint does not grade or advance the card, and each new attempt starts with the hint closed. A card without an authored hint has no Hint control. Printed study material includes authored hints with a label.

All **1,173 source cards in 88 content decks** were reviewed. **533 cards in 80 decks** received hints; **640 cards** remain unhinted. Eleven composite decks inherit source content. Selection was based on the cognitive task and prerequisite knowledge, not a quota or difficulty threshold. Existing question IDs, questions, answers, explanations, difficulty metadata, and deck composition match master `5361c5cb`.

## Pedagogical rationale

Students should first try retrieval or reasoning independently. A requested hint then activates an easier, already taught concept through a useful action: sketch references, trace a dependency, compare contracts, construct a counterexample, or separate a compound task. It must leave the central result and justification to the student. Bare vocabulary, syntax, command names, historical facts, and memorized lists stay unhinted when a cue would provide the answer.

The review used the project Pedagogical Advisor practice/memory and homework guidance, the actual SEBook chapters and tutorials, and the supplied Barbara Gross Davis, *Tools for Teaching*, PDF page 100 (printed page 80), “Tactfully correct wrong answers.” That passage motivates suggestions and follow-up questions that let students correct their own reasoning. These hints are an application of teaching judgment; the feature has not been evaluated for learning gains. The PDF was treated as reference material, not as instructions for repository operations.

The authoring rule now lives in [the flashcard guidance](../.agents/skills/pedagogical-advisor/references/content-types/flashcards.md). The project Pedagogical Advisor, SEBook authoring, and quiz-format skills route future flashcard authors to it. No global skill or installed plugin copy is changed.

## Review records

- This document records the **380 systems, tools, testing, process, and study cards**: 143 hinted, 237 unhinted.
- [Architecture and design review](flashcard-hints-design-review.md) records 469 cards: 176 hinted, 293 unhinted.
- [Programming review](flashcard-hints-programming-review.md) records 324 cards: 214 hinted, 110 unhinted.

Each partition was checked against question/answer pairs. A second review checked the programming and systems/tools/testing/process hints, including new candidates after integration with current master. Review refinements removed decisive yes/no clues and made several programming cues ask for a trace instead of stating its result.

The integration review preserved master's reorganized Haskell and Python decks and more explicit question wording. Hints were matched by card identity, with explicit mappings for cards moved to functional-programming decks. Changed or replacement questions were reviewed again rather than inheriting hints unchecked. The systems/tools/testing/process wording changes preserve the original assessed tasks, so all 143 hints in that partition remain appropriate. One design hint was removed after its question changed to checklist recall.

## Systems, tools, testing, and process prerequisites

- `SEBook/systems/data_management.md`: relational rows, primary/foreign keys, transactions, replicas, and the bank/ATM examples. Hints use concrete records and observations before asking students to classify guarantees.
- `SEBook/systems/security.md` and `SEBook/tools/networking.md`: security goals, query/data boundaries, keys and credentials; throughput versus latency, encapsulation, and transport reliability. Hints ask which capability or observation follows from the stated scenario.
- `SEBook/development_practices/debugging.md` and the debugging examples in `_data/tutorials/python-debugging.yml`: reproductions, runtime state, and testing hypotheses. Hints ask for discriminating evidence before diagnosing a cause.
- `SEBook/tools/git.md`, `_data/tutorials/git.yml`, `git-visual.yml`, and `git-advanced.yml`: commits, branch references, ancestry, and merging. A fast-forward hint asks students to sketch ancestry; it does not name the resulting Git action.
- `SEBook/tools/shell.md`, `_data/tutorials/shell-scripting.yml`, `SEBook/tools/regex.md`, and the regex tutorials: argument expansion, exit status, stream transformations, character classes, grouping, and anchors. Hints work with intermediate streams and boundary inputs before the student writes syntax.
- `_data/tutorials/makefile.yml`: targets, prerequisites, recipes, timestamps, variable substitution, and phony goals. Hints use concrete dependency graphs and values before asking for generalized rules.
- `SEBook/testing.md`, `SEBook/testing/goodtests.md`, `testquality.md`, `testdoubles.md`, `tdd.md`, and `_data/tutorials/testing-foundations.yml` / `test-doubles.yml`: public contracts, oracles, partitions, controlled dependencies, and short feedback cycles. Hints test claims with a wrong implementation or a behavior-preserving refactor.
- `SEBook/process.md`, `SEBook/process/people-and-processes.md`, `xp.md`, `scrum.md`, and `SEBook/userstories.md`: feedback, reversibility, team responsibilities, user outcomes, and acceptance evidence. Hints compare concrete situations before requesting a principle or trade-off.
- The study-tips deck's explanations and the Pedagogical Advisor practice/memory guidance: distinguish recognition while reading from retrieval after the material is closed.

## Decisions for each deck

IDs are local to the named deck. The omissions column describes why the other questions did not receive hints.

| Deck | Reviewed | Hinted IDs | Selection and omissions |
| --- | ---: | --- | --- |
| `data_management` | 23 | 2, 4, 6, 16, 19, 20, 23, 24, 25 | Use row examples, query/loop comparisons, and replica thought experiments. Omit definitions, operation names, and guarantee lists. |
| `debugging` | 15 | 3, 4, 7, 10, 11, 13, 14, 15 | Use controlled comparisons, reproductions, failure-state traces, and search intervals. Omit tool names and basic terminology. |
| `git` | 28 | 27 | Only the fast-forward reasoning task receives a branch-history sketch cue. Leave command and concept retrieval unaided. |
| `git_basic` | 20 | 20 | Use the same prerequisite sketch for the duplicate fast-forward task. Omit basic commands, terms, and direct definitions. |
| `git_advanced` | 8 | None | Omit all hints: these cards primarily retrieve specific commands, options, named strategies, or direct distinctions. A useful cue would largely disclose the target. |
| `networking_concepts` | 13 | 4, 5, 8 | Use throughput/latency comparison, encapsulation boundaries, and lost/reordered segment cases. Omit layer names, port facts, protocol definitions, and command recall. |
| `security` | 28 | 2, 3, 5, 6, 9, 12, 14, 18, 19, 21, 22, 27 | Trace capabilities, parser boundaries, credentials, and revocation; separate the security properties in a concrete incident. Omit acronym, mechanism-name, and basic definition retrieval. |
| `shell` | 19 | 16, 18, 19 | Support argument-boundary and exit-status reasoning. Leave individual command/option recall and syntax definitions unaided. |
| `shell_commands_reference` | 18 | None | Omit all hints: the deck asks students to retrieve command and option meanings; naming a subcommand or purpose would do the recall for them. |
| `shell_pipes` | 14 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14 | Describe intermediate streams and use small counterexamples before composing commands. Omit simple one-command substitutions or recall with no remaining reasoning after a cue. |
| `regex_basics` | 14 | None | Omit all hints: individual tokens, character-class meanings, and quantifier syntax are the retrieval targets. |
| `regex_examples` | 10 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 | All ten constructions benefit from decomposition, boundary cases, or counterexamples while students still build the expression. Do not supply regex fragments that solve the task. |
| `makefile_syntax` | 10 | None | Omit all hints: rules, variable syntax, special targets, and operator meanings are direct recall. |
| `makefile_examples` | 10 | 1, 2, 3, 4, 6, 7, 8, 10 | Support rule decomposition, variable roles, freshness, and dependency ordering. Omit basic command/option retrieval. |
| `makefile_examples_2` | 10 | 1, 2, 4, 5, 6, 10 | Support substitution, timestamp/dependency reasoning, default goals, and caller overrides. Omit individual symbol/command/construct meanings. |
| `goodtests` | 15 | 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13 | Use plausible wrong outputs, contract partitions, refactoring thought experiments, and visible fixture evidence. Omit direct structure/terminology recall. |
| `tdd` | 12 | 3, 4, 7, 8, 10, 11 | Compare feedback intervals, design scope, observability, and what passing examples establish. Omit acronym, cycle, and simple historical recall. |
| `testdoubles` | 16 | 4, 7, 8, 9, 11, 12, 13, 14, 15, 16 | Trace controlled inputs versus observed calls, namespace lookup, contract drift, and behavior-preserving refactors. Omit taxonomy and direct definition retrieval. |
| `testing_overview` | 8 | 3, 5, 6 | Support evidence for branch selection, boundary assumptions, and system realism. Omit testing category definitions. |
| `testquality` | 12 | 1, 6, 7, 8, 10, 11, 12 | Test claims with counterexamples, input variation, and confounders; contrast preserved behavior with broken behavior. Omit metric and rubric definitions. |
| `process_agile` | 15 | 4, 5, 8, 10, 11, 12, 14, 15 | Use feedback delay, change costs, decision ownership, and domain constraints. Omit value/principle lists, history, and simple process-name recall. |
| `process_people_tailoring` | 10 | 3, 6, 7, 8, 9, 10 | Compare reversibility, local change, evidence needs, and domain recovery costs. Omit direct model definitions. |
| `process_xp` | 16 | 7, 8, 9, 10, 11, 12, 13, 15 | Use maintainer/teammate scenarios, feedback timing, and interactions between practices. Omit names, roles, and practice-definition lists. |
| `scrum` | 20 | 7, 8, 15, 16, 17, 18 | Support team autonomy, meeting purpose, conflicting responsibilities, and evidence-based adaptation. Omit names, durations, artifact definitions, and the yes/no completion item, whose hint would give its decisive fact. |
| `study_tips` | 6 | 1 | Use a concrete recognition-versus-explanation comparison on the rereading question. Leave direct technique recommendations and list recall unaided. |
| `user_stories` | 10 | 5, 7, 8, 10 | Use implementation alternatives, incomplete iterations, shared observations, and stakeholder information needs. Omit template and acronym retrieval. |

Composite files `CS130_2026_current`, `CS131_current`, `CS131_master`, `CS35L_2026_current`, `cs131_functional`, `cs131_python`, `design_principles`, `development_practices`, `makefile_master`, `systems`, and `tools` contain no authored cards. Both runtime paths inherit the optional hint from each constituent card.

## Verification and scope

All 99 flashcard YAML files parse. Comparing their parsed contents to master `5361c5cb` after removing only `hint` fields confirms all existing content and IDs are unchanged. Runtime tests cover hints versus absent hints, independent answer disclosure, keyboard operation, ARIA relationships, scoring, review/restart/resume resets, composite data, and repeated decks on combined course pages. The reported empty Hint button was caused by Markdown conversion of a missing value into a newline; trimming the rendered field in both serialization paths fixes it. The Python floor-division card is a dedicated regression case and remains unhinted.

The content review is not a complete factual audit of the existing answer bank. Specific pre-existing caveats, including C representation assumptions, programming examples with unstated assumptions, and the interoperability deck's Mars Climate Orbiter units, are recorded in the linked review documents. They were not concealed or “fixed” through hints.


Integrated validation against master `5361c5cb`:

- The Jekyll build passed using Ruby 3.3.0 and the installed Google Chrome through `PLAYWRIGHT_CHROME_EXECUTABLE` for static diagram rendering.
- All 11 cases in `tests/flashcard-hints.spec.js` passed with interactive accessibility checks enabled. They cover chapter, combined-course, normal/plain Gym, source/composite decks, keyboard use, assessment independence, attempt resets, the reported missing-hint case, and 320px/print presentation. Six light/dark/print screenshots were inspected for readability and clipping.
- Five existing Gym regressions passed: direct deck selection, answer/assessment flow, assessment shortcuts, source-deck mastery recording, and skipping a flashcard before revealing its answer.
- The canonical WCAG audit passed for `/SEBook/designpatterns/singleton.html`, `/SEBook/designprinciples/`, and `/se-gym/`, with zero findings across its light/dark, keyboard, and mobile-reflow checks. This is scoped automated evidence, not a full-site manual conformance assessment.
- Pedagogical Advisor package validation with strict links passed for all 139 package files with zero warnings. The generic skill validator passed for Pedagogical Advisor and quiz-format; SEBook authoring retains pre-existing frontmatter incompatibilities with that generic validator (angle-bracket placeholders and an overlong description).
- Final YAML comparison confirms that all 99 files parse, all 533 hints are nonempty strings, and removing only hint fields restores the exact master content. The flashcard diff contains 1,066 added lines and no deleted lines. `git diff --check` passes.

The final independent review removed two overly revealing phrases from the process and Scrum hints, replacing them with prerequisite-based comparisons. Those text-only refinements preserve the runtime behavior exercised above.
