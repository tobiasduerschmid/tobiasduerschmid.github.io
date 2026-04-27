# Pedagogy of per-option feedback

Read this when you're stuck on whether a feedback string is good enough, or when you're drafting feedback for a question whose wrong answers don't have an obvious error mode attached.

The goal of `option_feedback` is **to land surgical correction at the moment the student's wrong mental model is most active**. It's not a substitute for the general `explanation:` — it complements it.

**House style: clarify, don't label.** Do not use the word "misconception" in feedback content, and do not write phrases like *"This is the X-misconception / X conflation / X confusion / X trap / X fallacy / X tautology"*. The label-and-correct pattern reads as a template tic when repeated across many questions and shifts attention from the corrective content to the diagnostic vocabulary. Just clarify the wrong reasoning directly — lead with the actual fact, the proximate distinction, or what's really happening.

## Before authoring: is a quiz the right tool?

MCQ is great at testing *discrimination* between near-neighbour concepts (recursion step vs base case, `WHERE` vs `HAVING`, unit vs integration test). It is a poor proxy for *production* skills — writing code, designing a class, choosing an architecture. If the construct you want to assess is "the student can write a working factorial," replacing it with "the student can recognise a working factorial from four candidates" demotes Bloom Apply/Create to Bloom Remember and trains pattern-matching, not synthesis.

Two diagnostic questions:

1. *Could the student pass this question by recognising the correct line without producing it?* If yes, and your objective was Apply/Create, you've miscalibrated the tool — write a coding exercise (or a Parsons) instead.
2. *Are most of your distractors syntactically malformed?* If yes, the question is testing syntax recognition (Bloom Remember), not understanding. Rewrite at least one distractor as a *semantic* near-neighbour, or convert to a Parsons.

When MCQ *is* the right tool, this document and `schema.md` (especially "Choosing a question type" and "Distractor design") tell you how to make it land.

## The five principles

### 1. Variation Theory (Marton & Booth, 1997)

Concepts are learned by **contrast** — students grasp what something *is* by encountering what it *is not*. Per-option feedback is built for this: each wrong option encodes a distinct neighboring concept, and the feedback should clarify the contrast.

**Rule (writing the feedback):** Lead with the contrast — *what's actually true* and the *load-bearing distinction* that separates it from the wrong reasoning. Optionally gesture at why the wrong reasoning is plausible, but do not label the error ("this is the *X*-misconception", "the *X* trap"); just clarify.

**Rule (designing the distractors):** Each distractor should differ from the correct answer on as few critical features as possible — ideally one. A distractor that varies on two dimensions at once (e.g. wrong operator AND wrong order) makes it ambiguous which mental model the item is testing, and the feedback ends up correcting two things at once. The cleanest items vary along a single axis: `WHERE` vs `HAVING`, `n > 0` vs `n == 0`, sequential `await` vs `Promise.all`. (See `schema.md` → "Distractor design" for the full five-test rubric.)

### 2. Corrective Feedback (Hattie & Timperley, 2007; Shute, 2008)

Hattie's meta-analyses put elaborated corrective feedback at d ≈ 0.7 — one of the strongest interventions in education. Verification-only feedback ("incorrect") sits near zero. Effective corrective feedback answers three implicit questions:

- *Where am I going?* (the goal)
- *How am I going?* (the gap)
- *Where to next?* (the corrective)

**Rule:** Every feedback string should *correct the mental model*, not just label the answer wrong. Bare verification ("this is incorrect") wastes the moment.

### 3. Generation Effect & Desirable Difficulties (Bjork & Bjork, 2011)

Wrong-answer feedback is most powerful when it lands **after** the student has actively committed to a wrong answer. The commitment is what makes the wrong reasoning *active*; the correction then lands on a "live" belief rather than a hypothetical one. This is why option_feedback fires inline at the moment of selection, not pre-emptively in the question stem.

**Rule:** Don't telegraph the error in the question (e.g., "Some students think X — which option avoids that mistake?"). Let the student commit, then correct.

### 4. Cognitive Load Theory (Sweller; Mayer's coherence principle)

