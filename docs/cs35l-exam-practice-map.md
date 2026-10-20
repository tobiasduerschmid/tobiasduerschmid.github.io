# CS35L exam-aligned practice

This addition provides 75 new topic-quiz questions and 52 flashcards using fresh examples, plus a separate 23-question deck titled **CS 35L Final Exam Spring 2026 MCQs**. Existing topic decks retain their earlier items and IDs. The current-course aggregate lists retain their existing pacing; the new standalone exam deck is discovered automatically by SE Gym.

## Sources and scope

The supplied archive contains Fall 2025 and Spring 2026 midterms and finals, plus Fall 2025 midterm and final solutions. The practice follows their introductory undergraduate teaching model. Full exam questions were decomposed into small skills: predict one state change, select a condition, diagnose a violation, produce a short expression or command, and justify one design choice.

The exact deck reproduces all multiple-choice items from the Spring final: the opening 15 questions, the Git team question, six code-comprehension questions, and the agile-process question. Its stems and 91 options were compared directly with the source DOCX. Whitespace and layout are normalized; wording and choices are preserved. Inline-code formatting protects command flags from Markdown smart-dash conversion. Each code-comprehension item includes the original shared scenario and all eight source files so it remains self-contained when shuffled. Keys and explanations are authored practice guidance; the archive did not contain an official Spring final solution.

## Pedagogical review

Reviewed using project and plugin Pedagogical Advisor, the project's quiz-format guide, and Barbara Gross Davis, *Tools for Teaching* (1993), chapter 30, printed pp. 262–267, plus chapter 31, pp. 274–275. The supplied PDF places some pages in reverse order; printed page numbers are used here.

Applied checklist for new topic practice:

- The stem presents the complete task and the assumptions needed to answer it.
- Each item targets one bounded decision or tightly coupled tracing step.
- Questions practise application, diagnosis, or production as well as retrieval.
- Distractors represent plausible errors, use parallel forms, and avoid implausible filler.
- Keys do not rely on longer wording, exclusive emphasis, or answer-position cues.
- Wording avoids tricks, unnecessary negative framing, and irrelevant context.
- Feedback explains the reasoning error briefly and remains correct after shuffling.
- Flashcards ask for a bounded response; model answers include the essential reasoning or short code.

Independent reviews checked answer correctness and educational quality separately. Two initial weak distractors/recognition items were revised, and two redundant cards were replaced with production/diagnosis prompts. The added MCQs have zero answer-length or formatting findings from `scripts/audit_mcq_tells.py`.

The historical exam deck intentionally retains its original wording. Original items 3, 4, 19, and 22 retain longer-answer cues to meet the exact-copy request. It is not subject to the short-item constraint applied to new topic practice. Expected introductory answers are used without adding research-level exceptions. Difficulty labels are author estimates; student difficulty, discrimination, retention, and transfer have not been measured.

## Introductory teaching assumptions

The explanations clarify the limits of useful course models without turning those limits into extra exam requirements:

- **Git:** no new commits on the target branch is the familiar fast-forward case; the underlying rule is ancestry. Incompatible edits to the same lines illustrate a merge conflict, without requiring the edits to occur at the same clock time.
- **Networking:** reliable, ordered TCP delivery describes transport behavior, not a promise that a service never fails. The new loss-tolerance example uses complete snapshots, so losing an older snapshot is different from losing a required incremental update.
- **C and Python:** leaving a C scope does not automatically free an ordinary heap allocation. The NumPy comparison concerns bulk numerical work and uniform numeric storage, rather than claiming every NumPy expression is faster than every Python alternative.
- **Generated code:** a skeleton and stated priorities guide an LLM, but do not guarantee that its output meets those priorities. Review and tests remain part of the expected introductory answer.

## Coverage by source task

