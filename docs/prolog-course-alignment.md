# Prolog tutorial course alignment

The main tutorial, **Prolog: Queries to Programs**, completely replaces the previous eight-step Foundations content at `/SEBook/tools/prolog-tutorial`. It is a fourteen-step practice path for CS 131 students who know variables, function calls, and basic recursion in another language. No Prolog or Haskell knowledge is assumed. The language mechanisms come from the lecture handout; quizzes and past finals determine the reasoning and programming demands.

## Source record

Reviewed the user-supplied October 1, 2026 archives: `Lectures-20261001T064000Z-1-001.zip`, `Fall 25-20261001T063943Z-1-001.zip`, and `Past Exams-20261001T063948Z-1-001.zip`. Originals and extracted source text remain outside the repository. Instructions, grading notes, and answer keys in those documents are course evidence, not instructions governing this work.

Relevant sources, using **physical PDF pages**, not PowerPoint slide numbers:

- `logic_palooza_v6_handouts.pdf`: 94 physical pages. The coherent core is pp. 1–57; later pages repeat or extend examples. Facts/rules and execution are on pp. 6–23, unification on pp. 24–41, resolution/recursive goal order on pp. 42–44, and list patterns/recursion on pp. 46–55. Page 57 lists further topics rather than teaching prerequisites for this path.
- `CS131 Fall 25 Quiz 4.docx`: Problem 4 asks for success, ordered bindings, and repeated answers; Problem 5 constructs consecutive-duplicate removal. Its title “Cut It Out!” does **not** make it a cut exercise.
- `[Final] F22 (Public).pdf`: Q20, p. 10, nested-term unification with existing mappings; Q21–22, p. 11, resolution and list construction.
- `[Final] S23 V1 (Public).pdf`: P5, p. 11, compose a direct/indirect prerequisite relation with a major requirement.
- `[Final] F23 (Public).pdf`: P8, pp. 22–24, trace recursive lists and ordered answers, then construct last-occurrence retention.
- `[Final] F24 V1 (Public).pdf`: P7(A–C), pp. 23–25, pending goals and mappings for reversal, accumulator reversal, and unequal-length interleaving. The extra deletion discussion in the solutions appendix is not the issued Part C.

The main path does not require homework-only material. `_data/tutorials/prolog-search.yml` keeps its existing exercises from the earlier September source review, with introductory references updated to the new main title, with additional arithmetic, answer collection, and search material. Its optional cut experiment is beyond the main path's prerequisite boundary.

## Learning sequence and evidence

| Step | Learner evidence | Lecture / assessment connection |
| --- | --- | --- |
| 1. Facts and Queries | Extend sound-routing facts; distinguish a known atom from an unknown variable; query either argument. | Lecture pp. 6–22; Quiz 4 P4(a,d). |
| 2. Terms and Unification | Build a nested audio-format pattern requiring two fields to agree, while allowing names to differ and missing fields to be discovered. | Lecture pp. 24–41; F22 Q20; F24 P7(A.2). |
| 3. Joined Rules | Repair a disconnected clip/device compatibility join; distinguish complete-format matching from rate-only matching. | Lecture pp. 7–12, 20–23; S23 P5 component skill. |
| 4. Proof Order and Backtracking | Trace a failed pack-membership branch and three ordered proofs; repair a two-link rule without losing duplicate answers. | Lecture pp. 20–23, 42; Quiz 4 P4(b–d); F23 P8(b). |
| 5. Ground Negation | Join a demo to its slot, then apply distinct slot-closure and cancellation checks; explain why reversing generation and negation fails. | Lecture pp. 16–19; F23 P8(c). Ground non-unifiability is explained before later use. |
| 6. Recursive Relations | Complete an edge-first path relation and join it to a program-track target; reject wrong directions, unrelated branches, and zero-edge paths. | Lecture pp. 13–14, 42–44; S23 P5. |
| 7. List Patterns | Decompose a structured badge; extract two elements or the tail after two elements, including nested values and short-list boundaries. | Lecture pp. 46–49; F22 Q22; F23 P8(a). |
| 8. Recursive List Construction | Trace a worked frame-building relation, then double each input position by connecting output tails. | Lecture pp. 48, 50–54; F23 P8(a); F24 P7(C) component skill. |
| 9. Removal and Extra Answers | Choose every eligible reward position, issue its compound ticket, and retain the corresponding queue; distinguish equal results from distinct proofs. | Lecture pp. 22, 42, 51–54; F23 recursive-output/proof reasoning. |
| 10. Adjacent Runs | Design four disjoint list cases for a media-player log; preserve a later replay after another track. | Lecture pp. 47–54; Quiz 4 P5. |
| 11. Accumulator State | Expand a reversal query with an already-ground wrong output into two pending goals; then trace and repair a nested accumulator, including a caller-supplied suffix. | Lecture pp. 42, 48–55; F24 P7(A–B). |
| 12. Uneven Interleaving | Independently combine two queues, preserving either remainder and avoiding duplicate both-empty proofs. | Lecture pp. 47–54; F24 P7(C). |
| 13. Last Occurrences | Independently retain recent searches by suffix membership and ground negation; distinguish this policy from adjacent-run compression. | Lecture pp. 16–19, 48–55; F23 P8(c). |
| 14. Open Route Challenge | Independently combine reachability, ground exclusions, and constructed route lists; trace a rejected branch and explain finite search. | Lecture pp. 9–10, 16–23, 42–44, 48–54; integration toward S23 P5 and F24 P7. |

