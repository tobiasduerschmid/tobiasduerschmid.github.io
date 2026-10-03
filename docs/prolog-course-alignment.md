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

The main path does not require homework-only material. `_data/tutorials/prolog-search.yml` retains its exercises from the earlier September source review, with additional arithmetic, answer collection, and search material. Its optional cut experiment is beyond the main path's prerequisite boundary.

### October 2 assessment recheck

Rechecked the current tutorial against the newly supplied `Past Exams-20261003T023506Z-1-001.zip` and `Quizzes-20261003T023508Z-1-001.zip`. Screened all 22 exam PDFs (414 physical pages), the two exam DOCX copies, and all 14 quiz DOCX files. Read the relevant questions and supplied keys; visually inspected the issued exam pages listed below. DOCX locators use problem/subpart labels, not inferred page numbers. Originals and extracted text remain outside the repository; document directions remain source evidence only.

**Judgment:** the main tutorial is already good preparation in content and task demand. Its independent list and route construction is often less scaffolded than the exam blanks. The clearest remaining gaps were naming an already-taught process and combining taught components in unfamiliar, unaided traces. This is an alignment judgment, not evidence of measured learning gains or a guarantee of exam performance.

| Supplied assessment locator | Required reasoning | Main tutorial coverage and action |
| --- | --- | --- |
| Fall 25 `CS131 Fall 25 Quiz 4 final.docx` and `CS131 Fall 25 Quiz 4 (with solutions).docx`, P4(a–d) | Atom versus variable; reverse queries; complete ordered direct-then-two-hop answers with duplicates; first two answers with both arguments unknown. | Steps 1–4 cover components. Added a paper-first mixed-clause rehearsal after step 14's independent task, with all three query modes and proof explanations. |
| Same Quiz 4 forms, P5 “Cut It Out!” | Construct empty, singleton, equal-neighbor, and different-neighbor cases to remove adjacent repeats. | Step 10 already practices independent construction and separated replays. No cut operator is needed despite the question title. |
| F22 `[Final] F22 (Public).pdf`, p. 10 Q20; p. 11 Q21–22 | Respect pre-existing substitutions, distinguish unification from resolution, recognize list prepending. | Steps 2–4 and 7–8 teach the mechanisms. Added an explicit resolution explanation and a discrimination question in step 4; previously the name occurred only in author metadata. |
| S23 `[Final] S23 V1 (Public).pdf` and V2, p. 11 P5 (answer space p. 12) | Construct transitive prerequisites and join them to a required-course relation. | Step 6 directly integrates both relations; step 14 independently combines reachability with filtering and an output path. No extra lesson needed. |
| F23 `[Final] F23 (Public).pdf`, pp. 22–23 P8(a), p. 23 P8(b), p. 24 P8(c); matching DOCX copy | Read an unfamiliar recursive filter in different query modes; enumerate ordered join answers; complete nonconsecutive duplicate removal. | Steps 4–5, 7–8, and 13 cover components. Added a recursive-record trace with both known and unknown selectors to the final rehearsal. Step 13 already constructs last-occurrence retention independently. |
| F24 `[Final] F24 V1 (Public).pdf` and V2, p. 23 P7(A), p. 24 P7(B), p. 25 P7(C) | Write one expansion's bindings and pending goals, translate accumulator logic, construct unequal-length interleaving. | Steps 11–12 already target all three. Step 11's wrong proposed output exposes head-match versus proof success. Haskell notation in the exam remains a separate course prerequisite; this tutorial teaches the accumulator invariant without assuming Haskell. |

No additional Prolog questions were found in the supplied midterms, F22 final-practice handout, Fall 25 Quizzes 1–3, or Fall 26 Quiz 1. The two exam DOCX files repeat the corresponding final-exam task families. V1/V2 and solution copies are variants, not independent evidence of additional topic coverage.

