# AI learning support and classroom pilots

## Choose one useful routine

Use when an educator asks how students should seek AI help, explain to an agent, collaborate with peers, or evaluate a teaching change. These are **original design syntheses**, not validated packages. Timings and rubrics are adjustable planning choices. Select the routine that addresses the observed difficulty; do not make every learner complete every step.

The supplied literature review motivates these routines. `LR[n]` identifies its numbered secondary report, not a newly verified primary study. Consult the [review crosswalk](../references/literature-review-crosswalk.md), [additional evidence cards](../references/cs-review-evidence-2026.md), and [reliability checks](../references/review-reliability-2026.md) for verified mappings, access limits, and corrections before making empirical claims. The routines complement [computing education](../knowledge/24_computing-education-and-ai.md), [learning safeguards](../knowledge/25_ai-literacy-and-learning-safeguards.md), and [curriculum/coaching](../procedures/19_ai-era-curriculum-and-coaching.md).

| Observed need | Select | Produce |
|---|---|---|
| Repeated generated patches or helpless questioning | 1. Diagnose, escalate, fade | Help card and fresh independent check |
| Fluent explanations without causal understanding | 2. Teach and challenge | Explanation, counterexample, reconstruction |
| AI use displaces peer reasoning | 3. Preserve collaboration | Role card, shared decision, individual evidence |
| Intended tutor behavior differs from actual use | 4. Check implementation | Observed failure/action log and revised activity |
| Instructor must keep, revise, or expand an intervention | 5. Evaluate a pilot | Comparison plan and outcome-specific decision |

## 1. Diagnose help needs, then escalate or fade

**Use:** Office hours, introductory labs, asynchronous study, and repeated debugging failures. Review leads: LR[9,10,11,22,32]; see LR-R-02 for the checked help-seeking synthesis. Do not assume identical help needs or infer low motivation from an incomplete attempt.

Ask for the smallest useful evidence: intended behavior, current attempt or obstacle, observed result, and one hypothesis. Choose the next move from that evidence:

| Learner evidence | Tutor/instructor move | Learner response that determines the next move |
|---|---|---|
| Cannot interpret the task or trace a simpler example | Explain the missing prerequisite with a verified miniature example | Complete one consequential step in a parallel example |
| Understands execution but cannot locate a fault | Give one discriminating input or state-inspection question | Predict and inspect the relevant state |
| Diagnoses the fault but cannot implement a repair | Show a partial repair or smaller analogous solution | Complete the repair and justify the changed step |
| Repairs successfully but cannot explain why | Request a trace or counterexample to the old version | Connect the repair to behavior rather than paraphrasing code |
| Explains and adapts successfully | Remove that scaffold for a fresh task | Demonstrate the same capability on new material |

**Student help card:** “I am trying to __. I expect __ on input __, but observe __. My current explanation is __. Help me choose one check that distinguishes this explanation from another possibility. If I am missing a prerequisite, show a small example first.” Allow a brief verbal version; writing the card must not become a barrier to help.

**Worked diagnostic:** A first-occurrence binary search returns index 2 for `[1,2,2,2,4]`, target `2`. Correct result: index 1. Ask: “After finding a match, what evidence rules out an earlier match?” A valid repair continues searching left; immediate return on equality does not establish first occurrence. Check empty input → `-1`, missing target → `-1`, and `[2,2]`, target `2` → `0`. Verify the actual implementation separately; these cases are illustrative, not a complete correctness proof.

**Failure response:** If hints repeat without changing the learner's reasoning, switch to direct explanation or human help. If the assistant supplied the answer, shorten reconstruction to the essential decision and use a new case. Do not impose an arbitrary minimum struggle time or require the student to exhaust every hint. Output a brief explanation of the obstacle, the selected support, and the observable condition for fading it.

## 2. Have the student teach an agent, then test the explanation

**Use:** Algorithms, recursion, proofs, or other topics with explainable decisions. Review leads LR[17,42] motivate distinguishing explanatory dialogue from independently demonstrated mastery; see primary card LR-CS-02 for LR[17]. A simulated confused learner is a rehearsal device; its agreement does not validate an explanation.

Prepare a verified answer outline and a few questions about the target concept. Give the student a small example. The agent asks for reasons, examples, and correction of a bounded misconception; it must not silently write the explanation for the student.

**Agent prompt:** “Act as a learner asking about this concept: __. Ask one question about a consequential decision in my explanation. Request a concrete example when a claim is unclear. Do not certify correctness from fluency or agreement. Flag unresolved claims for checking against the supplied course key. If I cannot begin, offer one example, then ask me to explain a related step.”

**Example:** Teach a backtracking algorithm that enumerates subsets of `[2,5]`. Explain the choice at each position, the stopping condition, and how choices are undone. Correct subsets, ignoring order, are `[]`, `[2]`, `[5]`, `[2,5]`.

**Instructor criteria:** The explanation accounts for both include/exclude choices; processes each input position once along a branch; emits a result at a complete decision sequence; restores state before exploring an alternative when using mutable state; and stores a copy when later mutation would otherwise change recorded results. An immutable implementation can satisfy the same reasoning without an explicit undo operation. Do not penalize a correct alternative representation.

**Student output:** Explain one branch, answer “What would go wrong if recorded subsets all referenced the same mutable list?”, and close the agent before tracing an unfamiliar small input. Expected answer: subsequent mutations could alter multiple recorded results together; copying or using immutable values prevents that aliasing problem.