| Source task | Target skill | Quiz deck and new IDs | Flashcard deck and new IDs |
|---|---|---|---|
| Spring 2026 midterm Task 3; Fall 2025 midterm Task 3 | Repair oversized integration stories with one usable vertical slice; testable criteria; negotiable outcomes | user_stories 6, 7, 9 | user_stories 12, 13 |
| Spring 2026 final §3 User Story; Fall 2025 final Debugging User Story | Align acceptance criteria with promised value; justify Small using bounded implementation scope | user_stories 8, 10 | user_stories 11, 14 |
| Spring 2026 midterm Task 8; Fall 2025 midterm Task 8 | Diagnose a subtype that breaks a promised result | design_principle_solid 13 | design_principle_solid 16 |
| Fall 2025 final State Pattern and Modeling | Place state-specific behavior in states, shared data in context, control current-state changes | design_pattern_state 6, 7 | design_pattern_state 6, 7 |
| Spring 2026 final §6 Modeling (image3 sequence and image4 class) and Fall 2025 midterm Task 8 | Notify all registered observers; use polymorphic callbacks; align pull notification signature | design_pattern_observer 11, 12, 13 | design_pattern_observer 6, 7 |
| Spring 2026 final §6 Modeling; Fall 2025 final Modeling; Spring 2026 midterm Task 8 | Realization/generalization direction; association vs lifetime ownership; abstract-operation contracts; observer multiplicity | uml_class_diagram_examples 15, 16, 17 | uml_class_diagram_examples 11, 12 |
| Fall 2025 final Modeling image1; Spring 2026 final §6 Modeling image3 | One concrete receiver under polymorphic dispatch; matching message arguments to declared operation | uml_sequence_diagram_examples 13, 14 | uml_sequence_diagram_examples 9 |
| Spring 2026 final §5 Testing; Fall 2025 final Testing | Red must fail for intended behavior; keep one failure in focus; avoid untested extra production behavior | tdd 9, 10, 11 | tdd 13, 14 |
| Fall 2025 final Testing §1 | Distinguish observed failure from debugging its cause | testing_overview 7 | testing_overview 9 |
| Fall 2025 final Reuse | Recheck assumptions in new context; pin and deliberately update dependencies | design_with_reuse 13, 14 | design_with_reuse 21 |
| Spring 2026 final §9 Others §1; Fall 2025 final Others §1 | Choose agile for useful feedback under uncertainty; plan/verify stable high-cost deployments | process_agile 11, 12 | process_agile 16 |
| Fall 2025 final Pair Programming | Restore active participation; identify evidence of knowledge transfer; mitigate remote visibility barrier | process_xp 11, 12, 13 | process_xp 16, 17 |

| Exam source | Practiced skill | Quiz deck: new IDs | Flashcard deck: new IDs |
|---|---|---|---|
| Spring 2026 midterm Task 2, Part 1 | Reject mismatched inputs before zip; transform pairs then apply strict threshold while preserving order | python: exam-practice-paired-lengths; python_output: exam-practice-transform-before-filter | python_syntax_generate: exam-practice-write-length-guard; python_syntax_explain: exam-practice-filter-input-or-output |
| Spring 2026 midterm Task 2, Part 2; Fall 2025 midterm Task 2 | Distinguish Python per-element execution/object overhead from compiled loops and uniform numeric array representation | python: exam-practice-numpy-loop, exam-practice-numpy-storage | Covered by existing conceptual Python material plus new applied quizzes |
| Fall 2025 midterm Task 7 Node.js | Match request method as well as URL; access route parameters and interpolate template literals | nodejs: exam-practice-http-method | nodejs_syntax_generate: exam-practice-route-interpolation |
| Spring 2026 midterm Task 7 Node.js | Query text vs boolean; route identifier vs array index | nodejs: exam-practice-query-string, exam-practice-id-not-index | nodejs_syntax_explain: exam-practice-false-query-truthiness |
| Fall 2025 midterm Task 7 React | Return one keyed list element per source item in an ordered list | react: exam-practice-map-return | react_syntax_generate: exam-practice-ordered-topic-list |
| Spring 2026 midterm Task 7 React | Recognize external reassignment does not update state; derive filtered lists from current state | react: exam-practice-external-reassignment | react_syntax_explain: exam-practice-derive-filtered-list |

