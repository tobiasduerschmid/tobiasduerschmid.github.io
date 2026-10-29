# Teaching PlusCal, TLC, and temporal logic to undergraduates

**Research review and design implications for an interactive web tutorial**

**Research date:** 29 October 2026

**Audience:** instructors, curriculum designers, and developers of undergraduate computer science learning environments

**Reading guide:** [conclusions](#1-main-conclusions), [review method](#2-scope-method-and-evidence-interpretation), [learning challenges](#3-what-is-difficult-about-learning-these-topics), [evidence synthesis](#4-what-the-research-supportsand-where-it-is-thin), [curriculum](#5-learning-objectives-and-a-proposed-sequence), [semantic requirements](#6-semantic-requirements-the-tutorial-must-get-right), [activities](#7-worked-tutorial-activities-and-instructor-notes), [interface and feedback](#8-interface-and-feedback-design), [assessment](#9-assessment-and-evaluation), [implementation priorities](#10-priorities-for-a-first-implementation), [annotated sources](#11-annotated-evidence-catalogue), [search audit](#12-search-audit-uncertainties-and-verification).

## 1. Main conclusions

An undergraduate tutorial should teach students to **construct and challenge a model of possible behaviors**, rather than primarily teaching them to obtain a successful model-checker result. Students need to distinguish the requirements, the model, the properties, the assumptions, and the evidence produced by checking. A tutorial can conceal these distinctions while remaining easy to complete; completion alone is therefore a poor success criterion.

The research supports a cautious but useful design direction:

1. **Begin with small, familiar systems and explicit states and transitions.** Introduce notation and concurrency incrementally. Direct TLA+ teaching reports establish feasibility and describe promising curricula, but mostly provide experience and attitude evidence rather than controlled learning outcomes. [T1] [T2]
2. **Teach temporal logic through contrasting behaviors, including negative examples.** Empirical LTL research identifies persistent misconceptions about scope, ordering, and trace semantics. Recognizing operators is insufficient. [L1] [L2]
3. **Make the counterexample a learning task.** Require students to locate the violated requirement, explain a transition, propose a repair, and predict its consequences. A trace display by itself does not establish that students understand it. Broader visualization research supports attention to the learner's activity, rather than assuming that animation is effective. [P5]
4. **Use worked examples, then remove support deliberately.** Teach a repeatable modeling and diagnostic process, but require later independent modeling, interpretation, and transfer. Programming research supports subgoal-oriented instruction conditionally; its effects are not uniformly positive across outcomes. [P2]
5. **Treat feedback and adaptivity as interventions to evaluate.** Existing tools demonstrate feasible designs, but an implemented tutor is not necessarily an evaluated tutor. Some relevant comparative studies have null or unfavorable results. [L3] [L4] [F4]
6. **Expose the scope of every result.** A successful finite model check does not establish that a model faithfully represents requirements, that an implementation conforms to it, or that every parameter size works. This is a technical correctness requirement and a central instructional objective. [R2]
7. **Measure independent understanding separately from assisted performance, satisfaction, and persistence.** Assess reasoning without feedback immediately and after a delay, and include a new problem context.

The proposed curriculum, activities, timings, rubrics, and interface requirements below are **original design synthesis**. No identified study validates this complete PlusCal–TLC–LTL tutorial design, and no study located in this review establishes that PlusCal-first is universally superior to TLA+-first instruction.

## 2. Scope, method, and evidence interpretation

### 2.1 Questions and assumed learners

This review asks:

- What makes formal modeling, model checking, and temporal specification difficult to learn?
- What teaching approaches have been proposed or evaluated, with what populations and outcomes?
- What evidence concerns TLA+, PlusCal, and TLC directly, and what transfers only indirectly from other formalisms?
- Which choices follow for an interactive undergraduate tutorial, and how should those choices be evaluated?

The working audience is second- or third-year undergraduates who can read imperative programs, reason about Boolean expressions, and have encountered elementary sets and quantification. Prior concurrency experience is **not** assumed. Students with weaker prerequisites need an optional preparatory route; students with stronger preparation need a diagnostic route around redundant instruction. This audience assumption is a design choice, not a result from the literature.

The intended outcome is practical modeling literacy: students can model a small concurrent system, express and challenge its requirements, interpret TLC evidence, and explain the limitations of their conclusion. Implementing a model checker, mastering automata-theoretic verification, proving arbitrary distributed algorithms, and learning TLAPS are separate advanced outcomes.

### 2.2 Search and selection

The review used the requested **Sider Scholar** and **SciSpace** services for discovery; primary author, publisher, institutional, and project sources for verification; and **PedAdvisor** for evidence appraisal. The **lit-search** workflow was applied in the requested light mode: targeted OpenAlex searches, seed identification, limited citation snowballing, deduplication, access tracking, and transparent screening. The sole deliverable is this report; there is no separate database, BibTeX export, or literature package.

Coverage included CS education, formal-methods teaching, human factors of formal specification, and learning science. Searches included recent work from 2024–2026 alongside earlier direct studies. Relevant venues include SIGCSE Technical Symposium, ITiCSE, TOCE, FIE, CSEET, FMTea, FormaliSE, FM, CAV, MODELS, and OOPSLA. Inclusion does not depend on a positive result or on a source being recent.

This is a **focused, source-checked narrative review**, not a registered systematic review or meta-analysis. Searches were purposive and iterative; no exhaustive screening count, database saturation, or comprehensive citation coverage is claimed. A search returning no records is an index result, not proof that no relevant research exists.

The review retains three kinds of material, with different roles:

| Material | Why include it? | What it cannot establish by itself |
| --- | --- | --- |
| Empirical studies of learners or specification users | Identify difficulties, compare conditions, or describe outcomes | General effectiveness beyond the studied population, task, and assistance conditions |
| Teaching experience, curriculum, and tool papers | Identify workable sequences, implementation costs, and candidate features | Causal learning gains merely because a course or tool exists |
| Learning-science syntheses and technical references | Inform mechanisms and ensure semantic correctness | That a particular PlusCal tutorial has been validated |

Unrelated results using words such as “model” or “pedagogy” in other disciplines were excluded. Verification algorithms without a teaching, comprehension, or design implication were not treated as educational evidence. Industrial adoption reports can motivate authenticity but do not establish undergraduate learning. Preprint and published versions, companion reports, and repeated cohorts were not counted as independent replications.

### 2.3 Outcomes that must remain separate

**Assisted performance** is doing better while instructional hints, worked solutions, or other added supports are available. To assess **independent learning**, define the aid conditions: use checker-free semantic probes to assess conceptual reasoning, and separate independent modeling tasks with normal tools and reference documentation but without instructional hints or supplied solutions. A counterexample trace can itself be the assessment material; independence does not mean removing the object the student must interpret. **Retention** requires a delayed measure. **Transfer** requires a meaningfully different task or context. **Experience** includes confidence, enjoyment, perceived usefulness, and workload. Each matters, but evidence for one does not imply the others.

The source catalogue records access scope and consequential limitations. “Full-text sections inspected” means relevant methods, results, or design passages were examined, not that every appendix or artifact was reproduced. Abstract-only findings are marked and carry less weight. Numerical claims are restricted to inspected evidence; enrollment, respondents, pairs, submissions, and analytic sample size are distinguished.

## 3. What is difficult about learning these topics?

### 3.1 Several conceptual transitions happen at once

Students move from executing one program to describing many possible behaviors; from predicting an output to characterizing acceptable executions; from finding a bug to interpreting a formal counterexample; and from informal expectations to explicit assumptions. Simultaneously, they may encounter concurrency, mathematical notation, an unfamiliar language, and a new toolchain. Teaching reports make these combined demands visible, but they do not establish a fixed cognitive capacity or a universal best order. [T2] [T5]

The instructional response should be to **separate sources of novelty**. Use a familiar scenario while introducing states. Use a tiny state space while introducing exhaustive exploration. Keep the algorithm fixed while changing the property. Keep the property fixed while changing the model. Introduce fairness only after students can recognize a safe execution that fails to make progress.

### 3.2 Programming knowledge helps and misleads

Imperative experience makes PlusCal approachable, but can encourage an execution-oriented interpretation: “the scheduler will probably run both processes,” “this line happens next,” or “a label is just a jump target.” Mathematical expressions can also be read as commands. These are instructional risks inferred from the semantic differences, rather than measured prevalence claims about all PlusCal learners.

A useful tutorial explicitly contrasts:

| Familiar expectation | Required modeling distinction | Diagnostic activity |
| --- | --- | --- |
| Running again produces another sample | Checking explores the configured reachable state space | Compare one simulated schedule with the set of legal schedules |
| The source determines a single next instruction | Several processes or branches may be enabled | Enumerate possible successors before checking |
| A source line is the unit of execution | PlusCal labels determine atomic steps | Compare two placements of a label |
| A successful run means the program is correct | A checker evaluates specified properties of a model | Remove a necessary property and interpret the result |
| Random choice and nondeterminism are interchangeable | Possibility does not assign probabilities | Explain why a rare schedule still matters |
| A scheduler will eventually be fair | Progress assumptions must be explicit | Construct an infinite starvation behavior |
| A logical formula works like an imperative statement | An action constrains a pair of states | Reorder conjuncts and explain why their meaning is unchanged |

The diagnostic activities are proposed teaching probes. They should be piloted before being used as a validated misconception inventory.

### 3.3 Temporal language is deceptively familiar

“Eventually,” “always,” “until,” and “after” sound like ordinary language. Their formal meanings depend on the evaluation position, operator scope, and the trace domain. Research on LTL finds that learners can apply intuitions that do not match those semantics. The 2024 finite/infinite-trace work further shows why one should not silently transfer an exercise between those domains. [L1] [L2]

Teach three translations repeatedly: **requirement to formula**, **formula to explanation**, and **formula to satisfying/violating behaviors**. Correctly producing a formula does not show that the learner can interpret it. A formula accepted on one model may also be too weak to express the intended requirement.

### 3.4 The specification itself can be wrong

Formal tools do not remove the need to validate intent. A requirement can be omitted, a precondition can exclude every interesting situation, or a response property can hold because its trigger never occurs. Students need both examples the model permits and examples it rejects. Formal-methods user studies and exploratory specification tools provide direct reasons to make this activity explicit. [F2] [L7]

This implies two distinct tutorial questions:

- **Does the modeled system satisfy this property?**
- **Do this model and property express the behavior we intended?**

A green status answers neither question unless the corresponding analysis was actually performed.

### 3.5 Tool interpretation is a separate skill

A parse error, failed invariant, deadlock, temporal counterexample, and incomplete computation call for different reasoning. A novice can change code until a message disappears without understanding the underlying obligation. Early LTL tool research is especially useful here: adding software support did not automatically produce better posttest performance than instruction. [L4]

Explicitly teach students to classify the result before attempting a repair. For a counterexample, ask what it demonstrates; for an incomplete computation, ask what remains unknown. Treat faster completion as a usability outcome, not automatically as better learning.

## 4. What the research supports—and where it is thin

### 4.1 Direct TLA+ and PlusCal teaching

The direct literature offers credible examples of teaching formal modeling to students and engineers, together with recurring recommendations: accessible examples, incremental models, practical relevance, and close attention to tool use. Its strongest contribution is **feasibility and design experience**. The widely repeated positive-experience percentage in the 2024 undergraduate TLA+ paper comes from a small survey; it should not be described as a measured learning gain. [T1]

Professional training is informative but has different conditions. Experienced engineers bring domain knowledge, immediate use cases, and different motivation from students completing a required course. Kuppe's Microsoft report therefore informs sequencing and implementation choices more directly than it predicts undergraduate outcomes. [T2]

The language entry point remains an open choice. PlusCal reduces some syntactic distance from programming, while direct TLA+ foregrounds relational state-transition modeling. A reasonable default for this audience is **state-machine reasoning, then PlusCal, then an explicit bridge to generated TLA+**. This is a local design recommendation, not a proven ranking of languages.

### 4.2 Temporal-logic comprehension has more targeted empirical evidence

The LTL misconception studies support deliberate contrasts involving scope, temporal ordering, and finite versus infinite traces. They also motivate feedback that diagnoses a particular interpretation rather than only marking a formula wrong. Their tasks and populations do not cover the entire process of creating an adequate concurrent-system model. [L1] [L2]

The adaptive LTL Tutor translates a misconception catalogue into a concrete tool design. That is useful engineering precedent, but the inspected paper does not establish controlled learning effectiveness. [L3] A recent 2026 example-trace study is relevant to assisted comprehension, but full methods were unavailable in this review; its abstract-level findings should not carry the evaluation plan. [L6]

The older LTLV studies deserve attention because they complicate a simple “tools improve learning” narrative. They suggest that the quality of the instructional integration, prerequisite knowledge, and extra tool demands matter. The 2009 protocol and 2010 results must also be distinguished: planned recruitment is not an achieved sample. [L4] [L5]

### 4.3 Adjacent formal-modeling tools offer design patterns, not automatic transfer

Forge and Alloy-based research provide useful ideas about staged language exposure, instance exploration, specification testing, and domain-specific presentations. Alloy4Fun demonstrates a web-based setting for model exercises and observational analysis of attempts. These findings concern different languages and analysis semantics, so their interface patterns should be adapted and evaluated rather than copied as evidence that TLC instruction will improve. [F1] [F2] [F3]

pseuCo Book shows that verification feedback can be integrated into an interactive concurrency text, including failure traces and checks beyond output examples. It establishes a relevant technical precedent. It does not show that a browser implementation of TLC is already available, nor that the educational effect of that integration has been established. [F6]

### 4.4 Broader pedagogy constrains the design

The evidence for active learning in undergraduate STEM is much broader than the evidence for any particular formal-methods interface. Freeman and colleagues synthesized 225 studies, reporting a mean examination/concept-inventory advantage of 0.47 standard deviations and a higher failure risk under traditional lecturing. The interventions varied substantially; the result is not a predicted effect size for this tutorial. [P1]

Worked examples and subgoal labels can support novice reasoning, but the outcome distinction matters. In a 265-student CS1 quasi-experiment, subgoal-oriented materials improved formative quiz performance and reduced failure/withdrawal, while average exam performance was not significantly better. [P2] Fading should therefore be followed by independent checks, not assumed to guarantee transfer.

Retrieval and distributed practice justify returning to important distinctions after a delay. They do not establish a precise optimal revisit interval for fairness or LTL. [P3] The proposed schedule below uses practical planning estimates, which should be adjusted to course length and student performance.

ICAP distinguishes overt activity from constructive explanation and substantive interaction. Clicking through a trace is not equivalent to explaining why a transition is legal or resolving conflicting interpretations with a peer. [P4] Feedback research likewise supports specific, usable guidance while warning that effects depend on the learner and task. [P6]

## 5. Learning objectives and a proposed sequence

### 5.1 Observable outcomes

By the end of the core tutorial, a student should be able to:

| Outcome | Evidence of capability | Insufficient substitute |
| --- | --- | --- |
| Choose a finite state representation for a small system | Explain included variables, omitted details, and one abstraction risk | Copy declarations from an example |
| Identify legal transitions and interleavings | Construct and justify successors and a counterexample schedule | Watch an animation |
| Explain PlusCal atomicity | Predict the effect of moving a label | Memorize labeling rules |
| Express safety and response requirements | Write a property and classify discriminating behaviors | Match a formula to a memorized phrase |
| Interpret TLC results | Classify outcome, locate evidence, and state its scope | Obtain a successful check |
| Diagnose a model/property mismatch | Decide whether to revise the model, property, or assumption | Randomly edit until the error disappears |
| Reason about liveness and fairness | Explain an infinite counterexample and justify an assumption | Add fairness whenever a check fails |
| Evaluate a verification claim | State parameter choices, properties, assumptions, and limitations | Claim “the implementation is proved correct” |

These objectives should determine both the exercises and the grading. Features without a corresponding learner action or observable outcome are lower priorities.

### 5.2 Eight modules with a delayed revisit

The following timings are estimates for planning, not research-derived constants. A core route would occupy roughly six to eight hours, distributed over several sessions, plus an independent capstone. A brief introduction should stop earlier and describe its narrower learning outcome honestly.

| Module | Central question and work | Scaffold and feedback | Evidence before moving on |
| --- | --- | --- | --- |
| 0. Readiness, 15–25 min | Can I evaluate a predicate, distinguish a set from a sequence, and enumerate a small case space? | Optional short explanations and worked cases | A fresh prerequisite item, with remediation available |
| 1. States and requirements, 30–45 min | What can happen in a simple reservation or controller system? | State table; explicit actions; short requirements | Student creates a legal and an illegal transition and explains both |
| 2. Exploration and invariants, 40–50 min | How can one counterexample refute a universal claim? | Supplied finite model; predicted invariant; guided trace | Student locates the first violating state and the transition that reached it |
| 3. PlusCal and atomicity, 45–60 min | Which parts of an algorithm may interleave? | Supplied two-process example; label-to-step mapping | Student predicts a newly enabled schedule after a label change |
| 4. Modeling and validation, 45–60 min | Does the model capture the requirement? | Partial model; allowed/forbidden scenario prompts | Student detects an omitted behavior or vacuous property |
| 5. Temporal logic, 50–70 min | Which infinite behaviors satisfy this requirement? | Positive/negative lassos, scope marking, staged formulas | Student produces a distinguishing behavior for two formulas |
| 6. Progress and fairness, 45–60 min | Why can a safe system fail to serve a request? | Enabled-action annotations; starvation example | Student names the responsible assumption and its justification |
| 7. Integration and checker limits, 45–60 min | What exactly did this check establish? | Partially faded diagnostic workflow | Student repairs a model and writes a scoped verification claim |
| 8. Independent transfer, 45–75 min | Can I model a different small system? | Reference sheet, but no solution or step-by-step hints | Model, property, counterexample analysis, and limitations statement |
| Delayed revisit, 15–25 min | What remains usable after time away? | New short cases before feedback | Independent interpretation, one construction task, and calibrated confidence |

A strong student can use diagnostic questions to skip elementary practice. A struggling student should receive targeted component practice rather than repeatedly attempting the whole capstone. Avoid punitive lockouts: a prerequisite failure should open support, not create an inaccessible dead end.

### 5.3 Three contexts, each with a clear purpose

Use a small family of examples instead of a new story for every concept:

- **A reservation system with two clients and limited capacity:** state, invariants, competing requests, and an independently understandable counterexample.
- **A two-worker counter:** local state, interleavings, atomicity, and the distinction between a source edit and an algorithmic assumption.
- **A request/service controller:** response properties, recurrence, starvation, and fairness.

Then assess transfer with a new context, such as a bounded message buffer or a simple door controller. Keep the transfer model small; a difficult story can obscure whether the intended concept transferred.

A puzzle can introduce state-space search, but explicitly explain the inversion when checking an assertion such as “the goal is unreachable.” A counterexample then witnesses reachability; it is not automatically a defect. Do not let the first playful example establish that every checker failure means a programming mistake.

### 5.4 A repeated activity cycle

For the main labs, use this sequence:

1. **Commit to a claim:** predict a successor, outcome, or property result and give a short reason.
2. **Inspect evidence:** run the actual task analysis or examine a supplied trace.
3. **Explain the mismatch:** identify the assumption or semantic distinction that matters.
4. **Revise one thing:** change the model, property, or explicit environment assumption.
5. **Check a contrasting case:** attempt to disprove the revision.
6. **Revisit independently:** solve a related case after support is removed.

This is an original synthesis informed by active engagement, feedback, and fading research. It should not become a rigid interaction tax. Syntax exploration and low-stakes experimentation need not require a written paragraph on every run; predictions are most valuable at conceptual decision points.

## 6. Semantic requirements the tutorial must get right

### 6.1 Distinguish the languages and the tool

**PlusCal** describes algorithms and translates to **TLA+**. **TLC** checks supported specifications and properties for a configured model. **LTL** is a temporal-logic formalism; common LTL notation is not automatically valid TLA+ syntax. The tutorial should introduce these roles once, then reinforce them through the actual workflow. [R1] [R3]

Do not call every action “Run.” Where appropriate, distinguish **Translate**, **Explore one behavior**, and **Check the model**. A combined beginner control can perform translation and checking, but its result must identify the operation and the exact model revision used.

### 6.2 Notation bridge

For state predicates `p` and `q`, the introductory bridge can be:

| Meaning on an infinite behavior, from the current position | Common LTL notation | TLA+ notation used in the tutorial |
| --- | --- | --- |
| `p` holds at every position from now on | `G p` | `[]p` |
| `p` holds now or at some later position | `F p` | `<>p` |
| Whenever `p` holds, `q` holds then or later | `G(p -> F q)` | `[](p => <>q)`, also `p ~> q` |
| `p` occurs infinitely often | `G F p` | `[]<>p` |
| Eventually `p` holds forever | `F G p` | `<>[]p` |

“Eventually” includes the current position. A response formula does not require a strictly later response unless the specification adds that requirement. A formula about request and response Booleans also does not, by itself, establish a one-to-one correspondence between individual requests and acknowledgments. Those requirements need an appropriate model of identity or outstanding obligations.

Distinguish satisfaction on one behavior from satisfaction by a specification. Checking `<>p` as a property asks whether every allowed behavior eventually reaches `p`; it does not merely ask whether some path can reach a `p` state. A learner who finds one successful path has not established that universal progress claim.

Teach `X` (next) and strong `U` (until) only in a clearly labeled LTL extension. Do not present `X p` as native TLA+ notation or equate priming with a general next-time operator. TLA+ priming belongs to action expressions over a state pair. Do not imply that inserting ordinary LTL syntax into a TLC property field will work. [R2] [R3]

### 6.3 Infinite behaviors must remain infinite in the interface

An arbitrary finite prefix usually cannot decide an unbounded eventuality. A trace widget must say whether it displays a prefix, an explicitly finite-trace logic exercise, or a finite representation of an infinite behavior. For complete infinite-behavior examples and liveness counterexamples in the TLA+ route, use a **lasso**: an initial segment followed by an explicitly repeating loop. A safety failure can instead be demonstrated by a finite bad prefix; do not invent a loop to present an invariant violation. Repeating a final state forever is another explicit completion convention, not permission to silently change to finite-trace LTL semantics. [L2] [R1]

Provide a textual description such as “after state 3, repeat states 2 and 3 forever.” The screen must not make an infinite failure look like an execution that merely has not reached the response yet.

### 6.4 Atomicity is part of the model

A PlusCal step runs from one label to the next along a control path. Label placement can therefore change the possible behaviors. [R1] Students should be asked whether the chosen atomicity matches the intended implementation, not merely whether it makes the invariant pass.

Combining a read and write into one atomic step can remove a lost-update counterexample from the model. That is an appropriate repair only if the modeled system actually provides the corresponding atomic operation or synchronization. An unjustified stronger atomicity assumption is a modeling error concealed by a successful check.

### 6.5 Safety, liveness, fairness, and deadlock are different obligations

An invariant is a state predicate required in every reachable state. It is an important class of safety requirement, but not every safety property is simply an invariant over the model's original variables. A liveness failure requires reasoning about indefinite behavior; a finite-state checker can represent it with a loop. [R2]

Fairness constrains allowed behaviors. Weak fairness addresses an action remaining enabled; strong fairness also addresses repeated enabling separated by periods of disabling. Neither supplies a numerical time bound or says that all choices are equally probable. [R1]

The pedagogical question is **which behavior the assumption rules out and why excluding it is justified**. An environment that may abandon a request should not be made fair merely to obtain a passing response property. A fairness assumption can exclude starvation without preventing a genuinely blocked state.

### 6.6 Results need an explicit scope

The interface should distinguish these outcomes:

| Result | Appropriate learner interpretation |
| --- | --- |
| Parse/translation error | The intended model has not yet been checked |
| Invariant violation | A reachable modeled state violates the named predicate |
| Deadlock report | The model reached a state with no applicable next-state transition under the checker's deadlock interpretation; determine whether termination was modeled as intended |
| Temporal-property violation | Interpret the evidence according to the property: a finite bad prefix can establish a safety failure, while a liveness failure requires an infinite continuation under the configured assumptions |
| Completed check with no violation | The selected analysis found no violation for this configured finite model; inspect exactly which properties and assumptions were used |
| Timeout, cancellation, or resource exhaustion | The attempted analysis is incomplete; the property is not established |
| Simulation produced no failure | The sampled behavior or behaviors did not expose a failure; exhaustive exploration was not performed |

Explicit parameter instances, finite domains, constraints, and analysis mode belong in a readable result summary. Choosing a finite instance is different from running a depth-bounded search. Constraining exploration can change what is checked. A larger bound is not automatically a proof for every system size. [R2]

## 7. Worked tutorial activities and instructor notes

The activities below are original examples and assessment designs. They are not copied interventions from the cited papers. Instructor answers belong in a separate reveal when these activities are implemented.

### 7.1 Activity A: The lost update

**Objective:** distinguish interleaving from sequential execution and explain the effect of atomicity.

Two processes, A and B, each perform two atomic actions in order: read a shared counter into a private temporary variable, then write that temporary value plus one back to the counter. Initially the counter is zero. Each process executes once.

**Student work:** predict the possible final values; construct a schedule for each; identify what changes if each process's read and write form one atomic action; explain whether that change is justified by the real system.

**Instructor analysis:** the six interleavings preserving each process's order are `AABB`, `ABAB`, `ABBA`, `BAAB`, `BABA`, and `BBAA`. The first and last produce 2; the others produce 1. Here each letter denotes that process's next atomic action, not a repeated whole procedure. This enumeration is not a probability distribution over schedules.

An illustrative PlusCal body is:

```text
Read:  temp := counter;
Write: counter := temp + 1;
```

`temp` must be local to each process. With both assignments in one labeled step, the model no longer permits the two reads to precede both writes. These are fragments for explaining the activity, not a complete checked PlusCal module.

**Hints:** first ask which values the two private temporaries can hold; next ask whether both reads can occur before either write; finally offer an incomplete four-event schedule. Do not start by telling students to move the label: deciding how a schedule becomes possible is the learning task.

**Transfer check:** use two clients reserving the last available place. Ask whether making the whole client action atomic describes a real transaction or merely hides the race.

### 7.2 Activity B: Four meanings of “eventually”

**Objective:** distinguish eventual occurrence, invariance, recurrence, and stabilization.

Let `p` indicate that a request is being served. Present six infinite behaviors:

| Behavior | Description | `F p` | `G p` | `G F p` | `F G p` |
| --- | --- | --- | --- | --- | --- |
| Never | `p` is false forever | False | False | False | False |
| Once | `p` is false, then true once, then false forever | True | False | False | False |
| Alternating | `p` alternates false and true forever | True | False | True | False |
| Stabilizing | `p` is initially false, then true forever | True | False | True | True |
| Always | `p` is true from the initial state forever | True | True | True | True |
| Only now | `p` is true initially, then false forever | True | False | False | False |

Initially hide the truth columns. Ask students to classify one formula across the behaviors and justify a difficult cell. Next ask them to create a behavior distinguishing `G F p` from `F G p`. The “Always” row prevents an all-false shortcut for `G p`; “Only now” checks that eventuality includes the current state. Translate the formulas to TLA+ only after the contrast is understood, then later reverse the direction.

**Feedback:** identify a position or loop relevant to the learner's choice. For an incorrect `F G p` answer on the alternating behavior, ask whether any suffix avoids a later false state. A simple “wrong” response does not reveal the mistaken interpretation.

**Independent check:** rename the proposition and change the representation from a timeline to a textual lasso. This tests whether understanding extends beyond a familiar graphic.

### 7.3 Activity C: A vacuous response property

**Objective:** recognize that property satisfaction does not establish an adequate model.

Supply a system in which `request` is always false. Ask whether `[](request => <>grant)` holds, whether the system can serve a request, and what additional exploration would test the intended requirement.

**Instructor answer:** the response property holds vacuously. It establishes no evidence of reachable requests or service capability. Students should investigate whether request states are reachable and whether the intended environment can generate them. A separate reachability check or witness exploration is useful; simply adding `<>request` as a universal requirement is a different assertion and may be inappropriate for an environment permitted never to request.

Then give a stronger counterexample: requests are reachable, but an assumption removes every behavior in which a request remains pending. Ask students to distinguish a legitimate environment contract from excluding the failure they are meant to analyze.

**Assessment:** require an explanation of why the property passes and a concrete validation action. A correct Boolean answer alone is insufficient.

### 7.4 Activity D: Weak versus strong fairness

**Objective:** reason about enabling conditions before choosing a fairness assumption.

Present two infinite schedules for a waiting process and a service action:

- In one schedule, service remains enabled forever but never occurs.
- In the other, service becomes enabled and disabled repeatedly, is enabled infinitely often, and never occurs.

Ask which behavior weak fairness excludes, which requires strong fairness, and whether either assumption guarantees service within ten steps.

**Instructor answer:** weak fairness excludes the continuously enabled starvation behavior. Intermittent enabling can satisfy weak fairness while violating strong fairness. Neither fairness condition supplies a fixed response bound. The exercise must identify the exact action whose fairness is being discussed and ensure its execution would be a relevant non-stuttering step.

**Critical follow-up:** give an unreliable external service. Ask whether fairness is a documented environmental guarantee, an abstraction for the exercise, or an unjustified wish. Credit a justified refusal to assume it.

### 7.5 Activity E: A successful check that should not earn full credit

Give three submissions for the same requirement:

1. A model with the intended actions and an appropriate property.
2. A model whose initialization and transitions make all request states unreachable.
3. A model that permits requests but checks only a type predicate, omitting the service requirement.

All can produce a successful result for the checks they actually perform. Ask students to identify which evidence is missing and construct a scenario that would expose the gap. This makes specification adequacy visible without teaching students that a checker is unreliable.

The intended conclusion is that the checker can correctly analyze the wrong question. The remedy is a better model/property/assumption contract and additional validation.

### 7.6 Activity F: Requirement ambiguity before formalization

Present “Every request gets a response.” Before students write a formula, ask:

- Can the response occur at the same state as the request?
- Can requests overlap?
- Must the response correspond to the same client or request identifier?
- Can a request be withdrawn?
- Is there a time bound?

Supply alternative stakeholder answers and ask students to explain how the model must change. Only then formalize one agreed version. This prevents the language exercise from rewarding a familiar pattern while ignoring the requirement's meaning.

### 7.7 Optional LTL extension: Strong until

If LTL competence is an explicit course outcome, add a short extension on `p U q`, using a dedicated LTL evaluator or instructor-checked traces rather than implying that `U` is a built-in TLC property syntax. Strong until requires `q` now or later, with `p` at every earlier position. It does not require `p` to become false when `q` occurs.

Ask students to classify these cases: `q` holds now while `p` is false; `p` holds until a later `q` and continues afterward; `p` holds forever while `q` never occurs; and `p` fails before the first `q`. The strong-until answers are true, true, false, and false. Compare the third case with weak until, and require a new distinguishing behavior. Scope and until errors in L1 motivate this focus; the exercise itself is an original design. [L1]

Treat branching-time logics, automata construction, and full model-checker algorithms as separate extensions. Adding them to the introductory route would change its scope and time requirements.

## 8. Interface and feedback design

### 8.1 Organize the workspace around the current reasoning task

An initial workspace needs a short requirement, a small editable model, and one evidence view. Show more detail only when it is needed. A permanent wall of specification, generated TLA+, full state graph, property editor, trace, statistics, and help would require beginners to decide where to look before they understand the task.

Use explicit connections between representations:

- Selecting an ordinary algorithm transition identifies the relevant process, PlusCal label, and changed variables. Stuttering and termination-related steps need explicit descriptions where no ordinary source action applies.
- Selecting a property highlights the propositions involved and provides a plain-language rendering.
- A trace shows the current state and the change from the previous state, with access to all values.
- A small graph distinguishes a state from a behavior; a behavior traverses the graph and may revisit a state.
- A lasso identifies its loop entry in both text and graphics.

These are proposed design choices. They need usability testing because a representation that seems clarifying to experts may increase novice search effort or hide distinctions.

Offer a way to inspect a different counterexample and ask whether the same repair handles it. The shortest displayed trace need not expose every relevant failure pattern; model-finder studies show why a locally plausible fix can miss the broader obligation. [F5]

### 8.2 Reveal generated TLA+ progressively

Initially permit learners to work with PlusCal while showing that translation occurs. Later expose one generated action and connect its guard, next-state values, unchanged variables, and program-counter movement to a PlusCal step. Eventually let learners inspect the full translation and recognize which parts are generated.

The goal is to avoid two failures: making the translation an unexplained magical step, and asking beginners to understand an entire generated module before they can reason about a small algorithm. Exported work should preserve a path to standard tools and notation.

### 8.3 Separate feedback about different failures

| Detected issue | Useful initial feedback | Next learner action |
| --- | --- | --- |
| Syntax prevents translation | Name the location and syntactic expectation | Repair the expression and retranslate |
| Predicate fails | Identify the state and relevant values | Explain the false subexpression |
| Liveness/progress requirement fails | Identify the repeating portion and unfulfilled obligation | Explain why repeating it defeats progress |
| Wrong formula accepted on current examples | Provide a distinguishing behavior when available | Explain which interpretation it eliminates |
| Possible vacuity | Ask whether the triggering situation is reachable | Find or rule out a witness |
| Model exceeds resources | Report incomplete analysis and current configuration | Reduce irrelevant state or choose a justified smaller instance |
| Unsupported feature | State what cannot be checked in this environment | Use a supported form or the documented external route |

A counterexample distinguishes the submitted object from an expected property. It does not, without additional reasoning, identify the student's mental misconception or the single correct repair. Avoid presenting heuristic diagnosis as certainty.

### 8.4 Hint progression and solution access

Use an attempt-sensitive sequence: orient attention, offer a discriminating case, then provide a partial scaffold. Each hint should enable an action while leaving the central assessed decision to the learner. Full solutions should remain available separately for study and recovery; prolonged unproductive struggle is not a learning objective.

After revealing a solution, ask for a new independent example before interpreting completion as mastery. Record hint use only if needed for instruction or evaluation, and interpret it carefully: seeking help can reflect good self-regulation rather than low ability.

Semantic feedback should accept equivalent correct formulas and legitimate alternative models under an explicit task contract. Exact-text matching is appropriate for neither general formula equivalence nor modeling competence. On a restricted model, two formulas may agree without being generally equivalent; label the scope of any equivalence check.

### 8.5 Accessibility is part of the learning design

Every essential interaction must have a keyboard and screen-reader path. Do not require dragging tokens, seeing color differences, or interpreting animation to solve the task. Pair graphics with structured state tables and readable text describing transitions and loops. Provide explicit names for temporal symbols and a consistent ASCII notation reference.

For a future implementation in this repository, WCAG 2.2 AA is a project requirement. Practical acceptance criteria include visible and unobscured focus, non-drag alternatives, sufficient contrast in both themes, readable paragraph-sized controls and code, resize/reflow support, restrained status announcements, and no forced timing. Print/offline materials should preserve the reasoning task and indicate which checks require a live engine. This report is not an accessibility audit of an implementation.

### 8.6 Latency and failure recovery

Slow feedback can turn a conceptual task into repeated submission or abandonment. Prefer deliberately small models early. Show progress without implying that a partial run establishes correctness. Allow cancellation and retain the learner's work. If source changes while a check is running, the result must identify that it belongs to an earlier revision.

An offline or unavailable-engine route can use precomputed traces for interpretation exercises, clearly labeled as supplied evidence. It must not pretend to have checked the learner's edited specification. Infrastructure performance should be measured separately from student reasoning time.

### 8.7 AI assistance, if included

An AI tutor is optional, not a prerequisite of this design. The central educational feedback should remain grounded in the formal semantics and actual checker output. An AI layer might help rephrase a requirement or prompt an explanation, but should not claim that a model is correct independently of the configured checks.

Require an attempt before targeted assistance when the learner has the needed prerequisites; provide direct explanation when they do not. Keep complete-solution generation separate from assessment. A later independent task is necessary to determine whether assisted success became learning. This review does not establish an educational benefit for an AI assistant in a PlusCal/TLC tutorial.

## 9. Assessment and evaluation

### 9.1 Assess the model, the property, and the explanation

A suggested capstone asks students to model a small service or reservation system, state two safety obligations and one progress obligation, identify any required environment assumption, analyze one counterexample, and report what a completed check establishes. Supply a flawed variant for the diagnostic subtask so that students whose own first model is correct can still demonstrate counterexample analysis.

An illustrative rubric is:

| Dimension | Weight | Evidence |
| --- | --- | --- |
| Model adequacy and abstraction | 25% | Intended behaviors represented; exclusions explained |
| Properties and their interpretation | 25% | Correct scope; relevant positive and negative cases |
| Counterexample diagnosis and justified repair | 20% | Correct reading of evidence; reasoned revision |
| Assumptions and limits | 20% | Fairness, domains, parameters, and implementation gap stated |
| Tool use and reproducibility | 10% | Configured model and results can be reconstructed |

The weights are a proposed course design, not a validated instrument. They deliberately prevent tool operation from dominating conceptual reasoning. Instructors should calibrate against sample submissions and allow multiple valid abstractions.

### 9.2 Build an assessment blueprint before an autograder

For each objective, include at least one item that cannot be solved by following the preceding example mechanically. Useful item families include:

- Explain which transition makes an invariant false.
- Construct a behavior satisfying one temporal formula but not another.
- Detect a vacuous or omitted requirement.
- Predict the effect of changing atomicity without first running the model.
- Decide whether a fairness assumption is justified.
- Explain why a timeout is inconclusive.
- State why a checked finite instance does not establish a claim for every size.
- Transfer the same reasoning to a new small domain.

Avoid overrestrictive graders that reward the instructor's encoding rather than the task's semantics. If an exercise assesses a specific concurrency mechanism, state that requirement in the contract; otherwise a correct alternative should not fail merely for differing internally.

### 9.3 A realistic evaluation sequence

**Stage 1: semantic and task validation.** Review every model, property, expected behavior, and explanation. Check that supposedly distinct answer options really differ, that counterexamples are legal, and that the environment can perform every requested action. This is a prerequisite to studying learning.

**Stage 2: small usability and think-aloud pilot.** Recruit students resembling the intended audience, including students with varying preparation and relevant access needs. Observe where they misread traces, confuse interface status, or cannot locate help. A small pilot can find important problems; it cannot estimate effectiveness reliably or prove their absence.

**Stage 3: course deployment with independent measures.** Use a prerequisite assessment, immediate independent posttest, and delayed transfer task. Report participation, missing data, hint/solution access, and the number of students contributing to each outcome. Collect workload and experience alongside learning, without combining them into a single success score.

**Stage 4: a focused comparison.** After the tutorial is usable, compare one meaningful feature, such as formula feedback alone versus formula feedback plus contrasting traces. Give both groups equivalent content, time, and assessment conditions. Randomize where feasible, consider class-section clustering and peer contamination, and define the main outcome in advance.

Test one or two questions well. A simultaneous redesign of examples, interface, feedback, and teaching time makes it difficult to identify why results changed. For small courses, report uncertainty and descriptive evidence rather than interpreting every nonsignificant finding as equivalence.

### 9.4 Recommended primary and secondary measures

| Measure | Role | Interpretation limit |
| --- | --- | --- |
| Independent delayed interpretation/construction score | Primary candidate for learning | Depends on item validity and follow-up participation |
| Independent near- and farther-transfer task scores | Test generalization | A novel story alone may be only surface transfer |
| Assisted exercise correctness and attempts | Diagnose instructional process | Can improve through hints or guessing without learning |
| Time to correct answer | Efficiency/workload | More time can accompany better reasoning; tool latency confounds it |
| Counterexample explanation quality | Mechanism and conceptual outcome | Requires a reliable rubric and rater calibration |
| Perceived usefulness and confidence | Experience and calibration | Not a substitute for knowledge |
| Completion and persistence | Feasibility and access | Attrition can reflect workload, scheduling, or access barriers |

A useful local adoption criterion is improvement on independent reasoning without unacceptable workload or access costs. Set a meaningful target using the course context and baseline data; the literature does not provide a universal threshold for this tutorial.

### 9.5 Research questions worth pursuing

The strongest open questions are narrow enough to study:

1. Does requiring students to explain a counterexample improve later unaided diagnosis compared with simply displaying it?
2. Does an explicit state-machine bridge reduce negative transfer from imperative programming when students begin PlusCal?
3. When should generated TLA+ become visible, and for which prior-knowledge groups?
4. Do positive-and-negative behavior contrasts improve later formula construction, rather than only current comprehension?
5. Can students distinguish legitimate fairness assumptions from assumptions that conceal failures after the tutorial?
6. Does a new-domain capstone expose weaknesses hidden by successful completion of guided checker tasks?

## 10. Priorities for a first implementation

The first release should be small enough to validate thoroughly. Prioritize a reliable checking path, accurate result classification, accessible trace inspection, a small set of high-value contrasting cases, and independent assessments. Add sophisticated adaptation only after the task data show what learners need.

| Priority | Proposed capability | Reason to build it early |
| --- | --- | --- |
| Essential | Faithful PlusCal translation and TLC checking, with explicit configuration | The environment must teach the actual semantics |
| Essential | Accessible state/transition/loop evidence | Counterexample interpretation is central |
| Essential | Prediction and explanation checkpoints | Make reasoning observable |
| Essential | Formula contrasts and model-validation tasks | Address misconceptions and inadequate specifications |
| Essential | Clear incomplete/failed/successful analysis states | Prevent invalid verification claims |
| Essential | Independent and delayed assessment items | Measure learning beyond guided success |
| Next | Attempt-sensitive hints and targeted remediation | Support identifiable difficulties |
| Next | Progressive generated-TLA+ view and standard-tool export | Support transfer beyond the tutorial |
| Later | Large adaptive item bank, rich game layers, AI dialogue | Benefits and maintenance costs need local evidence |

A browser tutorial does not require the entire verification engine to execute inside the browser. Browser-local and isolated server execution are architectural alternatives to evaluate for latency, resource limits, privacy, reliability, and deployment cost. The reviewed educational literature does not resolve that engineering choice. This report specifies pedagogical behavior rather than claiming an existing backend can already provide it.

The most important authoring discipline is to keep a visible chain from **requirement → learner decision → evidence → feedback → independent check**. That chain is more consequential than the number of animations, badges, or editor features.

## 11. Annotated evidence catalogue

Source cards and the search audit follow. Access dates refer to this review, 29 October 2026.

### 11.1 TLA+, PlusCal, and TLC teaching

**T1. Läufer, K., Mertin, G., and Thiruvathukal, G. K. (2024). _WIP: An Engaging Undergraduate Intro to Model Checking in Software Engineering Using TLA+_. IEEE Frontiers in Education, 1–5.** [Published paper][T1]; [inspected author manuscript](https://arxiv.org/html/2407.21152v2), especially Sections III–V.

One-institution course report for upper-level undergraduates and graduates. Enrollment was 15 in Fall 2022 and 22 in Spring 2024; the Spring survey had **19 respondents**, with an equally weighted composite increasing from 3.0 to 4.1 and 84% reporting a positive experience. No controlled independent learning or delayed-transfer measure was reported. Useful direct curriculum precedent; weak evidence of learning gains. The related 2024 *Computer* article and 2025 notebook proposal are not independent replications.

**T2. Kuppe, M. A. (2023). _Teaching TLA+ to Engineers at Microsoft_. FMTea, LNCS 13962, 66–81.** [Publisher][T2]; [university-hosted proceedings](https://sites.mdu.se/download/18.677014f8188516ff46a26db2/1686387789484/Teaching%20and%20Training%20in%20Formalisation%20with%20B.pdf), chapter Sections 2–3 inspected.

Two-day professional course; more than 300 attendees across more than 25 classes, but **94 survey respondents** from more than 200 surveyed. Forty-seven reported workplace usefulness and 47 did not. Many requested preparation material or additional exercises. No controlled or unaided learning outcome. A sustained termination-detection problem provides a useful curriculum example, with substantial limits on transfer to undergraduates. Selection bias and attendance/respondent differences matter. Primary records correct a false author attribution returned by SciSpace.

**T3. Lamport, L. (2009). _Teaching Concurrency_. ACM SIGACT News, 40(1), 58–62.** [DOI][T3]; [author version with later corrections](https://lamport.azurewebsites.net/pubs/teaching-concurrency.pdf), complete short paper inspected.

Expert pedagogical argument, not an intervention study. Centers concurrency education on states, behaviors, precise requirements, and mathematical descriptions of transitions, with PlusCal as an approachable algorithm notation. It supplies a domain-grounded rationale for the proposed state-machine bridge. There is no participant sample, comparator, or measured advantage for the proposed order. Use it to check what the tutorial should teach, not to claim the optimal teaching method has been empirically established.

**T4. McKee, D., Lin, Z., Fox, B., Li, J., Zhu, J., Seif El-Nasr, M., and Sorensen, T. (2026). _Parallel X: Redesigning of a Parallel Programming Educational Game with Semantic Foundations and Transfer Learning_. SIGCSE TS, Volume 1.** [DOI][T4]; [author PDF](https://tyler-utah.github.io/files/parallelx2025.pdf), design and Section 5 inspected.

A randomized **eight-undergraduate usability pilot**, with sessions of at most 40 minutes, compared game versions. The backend translates game states through PlusCal/TLA+ and uses TLC. Only one participant completed the planned sequence; later game-to-code transfer levels were not evaluated. Thus the title's transfer objective is not demonstrated transfer effectiveness. Useful evidence of a relevant tool architecture and interface issues, not of learning TLA+ authoring. The filename says 2025; the publication is SIGCSE TS 2026.

**T5. Merz, S. (2019). _Re: university courses using TLA+?_ Public instructor discussion, 30 April.** [Archived quotation of the account][T5]; [Merz's subsequent reply](https://discuss.tlapl.us/msg02805.html).

Informal first-person experience, accessed through indexed archive text; direct archive retrieval was intermittent. Describes mixed experience introducing PlusCal/TLC alongside fourth-year distributed algorithms without sufficient time for language instruction. A switch to Python-based DistAlgo was reportedly better received, while losing exhaustive exploration. No sample, formal comparison, or learning assessment. Retained as a caution about combined novelty and insufficient instruction, not as evidence against PlusCal or proof of another language's superiority.

**T6. Carro, M., Herranz, Á., and Mariño, J. (2013). _A Model-Driven Approach to Teaching Concurrency_. ACM TOCE, 13(1), Article 5.** [DOI][T6]; [author PDF](https://cliplab.org/papers/carro04:teaching_concurrency.pdf), especially Sections 5.1–5.2.

Observational cohort of **63 students**: 23 chose the resource-model/code-generation method and 40 did not. Good-code proportions were 15/23 and 23/40; theory means were 6.48 and 6.15. Self-selection and small subgroups prevent causal interpretation. TLC validates teaching models; this is not a controlled comparison of TLA+ teaching methods. The model-to-code connection is relevant, but weaker-preparation subgroup results caution against assuming scaffolding benefits everyone equally.

**T7. Zeller, P., Bieniusa, A., and Ferreira, C. (2020). _Teaching practical realistic verification of distributed algorithms in Erlang with TLA+_. Erlang Workshop, 14–23.** [DOI][T7]; [institutional abstract](https://novaresearch.unl.pt/en/publications/teaching-practical-realistic-verification-of-distributed-algorith/).

**Abstract and metadata only**; publisher full text was inaccessible. Describes hands-on teaching that derives TLA+ models from Erlang broadcast algorithms and uses model executions to revise designs. Useful precedent for an advanced implementation/model comparison. No sample size, detailed assessment, or quantitative result is asserted here. The abstract's account of a practical course does not establish effectiveness for beginning undergraduate modelers.

**T8. Wayne, H. (living resource). _Learn TLA+_, PlusCal and TLA+ chapters.** [PlusCal entry][T8]; [transition to TLA+](https://www.learntla.com/core/tla.html), introductory rationale and transition example inspected.

Practitioner curriculum. Advocates PlusCal-first for programmers while offering alternatives, and later connects a familiar algorithm to `Init` and `Next`. This informs a possible bridge between representations. The ordering preference is based on teaching experience, without a verified comparative sample or delayed-learning outcome. It should remain an explicit hypothesis when choosing this tutorial's entry route.

**T9. Läufer, K., and Thiruvathukal, G. K. (2025). _TLA+ for All: Model Checking in a Python Notebook_. TLA+ Community Event at ETAPS, short-presentation proposal.** [Primary event paper][T9], all three pages inspected.

Describes running command-line TLA+ tools through a Python notebook, including model loading, checking, and expression evaluation. Relevant to reducing setup work and providing reproducible examples. It is a tool/curriculum proposal in the T1 lineage, not an independent learning study or a measured demonstration that notebooks outperform other interfaces. Account and hosting requirements would still need local consideration.

### 11.2 Temporal logic, specification comprehension, and validation

**L1. Greenman, B., Saarinen, S., Nelson, T., and Krishnamurthi, S. (2023). _Little Tricky Logic: Misconceptions in the Understanding of LTL_. The Art, Science, and Engineering of Programming, 7(2), Article 7.** [DOI][L1]; [author PDF](https://cs.brown.edu/people/sk/Publications/Papers/Published/gsnk-little-tricky-logic/paper.pdf), methods/results/limitations inspected.

Four rounds involved 90 students, 57 students, 29 LTL-exposed researchers, and 11 student think-aloud participants, with instruments and conditions changing. Examined trace satisfaction, formula explanation, and formula writing. Errors included unintended scope, wrong evaluation state, and strong-until misunderstandings. These are observational misconception findings, not an instructional treatment effect. Same-site students, task simplicity, English interpretation, and coding judgments limit generalization. Published in 2023; the 2022 preprint is not another study.

**L2. Greenman, B., Prasad, S., Di Stasio, A., Zhu, S., De Giacomo, G., Krishnamurthi, S., Montali, M., Nelson, T., and Zizyte, M. (2024). _Misconceptions in Finite-Trace and Infinite-Trace Linear Temporal Logic_. FM, 579–599.** [Publisher][L2]; [author PDF](https://users.cs.utah.edu/~blg/publications/hf/gpdzdkmnz-fm-2024.pdf), including Table 1 and threats.

Finite-trace survey counts were 22, 18, and 24; infinite-LTL novice rounds had 31 and 24 anonymous responses from one course population. These are not all known-independent participants. Formula construction was harder than trace matching; endpoint, next-state, and prefix-constraint issues were identified. No controlled learning intervention. Differing questions and unpaired rounds prevent reading changes as learning gains. Particularly relevant to avoiding semantic mismatches in trace widgets.

**L3. Prasad, S., Greenman, B., Nelson, T., and Krishnamurthi, S. (2025). _A Misconception-Driven Adaptive Tutor for Linear Temporal Logic_. CAV, 185–200.** [Publisher][L3]; [author paper](https://cs.brown.edu/~sk/Publications/Papers/Published/pgnk-ltl-tutor/paper.pdf); [implementation](https://github.com/brownplt/LTLTutor).

Full tool paper inspected. Generates misconception-related distractors, supports trace/formula practice and feedback, and adapts subsequent questions. It assumes introductory logic/LTL preparation. The paper reports an implemented system rather than a controlled learner-outcome evaluation. It does not automate every relevant ability, including unrestricted explanation. Treat its particular repeated-error thresholds as implementation choices, not validated pedagogical constants. Useful feature precedent; efficacy and transfer remain to be tested.

**L4. Salamah, S., Ochoa, O., and Gates, A. Q. (2010). _A Comparative Study of a Tool-Based Approach for Teaching Formal Specifications_. IEEE Frontiers in Education, S2D-1–S2D-6.** [DOI][L4]; [author PDF](https://www.cs.utep.edu/isalamah/publications/C16.pdf), full methods/results inspected.

Novice groups at two institutions received additional lecture, LTLV practice, or no additional treatment after common instruction. Three-day final means were **60/61% tool, 63/64% lecture, and 55/51% home**, respectively. Novice group counts and randomization were not reported in the inspected paper. A separate uncontrolled experienced group, **N=12**, increased from 60% to 72%. Missing uncertainty, baseline imbalance, and differing incentives restrict inference. These data do not establish tool superiority or equivalence to lectures.

**L5. Salamah, S., Roach, S., Ochoa, O., Medina, V., and Gates, A. Q. (2009). _An Experiment To Evaluate An Approach To Teaching Formal Specifications Using Model Checking_. ASEE Annual Conference & Exposition.** [Proceedings][L5]; [author PDF](https://www.cs.utep.edu/isalamah/publications/C18.pdf), full text inspected.

Despite the title, Section 6 states that results were unavailable at writing. Approximately 60 and 25 students were planned recruitment, not achieved analytic samples. The protocol usefully separates unaided predictions and tool-assisted correction. It cannot support an efficacy claim and must not be merged with the different 2010 study design. This is a particularly important example of why titles and optimistic abstract language are insufficient evidence.

**L6. Shevrin, I., Grunske, L., and Maoz, S. (2026). _An Empirical Study on the Impact of Example Traces on Linear Temporal Logic Comprehension_. ACM TOSEM.** [DOI][L6]; [author publication list](https://www.cs.tau.ac.il/~maozs/publications.html).

**Publication verified; primary methods unavailable.** Index mirrors describe a comparison of comprehension with and without positive/negative traces, but ACM requests failed and primary statistical details were not inspected. This report therefore does not rely on the numerical sample or efficacy claims in those mirrors. The paper is an important current follow-up to retrieve before making stronger claims about example traces. Aided comprehension, if improved, would still need to be distinguished from learning after the examples are removed.

**L7. Ma'ayan, D., Maoz, S., and Rozi, R. (2022). _Validating the Correctness of Reactive Systems Specifications Through Systematic Exploration_. MODELS, 132–142.** [DOI][L7]; [author PDF](https://dormaayan.github.io/assets/pdf/MODELS22.pdf), user study and threats inspected.

Twenty senior undergraduates worked in ten pairs on a three-week traffic-junction specification assignment. After their own validation, they used a coverage-guided exploration tool; **nine of ten teams found previously undetected bugs**. This is aided bug discovery in a sequential, uncontrolled setting, with extra examination time and possible order effects. It supports the relevance of validating intent, not a causal learning-gain claim. Spectra reactive synthesis differs from TLC, so the proposed tutorial adaptation is an inference.

**L8. Salamah, S., and Gates, A. Q. (2008). _A Technique for Using Model Checkers to Teach Formal Specifications_. CSEE&T, 181–188.** [DOI][L8]; [author PDF](https://www.cs.utep.edu/isalamah/publications/C24.pdf).

Instructional-method and tool paper; relevant full-text sections inspected. Uses SPIN and specification patterns to expose accepted behaviors, compare predictions with analysis, and construct properties. It provides a direct predecessor for a predict/check/explain activity but no verified controlled effect or analytic learner sample. Porting the pattern to TLC requires adapting notation and behavior semantics. Related to L4–L5, rather than an independent replication of their outcomes.

**L9. Dwyer, M. B., Avrunin, G. S., and Corbett, J. C. (1999). _Patterns in Property Specifications for Finite-State Verification_. ICSE, 411–420.** [DOI][L9]; author-uploaded full text and corpus results inspected.

The unit of analysis was **555 property specifications**, drawn from at least 35 sources; 511 fit the pattern system. This is pattern coverage, not 555 learners or a teaching experiment. It supports organizing introductory properties by intent and scope, while retaining boundary-case checks. The corpus is not a representative sample of every requirement. “Finite-state verification” does not mean finite-trace LTL semantics.

**L10. Li, R., Gurushankar, K., Heule, M. J. H., and Rozier, K. Y. (2023). _What's in a Name? Linear Temporal Logic Literally Represents Time Lines_. IEEE VISSOFT, 73–83.** [DOI][L10]; [author PDF](https://runmingl.github.io/paper/ltl.pdf).

Implemented `ltl2timeline` visualization, correctness argument, and benchmark evaluation; full relevant sections inspected. Represents satisfying behavior sets using automata and omega-regular expressions. No human learning study was reported. Useful technical precedent for faithful infinite-behavior visualization, but compact output and algorithmic performance do not demonstrate novice comprehension. A complex visualization notation itself requires instruction and testing.

### 11.3 Broader formal-methods and model-checking education

**F1. Nelson, T., et al. (2024). _Forge: A Tool and Language for Teaching Formal Methods_. PACMPL, 8(OOPSLA1), Article 116.** [DOI][F1]; [author PDF](https://tnelson.github.io/publications/forge-oopsla24.pdf), especially Section 7.

Descriptive use in Brown's Logic for Systems elective: 92 enrolled in 2022 and 64 in 2023, with smaller and varying survey denominators. Language levels, tests, and customizable instance views support staged teaching. Surveys identified temporal and programming-style interpretation issues; visualization authoring introduced JavaScript and time costs. No randomized teaching comparison. Relevant inference: supply initial visualizations and stage expressive power, while separately assessing understanding. Institutional selectivity, grouped projects, and evolving tool/course design limit transfer.

**F2. Mansoor, N., Bagheri, H., Kang, E., and Sharif, B. (2023). _An Empirical Study Assessing Software Modeling in Alloy_. FormaliSE, 44–54.** [DOI][F2]; [author PDF](https://eskang.github.io/assets/papers/formalise23-Alloy.pdf), methods/results/threats inspected.

Remote task study with **30 participants: 17 novices and 13 non-novices**. Expertise was not randomized; task order was. Bug-fix accuracy averaged 5.588/10 and 8.615/10, respectively, while the large mean time difference was not significant (`p=.28`). Both groups struggled with construction, especially dynamic modeling. Small samples, self-selection, experience confounding, and tool availability limit inference. The study supports separating repair from authoring in assessment, not a causal claim about a teaching intervention.

**F3. Macedo, N., Cunha, A., Pereira, J., Carvalho, R., Silva, R., Paiva, A. C. R., Ramalho, M. S., and Silva, D. (2021). _Experiences on teaching alloy with an automated assessment platform_. Science of Computer Programming, 211, 102690.** [DOI][F3]; [author manuscript](https://repositorio.inesctec.pt/server/api/core/bitstreams/b372fec0-ce79-477c-9e13-7d71fd302c11/content), Sections 5–6 inspected.

Graduate-course experience with Alloy4Fun. Two course editions enrolled 17 and 25; 30/42 answered a questionnaire. Approximately 35,000 interactions are not 35,000 learners. Many respondents valued counterexamples, with acceptance/rejection labels especially relevant. Low execution-success percentages for some temporal challenges are attempt-level outcomes, not mastery rates. Anonymous repeated attempts and challenge differences limit interpretation; no causal learning comparison. The 2020 and 2021 publications belong to the same evolving research lineage.

**F4. Braught, K., Li, Y., Driggs-Campbell, K., and Mitra, S. (2025). _“Too Theoretical and Nowhere Near Interesting”: Using a Tool to Increase Student Motivation for Formal Methods_. ITiCSE, 187–193.** [DOI][F4]; [author PDF](https://mitras.ece.illinois.edu/research/2025/ITICSE25-Verse.pdf), full methods/results inspected.

Upper-level Safe Autonomy course: **57 complete survey cases**, including 20 graduates, with randomized task order (30/27) for testing and Verse verification activities. Overall motivation change was **+0.028, `p=.167`**; differences between testing and verification changes were also nonsignificant. No objective learning measure. Selected-course population, complete-case attrition, carryover, and task differences matter. Nonsignificance is not equivalence, and the result supports neither universal tool benefits nor universal tool failure.

**F5. Danas, N., Nelson, T., Harrison, L., Krishnamurthi, S., and Dougherty, D. J. (2017). _User Studies of Principled Model Finder Output_. SEFM, 168–184.** [DOI][F5]; [author PDF](https://tnelson.github.io/publications/dnhkd-sefm17-studies.pdf), classroom studies inspected.

Advanced students used specialized model-finder outputs. In minimal/maximal counterexample groups of 35/25, **28/35 and 10/25 abandoned the specialized outputs** for ordinary Alloy. Minimal examples could focus repairs too narrowly on self-loops. Heavy differential attrition makes completer comparisons unreliable. The useful lesson is not that minimal examples are bad: offer interpretable evidence, varied cases, and a check that a repair addresses the broader property. These are task findings, not demonstrated delayed learning effects.

**F6. Freiberger, F. (2023). _Model Checking Concurrent Programs for Autograding in pseuCo Book_. FMTea, 51–65.** [DOI][F6]; [author PDF](https://depend.cs.uni-saarland.de/~freiberger/papers/Model%20Checking%20Concurrent%20Programs%20for%20Autograding%20in%20pseuCo%20Book.pdf), Sections 1–4 inspected.

Technical and instructional integration paper. A Petri-net-based verifier supports in-browser concurrency exercises, trace debugging, and checks of required internal concurrency behavior. This is a useful precedent for semantically meaningful autograding. The inspected contribution does not provide a controlled learner-outcome evaluation. It uses a different language and engine from PlusCal/TLC; its implementation cannot establish that the same performance or deployment properties hold for TLC.

**F7. Körner, P., and Krings, S. (2021). _Increasing Student Self-Reliance and Engagement in Model-Checking Courses_. FMTea, 60–74.** [DOI][F7]; [author PDF](https://krin.gs/publication/koerner-mc-throughout-the-years-fmtea21/koerner-mc-throughout-the-years-fmtea21.pdf), context and course-evolution sections inspected.

Experience report on successive **master's-level** course designs, emphasizing implementation of model-checking algorithms and inquiry-oriented work. Useful for recognizing a theory-to-tool transfer problem and distinguishing learning to use a checker from learning to implement one. Historical iterations and informal/limited feedback do not establish causal improvement. Its advanced, implementation-centered curriculum should not be imported wholesale into a novice web tutorial.

**F8. Noble, J., Streader, D., Gariano, I. O., and Samarakoon, M. (2022). _More Programming Than Programming: Teaching Formal Methods in a Software Engineering Programme_. NASA Formal Methods, 431–450.** [DOI][F8]; [author manuscript](https://arxiv.org/abs/2205.00787), evaluation and trade-offs inspected.

Dafny-centered third-year course with automated formative questions. Survey response was **19 of 88 enrolled**, with favorable ratings relative to historical courses. Confounding changes and low response prevent causal inference. Particularly relevant is the authors' distinction between producing verifier-accepted preconditions with assistance and deriving their formal justification. Deductive verification differs from model checking, but the assessment warning transfers: assisted artifact success is not independent reasoning competence.

**F9. Vescan, A., and Frențiu, M. (2010). _Teaching Model Checking to Undergraduates_. Studia Universitatis Babeș-Bolyai Informatica, 55(3), 45–50.** [Primary paper][F9], full text inspected.

Instructor report on a lecture, two-hour Spin/jSpin/Promela lab, and homework; no analytic sample or controlled estimate. Describes students who encoded puzzle solutions instead of rules, copied models without understanding them, or confused state-space checking with execution. These observations motivate diagnostic questions but do not establish prevalence. A short, older intervention cannot determine which modern web design will overcome these problems.

**F10. Roychoudhury, A. (2006). _Introducing Model Checking to Undergraduates_. Formal Methods Education Workshop, FM-Ed.** [Author paper][F10], full short paper inspected.

Five-year instructor reflection on undergraduate teaching with discrete-math and systems prerequisites. Identifies difficulties moving from programs to transition systems, interpreting reactive infinite executions, and using temporal logic. Suggests early modeling and practical projects. No analytic sample, controlled learning outcome, or systematic project-preference estimate. Relevant to task sequencing and problem selection, with caution about transferring a semester project format to a short tutorial.

**F11. Prasetya, I. S. W. B., et al. (2019). _Having Fun in Learning Formal Specifications_. ICSE-SEET, 192–196.** [DOI][F11]; [author preprint](https://arxiv.org/abs/1903.00334), evaluation inspected.

FormalZ game playtest of approximately 30 minutes, with **26 questionnaire respondents** from a bachelor-level course. Experience was generally positive, but resource-management understanding was mixed and some feedback unclear. No control or independent learning measure; the paper leaves effectiveness unconfirmed. Retained to distinguish game usability from learning. A later 2020 follow-up was discovered but not inspected, so this is not presented as the complete or latest FormalZ evidence.

### 11.4 General pedagogy and computing-education foundations

**P1. Freeman, S., et al. (2014). _Active learning increases student performance in science, engineering, and mathematics_. PNAS, 111(23), 8410–8415.** [Publisher][P1], methods and reported aggregate results inspected.

Meta-analysis of 225 undergraduate STEM studies: 158 contributed examination/concept-inventory outcomes and 67 failure outcomes. Broad support for meaningful active learning relative to traditional lecture, with heterogeneous interventions and settings. It does not identify the best web interaction, resolve PlusCal-first sequencing, or supply a local forecast. Use as indirect support for requiring substantive student reasoning.

**P2. Margulieux, L. E., Morrison, B. B., and Decker, A. (2020). _Reducing withdrawal and failure rates in introductory programming with subgoal labeled worked examples_. International Journal of STEM Education, 7, Article 19.** [Full publisher article][P2], design and results inspected.

Quasi-experiment across five Java CS1 sections, **265 students**, with conventional versus subgoal-labeled worked examples. The materials differed during five weeks of a semester. Formative results and course persistence were more favorable than average exam outcomes, underscoring that effects depend on the measure. Nonrandom sections and a different content domain limit direct transfer. The proposed modeling subgoals need their own validation.

**P3. Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., and Willingham, D. T. (2013). _Improving Students' Learning With Effective Learning Techniques: Promising Directions From Cognitive and Educational Psychology_. Psychological Science in the Public Interest, 14(1), 4–58.** [Publisher article][P3]; [journal overview](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html).

Broad review of ten learning techniques; summary and relevant practice recommendations inspected. Practice testing and distributed practice received high utility ratings, while several other techniques were more conditional. The populations, materials, and outcomes vary. This supports delayed revisiting of important distinctions but not a particular spacing formula or assurance that recall questions alone teach model construction.

**P4. Chi, M. T. H., and Wylie, R. (2014). _The ICAP Framework: Linking Cognitive Engagement to Active Learning Outcomes_. Educational Psychologist, 49(4), 219–243.** [DOI][P4]; [author-hosted PDF](https://education.asu.edu/sites/default/files/lcl/chiwylie2014icap_2.pdf), framework and caveats inspected.

Framework with supporting empirical synthesis, rather than a trial of a formal-methods tutorial. Distinguishes passive, active, constructive, and interactive engagement. Its useful design implication is to elicit new explanations and substantive comparison of reasoning, rather than equating interface activity with cognitive work. Categories are a design lens, not a validated automatic score for every student action.

**P5. Hundhausen, C. D., Douglas, S. A., and Stasko, J. T. (2002). _A Meta-Study of Algorithm Visualization Effectiveness_. Journal of Visual Languages & Computing, 13(3), 259–290.** [Publisher][P5]; [author PDF](https://faculty.cc.gatech.edu/~stasko/papers/jvlc02.pdf).

Publisher abstract and indexed author-paper text inspected; direct PDF retrieval timed out. Synthesizes 24 experimental evaluations and emphasizes how learners use visualization. Relevant but indirect and historical evidence for designing prediction, construction, and explanation around a display. It does not establish that any proposed TLC graph or trace widget improves learning, nor that more animation is better.

**P6. Shute, V. J. (2008). _Focus on Formative Feedback_. Review of Educational Research, 78(1), 153–189.** [DOI][P6]; [author PDF](https://myweb.fsu.edu/vshute/pdf/shute%202008_b.pdf), methods and feedback conditions inspected.

Research review emphasizing specific, supportive, usable feedback, with substantial dependence on task, prior knowledge, and timing. Supports feedback that gives a learner something to do next. It does not justify one universal hint count, automatic immediate interruption after every action, or indefinite withholding of a complete explanation. The proposed hint sequence remains an adaptation requiring local checks.

### 11.5 Technical sources, used for semantics rather than effectiveness

**R1. Lamport, L. (2024). _A PlusCal User's Manual, C-Syntax, Version 1.8_, 11 March.** [Official manual][R1]. Sections on labels/atomicity, checking, constraints, and temporal operators inspected. Authoritative reference for the language; no instructional effectiveness inference.

**R2. Lamport, L. _Specifying Systems: The TLA+ Language and Tools for Hardware and Software Engineers_.** [Author's book PDF][R2], first-printing version dated 18 June 2002, PDF recreated in 2020. Contents and relevant semantic reference material consulted; the whole book was not read for this review. Use as the technical authority for models, behaviors, temporal reasoning, and verification scope, not as an evaluated curriculum.

**R3. Lamport, L. (2000). _A Summary of TLA+_, 25 August.** [Official summary][R3]. Action/temporal operators and ASCII spellings inspected. A compact notation reference, not a complete account of TLC support or current tooling.

**R4. Lamport, L. (2021 version). _The PlusCal Tutorial_.** [Official tutorial][R4]; [contents](https://lamport.azurewebsites.net/tla/tutorial/contents.html). Home, contents, and selected material consulted. A useful curriculum and example source; its existence and author expertise do not establish learning effectiveness.

## 12. Search audit, uncertainties, and verification

### 12.1 Representative exact discovery queries

These are actual queries used in this review, rather than a proposed future strategy. Additional exact-title, DOI, author, and primary-copy searches followed individual results.

| Service | Query or operation | Purpose and result |
| --- | --- | --- |
| SciSpace | “What empirical studies and experience reports evaluate teaching TLA+, PlusCal and the TLC model checker to undergraduate students or professional software engineers?” | Direct teaching literature; primary verification required to correct metadata |
| SciSpace | “What studies published in 2024, 2025, or 2026 investigate teaching TLA+ or PlusCal specification and model checking in computing education?” | Recent coverage; returned older and irrelevant material too |
| SciSpace | “What empirical studies and experience reports investigate teaching undergraduate students formal modeling and model checking using Alloy, SPIN, NuSMV, TLA+ or PlusCal?” | Broader formal-methods strand |
| SciSpace | “What empirical classroom studies evaluate Alloy4Fun, Forge, and Logic and Magic for teaching formal methods to undergraduate students?” | Tool-based education; no usable intervention with the exact name “Logic and Magic” was verified |
| SciSpace | “What empirical studies investigate how university students learn linear temporal logic, their misconceptions about infinite and finite traces, and interactive tools for learning temporal specification?” | Misconception and tutor studies |
| SciSpace | “What empirical research evaluates worked examples, self-explanation, feedback and interactive visualizations for teaching formal specification and model checking to undergraduate computer science students?” | Cross-check connecting the disciplinary and pedagogical strands |
| Sider/OpenAlex | `TLA PlusCal teaching` | Direct-term search; important teaching papers were missed by this query alone |
| Sider/OpenAlex | `Temporal Logic Actions education`, from 2024, newest first | Recent check; low specificity, many unrelated results |
| Sider/OpenAlex | `teaching model checking undergraduate` | Broad discovery; substantial unrelated results |
| Sider/OpenAlex | `model checking education pedagogy` | Very noisy; unrelated pedagogy records excluded |
| Sider/OpenAlex | `"formal methods" education` | Phrase-based coverage check |
| Sider/OpenAlex | `"formal methods" teaching`, from 2024, newest first | Recent formal-methods check; insufficient alone for venue coverage |
| Sider/OpenAlex | `linear temporal logic misconceptions` and `"linear temporal logic" misconceptions` | Recovered L1–L3 and the 2026 L6 record |
| Sider/OpenAlex | `temporal logic specification empirical` | Broader specification search; many algorithm papers excluded from teaching evidence |
| Sider/OpenAlex | DOI lookup for `10.1109/FIE.2010.5673599` | Metadata check before locating an author manuscript |
| Sider/OpenAlex | DOI lookup for `10.48550/arXiv.2407.21152` | Identified the TLA+ education seed record |
| Web, primary follow-up | `"TLA+" "SIGCSE" "2024"`; `"TLA+" "SIGCSE" "2025"`; `"TLA+" "2026" "students" "model checking"` | Targeted recent venue checks; Parallel X located in SIGCSE TS 2026 |
| Web, primary follow-up | `"An Empirical Study Assessing Software Modeling in Alloy"`; `"Too Theoretical and Nowhere Near Interesting"`; `"Danas" "User Studies" "Model"` | Retrieve empirical methods and contrary/null results |
| Web, primary follow-up | `"LTL" "misconceptions" Nelson`; `"LTL Tutor" evaluation`; `"A comparative study of a tool-based approach" pdf` | Retrieve primary temporal-logic evidence |

### 12.2 Light citation snowballing

The T1 manuscript's references led to checks of Lamport's concurrency article, Kuppe's professional course, Körner and Krings' model-checking course, and Freiberger's autograding work. The T1 OpenAlex preprint record was `W4402502773`; a forward search with `cites:W4402502773` returned no records through the connector. This does not establish that the paper is uncited, especially because preprint and proceedings records can differ.

The L1 OpenAlex seed was `W4308243713`. A forward query with `cites:W4308243713` recovered the finite/infinite-trace follow-up and adaptive tutor, alongside noneducational specification and systems work. The former were retained; unrelated solver, robotics, and synthesis papers were not treated as human learning evidence. Author bibliographies and paper references supplemented the citation query.

Duplicate preprints, published papers, and follow-on datasets were reconciled by title, DOI, authors, and study lineage. In particular, the LTL misconception/tutor papers form a related program, Salamah's 2008–2010 papers differ in whether results exist, and Alloy4Fun's successive reports are not independent intervention replications.

### 12.3 Access and coverage limitations

- Some ACM and other publisher pages returned access errors. Author and institutional manuscripts were used where available. L6 remains a verified publication with uninspected primary methods; T7 remains abstract-level.
- Search-service metadata contained errors, including Kuppe's authorship and the publication year of L1. Crawl dates and PDF filenames were not treated as publication dates.
- NuSMV/NuXMV and other tools appeared in broader discovery, but this report's strongest inspected evidence is concentrated in TLA+, LTL, Alloy/Forge, Spin, and adjacent verification education. It is not an exhaustive comparison of every formalism.
- This review did not establish a controlled head-to-head comparison of PlusCal-first and TLA+-first instruction, or a validated full undergraduate PlusCal/TLC/LTL web curriculum with delayed independent transfer outcomes. That is a bounded search finding, not proof that no such evidence exists.
- Current leads with insufficient inspection were not promoted into efficacy evidence. These include the 2026 FMTea paper *Autograding Weakest Precondition Proofs and Dafny Specifications*, a 2025 Z3Guide technical report, and later FormalZ evaluation work.
- Industry success stories, expert preference, tool benchmarks, and AI-generated specification quality were not substituted for evidence about student learning.

### 12.4 Verification of this report

The original lost-update schedules and temporal truth table were independently enumerated with a small transient computation. The illustrative PlusCal fragments are not complete modules and were not executed by TLC. Technical and pedagogical review checked the distinctions between state/action/behavior, finite prefixes and infinite continuations, aided outcomes and learning, and assumptions versus guarantees.

No tutorial runtime was implemented or assessed. No full-site accessibility, browser, or test-suite result is claimed. The output is a single Markdown research report with linked sources and explicitly labeled design proposals.

[T1]: https://doi.org/10.1109/FIE61694.2024.10893422
[T2]: https://doi.org/10.1007/978-3-031-27534-0_5
[T3]: https://doi.org/10.1145/1515698.1515713
[T4]: https://doi.org/10.1145/3770762.3772657
[T5]: https://discuss.tlapl.us/msg02804.html
[T6]: https://doi.org/10.1145/2414446.2414451
[T7]: https://doi.org/10.1145/3406085.3409009
[T8]: https://www.learntla.com/core/pluscal.html
[T9]: https://conf.tlapl.us/2025-etaps/laufer.pdf
[L1]: https://doi.org/10.22152/programming-journal.org/2023/7/7
[L2]: https://doi.org/10.1007/978-3-031-71162-6_30
[L3]: https://doi.org/10.1007/978-3-031-98685-7_9
[L4]: https://doi.org/10.1109/FIE.2010.5673599
[L5]: https://peer.asee.org/5809
[L6]: https://doi.org/10.1145/3812536
[L7]: https://doi.org/10.1145/3550355.3552425
[L8]: https://doi.org/10.1109/CSEET.2008.25
[L9]: https://doi.org/10.1145/302405.302672
[L10]: https://doi.org/10.1109/VISSOFT60811.2023.00018
[F1]: https://doi.org/10.1145/3649833
[F2]: https://doi.org/10.1109/FormaliSE58978.2023.00013
[F3]: https://doi.org/10.1016/j.scico.2021.102690
[F4]: https://doi.org/10.1145/3724363.3729116
[F5]: https://doi.org/10.1007/978-3-319-66197-1_11
[F6]: https://doi.org/10.1007/978-3-031-27534-0_4
[F7]: https://doi.org/10.1007/978-3-030-91550-6_5
[F8]: https://doi.org/10.1007/978-3-031-06773-0_23
[F9]: https://www.cs.ubbcluj.ro/~studia-i/contents/2010-3/04-VescanFrentiu.pdf
[F10]: https://abhikrc.com/pdf/fm-ed06.pdf
[F11]: https://doi.org/10.1109/ICSE-SEET.2019.00028
[P1]: https://doi.org/10.1073/pnas.1319030111
[P2]: https://doi.org/10.1186/s40594-020-00222-7
[P3]: https://doi.org/10.1177/1529100612453266
[P4]: https://doi.org/10.1080/00461520.2014.965823
[P5]: https://doi.org/10.1006/jvlc.2002.0237
[P6]: https://doi.org/10.3102/0034654307313795
[R1]: https://lamport.azurewebsites.net/tla/c-manual.pdf
[R2]: https://lamport.azurewebsites.net/tla/book-02-08-08.pdf
[R3]: https://lamport.azurewebsites.net/tla/summary.pdf
[R4]: https://lamport.azurewebsites.net/tla/tutorial/home.html