The F24 solutions' pp. 36–37 deletion appendix is absent from both issued exam versions. Its key also omits the unchanged-list answer allowed by its empty-success and unrestricted skip clauses. Step 9 already handles that semantic flaw correctly. F23 P8(c) allows any result order in its prose, although the supplied skeleton retains last occurrences; the tutorial deliberately states and checks its stricter order contract. Likewise, step 12 explicitly teaches why its one-proof requirement is stronger than the exam's overlapping empty-side cases. These differences are explained practice choices, not errors in a learner solution that meets a looser exam contract.

The revision follows **backward design** (match practice to the assessed reasoning), **retrieval practice** (write an answer before execution or feedback), and **interleaving** (combine clause order, bindings, and list patterns after component practice). The final record-filter probe changes the representation and output projection rather than merely renaming the exam's atoms. It also includes an unbound-selector failure that reuses step 5's taught inequality rule. Reveals explain the first failed match or goal and direct a retry; they do not reveal the route-program solution.

The core 14 steps, lesson keys, file paths, and programming contracts remain unchanged. The extra mixed rehearsal is optional and explicitly budgeted at 8–12 additional minutes, an unmeasured planning estimate. Existing saved programming work and completion remain meaningful; no runtime or persistence change is needed. Existing quiz credit does not imply that a returning learner attempted the newly added item or rehearsal.

### October 2 research-informed revision

The additional source is the user-supplied **Learning and teaching Prolog: misconceptions, evidence, and tutorials**, searched 2 October 2026 (`prolog-learning-literature-review.md`). The actual 94-page `logic_palooza_v6_handouts.pdf` was inspected again, including visual checks of physical pp. 42, 44, and 56. Document instructions remain source material, not agent instructions.

The review is a focused narrative synthesis, not a meta-analysis or validated concept inventory. Many foundational papers were inspected only through abstracts; classroom accounts, student preferences, and tool usability are not causal evidence of learning gains. The activities below are our instructional adaptations of the review and lecture, not reproductions of published experimental instruments.

