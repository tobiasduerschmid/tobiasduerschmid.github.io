# AI-era curriculum, rehearsal, and coaching

Contents: curriculum mapping; computing and software engineering; microteaching; student learning coaching. These workflows are original design synthesis. They are not evidence that one fixed curriculum is optimal or a forecast of which jobs AI will replace.

## 1. Build a capability progression

Start from what graduates must reliably decide and accomplish, including situations where a model is wrong, unavailable, expensive, or inappropriate. Do not replace domain knowledge with generic prompting.

For each capability, map:

| Field | Decision |
|---|---|
| Human responsibility | What decision or explanation must the learner own? |
| Prerequisite | What must be understood to judge plausible output? |
| Assistance | Which operations may be delegated during learning and performance? |
| Observable evidence | What would distinguish understanding from copying or luck? |
| Progression | Where introduced, practised, independently sampled, and transferred? |
| Opportunity cost | What lower-value work is reduced to make room? |
| Access/fallback | Can everyone meet the target with supported resources? |

Use diagnostic examples to decide where guidance should begin. Progress from modeled reasoning to guided comparison, constrained tool use, independent decisions, and changed-condition transfer. This order can be adapted to prior expertise; it is not a fixed prerequisite to every AI interaction.

## 2. Computing and software engineering outcomes

Use `knowledge/24_computing-education-and-ai.md` and `examples/cs-ai-requirements-design-testing.md` for concrete teaching. Select a few capabilities per unit.

| Capability | Student task | Evidence of individual understanding | AI role and caution |
|---|---|---|---|
| Code comprehension | Predict state/output and explain a loop invariant | Trace an unseen related case with reasons | Explain after prediction; fluent paraphrase is insufficient |
| Problem framing | Separate stakeholder goals, constraints, and unverified assumptions | Identify a missing question that changes a design decision | Simulated stakeholder practice; label invented answers |
| Requirements | Convert vague needs into observable criteria and edge cases | Reject an inconsistent requirement and resolve the conflict | Generate alternatives; student verifies stakeholder meaning |
| Design | Compare two architectures under quality requirements | Revise choice when scale, failure, or privacy constraints change | Generate candidates and critiques; popularity is not justification |
| Testing | Derive expected behavior from requirements | Explain a test oracle and show which faulty implementation it rejects | Draft cases; avoid common errors in generated code and tests |
| Debugging | Form a hypothesis, design a discriminating experiment, update belief | Minimal reproduction plus causal explanation and regression check | Suggest hypotheses; random patching is not diagnosis |
| Software evolution | Analyze a change across requirements, architecture, code, tests | Explain dependencies and test a changed boundary | Draft a patch; learner reviews effects and regression risks |
| Performance/security | Identify a threat or bottleneck and measure/check it | Justify mitigation using evidence and remaining risk | Generate probes in authorized teaching environments |
| Responsible delegation | Decide what to automate and verify | Explain rejected output, uncertainty, and accountability | Logs illustrate decisions; verbosity is not competence |

Model a complete example of good judgment, including rejected alternatives. Have learners compare a plausible but flawed answer with a defensible answer before demanding independent production. Use change requests that alter the underlying condition, not cosmetic wording.

Assess at least the capabilities the assignment claims. A successful AI-built application demonstrates product performance; add specific observed decisions if the claim includes the student's requirements analysis, architecture judgment, or debugging. Tool-assisted professional competence is a legitimate target when criteria explicitly assess it.

## 3. Microteaching rehearsal

When an instructor asks to practise explaining or facilitating:

1. Set a narrow learning target and a short segment; use the instructor's actual script, transcript, or delivery sample.
2. Identify an observable success criterion (for example, learners distinguish state from printed output).
3. Rehearse a short segment with likely questions or a misconception. Label simulated student behavior as hypothetical, never representative learner data.
4. Give feedback at exact moments: wording or action → likely learner interpretation → replacement or probe.
5. Rehearse the revised segment. Compare against the criterion and identify what still needs a real learner check.

Avoid personality judgments such as “not charismatic.” Prefer “The example changes both variable scope and mutation at once; hold scope fixed for the first comparison.” For classroom observations, distinguish direct observation from inferred thinking.

## 4. Student learning-strategy coaching

When assisting an educator with coaching, infer neither laziness nor a clinical diagnosis from failure. Ask for an actual attempt and study routine; distinguish missing knowledge, ineffective practice, interpretation of feedback, time/access barriers, and confidence calibration.

Build one feasible cycle: predict performance → attempt retrieval/problem → compare with answer/criteria → identify error type → practise a targeted next step → revisit after a delay. The educator can adapt the interval to schedule and task; do not prescribe one scientifically optimal spacing calendar.

For AI dependence, try a narrow assistance contract (`templates/ai-assistance-contract.md`) and a comparable independent task. If the student cannot begin, restore prerequisite explanation and a worked example. If the student can explain and transfer, reduce support. Do not use independence checks as punishment or remove accessibility tools unrelated to the target capability.

Deliver an educator-facing diagnosis with uncertainty and a brief student-facing coaching script. Refer problems beyond teaching expertise to appropriate institutional support without inventing personal diagnoses or institutional rules.