| Deck | New IDs | Target skill | Exam source |
| --- | --- | --- | --- |
| `_data/quizzes/git_basic.yml` | `14` | Predict which staged snapshot is committed after another edit. | Spring 2026 midterm Task 5.2.3; Fall 2025 midterm Task 5.2 |
| `_data/quizzes/git_basic.yml` | `15` | Distinguish a staged addition from an unstaged working-file deletion. | Fall 2025 midterm Task 5.2a-b |
| `_data/quizzes/git_basic.yml` | `16` | Interpret the ahead count as a comparison of commit histories. | Spring 2026 midterm Task 5.2.3; Fall 2025 midterm Task 5.2a |
| `_data/quizzes/git_basic.yml` | `17` | Use current ancestry to decide whether a fast-forward is possible. | Spring 2026 final MCQ 1 |
| `_data/quizzes/git_advanced.yml` | `10` | Select reflog inspection to recover a removed branch tip. | Spring 2026 midterm Task 5.2.1-2 |
| `_data/quizzes/git_advanced.yml` | `11` | Trace detach plus branch-creation commands without confusing create with switch. | Spring 2026 final Git 2; Fall 2025 final Git 2 |
| `_data/quizzes/git_advanced.yml` | `12` | Explain why a newly tracked regression detector disappears in historical checkouts. | Fall 2025 final Git 3A |
| `_data/quizzes/git_advanced.yml` | `13` | Choose a specific regression test instead of unrelated red-step failures. | Fall 2025 final Git 3B |
| `_data/quizzes/git_advanced.yml` | `14` | Recognize that reverting a squash commit reverses its useful feature too. | Fall 2025 final Git 3C |
| `_data/quizzes/shell_output.yml` | `shell-output-errexit-or` | Trace handled versus bare failure under set -e. | Fall 2025 midterm Task 5.1; Spring 2026 midterm Task 5.1 |
| `_data/quizzes/shell_output.yml` | `shell-output-errexit-and` | Trace nonfinal versus final failure in an && list. | Fall 2025 midterm Task 5.1 |
| `_data/quizzes/shell_output.yml` | `shell-output-pipeline-status` | Predict grep/no-match pipeline status without pipefail. | Spring 2026 midterm Task 5.1; Spring 2026 final Makefiles & Shell |
| `_data/quizzes/shell_output.yml` | `shell-output-quote-literal` | Contrast literal single quotes with interpolating double quotes. | Spring 2026 midterm Task 5.1 |
| `_data/quizzes/shell_output.yml` | `shell-output-positional-shift` | Trace positional arguments after shift. | Spring 2026 final MCQ 2 |
| `_data/quizzes/shell_output.yml` | `shell-output-redirected-loop` | Separate file append effects from terminal output in a loop. | Spring 2026 midterm Task 5.1 |
| `_data/quizzes/shell.yml` | `23` | Trace left-to-right descriptor redirection. | Spring 2026 final Makefiles & Shell build_and_check.sh |
| `_data/quizzes/regex.yml` | `14` | Scope anchors around both alternation branches. | Fall 2025 midterm Task 4.1 |
| `_data/quizzes/regex.yml` | `15` | Permit even and odd lengths while preserving alternating characters. | Fall 2025 midterm Task 4.1 |
| `_data/quizzes/regex.yml` | `16` | Place capture boundaries around only the desired field. | Fall 2025 midterm Task 4.2; Spring 2026 midterm Task 4.1-2 |
| `_data/quizzes/regex.yml` | `17` | Quantify a multi-character group rather than one character. | Spring 2026 midterm Task 4.1-2 |
| `_data/quizzes/regex.yml` | `18` | Use lookahead to exclude trailing context from a match. | Spring 2026 midterm Task 4.1-2 |
| `_data/quizzes/regex.yml` | `19` | Compose decimal character ranges for the hour bounds. | Spring 2026 final Others 2 |
| `_data/quizzes/regex.yml` | `20` | Combine whole-string length bounds with non-whitespace matching. | Fall 2025 final Others 2 |
| `_data/quizzes/makefile.yml` | `11` | Evaluate prerequisite recipes before dependent targets. | Fall 2025 final Makefiles; Spring 2026 final Makefiles & Shell 1 |
| `_data/quizzes/makefile.yml` | `12` | Predict repeat execution when the recipe does not create its target. | Fall 2025 final Makefiles |
| `_data/quizzes/makefile.yml` | `13` | Expand $@, $<, and $^ in the same recipe. | Fall 2025 final Makefiles; Spring 2026 final Makefiles & Shell |
| `_data/quizzes/makefile.yml` | `14` | Repair a file/action name collision with .PHONY. | Spring 2026 final MCQ 3; Makefiles & Shell 4 |
| `_data/quizzes/makefile.yml` | `15` | Rebuild only the stale object and its executable. | Spring 2026 final Makefiles & Shell 3 |
| `_data/flashcards/git_basic.yml` | `21` | Produce the staged-diff review command. | Fall 2025 midterm Task 5.2b; Spring 2026 midterm Task 5.2.3 |
| `_data/flashcards/git_basic.yml` | `22` | Produce a staged-addition/unstaged-deletion state. | Fall 2025 midterm Task 5.2a |
| `_data/flashcards/git_basic.yml` | `23` | Explain the operation that increases the ahead count. | Spring 2026 midterm Task 5.2.3; Fall 2025 midterm Task 5.2a |
| `_data/flashcards/git_advanced.yml` | `9` | Protect a recovered commit with a branch. | Spring 2026 midterm Task 5.2.2 |
| `_data/flashcards/git_advanced.yml` | `10` | Construct a bisect sequence with a stable external detector. | Fall 2025 final Git 3A-B |
| `_data/flashcards/git_advanced.yml` | `11` | State the passing-feature condition for squash-integrated TDD work. | Fall 2025 final Git 3C |
| `_data/flashcards/shell.yml` | `21` | Produce an explicit failure-handling OR list. | Spring 2026 midterm Task 5.1; Fall 2025 midterm Task 5.1 |
| `_data/flashcards/shell.yml` | `22` | Produce a loop that appends expanded values without terminal output. | Spring 2026 midterm Task 5.1 |
| `_data/flashcards/shell.yml` | `23` | Enable pipeline failure detection with errexit. | Spring 2026 midterm Task 5.1; Spring 2026 final Makefiles & Shell |
| `_data/flashcards/shell_pipes.yml` | `15` | Construct a combined-stream tee pipeline. | Spring 2026 final Makefiles & Shell build_and_check.sh |
| `_data/flashcards/regex_examples.yml` | `11` | Generate both alternating start cases, including odd lengths. | Fall 2025 midterm Task 4.1 |
| `_data/flashcards/regex_examples.yml` | `12` | Generate a named capture excluding delimiters. | Fall 2025 midterm Task 4.2; Spring 2026 midterm Task 4.1-2 |
| `_data/flashcards/regex_examples.yml` | `13` | Generate line-anchored repeated words with an excluded trailing marker. | Spring 2026 midterm Task 4.1 |
| `_data/flashcards/regex_examples.yml` | `14` | Generate independent zero-padded minute/second bounds. | Spring 2026 final Others 2 |
| `_data/flashcards/regex_examples.yml` | `15` | Generate a bounded non-whitespace token pattern. | Fall 2025 final Others 2 |
| `_data/flashcards/makefile_examples_2.yml` | `11` | Explain repeated runs of a recipe that leaves its target missing. | Fall 2025 final Makefiles |
| `_data/flashcards/makefile_examples_2.yml` | `12` | Distinguish command suppression from stdout redirection. | Spring 2026 final Makefiles & Shell 1-2 |
| `_data/flashcards/makefile_examples.yml` | `11` | Produce an automatic-variable copy recipe. | Fall 2025 final Makefiles; Spring 2026 final Makefiles & Shell |
| `_data/flashcards/makefile_examples.yml` | `12` | Diagnose a tee-created file/action collision and declare the action phony. | Spring 2026 final MCQ 3; Makefiles & Shell 4 |

