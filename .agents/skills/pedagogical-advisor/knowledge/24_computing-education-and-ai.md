# Computing education with and for AI

## Contents

- Start with the capability claim
- Selection rules
- Relevant SIGCSE 2024 and 2025 decisions
- Ready-to-adapt teaching recipes
- Further routines from the supplied literature review
- A course progression for AI-capable software engineering
- Local evaluation and stopping rules
- Reliability checks specific to this chapter

Use for introductory programming, data structures, software engineering, data science, capstones, and teacher preparation in computing. Pair this chapter with `19_genai-in-teaching-and-assessment.md`, `07_practice-memory-and-mastery.md`, and the relevant assessment workflow. Evidence IDs refer to [the CS evidence update](../references/cs-ai-evidence-2026.md) and the [SIGCSE TS 2024](../references/sigcse-2024-evidence.md) and [SIGCSE TS 2025](../references/sigcse-2025-evidence.md) supplements.

## Start with the capability claim

Ask what a student must eventually do **independently**, what they should do **effectively with tools**, and what they must **verify or decide** even when a tool supplies the artifact. These are separable outcomes; do not average them into one vaguely named “AI readiness” score.

| Intended capability | Useful practice | Credible evidence | Common false positive |
|---|---|---|---|
| Understand execution | Predict state, trace an input, compare explanations | Accurate trace and a counterexample on unseen code | Repeating a fluent generated explanation |
| Specify behavior | Write examples, boundary rules, invariants, acceptance criteria | New cases follow from a consistent specification | A prompt happened to produce passing code |
| Build a solution | Decompose, implement, integrate, test | Working artifact plus rationale and a fresh change | Large volume of generated code |
| Debug | Form a hypothesis, isolate a failure, run a discriminating test | Correct diagnosis and minimal justified repair | Repeatedly pasting errors until something passes |
| Evaluate design | Compare alternatives under explicit quality constraints | Evidence-supported tradeoff and consequence analysis | Naming patterns or endorsing the model's architecture |
| Use AI responsibly | Choose role, provide relevant context, verify, document decisions | A consequential error caught and corrected; warranted delegation | A polished transcript or disclosure alone |
| Learn after graduation | Diagnose a knowledge gap, choose help, practice, reassess | Improved performance on a delayed new task | Self-reported confidence or intention |

This matrix is a **design synthesis**. It does not claim that each assessment format has been validated for every course. State the assessed construct and its limits explicitly.

## Selection rules

