# Assessment and feedback clinic

Use the relevant branch; do not perform a full psychometric audit for a wording repair. This is an original operational synthesis of the assessment, feedback, and grading knowledge files.

## A. Repair an item or answer key

1. Identify the exact capability and allowed resources. Solve the item independently before reading the proposed key when feasible.
2. Check whether an informed student could reasonably give another answer. Inspect assumptions, units, boundary cases, ambiguous terminology, language load, irrelevant cultural knowledge, and scoring.
3. For an MCQ, require one defensible best answer under stated assumptions; each distractor should represent a plausible misconception. Avoid clues from length/grammar and options that overlap. Explain why each option is right or wrong.
4. For code, trace and execute representative normal, boundary, and error inputs if possible. Check the specification independently from the implementation. Passing a generated test suite does not establish correctness if its oracle repeats the same error.
5. Repair the smallest consequential defect. Supply the revised item, verified key, partial-credit rules, estimated student time, and one likely misconception with a follow-up prompt.
6. Re-solve after the repair. If execution was unavailable, state the extent of manual checking. Do not describe an unrun example as tested.

**Example.** “Which sort is fastest?” is underspecified. Repair: “For a nearly sorted array of 30 records held in memory, what properties would make insertion sort a reasonable choice? Explain one circumstance that would change your choice.” This assesses conditional selection, not recall of a context-free ranking. It does not establish that insertion sort is universally optimal.

## B. Interpret item-level results

First inspect the data dictionary, missingness, absent students, multiple attempts, scoring changes, and assessment conditions. Preserve an untouched source copy. Use spreadsheet/data-analysis tools when requested and available.

- Difficulty: report the proportion correct (or mean score / maximum for partial credit), with denominator. Do not interpret missing as incorrect without an explicit scoring policy.
- Discrimination: use corrected item–rest relationships or clearly defined group comparisons. Small samples, restricted range, multidimensional objectives, and negative marking limit interpretation.
- Distractors: examine choice frequencies and student reasoning; an unused distractor may be implausible, but an easy essential-knowledge item may legitimately have few errors.
- Reliability: explain the measure and intended use. High alpha cannot establish validity; a broad curriculum can include multiple constructs.
- Fairness: inspect construct-irrelevant barriers and patterns. Small subgroup differences are signals to investigate, not proof of bias or innate group differences. Suppress identifying small-cell reports.

Triangulate statistical flags with the item, key, teaching, and student work. Never delete every difficult or low-discrimination question mechanically. A keying error, untaught outcome, ambiguous wording, and deep misconception require different repairs.

**Deliver:** item locator → observed pattern → competing explanation → evidence needed → repair/regrade consideration → next-use check. Do not change grades or announce decisions unless authorized. Draft a rationale the instructor can inspect.

## C. Feedback that changes the next attempt

1. Name the next performance the student can improve and when it occurs.
2. Choose one or two high-leverage discrepancies against visible criteria. Separate conceptual error from presentation polish.
3. Cite an exact feature of the student's work; explain its effect; prescribe an action the student can perform.
4. Ask for a revision and a short explanation of why it addresses the issue. Check the revised work or a later analogous task.
5. For AI feedback, constrain to provided work and rubric, request evidence locators, flag uncertain judgments, and sample-check factual accuracy. Do not infer intent, ability, diagnosis, or effort from prose style.

**Weak:** “Be more analytical.” **Usable:** “Your paragraph lists two architecture options but gives no comparison criterion. Add expected request volume and failure tolerance, then use those requirements to justify which option fits. Revise the decision if the availability requirement changes.”

A feedback receipt can be three fields: claim accepted/rejected; evidence; next change. Do not turn reflection into a long compliance essay.

## D. Grade moderation and calibration

Use `templates/ta-calibration-pack.md`. Select anonymous examples spanning levels and difficult boundaries; grade independently before discussion. Compare criterion-level evidence, resolve ambiguous descriptors, and record anchor rationales. Double-mark a sample and cases with consequential disagreement. Reserve time for adjudication and student clarification.

Separate disagreement about evidence, interpretation of criteria, and arithmetic. Do not average incompatible interpretations to hide the problem. Preserve legitimate alternative solutions; calibrate to the construct, not one model answer's wording.

## E. Evaluate a teaching change

Frame the question as a local decision: keep, revise, or stop a particular ingredient. Identify baseline performance, common independent task, implementation fidelity, time burden, and unwanted effects. Predefine what pattern would support each decision; thresholds are local planning choices.

For AI, collect assisted performance and a matched independent task separately; add delayed transfer if the course claims durable learning. Randomized comparisons can improve causal inference where feasible and appropriate, but routine improvement can use student work plus observations without claiming causality. Account for different cohorts, grading, content, and exposure. AI-persona feedback is a hypothesis source, not student evidence.

**Minimum usable cycle:** one misconception prompt now → targeted change next session → parallel misconception prompt plus explanation → inspect work/time → keep or revise. Student satisfaction helps interpret experience; it cannot substitute for learning evidence.

Sources: `knowledge/10_assessment-foundations.md`, `knowledge/11_formative-assessment-and-feedback.md`, `knowledge/12_exam-design-and-psychometrics.md`, `knowledge/17_grading-rubrics-and-academic-judgment.md`, `knowledge/22_course-evaluation-and-sotl.md`; inspected book passages in `references/project-foundations-2026.md` and `references/project-extended-2026.md`.