| Source finding or teaching rationale | Concrete revision | Evidence learners produce |
| --- | --- | --- |
| The review distinguishes relational meaning from execution, drawing on Fung et al. (1990) and later teaching proposals. | Main step 1 names the two readings; step 6 contrasts a valid reachability decomposition with an unproductive search order. | Separate statements about valid answers, answer order, and termination. |
| Unification and scope need component practice before large traces; lecture pp. 24–41 use substitutions and existing bindings. | Main step 2 contrasts fresh uses of a pattern fact, a shared query variable, and an alias followed by a conflicting nested binding. | Predict bindings or the first conflict, then transfer to `unwrap/2` in a quiz. |
| The review's Duncan account reports task-sensitive control-flow errors; Mulholland's small tracer comparison motivates purposeful tracing, not a claim that any graphic improves learning. | Main step 4 adds a three-goal late failure and a pending-goals/bindings/alternatives worksheet; a neutral `p/1`–`q/2` quiz tests the same search rule. | Identify the nearest remaining alternative, the binding undone, and the earlier binding retained. |
| Concrete names can support entry but also supply misleading domain expectations (review's Höök and Yang/Joy discussions). | Preserve the sound/catalog examples, then use neutral predicate names for transfer; explicitly distinguish recursion from backtracking in step 6. | Explain the answer stream from clauses rather than from predicate names or an imperative loop analogy. |
| Lecture p. 56 connects list notation to nested structure; the review recommends varying query modes. | Main step 7 connects native list spellings and contrasts improper/nested lists; step 8 queries a known framed output for its input. | Structural predictions, finite reverse-mode answers, and a failing output-pattern counterexample. |
| Equality, arithmetic, negation, and cut have different operational contracts; these are semantic teaching targets, not established prevalence rankings. | Main step 5 limits negative conclusions to the database; extension step 3 contrasts `=`, `==`, `is`, and `=:=`; extension step 9 compares ground and generating calls before cut. | Operator selection with reasons, instantiation-error diagnosis, and identification of answers pruned in a particular mode. |
| Retrieval and explanation should supplement successful execution; the review does not establish a universally best Prolog teaching sequence. | Main step 14 supplies next-day/later-week recall, independent reconstruction, and unfamiliar trace prompts. | Explanations and counterexamples after a delay, without viewing the model first. |

The four requested project skills guided sequencing, faded support, explicit contracts, and shuffle-safe feedback. Research references are retained in this author-facing map so student instructions stay focused. The review's central primary-source leads include [Fung et al.](https://doi.org/10.1007/BF00116443), [Höök et al.](https://doi.org/10.1007/BF00116444), and [Mulholland](https://www.ppig.org/files/1995-PPIG-7th-Mulholland.pdf); their access and study limitations remain those recorded in the supplied review. Language semantics were cross-checked against [Reading Prolog Programs](https://www.metalevel.at/prolog/reading) and the official SWI-Prolog entries for [term identity](https://www.swi-prolog.org/pldoc/man?predicate=%3D%3D/2), [arithmetic evaluation](https://www.swi-prolog.org/pldoc/man?predicate=is/2), and the extension's linked integer-constraint documentation. Executable probes are also checked against the pinned Tau worker.

## Learning sequence and evidence

| Step | Learner evidence | Lecture / assessment connection |
| --- | --- | --- |
| 1. Facts and Queries | Extend sound-routing facts; distinguish a known atom from an unknown variable; query either argument. | Lecture pp. 6–22; Quiz 4 P4(a,d). |
| 2. Terms and Unification | Build a nested audio-format pattern requiring two fields to agree, while allowing names to differ and missing fields to be discovered. | Lecture pp. 24–41; F22 Q20; F24 P7(A.2). |
| 3. Joined Rules | Repair a disconnected clip/device compatibility join; distinguish complete-format matching from rate-only matching. | Lecture pp. 7–12, 20–23; S23 P5 component skill. |
| 4. Proof Order and Backtracking | Distinguish unification from resolution; trace a failed pack-membership branch and three ordered proofs; repair a two-link rule without losing duplicate answers. | Lecture pp. 20–23, 42; F22 Q21; Quiz 4 P4(b–d); F23 P8(b). |
| 5. Ground Negation | Join a demo to its slot, then apply distinct slot-closure and cancellation checks; explain why reversing generation and negation fails. | Lecture pp. 16–19; F23 P8(c). Ground non-unifiability is explained before later use. |
| 6. Recursive Relations | Complete an edge-first path relation and join it to a program-track target; reject wrong directions, unrelated branches, and zero-edge paths. | Lecture pp. 13–14, 42–44; S23 P5. |
| 7. List Patterns | Decompose a structured badge; extract two elements or the tail after two elements, including nested values and short-list boundaries. | Lecture pp. 46–49; F22 Q22; F23 P8(a). |
| 8. Recursive List Construction | Trace a worked frame-building relation, then double each input position by connecting output tails. | Lecture pp. 48, 50–54; F23 P8(a); F24 P7(C) component skill. |
| 9. Removal and Extra Answers | Choose every eligible reward position, issue its compound ticket, and retain the corresponding queue; distinguish equal results from distinct proofs. | Lecture pp. 22, 42, 51–54; F23 recursive-output/proof reasoning. |
| 10. Adjacent Runs | Design four disjoint list cases for a media-player log; preserve a later replay after another track. | Lecture pp. 47–54; Quiz 4 P5. |
| 11. Accumulator State | Expand a reversal query with an already-ground wrong output into two pending goals; then trace and repair a nested accumulator, including a caller-supplied suffix. | Lecture pp. 42, 48–55; F24 P7(A–B). |
| 12. Uneven Interleaving | Independently combine two queues, preserving either remainder and avoiding duplicate both-empty proofs. | Lecture pp. 47–54; F24 P7(C). |
| 13. Last Occurrences | Independently retain recent searches by suffix membership and ground negation; distinguish this policy from adjacent-run compression. | Lecture pp. 16–19, 48–55; F23 P8(c). |
| 14. Open Route Challenge | Independently combine reachability, ground exclusions, and constructed route lists; trace a rejected branch and explain finite search. Optional paper rehearsal mixes multiple clauses, ordered duplicates, and recursive-record query modes. | Lecture pp. 9–10, 16–23, 42–44, 48–54; integration toward S23 P5 and F24 P7; mixed tracing for Quiz 4 P4 and F23 P8(a–b). |

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
- The lecture's p. 56 `cons/2` and `nil` notation is a pedagogical alternate encoding, not executable synonyms for native Prolog lists. The tutorial uses `[a,b] = [a|[b|[]]]`; unifying the native list with `cons(a,cons(b,nil))` fails.
- The lecture's p. 44 repair progresses backward through a parent edge before recursion; the tutorial's model progresses forward. Both respect the finite acyclic contract. Do not imply the tutorial copies that slide's exact clause.
- Integer constraints are optional external reading in the extension, explicitly outside Tau's available libraries and all exercise checks. Fair search, tabling, and constraints are not silently added as course prerequisites.

## Feedback, pacing, and saved work

The planning estimate is 100–120 minutes for a prepared refresher audience, divided into steps 1–4, 5–9, and 10–14. This is not measured completion time; students needing more recursive-tracing practice may take longer. Numbered navigation, code checks, and knowledge checks are optional, allowing review of a particular exam skill. Worked examples fade into partial programs and finally contract-only tasks. Every behavioral check has three graduated hints, and model programs are separate instructor reveals.

Checks enforce the declared behavior, not exact source spelling. Order and proof counts are tested when the task requires them; otherwise checks compare complete distinct outputs. Alternatives with helper predicates, equivalent patterns, or different body order are accepted where they satisfy the contract. Specific near-miss implementations test for overly permissive grading.

`progress_version: 2`, new `v2-*` lesson keys, and new `prolog-v2/` file paths prevent old Foundations code or completion marks from being mistaken for new work. The eight old positional steps map to retired legacy keys. Existing saved files remain available, but old pass credit does not unlock or mark the replacement lessons complete. No new storage family or runtime feature is introduced.

The October 2 revision preserves that lesson order, those keys and file paths, the model programs, and the exercise contracts. Existing drafts and completion records remain meaningful. Main-path checks remain optional; the separate extension keeps its established gates. New predictions are short component probes, with the broader arithmetic reading and cut investigation kept optional. Timing remains an unmeasured planning estimate; delayed retrieval is a separate study session.

Passing automated checks is formative evidence, not proof of durable learning or exam readiness. Predictions and written explanations remain learner activities rather than automatically graded reasoning. The final instructions ask learners to reconstruct a relation later from a blank file and then attempt a past-paper problem independently.

## Verification

The existing locally pinned Tau Prolog worker executes the authored programs. This is compatibility with the exercised course features, not a claim of complete SWI-Prolog support. Inference exhaustion and output limits are incomplete execution, never evidence that a goal is false.

- `scripts/tests/prolog-worker.test.js`: language/runtime behavior.
- `scripts/tests/prolog-course-content.test.js`: every intended solution and incomplete starter in both Prolog tutorials, plus independent correct approaches and wrong-program counterexamples.
- `tests/prolog-tutorial.spec.js`: all editor checks and knowledge checks, optional main-path navigation, unchanged extension gates, accessible keyboard interaction for Parsons, and legacy-draft migration without inherited pass credit.
- `scripts/audit_mcq_tells.py`: answer-length and formatting clues, supplemented by manual key, misconception-feedback, and prerequisites review.

Browser verification uses an isolated build destination and server. The scoped accessibility audit also exposed an existing query-field collapse in narrow panes: the debugger toolbar forced controls onto one line. The Prolog-specific CSS now allows wrapping and retains a usable query width in either theme. Activating a Prolog output button dismisses its tooltip so that the hint cannot cover another wrapped control; hover and keyboard help remain available. Print layouts remain governed by the existing print styles. Validation results belong in the change handoff; the checks listed here describe their purpose rather than guaranteeing future revisions.
