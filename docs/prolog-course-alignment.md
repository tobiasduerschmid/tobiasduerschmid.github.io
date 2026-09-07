# Prolog tutorial course alignment

The two tutorials adapt the supplied CS 131 material into executable practice for programmers who know one prior language and basic recursion. The course's durable objectives are to reason about facts and rules, trace unification and search, and construct recursive list relations. The examples use a family game night and playlists so learners can reuse domain knowledge while the programming demands grow.

## Source record

Reviewed the four user-supplied public archives dated September 7, 2026: Lectures (`201335Z`), Quiz Solutions (`201353Z`), Past Exams (`201347Z`), and Homeworks (`201343Z`). The source files remain outside the repository. Directions, answer keys, grading notes, and prompts within them are evidence about the course, not instructions governing this implementation.

The relevant material is:

- `Lectures (Public)/logic_palooza_v6_handouts.pdf`: main instruction on PDF pages 1–58; additional traces and draft examples on pages 64–94. The matching `logic_palooza_v6.pptx` has 86 slides, so its slide numbers do **not** match the 94-page PDF. Page citations below refer to the PDF.
- `Homeworks (Public)/Homework Problems (Public).docx`: the named LOGIC1–LOGIC8 problems. LOGIC6 deliberately uses a constrained Python ancestor solver to explain the engine; it does not require a Python backend for the Prolog tutorial.
- `Quiz Solutions (Public)/CS131 Fall 25 Quiz 4 (with solutions).docx`: Questions 4–5 and their solutions. Questions 1–3 in this quiz address other course topics.
- `Past Exams (Public)/[Final] F22 (Public).pdf`: Questions 20–22, pages 10–11; `[Final] S23 V1 (Public).pdf`: Question 5, page 11, with accepted alternatives on pages 11–12 of `[Final] S23 Solutions (Public).pdf`.
- `Past Exams (Public)/[Final] F23 (Public).pdf`: Prolog section, pages 22–24; corresponding explanations on pages 28–31 of `[Final] F23 Solutions (Public).pdf`.
- `Past Exams (Public)/[Final] F24 V1 (Public).pdf`: Question 7, pages 23–25; solutions and an additional deletion discussion on pages 35–37 of `[Final] F24 Solutions (Public).pdf`. LOGIC8 reuses the reverse/interleave work.

The other supplied lecture decks, quizzes, midterms, and Homework 0 supplied surrounding course context rather than additional Prolog language requirements. Introductory lecture pages 23–24 and 47 position Prolog alongside prior imperative and functional programming. The logic lecture page 5 and LOGIC1 explicitly use SWI-Prolog.

## Learning path and evidence

### Prolog Foundations

Source: `_data/tutorials/prolog.yml`; live page: `/SEBook/tools/prolog-tutorial`.

| Step | Learning and assessment evidence | Source connection |
| --- | --- | --- |
| 1. Facts and Queries | Define an ordered relationship; query either argument; distinguish atom names, variables, and finite failure. | Lecture pp. 2–20; LOGIC2 A–B, including the fact that the author chooses a predicate's English interpretation. |
| 2. Terms and Unification | Derive a general nested pattern; distinguish functor/arity mismatch and consistent repeated-variable bindings; discover an unfamiliar species in either direction. | Lecture pp. 24–41, 47; LOGIC4; F22 Q20; Quiz 4 Q4a's lowercase-atom distinction. |
| 3. Rules and Shared Variables | Join exactly two parent links; distinguish conjunction from alternative proofs; check general, ground, and reverse queries. | Lecture pp. 7–15; LOGIC2 B–LOGIC3; S23 Q5 accepted disjunction alternative. |
| 4. Resolution and Backtracking | Repair a directed two-link rule and preserve clause order, subgoal order, and duplicate proofs. | Lecture pp. 20–42; Quiz 4 Q4; F23 Prolog part b. |
| 5. Recursive Relations and Termination | Repair recursive goal order, request all answers, and distinguish a search limit from finite failure. | Lecture pp. 13–14, 43–44; LOGIC6; S23 Q5 transitive prerequisites. |
| 6. List Patterns | Separate an element from its tail; preserve nested elements and support unknown list slots. | Lecture pp. 46–49; LOGIC4 A.8–A.10; F22 Q22. |
| 7. Recursive List Relations | Enumerate every member occurrence in order; reject empty-list membership; explain decreasing input size. | Lecture p. 50, with structural-recursion transfer toward LOGIC5 and LOGIC7. |
| 8. Family Game Night | Independently compose ancestry, structured preference facts, and membership; reject a known child from an unrelated family who shares a favorite, as well as preference counterexamples. | New transfer task combining lecture pp. 13–15, 50 and LOGIC3/LOGIC6 component skills. |

