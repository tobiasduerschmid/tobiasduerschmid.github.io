# PlusCal tutorial: evidence-informed design

This author-facing rationale connects the ten-lesson `pluscal` tutorial to the
[research review](pluscal-tlc-ltl-pedagogy-research.md). Source identifiers below
match that review, which records methods, access limits, and threats to validity.
Student instructions belong in `_data/tutorials/pluscal.yml`.

The audience is undergraduates familiar with variables, conditionals, and loops,
without prior formal-methods instruction. Plan two sittings, separating lessons
1–5 from 6–10. **110–120 minutes is an author estimate, not measured completion
time.** Playlists, ticket reservations, and uploads are relevance choices; no
evidence establishes a distinct “Gen Z” learning profile or their demographic
effectiveness.

## What the evidence supports

The sequence responds to documented difficulties and uses adjacent teaching
evidence; it is not a validated intervention. The direct TLA+ course report
[T1] measured self-reports from 19 respondents, not independent learning gains.
The comparative LTL teaching study [L4] did not establish tool superiority over
additional lectures. Forge and Alloy findings transfer imperfectly to PlusCal.
Technical references establish semantics, not instructional effectiveness.
Subgoal-labeled worked examples in Java CS1 [P2] produced more favorable
formative and persistence outcomes than average exam outcomes; this is indirect
support for the initial worked example, not proof of the proposed fading sequence.

## Lesson decisions and observable evidence

Each entry names the problem informing the design and the student work needed
to assess it. These are assessment targets, not claims that a checker measures
every target automatically.

1. **`playlist-states` — full worked model.** Forge [F1] reports programming-style
   interpretations of formal models; Lamport [T3] argues for states and behaviors
   as the concurrency foundation. Separate variable values, labeled actions,
   and a chosen behavior before introducing more syntax. **Evidence:** a predicted
   next state and an explanation of why exploring one behavior differs from
   checking all admitted behaviors.

2. **`playlist-boundary` — guard repair.** Danas et al. [F5] observed repairs
   focused too narrowly on particular counterexamples. Keep the requirement
   fixed while diagnosing the guard, then consider another boundary case.
   **Evidence:** identify the first violating state, connect it to the enabled
   action, and justify the repair beyond the displayed trace. Checker success
   alone does not supply that explanation.

3. **`playlist-property` — invariant construction.** Mansoor et al. [F2] found
   model construction difficult even when participants could repair models.
   Move from reading and repair to writing a property; do not infer construction
   competence from lesson 2. **Evidence:** a submitted invariant with explanations
   of an allowed and a forbidden state. Independent instructor checks reduce
   credit from weakening editable properties; model adequacy still needs review.

4. **`ticket-interleavings` — worked race.** Vescan and Frențiu [F9] report
   confusion between execution and state-space checking. Compare schedules
   from the same initial state so a successful schedule cannot stand for the
   whole system. **Evidence:** reconstruct an allowed failing interleaving and
   identify the requirement it violates, alongside a successful schedule.

5. **`atomic-reservations` — faded label repair.** Programming-style assumptions
   reported in Forge [F1] motivate making atomicity explicit. The PlusCal manual
   [R1] supplies the technical basis for label boundaries. Remove some scaffolding
   and require an atomicity decision. **Evidence:** a corrected model plus an
   account of the real atomic transaction it assumes. Changing labels does not
   implement synchronization in production code.

6. **`temporal-truth` — always and eventually.** Greenman et al. [L1], [L2]
   observed scope, evaluation-state, and finite/infinite-trace confusions.
   Teach `[]` and `<>` on explicitly infinite behaviors, including true and
   false contrasts. **Evidence:** classify contrasting infinite behaviors and justify
   the result from its continuation; a finite displayed prefix is insufficient
   to decide eventuality in general.

7. **`eventual-upload` — weak fairness.** T1 supplies curriculum precedent;
   [R2] supplies semantics, neither a causal test of this lesson. Contrast an
   invariant-preserving nonprogress behavior with a fairness-qualified model.
   **Evidence:** identify the continuously enabled action and justify the
   scheduler assumption. Fairness must not be presented as a repair for lost
   requests or an implementation guarantee.

8. **`response-contract` — formula scope repair.** L1/L2 identify scope errors
   and distinguish formula writing from recognition; Alloy4Fun [F3] reports the
   usefulness of acceptance/rejection feedback. Repair an initial-position
   implication using no-request, successful-response, and dropped-request
   behaviors. **Evidence:** a repaired response formula, its
   classifications, and an explanation of the no-request case. Two implication
   checks compare submitted and intended classifiers over this fixture; they
   do not establish unrestricted logical equivalence.

9. **`upload-capstone` — bounded retries from a skeleton.** F2's construction
   difficulty and F9's reports of encoding puzzle answers instead of rules
   motivate a distinct modeling task. Fade to a skeleton while retaining an
   explicit behavior contract. **Evidence:** a model admitting the required
   success and exhaustion cases, bounded one-at-a-time counting, and justified completion
   assumptions. Automatic checks use budgets 2 and 0; changing the budget to 3
   is separate learner practice. Deleting required behavior is not an acceptable repair.

10. **`scoped-evidence` — independent reasoning and return practice.** Noble
    et al. [F8] distinguish verifier-accepted artifacts from formal justification;
    Dunlosky et al. [P3] support retrieval and distributed practice broadly.
    **Evidence:** an unaided explanation of the checked model, properties,
    bounds, assumptions, and remaining implementation obligation. Optional
    recurrence work is ungraded. The final quiz uses a fresh game-lobby response
    behavior; a later task revisits distinctions without claiming that one
    sitting establishes retention.

## Assessment and release limits

Separate tool-assisted modeling, unaided semantic reasoning, and delayed transfer.
Record first attempts and support used when evaluating learning; repeated passes,
clicks, time spent, or confidence are different measures. Keep hints diagnostic
and full solutions separately revealed. Prediction and explanation prompts must
leave a meaningful decision for the learner.

Before release, verify model outcomes with official TLC, exercise plausible
wrong and alternative correct answers, and inspect live/print accessibility.
A learner pilot should test comprehension and pacing. No observed learner
outcomes or benefit estimates are claimed here.

[T1]: https://doi.org/10.1109/FIE61694.2024.10893422
[T3]: https://doi.org/10.1145/1515698.1515713
[L1]: https://doi.org/10.22152/programming-journal.org/2023/7/7
[L2]: https://doi.org/10.1007/978-3-031-71162-6_30
[L4]: https://doi.org/10.1109/FIE.2010.5673599
[F1]: https://doi.org/10.1145/3649833
[F2]: https://doi.org/10.1109/FormaliSE58978.2023.00013
[F3]: https://doi.org/10.1016/j.scico.2021.102690
[F5]: https://doi.org/10.1007/978-3-319-66197-1_11
[F8]: https://doi.org/10.1007/978-3-031-06773-0_23
[F9]: https://www.cs.ubbcluj.ro/~studia-i/contents/2010-3/04-VescanFrentiu.pdf
[P2]: https://doi.org/10.1186/s40594-020-00222-7
[P3]: https://doi.org/10.1177/1529100612453266
[R1]: https://lamport.azurewebsites.net/tla/c-manual.pdf
[R2]: https://lamport.azurewebsites.net/tla/book-02-08-08.pdf