1. **Novice cannot explain the problem or execution:** model a small example and diagnose prerequisite knowledge before adding an open-ended AI task. A Socratic prompt cannot supply every missing prerequisite.
2. **Novice understands the idea but syntax blocks progress:** consider completion or Parsons support, followed by independent reconstruction. CodeTailor supports testing this approach, but does not establish superior overall posttest scores [CS-AI-006](../references/cs-ai-evidence-2026.md#cs-ai-006).
3. **Student completes work but cannot adapt it:** reduce the size of each delegated step; collect predictions and rationale before revealing a solution; add a new unaided variation [CS-AI-004](../references/cs-ai-evidence-2026.md#cs-ai-004), [CS-AI-007](../references/cs-ai-evidence-2026.md#cs-ai-007).
4. **Student cycles through generated fixes:** teach hypothesis-driven help requests and a human-help escalation route [CS-AI-008](../references/cs-ai-evidence-2026.md#cs-ai-008), [CS-AI-014](../references/cs-ai-evidence-2026.md#cs-ai-014).
5. **Student has strong foundational performance:** permit more substantial delegation where the learning target is design, verification, integration, or professional judgment. Require evidence for the decision, not an arbitrary number of prompts.
6. **Instructor generates materials:** provide verified course context, target misconceptions, allowed constructs, and solutions; check outputs with a stable review sample [CS-AI-009](../references/cs-ai-evidence-2026.md#cs-ai-009), [CS-AI-012](../references/cs-ai-evidence-2026.md#cs-ai-012).
7. **Instructor proposes replacing peer/TA interaction:** account for the collaboration practice and formative support being removed. Availability of automated answers does not establish an equivalent learning environment [CS-AI-002](../references/cs-ai-evidence-2026.md#cs-ai-002), [CS-AI-010](../references/cs-ai-evidence-2026.md#cs-ai-010).

## Relevant SIGCSE 2024 and 2025 decisions

Use earlier findings when they answer the teaching decision. The package covers **five selected SIGCSE TS 2024 papers and seven selected SIGCSE TS 2025 papers**, alongside newer work. These are targeted selections, not complete proceedings coverage. The adaptations below are original teaching proposals; open the linked card before making a study-specific claim.

| Teaching decision | Action and usable deliverable | Evidence and limit |
|---|---|---|
| Students repeatedly paste error messages | Build a debugging card: predicted cause, verified hint, minimal repair, and a fresh unaided diagnosis next class. Track repair attempts separately from later diagnosis. | [SIG24-01](../references/sigcse-2024-evidence.md): contextual messages supported assisted repair; postassignment exclusions weaken causal interpretation. |
| Instructor needs useful code feedback quickly | Produce an issue/next-action/question table, checked against execution and the task; ask students to demonstrate the consequence of a revision. | [SIG24-02](../references/sigcse-2024-evidence.md): expert-rated feedback on 113 submissions; student learning was not established. |
| Course plans an AI assistant | Deliver a held-out question set, correct/checked counts by question category, current course-source references, and a staff escalation path. Evaluate learning separately from satisfaction. | [SIG24-03](../references/sigcse-2024-evidence.md): CS50 deployment and answer audit, not a randomized learning comparison. |
| Proof exercises seem engaging but students cannot explain them | Diagnose prerequisites; combine a worked explanation, partial example, and independent proof variant. Match time and examples when comparing designs. | [SIG24-04](../references/sigcse-2024-evidence.md): practice alone produced the smallest reported gains; abstract-only appraisal limits prescription. |
| TAs use AI to draft feedback | Run the 20-minute keep/edit/reject clinic in the source supplement; require a trace or failing test supporting each retained claim. Sample actual released feedback. | [SIG25-01](../references/sigcse-2025-evidence.md): human review did not reliably remove errors; small help-seeking groups and no independent learning test. |
| AI-permitted database work earns high marks | Produce an assisted strategy comparison and a separate fresh schedule under changed assumptions. Score verification and independent reasoning separately. | [SIG25-02](../references/sigcse-2025-evidence.md): observational assisted-question advantage; other grade differences were nonsignificant. |
| Instructor wants to add distractors to Proof Blocks | Select a real misconception, explain why the distractor fails, and check later proof writing. Remove distraction when prerequisite gaps prevent reasoning. | [SIG25-03](../references/sigcse-2025-evidence.md): no significant learning difference between groups; final abstract and earlier preprint must remain distinguished. |
| Students report being good at AI | Deliver separate confidence questions and an evidence-based accept/revise/reject performance task. Use mismatches for coaching and reassess with a fresh example. | [SIG25-04](../references/sigcse-2025-evidence.md): familiarity/understanding mismatch, abstract-only; no validated cutoff or proven curriculum effect. |

Also retain the earlier cards already present: **Prompt Problems (2024; CS-AI-005)** informs recipe 5 on specification; **computational thinking with LLMs (2025; CS-AI-008)** informs recipes 1 and 3; **programming-feedback generation/judgment (2025; CS-AI-009)** informs recipes 6 and 10; **Code Interviews (2025; CS-AI-010)** informs recipe 8. These four records are counted once, not duplicated in the supplements.

Choose only the rows relevant to the requested task. Use the detailed implementation move in the corresponding supplement and the material-repair, assessment-feedback, or teaching-operations workflow to complete the actual artifact. Never turn faster repair, higher assisted grades, favorable ratings, or a numerical but nonsignificant advantage into a demonstrated learning gain.

## Ready-to-adapt teaching recipes

All timings, scoring choices, task variants, and mastery rules below are **local design defaults**, not published optimal doses. Adjust to diagnostic performance and available time. Grade the intended reasoning or performance; avoid grading obedience to a particular tool or forcing private thought disclosure.

### 1. Predict, test, explain, change

**Use when:** teaching code comprehension, loops, aliasing, recursion, data transformations, or unfamiliar generated code. **Basis:** C for AI-specific adaptation [CS-AI-008](../references/cs-ai-evidence-2026.md#cs-ai-008); learning principles from worked examples and retrieval are broader evidence.

Give a 10–20 line function and a concrete input. Students first predict an output and one intermediate state. They then execute or use a debugger, compare results, and explain the smallest discrepancy. AI may clarify a concept after the prediction but must not replace the learner's initial attempt. Finish with a changed input or requirement completed without AI.

**Instructor deliverables:** tested code, expected trace, two likely misconceptions, one diagnostic distractor, and a transfer variant. **Evidence:** the final unseen trace/change, not agreement with AI. **Failure response:** if predictions are mostly guesses, reduce the code span and demonstrate an execution model.

### 2. One consequential decision before the next code block

**Use when:** students accept full generated solutions without following the algorithm. **Basis:** emerging [CS-AI-007](../references/cs-ai-evidence-2026.md#cs-ai-007), [CS-AI-011](../references/cs-ai-evidence-2026.md#cs-ai-011); superior learning is not established for the complete recipe.

Break a task into two or three subgoals. Before showing the next block, ask a learner to choose or describe the next operation and why it satisfies the subgoal. Provide corrective feedback or a small worked example after an unsuccessful attempt. Reveal the block, relate it to the decision, then fade prompts as competence appears. Accept multiple correct algorithms.

**Example:** for event deduplication, ask what defines identity before proposing a set or dictionary. Ask how preserving order changes the data structure choice. **Evidence:** a later variant with a different duplicate policy. **Failure response:** do not trap learners in indefinite questioning or make them guess the assistant's preferred wording. Increase instruction when prerequisite knowledge is missing. “Slower” means more useful learner thinking, not artificial waiting.

### 3. Personalized completion or Parsons rescue

**Use when:** a learner has a partially valid plan and gets stuck implementing it. **Basis:** emerging AI personalization [CS-AI-006](../references/cs-ai-evidence-2026.md#cs-ai-006); consult the package's traditional Parsons/worked-example evidence separately.

Preserve correct elements of the learner's attempt. Offer a small completion gap or reorder task targeting the specific dependency they missed. Validate that the blocks form a correct solution and permit semantically equivalent orderings. Have the student explain the critical dependency, then solve a short fresh task without the scaffold.

**Evidence:** independent application of the missing concept and overall solution quality reported separately. **Failure response:** if a learner sorts by surface cues without understanding, ask for a counterexample or change an invariant. Do not call puzzle completion proof of programming mastery.

### 4. A useful help request and an escape from the fix loop

**Use when:** labs have repeated “it does not work” requests or students submit AI revisions without diagnosing them. **Basis:** observed help-seeking risks [CS-AI-002](../references/cs-ai-evidence-2026.md#cs-ai-002), [CS-AI-008](../references/cs-ai-evidence-2026.md#cs-ai-008), [CS-AI-014](../references/cs-ai-evidence-2026.md#cs-ai-014).

Teach a short request structure: intended behavior; smallest failing input; expected versus observed result; one hypothesis; relevant code and an attempted check. The tutor supplies one discriminating test or hint. The student records the test result and updates the hypothesis. As a local default, after two unsuccessful model-suggested fixes, pause generation and seek a TA/peer review or inspect official documentation.

**Example:** a generated timestamp parser passes ordinary dates but fails around a time-zone boundary. Ask what assumption would distinguish parsing from conversion errors. **Evidence:** a minimal reproducer and justified fix. **Failure response:** do not require elaborate logs for every syntax typo; match documentation burden to learning value.

### 5. Specification as the assessed product

**Use when:** teaching requirements, natural-language programming, computational thinking, or prompt construction. **Basis:** Prompt Problems experience report [CS-AI-005](../references/cs-ai-evidence-2026.md#cs-ai-005); expansion to requirements engineering is a design extrapolation.

Present a small stakeholder request with one intentional ambiguity. Students ask a clarification, write input/output examples and a boundary rule, then submit a specification. Let AI generate code from it. Students must distinguish a specification defect from an implementation defect and repair the right artifact. Provide withheld cases only after students commit their own cases.

**Example:** “remove duplicate registrations” leaves identity, order, missing values, and conflict resolution undecided. **Evidence:** coherent requirements, discriminating tests, and a revised specification that survives a new case. **Failure response:** passing tests is insufficient if tests encode the same mistaken assumption. Reward justified uncertainty and stakeholder questions, not verbose prompts.

### 6. An AI-generated test suite on trial

**Use when:** teaching testing, quality assurance, and review. **Basis:** design extrapolation from the need for independent verification [CS-AI-009](../references/cs-ai-evidence-2026.md#cs-ai-009), [CS-AI-014](../references/cs-ai-evidence-2026.md#cs-ai-014); this full lesson has not been causally evaluated in those studies.

Supply a function, specification, and generated tests with a plausible blind spot. Before executing, students identify what each test can and cannot establish. Give one seeded fault or altered implementation; ask which tests should detect it. Students improve the suite and justify an oracle independently of the implementation.

**Example:** reservation intervals touching at an endpoint expose an unstated inclusive/exclusive boundary. **Evidence:** a test that fails for the intended fault and passes a corrected implementation, with rationale. **Failure response:** test count and coverage alone are not evidence of adequate fault detection; inspect assertions and oracle quality.

### 7. Architecture review under a changed constraint

**Use when:** teaching software design, scalability, reliability, maintainability, or architecture evolution. **Basis:** original design extrapolation, supported by alignment and transfer principles rather than a direct AI-CS trial.

Students propose two designs for the same requirement, then use AI to critique each. A new constraint arrives: bursty traffic, a regional outage, a tighter cost limit, or a data-consistency requirement. Students choose a revision, name its failure modes, and state what observation would change their choice.

**Evidence:** a decision record with assumptions, alternatives, measurable criteria, and an executable test or defensible analysis. **Failure response:** diagram sophistication and named patterns do not establish quality. Require a scenario walkthrough that connects components to the requirement.

### 8. Explain-and-change interview

**Use when:** verifying understanding after an AI-permitted take-home assignment. **Basis:** design/experience evidence [CS-AI-010](../references/cs-ai-evidence-2026.md#cs-ai-010).

Choose one important decision and a small modification tied to published learning targets. Share format, criteria, sample questions, and allowed resources before submission. In a short meeting, the learner explains the decision, predicts the consequence of the new requirement, and performs or outlines a change. Reserve time for formative feedback separately.

**Evidence:** the student's explanation and adaptation, recorded with a concise rubric. **Access:** provide an equivalent modality or additional time when appropriate; spontaneous spoken English and performance anxiety may be irrelevant to the programming construct. **Failure response:** pilot workload, calibrate TAs on samples, and check which teaching activities interviews displace. A weak interview alone is not proof of misconduct.

### 9. Compare two work processes with evidence

**Use when:** students need to notice how AI changes their planning, debugging, or help seeking. **Basis:** promising reflection design [CS-AI-013](../references/cs-ai-evidence-2026.md#cs-ai-013); no established causal effect on long-term capability.

Students select short work episodes with and without AI and examine screen recordings or another acceptable process record. They identify an observable decision, its consequence, and one change to try next time. They distinguish an observed difference from a claim about its cause. Follow up during a later task to see whether the chosen change was useful.

**Evidence:** grounded comparison and enacted follow-up, scored separately from confidence or intended behavior. **Access/privacy:** allow a timeline or annotated code history when video is unsuitable; avoid recording unrelated people or private information. **Failure response:** different tasks and fixed order confound comparison. Do not tell students that faster work in the second session proves an AI productivity effect.

### 10. Generate a question family from verified course context

**Use when:** preparing practice, quizzes, worked examples, lab variants, or explanations. **Basis:** local technical/material-quality evidence [CS-AI-009](../references/cs-ai-evidence-2026.md#cs-ai-009), [CS-AI-012](../references/cs-ai-evidence-2026.md#cs-ai-012).

Summarize the actual taught content, student prerequisites, allowed APIs, representations, and datasets. Verify this summary before generation. Request a small family varying one relevant feature: direct application, misconception diagnosis, and transfer. Require a solution, reasoning target, likely wrong answers with explanations, and estimated completion burden.

**Review:** solve/run the materials; check correctness, relevance to the current course, instructional coherence, and accessibility. Keep accepted and rejected examples to evaluate later prompt changes using the same criteria. **Failure response:** reject invented prerequisites, new datasets that add irrelevant burden, leaked answers, and distractors that are accidentally defensible. Generated content quality is not yet evidence that students learn better from it.

## Further routines from the supplied literature review

For help escalation, student explanations to an agent, peer/AI roles, implementation problems, or an adoption decision, use `procedures/20_ai-learning-support-and-pilots.md`. It supplies five selectable routines with prompts, examples, expected answers, and failure responses. The source map is `references/literature-review-crosswalk.md`; these are original teaching adaptations.

| Decision | Evidence to consult | What changes in the advice |
|---|---|---|
| Improve flipped-class preparation | LR-CS-01 in `references/cs-review-evidence-2026.md` | Pair preclass feedback with an independent application; assessment independence in the study remains unverified. |
| Use students as teachers of an AI | LR-CS-02 in the same file | Evaluate explanation and program correctness separately; protect a fresh reconstruction task. |
| Replace human partners or tutoring with AI | LR-CS-03–05 in the same file | Preserve peer explanation and assess the actual support function. Small comparisons and conflicting reports cannot settle a universal ranking. |
| Introduce a database agent | LR-CS-06 in the same file | Separate assisted reports/code from independent SQL/design checks; compare class and instructor conditions. |
| Claim hints or faster completion establish learning | LR-R-01–02 in `references/review-reliability-2026.md` | Check later capability and adapt help to the obstacle; neither answer withholding nor better help behavior is sufficient. |
| Forecast gains from a meta-analysis | LR-R-03–04 in the same file | Check heterogeneity, bias sensitivity, overlap, and publication status; exclude the identified retracted estimate. |

## A course progression for AI-capable software engineering

This is an adaptable curriculum design, not an empirically established universal sequence.

| Stage | Student responsibility | AI role | Minimum evidence before increasing delegation |
|---|---|---|---|
| Foundations | Read, trace, construct small functions, explain assumptions | Optional concept hints and worked examples | Accurate independent reasoning on representative new tasks |
| Assisted implementation | Define behavior and decompose the task | Suggest bounded code or alternatives | Student detects defects and changes code for a new case |
| Verification | Choose tests, oracles, and review criteria | Draft tests, counterexamples, critique | A consequential defect caught with independent evidence |
| Design and evolution | Own quality constraints, architecture, migration decisions | Generate alternatives and challenge assumptions | Defended tradeoff and response to a changed constraint |
| Professional practice | Decide what to delegate, maintain, communicate, and escalate | Scoped collaborator under human responsibility | Working artifact, evidence of quality, clear limits, and capability to recover from failure |

Do not delay all authentic work until perfect fundamentals. Use a small project to create purpose, teach the necessary foundations, then widen the task. Do not eliminate foundational practice merely because a model can produce code: judging and repairing generated software also require knowledge.

## Local evaluation and stopping rules

For a proposed AI intervention, provide a minimal evaluation card:

- **Question:** which capability should improve, for which learners, relative to which existing activity?
- **Comparison:** equal or reported instructional time, comparable content, and explicit AI access during practice and evaluation. If allocation is not random, describe confounding rather than making causal claims.
- **Measures:** assisted task quality; immediate independent performance; a delayed fresh problem when retention matters; burden; help access; and confidence calibration. Use only measures needed for the decision.
- **Analysis:** separate prior-knowledge groups where appropriate, report missingness and uncertainty, and avoid causal interpretation of voluntary usage correlations.
- **Decision:** retain, adapt, or stop based on a practical criterion defined beforehand. If assisted products improve but independent performance worsens, redesign the cognitive work and scaffolds before expanding.
- **Versioning:** record tool/model, course context, intervention prompts, and grading rubric. Recheck when the tool or course changes.

Simulated students, an agent panel, or AI-generated exam answers can reveal ambiguities and plausible failure modes. They cannot estimate real student learning gains, validate grade fairness, or substitute for an actual learner pilot.

## Reliability checks specific to this chapter

Before delivery, check that the response has not: turned CodeAid/CodeHelp adoption into a learning effect; turned the CodeTailor support-reuse outcome into superior total test performance; described Lead-and-Reveal as proven to increase learning; treated Pacing for Mastery's abstract as fully appraised evidence; called a prompt recipe universally optimal; mistaken model output quality for pedagogical effectiveness; claimed to make assessments permanently AI-proof; or made CS1 lab findings stand in for professional architecture expertise.