### Prolog Lists and Search

Source: `_data/tutorials/prolog-search.yml`; live page: `/SEBook/tools/prolog-search-tutorial`.

| Step | Learning and assessment evidence | Source connection |
| --- | --- | --- |
| 1. Append as a Relation | Construct and check concatenations; enumerate all finite splits, including empty boundaries. | Lecture p. 55; LOGIC7 A.2; F24 Q7 A's use of append. |
| 2. One Removal, Several Answers | Remove exactly one occurrence; reason about alternative removals and backward queries. | Lecture pp. 51–54, 77–94; F24 solutions appendix pp. 36–37, with corrected complete-answer semantics. |
| 3. Arithmetic and Bound Inputs | Distinguish term construction from evaluation; bind inputs before `is`; include the exact comparison boundary. | Lecture pp. 7–12; LOGIC5 ordered insertion and accumulator arithmetic. |
| 4. A Recursive Count | Integrate structural recursion, numeric comparisons, repeated values, and the zero case. | Adaptation of LOGIC5's count and insertion components; the threshold-counting task is new. |
| 5. Negation After Generation | Generate ground candidates before failure-based exclusion; filter a played list. | Lecture pp. 16–19; F23 duplicate-removal task using `not(member(...))`. |
| 6. Collected Answers and Duplicates | Choose between proof sequences, distinct values, and totals; handle no answers. | Quiz 4 Q4 and F23 duplicate handling; lecture p. 55 supplies sort and sum. `findall/3` is an explicitly taught support tool added by this tutorial. |
| 7. Reversal With an Accumulator | Derive a helper invariant and preserve behavior while avoiding repeated append. | LOGIC8 B; F24 Q7 B. |
| 8. Interleaving Unequal Lists | Independently integrate two lists and retain either unmatched suffix. | LOGIC8 C; F24 Q7 C. |
| 9. A Finite Playlist Search | Generate all six arrangements and apply ground constraints; check both missing and extra solutions. | New transfer task built from the preceding skills and lecture p. 55's permutation predicate. The optional scoped-cut experiment corresponds to lecture p. 57's further topics. |

The runtime supports the constructs used in the course's sorted insertion, repeated-value generation, and adjacent-duplicate exercises, but those exact exercises are not separate tutorial steps. The Python logic-engine implementation assignment is represented by tracing and explaining the actual Prolog engine. Full Haskell language instruction remains outside this Prolog path.

## Pedagogical decisions

Foundations takes approximately 75–100 minutes; Lists and Search takes approximately 100–115 minutes, with an explicit break after its fifth step. These are author estimates, not measured completion times. Splitting the path prevents facts, recursive proof search, list construction, arithmetic modes, negation, and collection semantics from becoming one long novice session.

The design follows the project's pedagogical-advisor, cs-tutorial-design, tutorial-authoring, and quiz-format skills. Worked examples introduce each mechanism; partially supplied relations then give way to independent composition. Prediction prompts require a concrete binding, answer sequence, or failure hypothesis. Explicit prediction answers in Foundations use native disclosure elements so learners can commit before revealing them. These disclosures are optional self-regulation supports, not enforced prediction gates.