**Failure response:** If the conversation rewards verbosity, replace it with a diagram, annotated trace, or concise written explanation. If the agent invents a misconception or endorses an error, correct it using the key. Preserve time for independent reconstruction; a long transcript alone is not learning evidence.

## 3. Preserve peer learning in an AI-supported lab

**Use:** Pair programming, testing, design review, and group projects where explaining to another person is an outcome. Review leads LR[19,20,24]; primary cards LR-CS-03–05. Select AI's role based on the instructional purpose; do not treat tool speed as proof that it can replace the social or conceptual functions of a partner.

**Student role card:** “First, each person proposes an approach or predicts a result. One partner explains a consequential decision; the other challenges it with a case or constraint. Then use AI for one unresolved question or candidate alternative. Together accept, reject, or revise its suggestion using independent evidence. Exchange roles at the next consequential decision.” Roles need not rotate on a timer or after every line of code.

**Testing example:** A reservation system permits nonempty half-open intervals `[start,end)`, with `start < end`; it rejects invalid intervals before overlap checking. Two bookings conflict when `startA < endB` and `startB < endA`. Partners first decide whether `[9,10)` and `[10,11)` overlap. Correct answer: no. Ask AI to generate candidate boundary tests, then have the peer challenge each expected result against the specification. A generated test that expects rejection solely because endpoints touch has the wrong oracle.

**Outputs:** One shared test with its expected result and rationale; one consequential accepted/rejected AI suggestion; and an individual answer to a changed interval case. Score collaborative explanation separately when it is an explicit objective. The individual check evaluates understanding, not who typed the shared solution.

**Failure response:** If one student monopolizes the tool, have both make a prediction before the next query and change who explains. If social friction or access limits participation, offer equivalent paired review or written exchange. For an isolated learner, AI can rehearse objections, but arrange real peer or staff feedback where human collaboration remains a course objective.

## 4. Check whether the intervention actually happened

**Use:** A course tutor, feedback assistant, or structured AI exercise is being introduced or revised. Review leads LR[10,11,21,25,41]. Extend the existing feedback audit by inspecting actual student interactions and time allocation, not just intended prompts.

Before class, define three observable requirements: the assistance students may receive, the cognitive action students should perform, and the independent evidence the activity must leave time to collect. Provide a verified fallback when access or correctness fails.

During a small pilot, sample representative episodes with minimal necessary data. Record:

| Intended behavior | Observation to inspect | Response if it fails |
|---|---|---|
| Diagnostic help addresses the current misconception | Correctness, relevance, and student's next action | Correct the advice; narrow context or escalate |
| Students examine suggestions before accepting them | Prediction, trace, test, or justified decision | Model verification and reduce delegation scope |
| Learners can obtain useful help | Access failures, language/format obstacles, unresolved questions | Supply an equivalent resource or human route |
| Practice leaves time for independent work | Actual minutes remaining and checkpoint completion | Shorten the conversation or puzzle; protect the checkpoint |

**Instructor prompt:** “Inspect these anonymized episodes against the intended behavior. Separate directly observed action from inferred understanding. For each consequential failure, supply the smallest activity or support change and the evidence that would show improvement.”

Deliver a compact **failure → proposed repair → next observation** log. Recheck affected cases after a model, prompt, retrieval-source, or interface change. If students miss the post-task because the activity consumes the session, report the learning outcome as unmeasured. Greater engagement or longer time cannot fill that evidence gap. Simulated episodes can expose possible failures; they cannot establish real learner uptake.

## 5. Evaluate a local pilot and decide what to change

**Use:** A decision to retain, revise, expand, or stop one teaching use. Review leads LR[6,7,12–20] motivate separating outcomes; read their verified cards before discussing particular results, including LR-R-01 for LR[7].

Write the comparison before collecting outcomes: “For __ learners learning __, compare __ with the feasible current alternative __. The primary outcome is __ at __ time.” Name whether the change tests the whole instructional package or one ingredient. Match or report content, time, staff support, prerequisites, and permitted tools. Voluntary users versus nonusers generally cannot establish the effect of AI access.

Choose only measures needed for the decision:

| Measure | Example and interpretation |
|---|---|
| Relevant baseline | Short prerequisite trace; describes starting differences |
| Assisted performance | Correct repaired program while tools are available |
| Immediate independent outcome | New diagnosis and justified repair after assistance closes |
| Delayed retention | Comparable fresh case at a specified later class |
| Transfer | Changed requirement or representation demanding adaptation |
| Implementation and burden | Uptake, missing work, access failures, student/staff time |

A week is a feasible example delay, not an optimal interval. A fresh item is not automatically transfer; state what underlying demand changes. Preserve necessary accessibility support and distinguish it from the assistance under evaluation. Use checked parallel tasks and common scoring criteria, blind to condition when feasible.

**Example scoring criteria:** Correct diagnosis; evidence supporting the cause; repair consistent with the specification; justified behavior on a new case. Report the dimensions needed for the learning claim, rather than averaging everything into “AI readiness.”

**Decision rules:** Better assisted work with uncertain independent results supports a claim about assisted performance only. Lower delayed scores than an earlier assisted peak do not establish lower retained skill than the comparison group. Missing assessments require reporting missingness, not treating absence as zero or silently dropping learners. A small nonsignificant difference does not establish equivalence. Inspect baseline imbalance, unequal time, crossover use, and implementation failures before attributing a result to the instructional mechanism.

Deliver a one-page decision memo: outcome observed, uncertainty, implementation explanation, workload/access implications, and the next change. Define a locally meaningful success criterion in advance with the instructor. Expand only to the extent the evidence supports; when useful assistance saves time, specify the learning activity that will use that time.