| Source task | Deck | Item ID | Type |
|---|---|---|---|
| Spring final §8.1–3 | dev_practice_code_comprehension | exam-practice-early-return-stock | quiz |
| Spring final §8.4 | dev_practice_code_comprehension | exam-practice-unused-policy | quiz |
| Spring final §8.2,5 | dev_practice_code_comprehension | exam-practice-trace-call-path | quiz |
| Spring final §8.3 | dev_practice_code_comprehension | exam-practice-repair-rejection | flashcard |
| Spring final §8.1 | dev_practice_code_comprehension | exam-practice-trace-observations | flashcard |
| Spring final §5 Refactoring | dev_practice_refactoring | exam-practice-safe-condition-order | quiz |
| Spring final §5 Refactoring test cases | dev_practice_refactoring | exam-practice-boundary-oracle | quiz |
| Fall final Refactoring | dev_practice_refactoring | exam-practice-preserve-padding | quiz |
| Spring final §5 Refactoring | dev_practice_refactoring | exam-practice-guard-compression | flashcard |
| Spring final §5 Refactoring | dev_practice_refactoring | exam-practice-name-predicate | flashcard |
| Spring midterm Task9.1 | data_management | exam-practice-partition-unique | quiz |
| Spring midterm Task9.2 | data_management | exam-practice-transaction-boundary | flashcard |
| Fall midterm Task6.2c; Spring midterm Task6.3 | networking_decisions | exam-practice-snapshot-loss | quiz |
| Spring midterm Task6.1 | networking_decisions | exam-practice-peer-redundancy | quiz |
| Fall midterm Task6.2 | networking_concepts | exam-practice-delta-vs-snapshot | flashcard |
| Fall/Spring final MCQ14 | security | exam-practice-rendering-path | quiz |
| Fall final MCQ5 | security | exam-practice-sql-bind | flashcard |
| Spring final MCQ8 | c | exam-practice-heap-lifetime | quiz |
| Spring final MCQ8 | c | exam-practice-explicit-polymorphism | flashcard |

