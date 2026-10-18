# AI literacy and learning safeguards

## Contents

- Operating stance
- Route the task before generating material
- A durable AI literacy competency map
- Choose how much assistance to provide
- Ready-to-use instructional recipes
- A compact tutor specification educators can adapt
- A practical evaluation and improvement protocol
- Rubric for student AI-supported work
- Minimal student-facing evidence record

Use for AI-supported teaching, student AI literacy, tutor design, feedback, academic integrity, independent-learning assurance, and preparing students for changing professional tools. Read `references/ai-learning-evidence-2026.md` before making recent empirical claims; its IDs below point to exact designs and limitations. This chapter extends `19_genai-in-teaching-and-assessment.md` and `20_metacognition-and-self-regulated-learning.md`.

## Operating stance

Design for three distinct capabilities: **what learners can do independently**, **what they can accomplish with assistance**, and **how well they judge and manage that assistance**. State which capability each activity develops and each assessment measures. A competent AI user also needs enough domain knowledge to notice when verification fails.

Evidence is conditional: AI26-BAS, AI26-KES, AI26-CON, AI26-THO, and AI26-BAR differ in interventions, learners, comparisons, and endpoints. Do not turn them into “AI helps” or “AI harms” slogans. AI26-FUT also cautions against treating prompts as sufficient pedagogy. Support promising designs with a pilot; do not promise that this skill makes an agent infallible or replaces professional judgment.

## Route the task before generating material

| User's task | Deliverable | Essential decision |
|---|---|---|
| Add AI to a lecture/lab | Revised timing, student instructions, teacher check, fallback | Which cognitive work remains with the learner? |
| Teach students to learn with AI | Worked demonstration, scaffolded practice, independent check | What will students do when an explanation feels clear but cannot be reproduced? |
| Prepare students for AI-supported work | Delegation exercise, verification artifacts, accountability rubric | What decisions and responsibilities cannot be delegated? |
| Build an AI tutor | Domain specification, staged help, acceptance tests, escalation rules | Can the tutor recognize uncertainty and preserve productive effort? |
| Evaluate a vendor/tutor | Learning trial plan plus correctness, usability, access, workload checks | Compared with which feasible alternative and on which outcome? |
| Improve AI feedback | Error-specific feedback ladder and required learner revision | Will feedback trigger diagnosis or replace it? |
| Redesign a take-home assessment | Complementary assisted and independent evidence | Which inference would the product alone fail to support? |
| Investigate an apparent learning decline | Competing explanations and small diagnostic checks | Is the problem knowledge, task interpretation, access, motivation, or assistance use? |

Ask only for missing facts that change the design materially. Otherwise state level, prior-knowledge, tool-access, and timing assumptions, then produce a usable first version.

## A durable AI literacy competency map

This is an original operationalization informed by AI26-UNE and the skill's learning/assessment principles. It is not a validated universal scale. Choose a manageable subset aligned with the course; increase complexity with proficiency rather than requiring every competency in each lesson.