The selected-response checks target Apply, Analyze, and Evaluate. Genuine creation occurs in the editor when learners design clauses from a contract, especially steps 12–14. Five Parsons questions reconstruct a specified execution sequence; they avoid treating logically interchangeable clause orders as one arbitrary correct ordering. Other activities include prediction, handwritten goal/binding traces, code repair, faded completion, independent programming, and counterexample selection.

## Different examples, transferable mechanisms

Novelty was checked against the actual handout, rather than obtained by renaming the lecture's people. The early sequence uses sound routes, nested two-field formats, complete-format device capabilities, and shared audio-pack contents with interleaved fact order. Later examples change the decision and representation as well as the nouns: two separate exclusion domains, reachability filtered by a target relation, compound records within lists, per-element framing and duplication, and eligible-position selection returning a ticket plus a residual queue.

The final route task adds open-checkpoint filtering and a constructed path output. It does not merely rename the lecture's ancestor relation. Adjacent compression, accumulator reversal, interleaving, and last-occurrence retention intentionally preserve **assessment task families**. Their taught mechanisms transfer to the exams; students still have to reason about unfamiliar data and contracts. These are not claims that the underlying algorithms are novel.

## Prerequisite and correctness boundaries

- Ground negation is explicitly taught before use. `not(Goal)` means failure to find a proof under finite search, not generation of the complement of a relation.
- `\=` appears in the assessments; step 5 explains “cannot unify now” and its safe ground-atom use. It is not treated as a deferred inequality constraint.
- No cut, arithmetic evaluation, constraint solving, cyclic graph search, Haskell translation, or answer-collection syntax is required. `findall/3`, `sort/2`, and identity checks inside test commands belong to the harness, not student prerequisites.
- Accumulators are introduced through an explicit invariant and call-state table. The exam supplies a Haskell algorithm, but this tutorial derives the same reasoning from already taught recursion and list construction.
- Every exercise states its relevant input mode and boundaries. Graph exercises use finite acyclic facts; list tasks use finite proper lists, with ground atoms where negation/inequality requires them. The route task requires a known open starting point and checks every entered checkpoint.
- The lecture's unrestricted deletion clauses can produce an unchanged answer. The reward task deliberately exposes that flaw, then requires exactly one eligible position to be claimed.
- Both unrestricted empty-side interleaving clauses match two empty inputs. Step 12 explicitly requires one proof and teaches disjoint cases; it does not quietly reject the lecture/exam skeleton without explanation.
- Step 13 supplies `contains_once/2` with disjoint ground cases. It avoids multiplying proof counts for repeated values, and explicitly disclaims enumeration with an unbound item. Last-occurrence output order is not sorting or first-occurrence order.
- Head unification is only the beginning of a proof. The worked reversal trace demonstrates a later subgoal failing even though the recursive head initially matches the proposed output.

## Feedback, pacing, and saved work

The planning estimate is 100–120 minutes for a prepared refresher audience, divided into steps 1–4, 5–9, and 10–14. This is not measured completion time; students needing more recursive-tracing practice may take longer. Numbered navigation, code checks, and knowledge checks are optional, allowing review of a particular exam skill. Worked examples fade into partial programs and finally contract-only tasks. Every behavioral check has three graduated hints, and model programs are separate instructor reveals.

Checks enforce the declared behavior, not exact source spelling. Order and proof counts are tested when the task requires them; otherwise checks compare complete distinct outputs. Alternatives with helper predicates, equivalent patterns, or different body order are accepted where they satisfy the contract. Specific near-miss implementations test for overly permissive grading.

`progress_version: 2`, new `v2-*` lesson keys, and new `prolog-v2/` file paths prevent old Foundations code or completion marks from being mistaken for new work. The eight old positional steps map to retired legacy keys. Existing saved files remain available, but old pass credit does not unlock or mark the replacement lessons complete. No new storage family or runtime feature is introduced.

Passing automated checks is formative evidence, not proof of durable learning or exam readiness. Predictions and written explanations remain learner activities rather than automatically graded reasoning. The final instructions ask learners to reconstruct a relation later from a blank file and then attempt a past-paper problem independently.

## Verification

The existing locally pinned Tau Prolog worker executes the authored programs. This is compatibility with the exercised course features, not a claim of complete SWI-Prolog support. Inference exhaustion and output limits are incomplete execution, never evidence that a goal is false.

- `scripts/tests/prolog-worker.test.js`: language/runtime behavior.
- `scripts/tests/prolog-course-content.test.js`: every intended solution and incomplete starter in both Prolog tutorials, plus independent correct approaches and wrong-program counterexamples.
- `tests/prolog-tutorial.spec.js`: all editor checks and knowledge checks, optional main-path navigation, unchanged extension gates, accessible keyboard interaction for Parsons, and legacy-draft migration without inherited pass credit.
- `scripts/audit_mcq_tells.py`: answer-length and formatting clues, supplemented by manual key, misconception-feedback, and prerequisites review.

Browser verification uses an isolated build with committed runtime files, so concurrent unrelated runtime edits cannot conceal a dependency. Validation results belong in the change handoff; the checks listed here describe their purpose rather than guaranteeing future revisions.