## Technical verification

- YAML parses; IDs remain unique; existing items and deck metadata are unchanged.
- Answer and feedback indices are valid; feedback is a sparse integer-keyed map.
- All seven new write-in programs were executed and matched their authored answers.
- Git state/recovery, Make dependency/rebuild, shell redirection, and regex boundary examples were exercised in temporary directories.
- Python and plain JavaScript examples were executed; JavaScript/JSX syntax was checked. React and Express behavior was checked against official documentation, without installing separate framework runtimes.
- The original Spring final Node case produces status 403, threat level 7, stock 6, and zero saved dispatches. The selected repair restores stock to 12 while retaining the 403 response and zero saved dispatches.
- New write-in snippets retain their executed outputs while fitting narrow phone screens. Distinct shell stems prevent the workout deduplicator from collapsing two exercises.
- Write-in scoring, print, and saved-progress checks derive their totals from the authored decks.
- A revealed code answer exposed an existing keyboard-accessibility gap. Visibility changes now refresh scroll-region focus, and focused code keeps native arrow-key scrolling instead of grading the flashcard.
- Build and browser results are recorded in the pull request validation notes.

Relevant primary references used for the programming checks: [Python built-ins](https://docs.python.org/3/library/functions.html#zip), [NumPy overview](https://numpy.org/doc/stable/user/whatisnumpy.html), [Express routing](https://expressjs.com/en/guide/routing/), and [React state](https://react.dev/learn/state-a-components-memory).