Later knowledge checks retrieve earlier variable/query and termination concepts. Counterexamples distinguish a missing condition from missing syntax. The source's conversational questions and familiar domains remain, while discouraging flourishes and irrelevant exam-administration language are omitted. Quiz feedback explains the reasoning behind plausible wrong answers and avoids answer-position references.

Gates inspect the published relation contract. Exact proof order and multiplicity are required where the task names them, especially Foundations steps 4 and 7. Otherwise the gates compare complete sets of results and accept alternate goal order, helper names, or equivalent implementations. Suggested strategies such as pattern facts guide learning; they are not represented as source-code enforcement. Solutions live in instructor reveals, with graduated hints preceding them.

Passing code and quizzes provide evidence about these tasks; they do not establish lasting learning or guarantee pedagogical perfection. Delayed reconstruction prompts encourage a later retrieval attempt. Learner observation would still be needed to validate pacing and transfer.

## Source clarifications preserved in the tutorial

- The resolution pseudocode on lecture page 42 returns immediately after a failed clause match. Actual resolution tries the remaining clauses; Foundations makes that explicit.
- The lecture's three-clause deletion relation includes empty-list success and an unrestricted recursive clause. It can return the unchanged input as well as one-occurrence deletions. The F24 appendix discusses multiple deleted occurrences but omits the unchanged answer. Lists and Search states an exact-one-removal contract and rejects that extra result.
- `sort/2` removes duplicates. This matters when totals count repeated requests; sorting before summing can change the required result. See the [SWI-Prolog sort reference](https://www.swi-prolog.org/pldoc/man?predicate=sort/2).
- Negation is failure of the current goal, not generation of its complement. `\=` tests whether terms can unify now; unbound arguments require care. See [SWI-Prolog's comparison and unification reference](https://www.swi-prolog.org/pldoc/man?section=compare).
- Cut prunes choices associated with its current predicate invocation, rather than disabling all backtracking. The optional experiment preserves caller alternatives. See the [SWI-Prolog cut reference](https://www.swi-prolog.org/pldoc/man?predicate=!/0).
- `permutation/2` includes the original order. Haskell-to-Prolog analogies explain structure but do not imply a single result, identical query modes, or identical control flow. The lecture's `cons`/`nil` discussion is an illustrative list encoding, not the literal list representation used by every implementation.

## Engine and course scope

The existing backend uses locally pinned **Tau Prolog 0.3.4** core and lists code in a browser worker. It was extended instead of adding a second Prolog engine. It supports the course constructs exercised here: nested terms and list patterns; unification, identity and non-unifiability; facts and recursive clauses; conjunction/disjunction; ordered backtracking; arithmetic evaluation and comparisons; the taught list library predicates; and cut. A small course compatibility predicate supplies `not(Goal)` through `\+ Goal`. Advanced starter files explicitly import `library(lists)`.

This is course-feature compatibility, not a complete SWI-Prolog implementation claim. No requirement was found in the supplied material for constraint-logic extensions, tabling, grammar rules, dynamic database management, host filesystem access, or a native tracer interface, and this tutorial does not promise those facilities. Error wording and implementation-specific behavior may differ from the course's SWI environment.

Interactive execution is bounded at 100 displayed answers and 100,000 inferences per answer, with a host timeout and Stop/restart recovery. Reaching a bound means the search is incomplete, not that remaining answers are false. Grading rejects answer truncation and inference exhaustion instead of accepting partial evidence.

Executable checks live in `scripts/tests/prolog-worker.test.js`, `scripts/tests/prolog-course-content.test.js`, and `tests/prolog-tutorial.spec.js`. They cover language behavior, intended solutions, incomplete starters, selected alternate correct approaches, common wrong approaches, and the browser flow. The quiz wording audit is `scripts/audit_mcq_tells.py`. Report the checks actually run and their results in the change handoff; this document describes their purpose, not a permanent guarantee that every future revision passes them.