| Capability | Observable student evidence | Suitable teaching task | Common false positive |
|---|---|---|---|
| Frame the problem | Goals, stakeholders, constraints, success and failure criteria | Rewrite an ambiguous request into an assessable brief | A long prompt without a clear objective |
| Understand model limits | Distinguishes generation, retrieval, tool execution, and uncertainty | Explain why a plausible citation or code output may be wrong | Repeating “AI hallucinates” without checking anything |
| Select assistance | Justifies no AI, hint, critique, generation, or automation for a specific subtask | Compare a manual and assisted workflow | Always choosing the most powerful model |
| Supply useful context | Includes relevant evidence and explicitly marks missing information | Repair a flawed context package | Pasting everything, including sensitive data |
| Verify claims independently | Source passage, calculation, execution, test, or expert check | Audit a plausible but unreliable answer | Asking the same model to reassure itself |
| Calibrate confidence | Confidence tracks accuracy and remaining uncertainty | Predict, test, and revisit confidence across examples | Strong confidence in fluent explanations |
| Maintain domain competence | Explains or performs prerequisite reasoning without assistance | Solve a changed example after assisted practice | Reproducing the model's words verbatim |
| Decompose and delegate | Separates planning, generation, checking, acceptance, and escalation | Create a task delegation plan | Delegating both construction and final acceptance to one unchecked system |
| Manage errors and recovery | Detects a defect, diagnoses it, revises the process, retests | Repair a seeded failure and explain prevention | Making repeated prompt changes without a hypothesis |
| Exercise ethical and contextual judgment | Explains privacy, access, consent, bias, attribution, and stakeholder tradeoffs | Evaluate an authentic deployment dilemma | A generic ethics paragraph unrelated to the decision |
| Remain accountable | Names the final decision-maker and records accepted/rejected assistance | Submit a short decision log and defend a choice | “The AI said so” or disclosure without verification |
| Adapt when tools change | Transfers a workflow to an unfamiliar tool or completes a fallback | Repeat a task under a model outage or changed interface | Memorizing platform-specific prompt tricks |

Professional readiness should develop habits that survive model changes: precise goals, domain models, critical reading, testing, tradeoff reasoning, communication, revision, and responsibility. Treat claims about future job demand as forecasts requiring current evidence, not as established pedagogical facts.

## Choose how much assistance to provide

For each target capability, select an assistance level and a condition for fading it:

1. **Model:** Teacher or verified example demonstrates the process; learner predicts or explains selected steps.
2. **Complete:** Learner fills consequential missing steps with bounded hints.
3. **Diagnose:** Learner attempts first; AI helps locate a specific misunderstanding.
4. **Critique:** Learner produces a defensible solution; AI proposes objections or alternatives for evaluation.
5. **Delegate:** Learner assigns bounded production tasks and independently accepts or rejects results.
6. **Demonstrate independently:** Learner retrieves, adapts, or explains without the assistant where that capability is the target.

These are choices, not a compulsory universal ladder. Novices may need a worked example before attempting a problem. Experienced learners may appropriately automate routine production. A prohibition on all help is not a learning theory; unlimited struggle can waste time and undermine access. Fading should respond to observed capability, not a fixed number of clicks.

## Ready-to-use instructional recipes

All recipes below are **evidence-informed design hypotheses**. Mechanisms draw on the broader skill knowledge base; the full recipe is not established by any one AI experiment. Timings are adjustable implementation defaults, not experimentally optimized prescriptions.

### 1. Attempt, hint, explain, and retry

**Use:** Mathematics, programming, data analysis, science problem solving, or argument construction.

**Mechanism:** An initial model of the problem makes feedback meaningful; targeted help supports correction; independent reconstruction tests whether the learner acquired the reasoning.

**Implement (15–25 minutes):** Give a novice a short worked example if prerequisites are missing. Ask for an attempt or explicit statement of the obstacle. Permit one useful hint at a time. Require the learner to explain the next decision. Close the assistant and solve a nearby changed problem. End with one sentence linking the two cases.

**Failure condition:** The assistant leaks the complete answer, the learner pastes hints mechanically, or the problem is far beyond current preparation.

**Local check:** Compare accuracy and explanation quality on the changed independent problem; inspect whether error types recur. AI26-BAS motivates checking what remains after assistance.

**Student instruction:** “Show what you know, identify one obstacle, and request help for that obstacle. After using help, explain why your next step is valid. Finish the changed problem with the assistant closed.”

### 2. Predict before running or revealing

**Use:** Code tracing, SQL, simulations, scientific explanations, demonstrations, or worked solutions.

**Mechanism:** Committing to a prediction exposes a mental model that can be compared with evidence.

**Implement (10–15 minutes):** Present a short AI-generated artifact verified by the instructor. Students predict its output or consequence and give a reason. Run it or reveal a verified result. Pairs diagnose discrepancies; each student predicts a modified case independently.