Per-option feedback should target only the specific wrong reasoning at hand. Anything longer than ~3 sentences duplicates the general `explanation:` and creates extraneous load. The student is reading the feedback at the moment their working memory is already loaded with their failed reasoning — keep it focused.

**Rule (length):** If the feedback would be longer than 3 sentences, the rest belongs in `explanation:`. Role split (Hattie & Timperley): `option_feedback` is *feed-back* — corrective on this specific wrong reasoning. `explanation` is *feed-up + feed-forward* — the canonical principle, plus (where useful) a pointer to the next concept or the adjacent trap. They are not the same job; an item where they read interchangeably means one is redundant.

**Rule (code in stem and options):** If the question stem contains code AND each option is a different code variant, the student must hold the stem in working memory while diffing four candidates. With ~4 working-memory slots and high element-interactivity (variables, control flow, side effects all interact), a 10-line stem plus four 4-line option variants blows the budget. Two paths out: (a) keep the stem ≤5 lines and aim for options that differ along *one* dimension (a single line, operator, or call) so a vertical scan reveals the diff; or (b) if you genuinely need full code variants in every option, shrink the stem to a one-line scenario or convert the question to Parsons.

### 5. Growth-Mindset Framing (Dweck, 1999)

Wrong-answer feedback is a high-stakes moment for the learner's identity. Second-person accusations — "you confused X with Y", "you forgot that…" — pin the error on the student. Third-person framing keeps the focus on the *idea*: describe what's actually true, what trap is sitting under the wrong reasoning, and why it's plausible — without making the student the protagonist of the mistake.

**Rule:** Talk about the *idea*, not the student. "Two nested loops aren't `2 × n` work, they're `n × n` work" is universal; "*you* miscounted the loops" is personal. Also: do not label the error ("this is the *X*-misconception"); just clarify.

## Two complete examples

These show the principles in action. Use them as reference quality bars when drafting your own.

### Example 1 — single-choice, recursion base case

```yaml
- question: |
    The recursive function `factorial(n)` calls itself with `factorial(n - 1)`. It does not return for any negative `n`. Which line is the missing **base case**?
  type: single
  options:
    - "`if n < 0: return 0`"
    - "`if n == 0: return 1`"
    - "`if n > 0: return n`"
    - "`return n * factorial(n - 1)`"
  correct_index: 1
  option_feedback:
    0: "This catches negative inputs but never terminates the recursion for positive `n` — `factorial(5) → factorial(4) → … → factorial(0)` still has nothing telling it to stop. The recursion needs a stopping condition at the smallest valid input, not just an error guard."
    2: "`n > 0` is the **direction of progress**, not the **stopping condition**. The recursion runs *while* `n` is positive; the base case is what fires once `n` hits `0` — the opposite end of the loop."
    3: "This line is the recursive *step* — it's how the call tree expands. Without a base case to terminate, the chain runs forever and the stack overflows."
  explanation: "A recursive function needs a **base case** that returns *without* recursing. For `factorial`, that's `n == 0` returning `1` (since `0! = 1` mathematically). Every other call decreases `n` until it hits `0`."
```

What this demonstrates:

- Each wrong option targets a different error mode (error-guard vs terminator, direction-vs-stopping, step-vs-base-case) — but the feedback **clarifies** rather than labels.
- Third-person framing: the *idea* is the subject, not the student.
- Each feedback contains *just* the corrective contrast — the canonical reasoning lives in `explanation:`.

### Example 2 — multi-choice with omission, unit testing properties