**Failure condition:** Predictions are guesses without reasoning, examples are too complicated, or tool output is treated as authoritative despite an invalid setup.

**Local check:** Score the second prediction and causal explanation, not the first guess. For code, choose input changes that separate competing execution models.

### 3. Audit a convincing error

**Use:** Source literacy, code review, quantitative reasoning, design decisions, and AI feedback literacy.

**Mechanism:** Comparing plausible alternatives develops discrimination and evaluative judgment.

**Implement (20 minutes):** Give two plausible responses: one sound, one containing a consequential flaw. Do not always make the longer response wrong or label which author produced it. Students classify claims, choose independent checks, and submit one correction with supporting evidence. Discuss what made the error persuasive.

**Failure condition:** Errors are trivial, learners cannot access verification resources, or the exercise rewards indiscriminate distrust.

**Local check:** Track correct acceptance as well as correct rejection. A student who rejects every output is not well calibrated. Repeat with an unfamiliar but prerequisite-aligned example.

### 4. Confidence, evidence, and a delayed return

**Use:** Exam preparation, tutoring, office hours, and study-skills coaching.

**Mechanism:** Comparing confidence with observed performance helps students choose further study rather than equating fluency with mastery.

**Implement:** Before an independent question, learners estimate their probability of answering correctly. After feedback, they state what evidence changed their confidence and select a next action. Revisit a related question in the next class and again later in the unit. Include both successful and unsuccessful cases.

**Failure condition:** Reflection becomes generic prose, students are penalized for honest uncertainty, or the teacher treats self-report as achievement.

**Local check:** Across enough questions, compare confidence with correctness and examine explanations of errors. Use a simple accuracy/confidence table; a Brier score is optional and must not replace substantive diagnosis.

### 5. Plan, monitor, and revise a learning session

**Use:** Independent study, asynchronous classes, and longer assignments.

**Mechanism:** Explicit goals and monitored progress can support self-regulation when students act on them.

**Implement:** Students choose one concrete learning goal, predict an obstacle, and select a strategy. Midway, ask for observable evidence of progress and one adjustment. End with a short independent retrieval or application task; use its result to plan the next session. AI may ask focused questions but should not write the student's reflection.

**Failure condition:** Prompt answering displaces learning time, reflection is fabricated, or learners need direct instruction they never receive.

**Local check:** Examine whether plans lead to changed behavior and improved independent work. Pilot against the normal study routine. AI26-FUT and AI26-DIO require caution about overclaiming SRL-prompt benefits.

### 6. Treat feedback as a testable claim

**Use:** Writing drafts, programming labs, proofs, and design reviews.

**Mechanism:** Explaining, selecting, and applying feedback turns advice into learner action.

**Implement:** Ask AI for at most three prioritized observations tied to criteria and specific artifact locations. The learner marks each “accept,” “reject,” or “investigate,” provides a reason, and revises one consequential issue. For programming, require an explanation of the failing behavior and a test before accepting a patch. Check syntax/compiler misunderstandings separately from conceptual/specification failures.

**Failure condition:** More comments overwhelm the learner, the model rewrites everything, or the learner stops reading actual test failures or source evidence.

**Local check:** Inspect the revision and the explanation of why it resolves the issue; later ask for a similar correction without feedback. Feedback volume and satisfaction are secondary outcomes.

### 7. Delegate with an acceptance contract

**Use:** Professional preparation, software projects, research assistance, and applied analysis.

**Mechanism:** Making delegation boundaries explicit preserves monitoring, judgment, and responsibility while allowing useful automation.

**Implement:** Students split a task into decisions and production steps. For each delegated step, record input, expected output, acceptance criteria, independent check, and failure response. AI generates a bounded artifact. The student runs the checks and documents one acceptance or rejection. Introduce a small requirement change; require a revised check and artifact.

**Failure condition:** Acceptance criteria merely restate the generated solution, the same unchecked agent validates itself, or no student can explain a consequential decision.

**Local check:** Seed a plausible error or changed constraint and observe detection, repair, and explanation. Reward appropriate nondelegation as well as effective use.

**CS example:** “Ask an assistant to implement a waitlist operation. You retain responsibility for the invariant that enrollment never exceeds capacity, including concurrent requests. Provide an executable check or precise argument addressing the failure case before accepting the code.”

### 8. Use AI to coach teaching assistants

**Use:** TA preparation, tutoring, office hours, peer mentors, and instructor rehearsal.

**Mechanism:** Just-in-time alternatives can improve the quality of a human educator's response while retaining contextual judgment.

**Implement:** Give the educator an anonymized student attempt, target concept, and likely misconception. Ask for two possible next moves with the evidence each would elicit. The educator chooses, adapts, and explains a move. Rehearse using a student response that contradicts the initial diagnosis.

**Failure condition:** The educator blindly follows suggestions, language is mismatched to learners, or the tool ignores contextual information.

**Local check:** Review a small sample of actual feedback and students' subsequent responses. Include accuracy, learner agency, usefulness, and follow-up evidence. AI26-COP supports evaluating human–AI tutoring at the student-outcome level.

### 9. Pair an assisted artifact with an independent adaptation

**Use:** Assignments, portfolios, capstones, and take-home exams where permitted.

**Mechanism:** Complementary evidence supports distinct claims about professional production and individual competence.

**Implement:** Assess the assisted product against authentic criteria. Separately ask the learner to explain a consequential decision, repair a new defect, interpret an unfamiliar example, or adapt to one changed requirement. Publish both components and their weights in advance. Offer accessible modalities preserving the target construct; an oral defense is one option, not a universal requirement.

**Failure condition:** The follow-up becomes an unannounced interrogation, rewards speaking speed over understanding, or demands irrelevant memorization.

**Local check:** Map every follow-up to an explicit outcome and examine mismatches between artifact and adaptation performance. Investigate mismatches educationally before assuming misconduct. Do not use AI detectors as proof.

### 10. Change the tool and test transfer

**Use:** Advanced labs and preparation for changing AI-supported work.

**Mechanism:** Varying surface features while retaining underlying decision requirements can reveal and strengthen transferable skill.

**Implement:** Complete a familiar task with the normal tool; then change the interface, remove a convenience feature, impose an outage, or supply a new model with unknown reliability. Students reconstruct the goal, available evidence, verification plan, and fallback. Keep technical obstacles proportional to the learning target.

**Failure condition:** Interface troubleshooting dominates the intended concept or only students with paid access can participate.

**Local check:** Score stable reasoning and verification decisions across tools, with appropriate allowances for unfamiliar mechanics. Do not equate tool-switching speed with disciplinary expertise.

## A compact tutor specification educators can adapt

Before producing a tutor prompt, fill these fields: target concepts; prerequisite knowledge; verified examples and solutions; likely misconceptions; acceptable alternative reasoning; assistance level; accessible response format; escalation route; evidence of mastery; and fallback if the tool fails.

Suggested behavioral specification:

> Identify the learner's current understanding from their attempt or a short diagnostic question. Provide the smallest useful next explanation or hint. Ask for a consequential learner response before advancing. Use the verified course material; clearly flag gaps and uncertainty. Accept correct alternative approaches. If the learner lacks a prerequisite, provide a concise model and a completion step. Periodically ask for independent reconstruction or a changed example. Avoid repetitive questioning when direct explanation is needed. Do not infer mastery from agreement, thanks, or copied wording. Escalate unresolved factual or conceptual uncertainty to the educator.