```yaml
- question: |
    Which of the following are characteristics of a **good unit test**?
  type: multiple
  options:
    - "It tests one specific behavior, with one logical assertion focus"
    - "It is fast — under a few milliseconds"
    - "It has a name that describes the scenario AND the expected outcome"
    - "It hits the real database to verify production behavior"
    - "It uses many setup steps to closely simulate end-user workflows"
  correct_indices: [0, 1, 2]
  option_feedback:
    0: "A unit test that asserts on multiple unrelated behaviors fails in ways that obscure WHICH behavior broke. One concept per test makes failures diagnostic, not vague — that's why this is a property of a good unit test."
    1: "Slow tests get skipped. The CI runs that protect you only happen if developers actually run the suite — and they only run it if it returns in seconds, not minutes. Fast is non-negotiable for unit tests."
    2: "A name like `test_user_login_returns_token_when_credentials_valid` tells you exactly what broke at a glance. `test_login_1` does not. The name is the diagnostic."
    3: "Hitting the real DB makes the test slow, flaky (state pollution), and dependent on external infrastructure — that's an integration test, not a unit test. Unit tests cover logic in isolation; integration tests cover I/O. Different layers, different jobs."
    4: "A closely simulated workflow is an end-to-end test, not a unit test. Unit tests isolate ONE unit so failures pinpoint root cause; e2e tests verify the system works overall. Both are valuable, but conflating them costs you the diagnostic precision unit tests are *for*."
  explanation: "Good unit tests are **F.I.R.S.T.**: Fast, Isolated, Repeatable, Self-checking, Timely. The first three options reflect those qualities. The last two describe **integration** or **end-to-end** tests — both valuable, but at different layers of the testing pyramid."
```

What this demonstrates:

- Omission feedback (options 0, 1, 2) explains *why this trait matters*, helping the student internalize the property they missed.
- Commission feedback (options 3, 4) clarifies the proximate distinction (unit vs integration vs e2e) without labeling the wrong reasoning.
- The general `explanation:` carries the framework (F.I.R.S.T.) and the testing-pyramid context.

## When NOT to write option_feedback

Sometimes leaving it out is the right call:

- **Trivially-wrong distractors.** If an option is wrong because it's syntactically malformed, contains a made-up keyword, or is obviously off-topic, there's no real reasoning to correct. Skip the feedback — *and* reconsider the distractor itself. A question whose wrong options are all syntactically malformed is testing recognition, not understanding (Bloom Remember, not Analyze). Replace at least one malformed distractor with a *semantically* near-neighbour option (a legal alternative encoding a real wrong belief), or convert the question to a Parsons. See `schema.md` → "Distractor design" for the full rubric.
- **Options where you can't articulate the wrong reasoning.** If you can't crisply finish the sentence "students who pick this are probably thinking…", the feedback you'd write is going to be vague filler. Skip it.
- **Pure factual recall.** "What year was Python first released?" doesn't have a wrong-reasoning structure — wrong years are just wrong, not the result of confused mental models. Use `explanation:` for the answer and call it done.
- **Optional indices in multi-choice.** Feedback assigned to `optional_indices` never fires — it's wasted work. The whole point of `optional_indices` is "either choice is fine".

## Diagnosing a feedback string

Quick test: read the feedback aloud. Does it…

1. **Clarify what's actually true** in a way that addresses the wrong reasoning behind this specific option? (If it just says "this is wrong because of X" without correcting the model, you're in verification-only territory — push it toward the corrective contrast.)
2. **Tell the student what's true instead**, in a way they can act on next time? (If not, it's not corrective.)
3. **Stay under three sentences**? (If not, trim or move to `explanation:`.)
4. **Avoid second-person blame**? (If you wrote "you confused…", reframe so the *idea* is the subject, not the student.)
5. **Avoid labeling phrases**? (If the string contains "this is the *X*-misconception / X conflation / X confusion / X trap / X fallacy", rewrite to clarify directly. Just describe what's actually true.)
6. **Differ from `explanation:`**? (If a student would learn nothing extra from the feedback that the general explanation doesn't say, delete it.)

If all answers are yes, ship it.

## References

- Bjork, R. A. & Bjork, E. L. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. *Psychology and the Real World*, 56–64.
- Dweck, C. S. (1999). *Self-Theories: Their Role in Motivation, Personality, and Development.* Psychology Press.
- Hattie, J. & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
- Marton, F. & Booth, S. (1997). *Learning and Awareness.* Routledge.
- Mayer, R. E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University Press.
- Shute, V. J. (2008). Focus on formative feedback. *Review of Educational Research*, 78(1), 153–189.
- Sweller, J., van Merriënboer, J. J. G. & Paas, F. (1998). Cognitive architecture and instructional design. *Educational Psychology Review*, 10, 251–296.