This specification is an original starting point. Prompts alone do not guarantee compliance, accuracy, or learning. Test the actual system, including retrieved context, interface sequencing, and tool behavior. Test cases should include an incorrect confident attempt, a correct unusual approach, a request for the full answer, missing prerequisite knowledge, inaccessible formatting, an unanswerable question, and a plausible erroneous source. Record the failure and revise the instructional design before deployment.

## A practical evaluation and improvement protocol

1. **Define a decision:** Continue, revise, expand, or stop a specified teaching use; name a feasible comparator.
2. **Choose one primary learning outcome:** Prefer an independent application or delayed check when independent capability is the claim. Also measure assisted quality when professional assisted performance is a target.
3. **Specify the intervention:** Model/version, prompts, course grounding, allowed uses, time, human support, access, and scaffolds. “Used AI” is not sufficient.
4. **Check implementation:** Can students obtain help? Does the tool answer correctly? Are they performing the intended cognitive work? Are barriers unequally distributed?
5. **Collect a small useful evidence set:** Prior knowledge, independent performance, representative work samples, uptake, student time, teacher correction time, and important failures. Use minimal necessary data.
6. **Interpret cautiously:** For a local pilot, describe results as diagnostic rather than causal unless design warrants causality. Compare like tasks; separate absent effect from low uptake; report missing data and uncertainty. Do not claim individual learning gains from group averages.
7. **Act:** If assisted products improve but independent work declines, revise help boundaries and practice; if independent work improves but workload is excessive, simplify implementation; if outcomes differ by preparation/access, adapt support. Specify what evidence would justify the next change.

Where randomized evaluation is feasible and appropriate, balance access and ethics with course constraints. Otherwise use matched tasks, staggered introductions, or within-course repeated evidence, explicitly acknowledging confounds. Do not withhold necessary accessibility support for experimentation. A short exit ticket is useful for immediate understanding, but cannot establish month-long retention or broad transfer.

## Rubric for student AI-supported work

Use separate criteria rather than a single “AI skill” impression. Suggested levels are **unsupported**, **partly justified**, and **well evidenced**; adapt weighting to outcomes.

| Criterion | Well-evidenced performance |
|---|---|
| Problem framing | Defines consequential goals, constraints, and uncertainty |
| Appropriate delegation | Assigns bounded tasks and explains retained human decisions |
| Domain reasoning | Explains the artifact and handles a changed case |
| Verification | Uses independent, relevant checks and addresses their limits |
| Revision | Diagnoses and repairs a consequential defect with evidence |
| Accountability | Identifies accepted/rejected assistance and takes responsibility |
| Ethical/access judgment | Applies concrete context-specific safeguards and alternatives |
| Communication | Makes decisions, sources, and remaining uncertainty understandable |

Do not grade prompt length, number of model calls, paid tool sophistication, disclosure verbosity, or confidence as proxies for competence. A transparent decision to avoid AI can earn full credit when it meets the objective.

## Minimal student-facing evidence record

> **My goal:** What capability or result was I aiming for?
>
> **Assistance used:** Which part did I delegate, and why?
>
> **One consequential check:** What evidence did I inspect or test independently?
>
> **My decision:** What did I accept, reject, or revise?
>
> **What I can now do:** What did the independent or changed task show?
>
> **Remaining uncertainty:** What would I check next, and when would I ask a person?

Request excerpts needed to understand decisions rather than compulsory complete conversation logs. Respect applicable course policy, accessibility arrangements, and data handling requirements. The aim is useful learning evidence and professional responsibility, not surveillance volume.

## Adaptive help and actual use

For a learner who repeatedly requests patches, a teachable-agent explanation task, or a local tutor pilot, use `procedures/20_ai-learning-support-and-pilots.md`. It distinguishes missing prerequisites from debugging obstacles, provides direct explanation and escalation when useful, and fades support based on demonstrated capability. Inspect whether the intended learner action actually occurs and preserve time for independent evidence. Source records and the imported review’s limits are in `references/literature-review-crosswalk.md` and `references/review-reliability-2026.md`.
