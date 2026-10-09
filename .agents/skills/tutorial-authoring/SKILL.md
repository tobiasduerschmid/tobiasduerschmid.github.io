---
name: tutorial-authoring
description: Authoring guide and architecture reference for the SEBook in-browser tutorial system. Use this skill EVERY TIME you create, edit, review, restructure, or extend anything that touches `_data/tutorials/*.yml`, the `_layouts/tutorial.html` / `_layouts/print-tutorial.html` layouts, the `tutorial-*-popup.html` popout windows at the repo root, the `js/tutorial-*.js` runtime (`tutorial-code.js`, `tutorial-quiz.js`, `tutorial-popout-manager.js`, `tutorial-popout-client.js`, `tutorial-refactorings.js`), backend workers (`cpp-worker.js`, `pyodide-worker.js`, `sql-worker.js`, `java-worker.js`, `prolog-worker.js`, `haskell-worker.js`, `playwright-compat/*`), the time-travel debugger under `js/debugger/`, the autosave / progress / reset machinery, the in-tutorial quiz / hint / test schemas, the print view, the SE Gym tutorial-progress import/export flows, the `SEBook/<section>/<slug>-tutorial.md` + `SEBook/<section>/<slug>-tutorial/print.md` page-pair convention, the `/SEBook/tutorials` auto-generated index, or any new feature added to the tutorial runtime. Also trigger on requests like "add a new tutorial on X", "add a step to <tutorial>", "convert this lecture into a tutorial", "design a quiz / hint / test for step N", "set up a print view for this tutorial", "add a new tutorial backend", "wire up a new popout window", "add a new YAML field to the tutorial schema", "review this tutorial draft", "audit tutorials for PRIMM / spaced practice / Bloom coverage", or any task that involves the tutorial runtime, schema, or content. **You MUST update this SKILL.md whenever you add, rename, remove, or change the semantics of a tutorial-runtime feature** — new YAML fields, new backends, new popout windows, new test runners, new quiz / hint mechanics, new autosave / reset modes, new debugger capabilities, changed permalink conventions, or any architectural change that an author or future agent needs to know to build or modify a tutorial correctly. Out-of-date schema or architecture notes here cause real downstream bugs (broken tutorials, missing print views, mis-shaped quizzes, lost progress).
---

# SEBook tutorial authoring & architecture

Shared tutorial splitters report the measured pane percentage through
`aria-valuenow`, including responsive layout changes. `_makeDraggable` observes
the pane and its parent with `ResizeObserver`; `TutorialCode.destroy()` disconnects
those observers. Preserve existing drag and keyboard size semantics when changing
this lifecycle. `playwright.smalltalk.config.js` imports shared server/use settings
and runs explicit Chromium, Firefox and WebKit projects; individual deferred
refactoring cases use the production capability helper and remain reported skips.

This is the canonical guide for **building, editing, and extending** the
SEBook in-browser tutorial system. It covers two layers:

1. **Authoring** — how to design a pedagogically sharp tutorial (defaults,
   checklist, advisor skills to consult, what to write where).
2. **Architecture** — how the tutorial runtime, layouts, popouts, backends,
   autosave, debugger, hints, quizzes, and tests fit together so you can edit
   the right file when you change behavior.

> ⚠️ **Keep this file in sync with reality.** If you add a new YAML field, a
> new backend, a new popout, a new test runner, a new quiz type, a new
> autosave mode, a new debugger capability, a new pedagogical convention, or
> a new page-pair convention — **edit this SKILL.md in the same change.**
> Stale architecture docs here have caused real bugs: missing print views,
> tutorials excluded from the index, quizzes that never gate, autosave
> corruption. Update the schema cheatsheet, the checklist, *and* the
> architecture map.

---

## 1. Tutorial design defaults

These are the project's **opinionated defaults** for what a "real" tutorial
looks like. Deviate only with a stated reason.

### Audience

- **CS undergraduates**, primarily UCLA CS 35L / CS 130 students. Assume they
  know one prior language (typically Python or C++) and the basics of the
  command line, but **no** prior exposure to the topic the tutorial teaches.
- Write at a Gen-Z, conversational register: warm, direct, light humor where
  it lands, no condescension. Avoid corporate/textbook tone. Examples should
  be **fun and engaging** — playlists, games, social apps, sports stats,
  music, sneakers, K-pop, anime, memes, food trucks — not banks, payroll, or
  HR forms unless the topic demands it.
- High learning-to-time ratio. Every paragraph and every student-run task
  must earn its place: cut filler, redundant restatements, throat-clearing,
  and tangents. If a sentence doesn't move the student forward, delete it.

### PRIMM is the default tutorial design system

Every step (or near every step) should follow the **PRIMM** cycle —
**Predict, Run, Investigate, Modify, Make** — adapted to fit the topic:

1. **Predict** — give the student code or a scenario *before* running it and
   ask them to predict the output / behavior in writing or in a quiz before
   they execute. Predictions activate prior knowledge and surface
   misconceptions.
2. **Run** — student runs the code as-is. Their prediction either confirms
   or fails. Surprise + comparison is the learning moment.
3. **Investigate** — questions / quiz / inline prompts that force the
   student to *explain why* the code behaves that way. Aim Bloom levels
   **Understand → Analyze → Evaluate**.
4. **Modify** — student makes a small, scoped change to the code (e.g.
   change a parameter, swap an operator, add a branch) and predicts /
   verifies the new behavior.
5. **Make** — student writes new code from scratch (or near-scratch) using
   the concept just practiced. Bloom level **Apply → Create**.

Not every step needs all five moves, but a tutorial that is *only* "Make"
(student writes code from scratch with no prediction) skips the most
effective parts. Conversely, a tutorial that is *only* "Read and Run" skips
the active-learning parts. Aim for each PRIMM phase to appear at least once
across any 3–4 step run.

#### What makes a *good* Predict prompt (vs. box-checking)

The Predict phase is the easiest to author badly. Tutorials are full of
"Predict before you run" headings that ask trivial counting questions
("how many printf calls are there?") or impossible questions ("predict
the runtime in microseconds"). Both fail. A Predict prompt earns its place
only when **all** of these are true:

1. **The student can actually predict it from prior knowledge or careful
   reading.** No magic, no needing to run the code first. If they have to
   guess, the prompt is broken.
2. **It surfaces a misconception or a non-obvious detail.** The reward for
   predicting correctly is the satisfaction of "I called it"; the reward
   for predicting incorrectly is *the gap itself becomes the lesson*. If
   the answer is too obvious, neither reward exists.
3. **The answer is sharp, not vague.** "Predict what happens" is too
   loose; "predict whether output line 3 and line 4 collapse onto the
   same line, and why" is sharp. A sharp answer is something the student
   can commit to in one sentence — and either match or mismatch on running.
4. **It would be plausible to predict wrong.** If 95% of students predict
   the same thing without thinking, the prompt is just retrieval cosplay.
   Good predict prompts have a *trap* — a tempting wrong answer that maps
   to a known misconception.
5. **It's engaging.** The student should actually want to know whether
   they were right. "How many lines are in this output?" — nobody cares.
   "Will pressing Run on this code segfault, succeed silently, or produce
   wrong output?" — students lean in.

A useful template: present **2–4 plausible alternatives** as multiple
choice (or "(a)/(b)/(c)") rather than an open-ended question. The
alternatives let you encode the misconceptions explicitly, and the
"commit to one letter" step forces a decision. Pair the prompt with a
gated `<details>` block that opens *after* the student has committed —
not before — and that uses the prediction-vs-reality gap to teach the
underlying rule.

Bad ("box-checking"):

> ✏️ Predict before you compile: how many lines of output will you see?
> What's the first character?

(Both trivially answered by glancing at the source. No gap, no insight.)

Good (sharp, traps a misconception, gated reveal):

> ✏️ Predict before you compile: mentally delete the `\n` from line 3's
> printf. What does the output look like?
>
> - (a) Identical — printf adds an implicit newline.
> - (b) Lines 3 and 4 collapse onto a single line.
> - (c) Line 3 disappears entirely.
> - (d) Compile error.
>
> Commit to a letter, *then* read the gated reveal.

(Forces the student to confront whether `printf` adds a newline — the
canonical C++→C trap. Three of the four wrong answers map to specific
misconceptions you can address in the reveal.)

If you can't write a Predict prompt that meets all five tests, **don't
add one** — a missing Predict is better than a box-checking one.

Other named pedagogies that are common in this repo and are encouraged when
they fit:

- **Mistake-based familiarization** (Tan & Poskitt 2024) — present buggy
  code and have the student fix it. Excellent for first exposure to a syntax
  family.
- **Productive failure** (Bjork) — ask the student to attempt a problem
  before showing the technique that solves it cleanly.
- **Worked example with fading** — full example → partial scaffold →
  no-scaffold capstone, across consecutive steps.
- **Negative transfer callouts** — explicitly warn when a habit from a
  prior language (`==` from Python, pointers from C, etc.) will mislead.

Cite the pedagogy in a YAML comment above the step
(e.g. `# Pedagogy: PRIMM — Predict before Run, then Modify`) so future
editors preserve intent.

### Examples must demonstrate the *true essence* of the concept

Examples are the single biggest determinant of whether a student learns the
concept or learns a coincidence of the example. Choose with care:

- The example should make the concept **necessary** — there should be no
  shorter, more idiomatic solution that doesn't use the concept being taught.
  If a `for`-loop solves the "Observer pattern" example just as well, the
  example doesn't teach Observer.
- The example should be **minimal** — strip every detail that doesn't
  illustrate the concept. Cognitive load on incidental details is load not
  spent on the concept.
- The example should be **honest** — it should resemble code the student will
  actually write, not a contrived puzzle.
- The example should make **misconceptions visible**. A good example causes
  the wrong mental model to predict the wrong output, so the predict-vs-run
  comparison is informative.
- Re-use the same running example across consecutive steps when possible —
  it amortizes the cognitive cost of learning the domain so attention can
  stay on the concept being layered in.

Bad example (teaches nothing): `class Cat: def meow(self): print("meow")`.
Good example (teaches inheritance + polymorphism): a `Track` subclass
hierarchy where `Audiobook` legitimately needs a different `play()` than
`Song`.

### Let students think — don't let them copy-paste their way through

The tutorial's job is to give the student enough context, instruction, and
worked examples that they can **derive the next step on their own** based on
their background. It is **not** to hand them a solution to paste. Concretely:

- Don't put the solution inline in the step's instructions. Put it in
  `solution.files` / `solution.commands` / `solution.explanation`. The
  solution should be reachable (instructor-mode reveal) but not the path of
  least resistance.
- Don't use TODO-comments that name the exact line they need ("`# TODO:
  call self.notify_observers() here`"). Name the *goal*, not the *fix*.
- Use **multi-layered hints** (see §3.3). The first hint should not contain
  the answer. The last hint may contain a strong nudge but still avoid the
  literal solution code.
- When a step is too hard without a worked example, **scaffold by structure,
  not by content**: provide the function signature, the test list, or a
  partial skeleton with the interesting bits missing — not the whole answer
  with two blanks.
- Prefer prompts like "before you continue, predict ..." / "stop and ask
  yourself ..." over "now type the following:".

### Step structure: required conventions

Every step's YAML and `instructions:` block follow a fixed structural
template so students get the same shape on every step, the print view
renders cleanly, and reviewers can scan a tutorial without re-learning
its layout. Deviating from these is **not** a stylistic choice — match
the template, then put your authorial energy into the *content*.

**1. Step title — Title-Cased noun phrase.** Names the concept the step
teaches, not the action the student performs. Reads like a textbook
chapter.

- ✔ "Your First Repository", "The Indentation Trap", "Reference Semantics"
- ✘ "Add a remote" (imperative), "Adding a Remote" (gerund), "Step 1: …"

**Documented exceptions** (do not normalize away):

- `c.yml` uses a `### Chapter N: <hook>` narrative arc with thematic
  step-titles like "Power Unlocked: …", "Every Hero Has a Weakness".
  The arc is load-bearing for that tutorial — keep as-is.
- `tdd.yml` uses themed step-title prefixes
  `Cycle N — RED: <…>` / `Cycle N — GREEN: <…>` / `Cycle N — REFACTOR: <…>`.
  The RED/GREEN/REFACTOR rhythm is the pedagogy — keep as-is.

**2. Pedagogy comment above the step.** Every step gets a
`# Pedagogy:` YAML comment immediately above the `- title:` line naming
the PRIMM phase or the named technique driving that step. Pick one:

```yaml
  # Pedagogy: PRIMM — Predict before Run, then Modify
  # Pedagogy: mistake-based familiarization
  # Pedagogy: productive failure (Bjork)
  # Pedagogy: worked example with fading
  # Pedagogy: negative-transfer callout (Python → C)
  - title: "..."
```

A richer multi-line `# Pedagogy:` block (citations, multiple techniques,
phase notes) is fine and even encouraged on steps where the pedagogy is
load-bearing. `# Bloom: <verbs>` comments are *optional* — add them when
they help future editors, but they're not required.

**3. `instructions:` opens with `### Why this matters` + 🎯 list.** The
first ~10 lines of every step's `instructions:` follow this exact shape:

```markdown
### Why this matters

<one short paragraph — 2–4 sentences that earn the student's attention.
Cut filler. Lead with the durable reason this step exists in the
curriculum, not a goal-restatement>

### 🎯 You will learn to

- <Bloom verb (Apply / Analyze / Evaluate / Create) + concrete behavior>
- <…1–3 items total…>

<rest of the step content — tables, examples, predict prompts, tasks, …>
```

The 🎯 emoji is part of the heading. Don't drop it; don't substitute
("You will demonstrate you can", "Goals", "Skills you'll gain"). Don't
duplicate — if the step already had a `> **Learning objective:**`
blockquote or similar, **restructure it into the 🎯 list**, don't keep
both.

**Documented exception:** `c.yml` keeps the `### Chapter N: <hook>`
narrative opener instead of `### Why this matters`. The 🎯 list still
appears, immediately after the chapter intro.

**4. Top-level `learning_objectives:` declared.** Every non-excluded
tutorial (i.e. `exclude_from_index: true` is not set) has a top-level
`learning_objectives:` list of 4–8 Bloom-verb statements. See §3.1 for
schema. Currently authoring-only metadata; runtime ignores it.

### Instructions must be readable and skimmable

Optimize every tutorial's instructions for finding the concept, rule, and next
action quickly. Apply this to the whole path, not just its introductory step.
Use `cs-tutorial-design` for the learning sequence and these encoding rules:

- **Short context paragraphs:** keep one idea per paragraph; retain the reason
  and causal explanation that make the example meaningful. Cut repetition.
- **Bullets for parallel information:** contracts, inputs, results, boundary
  cases, alternatives, and example mappings. Give each item a brief label when
  it helps scanning, such as **Inputs**, **Empty input**, or **Preserve**.
- **Number the tasks:** present genuinely ordered actions as a numbered list,
  with a short bold action word: **Predict**, **Implement**, **Check**, **Explain**.
  Keep prediction before running or revealing feedback. Do not number unrelated
  facts or turn every explanatory sentence into a separate action.
- **Bold selectively:** emphasize the key distinction, constraint, or action,
  not entire paragraphs. Keep code in code spans or fenced blocks beside its
  explanation; formatting must clarify the reasoning, not replace it.
- **Preserve the learning contract:** retain requirements, edge cases, accepted
  approaches, manual self-checks, and the intended amount of scaffolding. Keep
  solutions behind their existing reveal or in `solution:`. Do not make tasks
  easier by leaking the target algorithm during a readability rewrite.
- **Useful humor:** relatable examples may be playful when the metaphor maps
  accurately to the concept. Explain its limit when needed (an unavailable-data
  sentinel is not an actual download). Avoid slang that hides technical meaning.
- **Respect the length budget:** restructure and replace prose rather than
  appending explanations. For a no-growth request, compare instruction word
  counts and check that requirements and exercises have not disappeared.
- **Verify rendered structure:** separate lists and headings with blank lines,
  indent continuation lines correctly, and inspect live and print views.
  Use semantic Markdown; never shrink typography to make instructions fit.

### In-tutorial quizzes are *recall and transfer*, not new content

Quizzes that appear between steps (the `quiz:` block on a step) should be
**recall and integration prompts**, not the place where new material is
introduced. Their job:

- **Retrieval practice** of the concept just taught (Bloom: Remember /
  Understand). These act as a low-stakes check-in.
- **Spaced practice** — *deliberately* re-test a concept from an earlier
  step. The quiz on step 5 should include at least one question covering a
  concept first taught in step 1 or 2. Spaced retrieval is one of the most
  replicated findings in cognitive science (≈2× retention vs. equal-time
  massed study). Without it, ~50% of what was learned today is gone in a
  week.
- **Higher-Bloom coverage**. Don't only ask Remember/Understand. Mix in
  **Apply** (predict the output of a new snippet), **Analyze** (which of
  these implementations breaks if the input grows?), **Evaluate** (which of
  two solutions is better and *why*?), and **Create** (Parsons problems
  that make the student assemble a small program).

Authoring rules for quizzes live in `quiz-format` (see §6 — Other skills to
consult). The two non-obvious traps that bite every author:

- **Per-option `option_feedback` is for misconceptions, not restatement of
  the explanation.**
- **Options shuffle at render time** — never write "Option A" / "the third
  choice" / "the last one" in an explanation; refer to options by their
  *content*.

Read `.agents/skills/quiz-format/SKILL.md` before writing or editing any
`quiz:` block.

**Two formatting conventions that apply to every quiz block:**

- **`title: "Step N — Knowledge Check"`** where `N` is the 1-indexed step
  number. Don't use `"Step N quiz"`, `"Step N recall"`, or topic-named
  variants — the canonical form names the cognitive purpose (a knowledge
  check, not a graded assessment) and is what students see in the print
  view's table of contents.
- **`min_score: 0.8`** on every quiz, no exceptions. Bumping a quiz to
  `0.6` or `0.7` because it's "harder" is a content problem dressed up as
  a threshold one — fix the questions, not the gate.

### Tests should be precise — low false-positive *and* low false-negative

Step `tests:` provide diagnostic feedback and gate advancement only when
`require_tests: true`. For a self-directed refresher such as CS131, set
`require_tests: false` and `require_quiz: false`: students can move on without
running or passing tests and can skip knowledge checks or continue with a low
score. Keep `min_score: 0.8` as the diagnostic pass threshold. Skipping or
continuing after a low score must never record a passed test or quiz.
For direct access to any numbered step, also set `allow_skip_steps: true`.
This opt-in navigation policy leaves tests and quizzes available and preserves
their actual pass records, including when restoring an older gated save.
Tests have two
opposite failure modes you must defend against simultaneously:

- **False positive (test passes on a wrong solution):** the student moves on
  with a broken mental model. Disastrous for learning. Defend by asserting
  *every* observable property the task actually requires — not just one
  string match. If the task is "print all even numbers from 1 to 10",
  asserting `"2" in output` lets `print("2")` pass. Assert presence of every
  expected number *and* absence of odd numbers.
- **False negative (test fails on a correct-but-different solution):** the
  student is told they're wrong when they aren't. Crushes confidence. Defend
  by asserting **only** what the spec actually requires. Don't pin
  whitespace, capitalization, exact wording, ordering (when order isn't
  specified), or specific identifier names unless the task says to.

Concrete heuristics:

- Prefer **set membership / regex / structural assertions** over exact
  equality on free-form output.
- For numeric output, allow tolerance (`abs(a - b) < 1e-6`).
- For multi-line output, normalize whitespace before comparing.
- For "implement function `foo`" tasks, test the *function*, not the
  surrounding script. Import and call it.
- If the task says "use `<construct>`" (e.g. "use a list comprehension"),
  add an AST-level check, not a string regex on `for ... in`.
- When in doubt, write the test, then write **3 plausibly-wrong solutions**
  in your head — the test should reject all 3. Then write **2 alternative
  correct solutions** — the test should accept both.

Pair every test with **multi-layered hints** (see §3.3) so a failing student
gets graduated help, not a wall.

#### Small checks make partial progress visible

Every assessed step should have **small, individually reported checks**, each
covering one meaningful behavior from the task contract. A learner who fixes
one requirement should be able to see that check pass while unfinished
requirements still fail. Split checks by function, branch, output component,
or input partition where these represent separate goals. Do not bundle an
entire exercise into one Boolean conjunction or one assertion script.

- **One reason to fail per check, not one assertion per check.** Several
  examples of the same rule may belong together: just below, at, and above a
  cap can form one boundary check. Separate unrelated rules, such as a match
  reward and a stock update, or addition and multiplication in an evaluator.
- **Name the criterion students can act on.** Use descriptions such as
  "Stock: at or above the supplied capacity" or "Front swap: an empty input".
  Do not put the solution formula, exact assessed type, or algorithm in the
  description. Order checks from simple cases toward combinations and transfer.
- **Preserve coverage when splitting.** Map every stated rule to checks, then
  include representative valid inputs, empty/singleton cases where applicable,
  and boundary neighbors. Retain checks for order, repeated occurrences,
  payload preservation, and type flexibility when the contract requires them.
  An always-passing scaffold check or a compilation-only check is not evidence
  that a behavioral requirement is implemented.
- **Make each check safe on its own.** Do not rely on an earlier assertion's
  short-circuit to guard a partial observation. For example, inspect a Haskell
  list with a complete `case` and return `False` for the wrong shape before
  applying a selected function-valued element. A wrong learner result should
  produce a failed criterion, not an exception in the authored test itself.
- **Avoid both under-fitting and over-fitting.** Assert the full specified
  result for each chosen case; use additional inputs to reject hard-coded
  sample answers. Accept equivalent algorithms, helper names, formatting,
  and allowed types. Check syntax or a declared interface only when the task
  explicitly requires it. Source patterns used for hints are not grading rules.
- **Verify partial progress and correctness independently.** Run the starter,
  the model, at least two independently written correct alternatives, and
  plausible mistakes against the authored checks. Include a runnable partial
  solution that passes its completed criteria and fails its unfinished ones;
  confirm the student UI shows both and updates after a focused correction.
  Do not require every check to fail on the starter when some behavior is
  deliberately supplied. Use the [test-design skill](../test-design/SKILL.md)
  for oracle strength and mutation-style validation.
- **Keep the list useful and fast.** There is no fixed test-count quota.
  Avoid one row per arbitrary literal or duplicate sample, and measure a full
  test run in the real backend. Keep condition-driven hints relevant to each
  failed criterion; YAML anchors may share an identical hint ladder within a
  file when the advice applies to all of those checks.

The legacy regex tutorials in `js/regex-tutorial.js` and
`js/regex-tutorial-advanced.js` define their exercises in JavaScript rather
than tutorial YAML. Their test cases use `shouldMatch` for presence and
`expectedMatches` for the ordered full-match strings an extraction task
requires. The advanced tutorial also supports `matchCount`, `firstMatch`,
and `namedGroups`. Use extraction expectations when the task specifies
individual matches or their boundaries; a boolean match alone cannot verify
those requirements. Live test indicators and final grading must apply the
same expectations while accepting equivalent regex patterns.

### Multi-layered hints

Hints are the project's primary way to keep students unstuck without giving
the answer. Conventions:

- **Three hints minimum** for any non-trivial test. The first is *least*
  revealing.
- **Layer 1 — orientation.** Identify a relevant concept, earlier example,
  or question the learner can investigate. Add direction beyond repeating
  the failed check. No solution code.
- **Layer 2 — diagnosis or plan.** Offer a concrete input to trace, a
  comparison to make, or a way to break the problem down. Name a required
  technique only if selecting it is not itself the learning objective.
- **Layer 3 — incomplete scaffold.** Support the next reasoning step with
  a partial trace, question, or skeleton that leaves meaningful decisions
  to the learner. A full algorithm in prose, exact assessed type, or blank
  requiring only an obvious literal still gives away the answer.
- Read the whole ladder cumulatively: each hint must add useful support,
  and all hints together must still leave the assessed reasoning to the
  learner. Avoid padding, redundant paraphrases, and untaught prerequisites.
  Apply the objective-first review in
  [`cs-tutorial-design`](../cs-tutorial-design/SKILL.md#progressive-hints-that-preserve-learner-work).
  Learner-visible test descriptions follow its
  [test-name guidance](../cs-tutorial-design/SKILL.md#learner-facing-test-names-are-part-of-the-scaffold):
  name the criterion without supplying the answer being assessed.
- **Title style — describe the *content*, not the layer.** "Orient",
  "Strategy", "Skeleton", "Layer 1", "Layer 2", "Layer 3" (and parenthetical
  variants like `Skeleton (you fill in the blanks)`) are author-side
  *intent* labels and **must not appear in the visible `title:`**. Give each
  hint a topical title that names the specific advice — `"Read the failing
  line's expected vs actual"`, `"Value-equality on frozen dataclasses"`,
  `"Fill the blank"` — so the student sees what the hint is *about*, not
  which rung of the ladder it sits on. The escalation is communicated by
  the order of hints in the list, not by their titles. If you find yourself
  reaching for "Orient" / "Strategy" / "Skeleton" as a title, write down
  what the hint actually says and use that instead.
- Use `condition:` to make hints fire only when their trigger is true
  (e.g. `condition: "code_missing: range("` only fires when the student
  hasn't typed `range(`). Conditional hints feel like the tutorial is
  *paying attention* to them and are dramatically more effective than a
  static list.
- Never reveal the literal solution in a hint. Solutions live in
  `solution:` (instructor-mode reveal). Hints lead to thought, solutions
  confirm understanding after the work.

#### Condition-driven progression

Progression comes from `condition:` matching the learner's current code or
output, not from a **Show next hint** button, click count, or elapsed time.
For each failed criterion, distinguish an untouched or missing implementation,
a recognizable partial attempt or misconception, and a more developed attempt.
Attach the advice appropriate to each state. Prefer mutually exclusive
conditions when the hints would otherwise repeat or disclose later scaffolds
prematurely. Scope source patterns to the assessed definition so examples in
`main`, unrelated helpers, and comments do not masquerade as progress.

Exercise each condition with a starter, a plausible partial attempt, and a
different developed attempt; also check that deleting the target definition
still yields useful help. Hints diagnose source patterns; they must not act as
additional grading rules or require one particular correct implementation.
Haskell `code_*` conditions use the existing shared tokenizer to mask line and
nested block comments while preserving string literals, spacing, and line
anchors. `source_*` conditions intentionally inspect the full source instead.

`js/tutor-chat.js` re-evaluates conditions after each failed test run. Preserve
the original **Hints** disclosure and flat hint-card layout; opening the collapsed
panel shows only the applicable advice from failed checks. There is no global three-hint cap,
manual reveal ladder, or stored reveal depth. Authored guidance takes precedence
over generated fallback advice. UML checks retain actual assertion diagnostics
alongside applicable authored hints, and an empty diagnostic result does not
invent a naming nudge. Passing checks no longer contribute hints.
When several failed checks share an identical hint body and authored title,
the flat panel shows that advice once, using the first applicable title.
Different fallback titles derived from test descriptions do not duplicate the
advice; distinct explicit hint titles preserve their separate context. The
criterion groups remain available internally, and retesting recalculates both
applicable advice and duplicates from the current results and source.

Keep presentation in `css/tutor-chat.css`. Condition changes and failed-check
coverage are verified by `tests/tutor-hints.spec.js`; authored source profiles
are covered by `scripts/tests/haskell-hint-conditions.test.js`.

### Visuals — create when they earn their place

Most concepts are clearer with one good diagram than three paragraphs of
prose. But every diagram costs the reader cognitive load to parse, and a
bad diagram is worse than no diagram. Decide using the **`good-diagrams`**
skill (`.agents/skills/good-diagrams/SKILL.md`) and pick the right type and
syntax using the **`diagrams`** skill (`.agents/skills/diagrams/SKILL.md`).

Tutorial-specific diagram opportunities:

- **State diagrams** — Git's three-state model, FSMs, lifecycle diagrams.
- **Sequence diagrams** — request/response flows, async callback timelines,
  Observer notify cycles.
- **Class diagrams** — design pattern structure (UML can render live in the
  tutorial via `uml_diagram: true`; see §4.4).
- **Memory / object-graph diagrams** — pointer-aliased structures,
  Python's reference semantics, JS closure capture.
- **Annotated screenshots** — when the IDE / browser DevTools state matters.

NEVER use ASCII art. (See `diagrams` skill.)

### Length, pacing, and step granularity

- **Each step ≈ 5–15 minutes** of student time. If a step grows beyond
  ~20 min, split it.
- **Each tutorial ≈ 45–120 minutes** total. Longer than that, students
  abandon. Split into a "basics" and an "advanced" tutorial (see
  `git.yml` / `git-advanced.yml`).
- **One concept per step.** If a step's instructions list two new
  concepts, split.
- **Steps are sequential.** Don't assume a student has read step N+1
  before step N — but *do* assume they remember step N-1 (and quiz them
  on N-3 a few steps later, see "spaced practice" above).

---

## 2. Authoring checklist

Use this list every time you create or substantially edit a tutorial.
Skipping items here is what causes "tutorial works fine for me but
students are confused" reports.

### Before drafting

- [ ] **Audience & prerequisites named** in the tutorial description (one
      sentence). What language(s) / concepts must the student already know?
- [ ] **Learning objectives written down** as a list of concrete,
      observable behaviors ("after this tutorial, the student can write a
      Git pre-commit hook that rejects commits without a Jira ID"). Use
      Bloom verbs (Apply, Analyze, Evaluate, Create) — not vague verbs
      like "understand" or "know about".
- [ ] **Running example chosen** — one example carries the whole tutorial
      where possible. Make it fun (music, games, social, sports).
- [ ] **Pedagogy decision per step** — PRIMM phase + any named technique
      (mistake-based, productive failure, worked-example-with-fading,
      negative-transfer callout). Note in YAML comments above each step.
- [ ] **Consult the `cs-tutorial-design` and `pedagogical-advisor`
      project skills** (at
      [`.agents/skills/cs-tutorial-design/SKILL.md`](../cs-tutorial-design/SKILL.md)
      and
      [`.agents/skills/pedagogical-advisor/SKILL.md`](../pedagogical-advisor/SKILL.md)).
      `cs-tutorial-design` covers programming-tutorial pedagogy
      specifically (CLT, PRIMM, worked-examples-with-fading,
      desirable difficulties, growth mindset, paradigm transitions,
      AI-enhanced learning, ready-to-use exercise templates).
      `pedagogical-advisor` covers the broader learning-science lens
      (Mayer's multimedia, ICAP, Variation Theory, UDL, UbD) for
      content that's *not* a tutorial. Read the relevant one and
      mirror its checks against your draft before you commit: PRIMM
      coverage, Bloom mix in quizzes, misconception coverage in
      `option_feedback`, scaffolding fade, spaced practice across
      steps.

### YAML & content

- [ ] `_data/tutorials/<slug>.yml` created with Title-Cased `title`,
      `description`, top-level `learning_objectives:` (4–8 Bloom-verb
      items), and an explicit `backend:`. (See §3.1 for the schema cheat
      sheet.)
- [ ] **Step titles are Title-Cased noun phrases / concept names** — not
      imperatives ("Add a remote"), gerunds ("Adding a remote"), or
      questions. Documented exceptions: `c.yml` (Chapter framing),
      `tdd.yml` (`Cycle N — RED/GREEN/REFACTOR:` prefix).
- [ ] **Every step has a `# Pedagogy:` YAML comment** immediately above
      its `- title:` line, naming the PRIMM phase or the named technique.
- [ ] **Every step's `instructions:` opens with the canonical block:**
      `### Why this matters` + 2–4 sentence motivating paragraph,
      followed by `### 🎯 You will learn to` + 1–3 Bloom-verb bullets,
      *then* the rest of the step content. Documented exception: `c.yml`
      keeps `### Chapter N: <hook>` instead of `### Why this matters`,
      but still gets the 🎯 list.
- [ ] Each step has `instructions:` (Markdown), zero or one `quiz:`
      block, and either `tests:` *or* a clear "exploratory step" callout.
- [ ] **Quiz `title:` is `"Step N — Knowledge Check"`** (1-indexed); quiz
      `min_score: 0.8`. No exceptions.
- [ ] **C++ tutorials use `backend: cpp`**, `language: cpp`, and an explicit
      `run_file` containing a C++17 program with `main`. Use files for setup
      and solutions, and complete C++ harnesses for automatic checks; do not
      author shell commands or rely on a C++ compiler in the v86 VM.
- [ ] **Compiler labs use `backend: compiler`** with three declared
      `compiler_files` paths, explicit AST projection, and `tests[].compiler`
      checks. Use different step directories to preserve drafts. Verify every
      expected AST alternative, lexical/syntax counterexamples, and resource-limit
      diagnostics; Run alone never awards completion credit. See §3.5.
- [ ] **Progression policy is deliberate.** Self-directed review may use
      `require_tests: false` and `require_quiz: false`; verify skipped checks
      stay unpassed, including after reload and in the instructions popout.
      Use `allow_skip_steps: true` when learners should also be able to jump
      directly to any numbered step; verify older saves keep that access.
- [ ] **Solutions live in `solution:`, not in `instructions:`.**
- [ ] **Hints are multi-layered** (≥3 layers for non-trivial tests),
      with `condition:` where useful, and **never reveal the literal
      solution**.
- [ ] **Tests cover all required behavior** *and* **only the required
      behavior** — see "Tests should be precise" above. Mentally run 3
      wrong solutions and 2 alternative correct solutions against each
      test.
- [ ] **Small checks expose partial progress.** Each assessed step reports
      meaningful criteria separately, with boundary coverage and useful names.
      Run a partial solution to verify that completed criteria pass while
      unfinished criteria fail; verify a focused correction updates the UI.
      Run the model and independent correct/incorrect alternatives in the
      actual backend, and keep the total check time practical.
- [ ] Independent React UI scenarios set step-level
      `react_reset_between_tests: true` and verify fresh state after both passing
      and failing checks. Omit it for deliberately cumulative assertions.
- [ ] **In-tutorial quizzes**: recall + spaced + higher-Bloom only. Never
      introduce new content in a quiz. Re-quiz at least one earlier-step
      concept by step 5+.
- [ ] **`option_feedback` written for the wrong distractors** that name a
      real misconception (per the `quiz-format` skill). Skip feedback for
      distractors that are obviously wrong — fix or cut the distractor
      instead.
- [ ] Diagrams added where they earn their place; type & syntax chosen
      via the `diagrams` skill; pedagogy checked via `good-diagrams`.
- [ ] Inline object-reference labs use a prepared example key in an
      `instructions:` HTML marker (see §3.4). Verify forward/backward playback,
      future growth without premature content, bounded preparation and responsive
      stepping, source highlights matching the displayed state through loops/calls,
      errors and completion, edited-code tracing, cleanup on step changes, the
      instructions popout, and the print transcript. Lab exploration does not award exercise credit.

### Page wiring (the page-pair convention)

Every real tutorial needs **two `.md` files** under `SEBook/`:

- [ ] `SEBook/<section>/<slug>-tutorial.md` — the live page:
      ```yaml
      ---
      layout: tutorial
      title: "<Tutorial title>"
      tutorial: <yaml-key>
      permalink: /SEBook/<section>/<slug>-tutorial
      ---
      ```
- [ ] `SEBook/<section>/<slug>-tutorial/print.md` — the **print view**
      (required — every real tutorial gets a print view so students can
      study offline / annotate on paper / submit a hard copy):
      ```yaml
      ---
      layout: print-tutorial
      title: "<Tutorial title> — Print View"
      tutorial: <yaml-key>
      permalink: /SEBook/<section>/<slug>-tutorial/print
      ---
      ```
- [ ] **Linked from the relevant SEBook chapter** (e.g. a design pattern
      chapter links its tutorial; a tools chapter links the tools).
- [ ] **Linked from the SE Gym** if the tutorial is a fundamental skill.
- [ ] If this is a **demo / lecture / playground / non-real tutorial**,
      add `exclude_from_index: true` near the top of the YAML so it
      doesn't appear on `/SEBook/tutorials`.

### `/SEBook/tutorials` index

The `/SEBook/tutorials` page is **auto-generated** by scanning
`_data/tutorials/*.yml` and joining each entry to the page that references
it via `tutorial:` front matter (`SEBook/tutorials.md`). You don't add or
remove entries by hand. Things to know:

- Adding `exclude_from_index: true` to a YAML hides that tutorial from the
  index. Use this for demos, lectures, playgrounds, backup files,
  instructor-only walkthroughs.
- Adding a new tutorial automatically lists it once both the YAML *and* a
  page with `layout: tutorial` + matching `tutorial:` key exist.
- Renaming a tutorial's `title` re-sorts it.

### Verification

- [ ] `bundle exec jekyll build` succeeds with no warnings about your
      new files.
- [ ] Open the live tutorial in a browser. Every step's tests pass for
      the intended solution and fail for at least one plausible wrong
      solution.
- [ ] For a required quiz, code-test success enables Next to open the check
      while the following numbered step stays locked; only passing the quiz
      unlocks that step. Check the same progression in detached instructions.
- [ ] Open the **print view** at `/SEBook/<section>/<slug>-tutorial/print`
      and confirm: instructions render, code blocks have syntax
      highlighting, quiz questions list options with correct ones marked,
      solutions are hidden by default (visible with `?instructor-mode=true`).
- [ ] **Accessibility (WCAG 2.2 AA)** — read
      `.agents/skills/wcag-aa-compliance/SKILL.md` and verify your
      tutorial against the criteria. New components, colored
      diagrams, focus rings, modal popouts — all in scope.
- [ ] **Light & dark mode** — read
      `.agents/skills/light-dark-mode/SKILL.md`. Toggle dark mode on the
      tutorial page and the print view; check every diagram and code
      block.
- [ ] **Storage inventory** — if you added a new persistence key (cookie,
      localStorage, IndexedDB), update `/cookies/` per the
      `cookie-storage-tracker` skill.
- [ ] **Tutorial-system tests** — if you added a new YAML field or
      changed runtime behavior, add or update a Playwright spec under
      `tests/`. Existing examples: `tests/python-tutorial.spec.js`,
      `tests/git-tutorial.spec.js`.
- [ ] **Prolog query surfaces stay independent.** Run and Debug execute
      the step's `default_query`; free-form queries belong in the Terminal
      view. Check that interpreter drafts, history, and transcript survive
      ordinary Run/Test actions without changing the authored query.
- [ ] **Update this SKILL.md** if you added a new YAML field, new
      backend, new popout, new test runner, new quiz / hint mechanic, new
      autosave mode, new debugger capability, or any architectural change.

---

## 3. Tutorial YAML schema (cheat sheet)

The runtime code is `js/tutorial-code.js` (~11k lines, the unified runtime
across backends). The schema below reflects what that file (and the print
layout, and the popouts) actually consume. **Update this section when you
add a field.**

### 3.1 Top-level fields

```yaml
title: string                          # Required. Shown in navbar + index
description: string                    # Required. Shown on /SEBook/tutorials
                                       # and as <meta description>

# === Authoring metadata ===
learning_objectives: [string]          # Optional. Bloom-verb statements (Apply,
                                       # Analyze, Evaluate, Create — not "understand"
                                       # or "know about"). Currently authoring-time
                                       # metadata for self-audit; not yet rendered
                                       # to students. The runtime ignores this field.
                                       # Add at the top of each tutorial so authors
                                       # and reviewers can verify Bloom coverage.

# === Index / surface visibility ===
exclude_from_index: boolean            # If true, /SEBook/tutorials hides
                                       # this entry. Set on demos, lectures,
                                       # playgrounds, _backup / _old files,
                                       # and any non-student-facing tutorial.
show_hints: boolean                    # Default true. Set false for assignments
                                       # that must not load TutorChat's authored
                                       # or generated hints after failed checks.
download:                              # Optional editor-file ZIP download.
  filename: assign.zip                 # Browser download filename.
  files: [src/App.jsx, package.json]    # Explicit paths relative to archive root.
                                       # Every path must have a loaded editor model.
                                       # Includes current text, even with Auto-save off.
                                       # No wrapper directory, execution, or submission.

# === Backend selection ===
backend: v86 | cpp | pyodide | webcontainer | react | prolog | haskell | smalltalk | compiler | uml-editor | multiple
                                       # default: v86

# v86           — full Linux VM (shell, gcc, git, etc.). Most tutorials.
# cpp           — C++17 compiled locally by pinned YoWASP Clang in a module
#                 worker, then executed as WebAssembly through WASI. Uses the
#                 output panel and Run; no shell, VM, SharedArrayBuffer, or
#                 cross-origin isolation is required. Supports mixed cpp /
#                 pyodide tutorials. See §4.6 for limits and §4.8 for checks.
# pyodide       — Python in-browser, no shell; supports `debugger: true`.
# compiler      — Regex tokenizer + EBNF parser + declarative AST projection.
#                 Single-backend, disposable local Worker; all complete parse
#                 trees and distinct AST alternatives within explicit bounds.
#                 Reads the three compiler_files from Monaco, with no VM or
#                 execution of the parsed language. See §3.5.
# webcontainer  — Node.js + npm + dev server (StackBlitz). Needs COOP/COEP.
# react         — React + Vite + live preview iframe + Playwright-compat.
# prolog        — Single-backend Tau Prolog 0.3.4 worker, locally pinned under
#                 js/vendor/tau-prolog/0.3.4/. Run executes default_query against
#                 the step's run_file; the separate Terminal view accepts
#                 free-form goals. Supports the course not/1 alias for \+/1.
# haskell       — Haskell in a hidden, sandboxed runtime frame through the
#                 repository's locally pinned MicroHs WebAssembly runtime.
#                 Uses the output panel rather than a shell, is single-backend
#                 only, and does not require cross-origin isolation.
# smalltalk     — Single-backend native Squeak image in a verified SqueakJS
#                 Worker. System Browser, multiline terminal and Run share one
#                 persistent Workspace. Run evaluates run_command in that image;
#                 it neither boots a new image nor reloads files. Drafts are
#                 excluded until native Accept succeeds. Restart session keeps
#                 accepted code and clears live objects/bindings.
#                 Every individual Boolean check gets a disposable fresh image
#                 loaded from one frozen accepted Program snapshot for its batch.
#                 Only Smalltalk true passes; strings/numbers/errors do not.
#                 Current legacy file saves restore as unaccepted file drafts;
#                 Browser method drafts are session-only until typed persistence
#                 lands. Do not treat a restored generic file draft as accepted.
# uml-editor    — ArchUML visual editor workspace for diagramming tutorials.
#                 The standard instruction panel renders on the left, the UML
#                 editor renders on the right, and `tests[].assertions`
#                 validate the ArchUML model for the current step's `uml_type`.
#                 Later steps automatically show rendered previews of earlier
#                 UML step drafts in the instruction panel (for example, a
#                 state-diagram step shows the class diagram, and a sequence
#                 step shows the class and state diagrams). The step footer
#                 includes a confirmed "Remove All Elements" action that clears
#                 the active step's diagram draft while leaving other diagram
#                 types saved.
#
# multiple      — explicit marker for a mixed-backend tutorial. Every step
#                 must set `steps[].backend`.
#
# Mixed-backend tutorials may also set `steps[].backend` to override a normal
# tutorial-level default per step. Mixed mode supports `v86`, `cpp`, `pyodide`,
# `react`, `webcontainer`, and `browser` steps, with `browser` serving as the
# in-page Node fallback if WebContainers cannot boot. Keep `haskell`,
# `uml-editor`, SQL, Prolog, Java, and debugger tutorials single-backend until
# the runtime explicitly supports those combinations.
# Mixed tutorials with multiple worker backends (such as cpp and pyodide)
# replace the active worker lazily when switching languages, restoring the
# source files mirrored by the host. They do not prewarm the other worker
# backend or keep both language runtimes alive concurrently.
#
# v86 IN MIXED MODE. A mixed tutorial containing at least one `v86` step gets
# a third runtime panel — the xterm terminal — alongside the output and
# preview panels, and `_updateRuntimePanelVisibility` shows exactly one of the
# three per step. The flag driving this is `TutorialCode._mixedNeedsTerminal`
# (set in the constructor when a `v86` step is declared); `config.useTerminal`
# stays FALSE in mixed mode because it selects the single-backend layout
# branches. Consequences for authors:
#   - Supply the VM's setup through `setup_commands_by_backend.v86`, not
#     top-level `setup_commands` (which mixed mode empties). `_initV86` threads
#     that list into `_setupFilesystem`.
#   - v86 steps have NO Run button — the terminal replaces the output panel.
#     Ctrl/Cmd+Enter syncs the buffer to the VM instead of executing.
#   - v86 is deliberately excluded from `_prewarmNextBackend`. Prewarming
#     leaves `config.backend` on the visible backend, which would make the
#     boot path skip its setup batch and flash a loading overlay over an
#     active step, so the first v86 step pays the full boot cost.
#   - `libv86.js` is preloaded by `_loadDependencies` only for single-backend
#     v86 tutorials; `_initV86` lazy-loads it when `window.V86` is absent.
#   - The VM has no C++ compiler: `/usr/bin/gcc` is a wrapper around TinyCC
#     (C only). Use `backend: cpp` for runnable C++ steps; the CS131 refresher
#     alternates cpp and pyodide and no longer needs a VM terminal. Do not
#     present grep/awk source patterns as evidence of C++ behavior.

# === Common feature flags ===
require_tests: boolean                 # If true, student must pass each step's
                                       # tests to advance. Default false.
                                       # NOTE: only steps that actually declare
                                       # `tests:` are gated. A step with no
                                       # `tests:` block is treated as ungated
                                       # — Next is enabled immediately (a quiz,
                                       # if present, opens via clicking Next).
                                       # This makes purely-quiz / summary /
                                       # reflection steps work inside an
                                       # otherwise test-gated tutorial.
require_quiz: boolean                  # Default true. Set false to keep quizzes
                                       # as optional diagnostic practice. They
                                       # still open on Next, with Skip Knowledge
                                       # Check available immediately and Continue
                                       # available after any score. Only scores
                                       # meeting min_score record quizPassed.
                                       # Pair with require_tests: false for
                                       # completely optional checks. Applies to
                                       # TutorialCode backends and the shared
                                       # instructions popout. Print views label
                                       # min_score as an optional practice target.
allow_skip_steps: boolean              # Default false. TutorialCode only: make
                                       # every numbered step selectable from the
                                       # start, including in instruction popouts
                                       # and after restoring older saved progress.
                                       # Does not mark tests or quizzes passed.
                                       # Pair with require_tests: false and
                                       # require_quiz: false for optional practice
                                       # through both numbered steps and Next.
                                       # When required, passing code tests enables
                                       # Next to open the quiz, but the following
                                       # numbered step stays locked until the
                                       # quiz is passed. The same distinction
                                       # applies to instructions popouts.
font_size: integer                     # Optional Monaco/editor font size in px.
                                       # Defaults to 16 so code, terminal input,
                                       # and editor popouts meet the site's
                                       # paragraph-size readability baseline.
cooldown_seconds: integer              # Optional, default 0 (disabled). When
                                       # > 0, every "Test My Work" run starts
                                       # a per-step cooldown of this many
                                       # seconds. While the cooldown is active
                                       # the visible Test button is replaced
                                       # by a disabled timer-icon countdown
                                       # ("⏱ Test My Work (4:32)") and a
                                       # secondary "I'm sure" button that
                                       # re-runs the tests SILENTLY — no
                                       # results panel, no announcer message,
                                       # no TutorChat callback — but a passing
                                       # silent run still unlocks the next
                                       # step. Persisted across reloads via
                                       # localStorage `tutorial-cooldown-<id>`
                                       # (a `{stepIndex: endsAt}` JSON map),
                                       # so refreshing can't bypass the wait.
                                       # Works on every backend (v86, cpp, pyodide,
                                       # webcontainer, react, browser, sql,
                                       # prolog, java, haskell, uml-editor) plus
                                       # the instructions popout. Implementation:
                                       # _buildTestButtonHTML / _runTests /
                                       # _renderTestResults in
                                       # js/tutorial-code.js + the matching
                                       # methods in js/tutorial-uml-editor.js.
                                       # Use to slow down test-spamming on
                                       # homework-style tutorials where
                                       # thinking before retesting is the
                                       # learning goal (e.g. UML modeling,
                                       # design exercises).
linter: boolean | "pyflakes"           # Live diagnostics in Monaco gutter.
debugger: boolean                      # Debugger for pyodide, browser/webcontainer,
                                       # prolog, and haskell (single-backend).
debugger_options: { ... }              # Per-tutorial debugger config
                                       # (snapshot caps, breakpoint behavior).
uml_diagram: boolean                   # Live UML class+sequence diagram pane.
uml_position: left | right | below | bottom-left | bottom-right
uml_class_layout: portrait | landscape
uml_default_view: boolean              # Show UML by default (vs. editor).
uml_default_type: class | sequence
git_graph: /path/to/repo               # Path enabling visual commit graph.
git_gutter: boolean                    # +/-/~ markers in Monaco gutter
                                       # vs. HEAD. Requires git_graph.
git_setup: [string]                    # Git init commands (per-tutorial).
make_dag: /path/to/dir | step_dir      # v86 only. Live SVG pane that visualises
                                       # the dependency graph `make -n` would
                                       # walk for the Makefile in <dir>. Use the
                                       # literal value `step_dir` to make the
                                       # graph follow each step's `step_dir`,
                                       # which is useful when every tutorial
                                       # step runs in an isolated project dir.
                                       # Refreshes on Makefile save and after
                                       # every shell command (~80ms debounce).
                                       # Renders:
                                       #   - solid arrow target → prerequisite
                                       #   - dashed arrow for order-only (`|`)
                                       #     prerequisites
                                       #   - red left stripe + pulsing glyph
                                       #     on stale targets (= what
                                       #     `make -n` would rebuild)
                                       #   - dashed border + amber glyph on
                                       #     `.PHONY` targets
                                       #   - flat italic text for source files
                                       # A view toggle (Editor / Make DAG)
                                       # appears top-right of the workspace.
                                       # Click any node to jump to its rule
                                       # in the Makefile.
                                       #
                                       # Per-step `view: make_dag` defaults the
                                       # workspace to the DAG when that step
                                       # opens. Authors typically set it on the
                                       # synthesis / incremental-build steps
                                       # where the graph is most pedagogical.
                                       #
                                       # Implementation: js/make-graph.js
                                       # (parser + renderer) and the
                                       # `_refreshMakeDag` /
                                       # `_renderMakeDagFromText` /
                                       # `_maybeAutoRefreshMakeDag` methods on
                                       # TutorialCode. The dump command
                                       # captures `make -pn`'s "# Files" stanza
                                       # plus PHONY declarations and source
                                       # mtimes into the active directory's
                                       # .makedag_state file.
make_dag_options: { ... }              # Reserved for future per-tutorial
                                       # configuration (e.g. hide_targets_matching
                                       # regex, custom layout direction). The
                                       # MVP uses sensible defaults for all
                                       # styling decisions.
editor_split: boolean                  # Two-pane: tests left, code right.
output_height: "40%" | "320px"         # Override output panel height.
output_position: bottom-left           # Move output below instructions.
run_label: string                      # Override Run button label
                                       # (e.g. "Test" for Playwright).

# === Setup / lifecycle hooks ===
setup_commands: [string]               # Run once at tutorial load for
                                       # single-backend tutorials only.
                                       # bash for v86, Python for pyodide,
                                       # serialized `sh` for WebContainer.
                                       # Readiness waits for every command;
                                       # timeout or nonzero exit rejects setup.
                                       # Unsupported by the cpp and haskell backends;
                                       # put required definitions in files.
setup_commands_by_backend:             # Mixed-backend tutorials only.
  pyodide: [string]                    # Run once when that backend first
  react: [string]                      # initializes. Usually empty for React.
  webcontainer: [string]               # Awaited, serialized shell commands in
                                       # the WebContainer. A failure rejects
                                       # backend readiness instead of silently
                                       # continuing in the browser fallback.
  browser: [string]                    # Reserved for browser fallback setup.
post_fileload_setup: [string]          # Run after files are synced.
user_command_listener: string | null   # JS callback name for command events
                                       # (used by git-playground).

# === Autosave / progress / reset ===
autosave_type: files | commands-and-files | none | false    # default: files
reset_type:    files | commands                       # default: files
progress_version: integer | null                     # opt-in stable lesson identity
legacy_step_keys: [string]                           # original unversioned lesson order
# Versioned progress requires a unique, stable `key` on EVERY step. Keep keys
# when editing titles or moving lessons; do not reuse a removed lesson's key.
# autosave: what is persisted to localStorage between visits.
#   files                 — current contents of every editor.
#   commands-and-files    — also replay saved solution commands on restore.
#   none / false          — no persistence. (Demos / lectures.)
# reset:    what "Reset Step" replays.
#   files                 — restore step's starter files only.
#   commands              — also replay setup_commands + prior solution
#                           commands to restore VM state.
# C++ tutorials use file autosave/reset; they do not replay shell commands.

# === Test runner (per backend) ===
pytest: boolean                        # Treat test_*.py as a pytest suite
                                       # (pyodide only).
playwright:                            # React tutorials only.
  enabled: boolean
  test_files: [string]                 # Globs for test specs.
  app_files: [string]                  # Files included in the preview.
  timeout: number                      # ms.
  reset_between_tests: boolean

# === Mode flags ===
instructor_mode: boolean               # Always show solutions, hints,
                                       # answers. Set on lecture configs.
disable_quiz: boolean                  # Skip all quizzes (lectures).
```

### 3.2 Step fields (`steps:` is a list)

```yaml
steps:
  - title: string                            # Required. Shown in nav.
                                             # Inline Markdown is supported
                                             # in the visible heading for code
                                             # spans/emphasis; keep the plain
                                             # text descriptive for nav labels.
    backend: v86 | cpp | pyodide | react | webcontainer | browser
                                             # Optional per-step backend
                                             # override. Inherits the
                                             # tutorial-level backend when
                                             # omitted. Mixed tutorials use
                                             # this for author-controlled
                                             # backend changes; students do
                                             # not choose the backend at
                                             # runtime.
    max-time: number                         # Optional timed-practice limit
                                             # in minutes for this step,
                                             # including its knowledge-check
                                             # quiz. Supports decimals for
                                             # demos/tests, but real tutorials
                                             # should use humane whole-minute
                                             # values. Runtime controls let
                                             # learners add time while keeping
                                             # the countdown visible.
    lockout-time: number                     # Optional timed-practice
                                             # lockout duration in minutes
                                             # after the countdown reaches 0.
                                             # Default: 60.
    instructions: |                          # Required. Markdown.
      Multi-paragraph step instructions.
      Code blocks Rouge-highlighted.

    files:                                   # Starter files for this step.
      - path: string                         # e.g. "/tutorial/main.py"
        content: |
          # File content
        language: python                     # Monaco language id.
        smalltalk_format: filein | doit       # Smalltalk only. Default: filein.
                                             # Omitted language + .st infers
                                             # Smalltalk; explicit other languages
                                             # are resources and never execute.
        pane: editor | tests | preview       # Which Monaco pane to load
                                             # the file into. default: editor.
        print_language: python               # Override syntax highlight in
                                             # the print view.
        reseed: true                         # Give this step its own version of
                                             # the file. First entry uses this
                                             # starter; revisits restore the
                                             # learner's draft for this step.
                                             # Same-named files without reseed
                                             # keep shared cross-step edits
                                             # (e.g. an evolving TDD program).
                                             # Reset Step explicitly restores
                                             # the current step's starter.

    # Smalltalk uses api.normalizeProgram in js/smalltalk/fresh-runner.js.
    # Ordered files load with run_file last once when a live/fresh image starts;
    # run_command is then evaluated in the persistent live image by Run. Missing
    # run_command reports successful loading. Keep runner/check selector names
    # stable across refactors. TutorialAdapter composes Workspace + FreshRunner;
    # TutorialAdapter.getWorkspace() exposes the accepted Program/draft owner.
    # run({acceptDrafts,signal}) evaluates in that Workspace; Accept and Run
    # rejects stale drafts before accepting, chains native commit revisions,
    # and never executes the entry after a failed acceptance. Earlier successful
    # draft commits remain accepted if a later draft fails. runTests forwards
    # its signal to independently owned fresh leases and reports batch revision.
    # Each normal check row includes error:null; failed rows include RuntimeError.
    # Stop recovery failures remain visible and block reuse until a successful
    # Workspace recovered event (including terminal Restart) repairs the gate.
    # A recovered event cannot dismiss a still-pending later recovery attempt.
    # TutorialCode also announces recovery errors through a scoped alert region.
    # Successful Reset/Apply Solution clears current-step drafts after accepted
    # replacement; failed replacement and ordinary Restart preserve drafts.
    # progress.js encodes accepted Program and Draft[] separately under the
    # existing progress record's smalltalk_workspace:{version:1,steps:{[stepKey]:
    # {program,drafts}}}. Both full and targeted saves use native snapshots,
    # preserving generated definitions/removals instead of declared-file filters.
    # Restore decodes accepted source/drafts before Workspace/view creation.
    # Legacy declared-file overrides become drafts, never accepted code.
    # Legacy keys use the same workspace-path normalizer (including /tutorial/).
    # Alias choice prefers the exact canonical key, then stable code-unit order.
    # Conflicting source stays in the original files record for export; warnings
    # recur while unresolved aliases remain. Transient migratedLegacyFiles is
    # held only by the adapter's step map and excluded from encoded progress;
    # a successful save removes only original keys with matching migrated text.
    # Explicit deleteSavedProgress clears remembered steps before current reset.
    # Disabling Auto-save with No keeps both disk and live/session work.
    # Unvisited malformed/future records retain source-only data plus optional
    # invalid:string quarantine reason; decode warns and loads the starter,
    # retaining valid drafts. A new version1 envelope cannot promote quarantine.
    # No live images/objects/bindings/handles/checkpoints/undo history are saved.
    # Existing Auto-save preference, quota status, deletion and whole-record
    # SE Gym transfer apply; there is no second persistence key/cache.
    # TutorialCode mounts Browser/Inspector views around the adapter's Workspace.
    # Its dynamic loader loads source-views.js before browser.js; Browser owns
    # the composed raw source, draft and accepted-change presentation module.
    # FreshRunner.create({host}) shares the adapter's RuntimeHost;
    # dispose aborts only its own withFreshSession leases. Without host, create
    # acquires/owns verified assets and dispose owns host cleanup. All fresh work
    # uses exclusive host.withFreshSession, never host.stop('fresh').
    run_command: string                      # Optional Smalltalk entry expression.
    smalltalk_target:                         # Optional initial native Browser target.
      kind: class                            # EntityRef, passed to Browser.navigate.
      className: SEBookCounter
      side: instance                         # instance | class
    open_file: string                        # Which file to focus on load.
    run_file: string                         # Which file the toolbar Run button
                                             # executes. In Pyodide tutorials
                                             # with top-level `pytest: true`, a
                                             # pytest-named file (`test_*.py` or
                                             # `*_test.py`) is run through
                                             # `pytest.main([path, "-v"])` and
                                             # the toolbar label changes to
                                             # "Test".
                                             # In C++ tutorials, Run compiles
                                             # this translation unit as C++17
                                             # and executes its main function
                                             # on every run. Current workspace
                                             # files are available as includes
                                             # under /tutorial. Use an explicit
                                             # workspace-relative entry, e.g.
                                             # main.cpp; opening another file
                                             # does not change the Run target.
                                             # In Haskell tutorials, Run syncs
                                             # every workspace file, derives the
                                             # module name from `run_file` (or
                                             # the active `.hs` file), imports
                                             # that module, and invokes `:main`.
                                             # Prefer the conventional
                                             # `Main.hs` / `Main` entry point.
    run_files: [string]                      # Pyodide + `pytest: true` only:
                                             # run all listed pytest files from
                                             # the toolbar Test button. Use this
                                             # when a step intentionally gives
                                             # students multiple test files to
                                             # read/run together. Keep
                                             # `run_file` as the primary debug
                                             # target if the tutorial debugger is
                                             # enabled; `run_files` only changes
                                             # the toolbar pytest run.
    view: editor | git_graph | uml | make_dag    # Override default pane visible.
                                             # `make_dag` requires a top-level
                                             # `make_dag:` config; opens the
                                             # live Make dependency graph.
    run_file: string                         # Which file the ▶ Run button
                                             # executes. Defaults to the active
                                             # editor file. For multi-file
                                             # steps (e.g. webcontainer Node
                                             # projects with a separate test
                                             # file) set this to the entry
                                             # point — e.g. `main.js`.
    test_file: string                        # webcontainer (with browser-
                                             # sandbox fallback) only. When
                                             # set, an inline `✓ Test` button
                                             # appears next to `▶ Run` in the
                                             # output panel. Clicking it
                                             # spawns `node <test_file>` and
                                             # streams stdout/stderr to the
                                             # same output panel as the Run
                                             # button. The argv input is
                                             # ignored during test runs.
                                             # Useful for lectures with a
                                             # driver + test pair, e.g.
                                             # `run_file: main.js` +
                                             # `test_file: __tests__/foo_test.js`.
                                             # Independent of the gate-style
                                             # ✓ Test My Work button (which
                                             # uses the `tests:` block) — set
                                             # only one to avoid two test
                                             # buttons on screen.
    has_args: boolean                        # pyodide / webcontainer
                                             # only. Show a command-line argv
                                             # field next to the Run button.
                                             # Pyodide passes it as `sys.argv`,
                                             # webcontainer appends it to the
                                             # `node <run_file>` invocation as
                                             # `process.argv.slice(2)`.
    default_query: string                    # prolog only. Authored goal used by
                                             # Run and Debug, independent of the
                                             # Terminal prompt and history.
                                             # Write a goal without the ?- prompt;
                                             # its final period is optional.
                                             # An absent/empty goal makes Run
                                             # consult the entry file only.
    default_args: string                     # webcontainer only. Initial
                                             # value the argv field shows on
                                             # step load. Useful so the first
                                             # ▶ Run still demonstrates
                                             # something meaningful before the
                                             # student types.
    args_placeholder: string                 # webcontainer only. Placeholder
                                             # text shown when the argv field
                                             # is empty (default `argv...`).
    args_title: string                       # webcontainer only. Tooltip /
                                             # aria-label for the argv field
                                             # (default
                                             # `Command-line arguments
                                             # (process.argv)`).
    args_label: string                       # webcontainer only. Short label
                                             # rendered before the argv input
                                             # (default `argv:`).
    step_dir: /absolute/path                 # v86 / webcontainer only. When
                                             # this step opens, drop the user's
                                             # interactive terminal into the
                                             # specified directory. v86 injects
                                             # `cd` into its persistent shell;
                                             # WebContainer first validates an
                                             # absolute path under `/tutorial`
                                             # with an awaited, bounded command,
                                             # then uses it for background runs
                                             # and restarts the interactive
                                             # shell there. Used by
                                             # multi-step build / Make tutorials
                                             # where the terminal should stay in
                                             # the active project directory. For
                                             # tutorials that isolate steps in
                                             # separate directories, set a unique
                                             # `step_dir` per step and use
                                             # top-level `make_dag: step_dir` if
                                             # the Make DAG pane should follow.
                                             # Implementation:
                                             # TutorialCode._runStepDir.
                                             # NOTE: do NOT try to do this via
                                             # a `cd` line in setup_commands —
                                             # that batch runs in a subshell
                                             # and the PWD does not propagate
                                             # back to the user's terminal.
    uml_type: class | sequence | state | component | deployment | usecase | activity
                                             # uml-editor backend only: selects
                                             # the editor diagram type for this
                                             # step. Drafts autosave per type;
                                             # later steps render earlier
                                             # saved/current UML drafts below
                                             # the instructions for reference.
    commands: [string]                       # Example commands shown to
                                             # student (display only).
    react_reset_between_tests: boolean       # React assertion batches; default false.
                                             # Rebuild the isolated preview before
                                             # each check, including after failure.
                                             # Source files and drafts are retained.
                                             # Playwright has its own reset policy.

    tests:                                   # One reported row per criterion;
                                             # step gate when require_tests.
      - description: "One behavior this verifies"
        command: |                           # The assertion code.
          # bash for v86: `test -f /tutorial/foo.py`
          # python for pyodide: `output = __run_capture('/tutorial/x.py');
          #   assert "expected" in output`
          # cpp: complete C++17 harness with its own main; include current
          #   learner files using /tutorial as the include root. Exit 0 passes.
        signature:                           # Haskell only; optional explicit
          name: canAffordPizza                # top-level declaration in run_file.
          type: "Double -> Double -> Bool"    # Compiler-resolved exact monomorphic type.
                                             # Keep command as a Boolean check;
                                             # use "True" for declaration/type checking
                                             # with successful compilation.
        assertions:                          # uml-editor backend only:
                                             # structural checks against the
                                             # current ArchUML source. Each
                                             # assertion has `kind`/`type`:
                                             # element|class|state|participant,
                                             # member, relation|transition|message,
                                             # or class_consistency.
                                             # Common fields: id/name,
                                             # owner, text/member, from, to,
                                             # label_contains. `*_contains`,
                                             # `*_contains_any`, and camelCase
                                             # equivalents match identifiers,
                                             # labels, members, endpoints, or
                                             # message labels by normalized
                                             # case-insensitive substring.
                                             # `naming_hint` adds a
                                             # student-facing hint to the
                                             # shared tutorial Hints panel
                                             # only when the assertion finds
                                             # a same-kind candidate with
                                             # non-matching naming (for
                                             # example, a method on the right
                                             # class with the wrong operation
                                             # name).
                                             # `element_type_any` accepts
                                             # alternatives such as interface
                                             # or abstract class. `is_abstract`
                                             # on member assertions requires a
                                             # `{abstract}` operation or an
                                             # operation declared by an
                                             # interface or abstract class.
                                             # `requires_arguments: true`
                                             # on member assertions requires
                                             # an operation signature with
                                             # parentheses, e.g. `method()`,
                                             # so attributes with similar
                                             # names do not satisfy operation
                                             # checks.
                                             # `argument_type` /
                                             # `argument_type_any` on member
                                             # assertions requires a parameter
                                             # typed as that class/interface,
                                             # accepting forms such as
                                             # `state: PlayerState`,
                                             # `PlayerState state`, or
                                             # `PlayerState`.
                                             # `relation_type_any` accepts
                                             # semantic types such as
                                             # aggregation or composition.
                                             # `source_multiplicity` /
                                             # `target_multiplicity` and their
                                             # `_any` variants check the
                                             # semantic relation endpoints;
                                             # aggregation/composition
                                             # multiplicities follow the UML
                                             # owner-to-part direction even
                                             # when the textual spelling is
                                             # reversed.
                                             # `relation_type_for_target_type`
                                             # maps target element types to
                                             # required relation types, e.g.
                                             # interface: realization and
                                             # abstract class: generalization.
                                             # State-diagram consistency can
                                             # reference concrete class-diagram
                                             # state names with `class_role`,
                                             # `from_class_role`, and
                                             # `to_class_role` (roles: normal,
                                             # jail/prison, bankrupt). Use
                                             # `label_min_length` for minimum
                                             # relation/transition label
                                             # length, and `optional: true`
                                             # for a relation that only fails
                                             # if it is present but malformed.
                                             # Class-diagram consistency uses
                                             # `kind: class_consistency` with
                                             # `check: abstract_methods_implemented`
                                             # to require every concrete
                                             # subclass to implement inherited
                                             # abstract/interface operations.
                                             # Sequence-diagram consistency
                                             # uses `kind: sequence` with
                                             # checks such as player_object,
                                             # state_objects,
                                             # messages_between_player_and_states,
                                             # state_change_between_state_calls,
                                             # state_change_argument_is_next_state,
                                             # call_labels_have_argument_lists,
                                             # and called_methods_exist.
                                             # Class generalization /
                                             # realization and aggregation /
                                             # composition arrows use UML
                                             # semantics, so reversed textual
                                             # spellings still satisfy the
                                             # conceptual from/to endpoints
                                             # when the arrowhead/diamond is
                                             # on the correct UML end.
        hints:                               # Multi-layered, see §1.
          - text: "Layer 1 hint (orientation)"
          - text: "Layer 2 hint (strategy)"
            condition: "code_missing: range("
          - text: "Layer 3 hint (skeleton)"
            condition: "output_missing: 42"

    quiz:                                    # See `quiz-format` skill.
      title: "Step N quiz"
      min_score: 0.8                         # Fraction to pass / advance.
      shuffle: true                          # Default true.
      shuffle_questions: false               # Optional. Use for deliberate
                                             # difficulty ramps while keeping
                                             # answer-option shuffling.
      shuffle_options: true                  # Optional. Defaults to the
                                             # `shuffle` value.
      questions:
        - type: single | multiple | parsons
          difficulty: basic | intermediate | advanced | expert
          question: "Markdown..."
          options: ["A", "B", "C", "D"]
          correct_index: 1                   # single
          correct_indices: [0, 2]            # multiple
          optional_indices: []               # multiple — bonus-only
          option_feedback:                   # SPARSE hash, by index.
            0: "Misconception note for 0"
          explanation: "General explanation"
          # Parsons only:
          lines: ["line1", "line2", "line3"]
          distractors: ["unused1", "unused2"]

    solution:                                # Instructor-mode reveal target.
      files: [{ path, content, language }]
      commands: [string]                     # Bash to replay solution state.
                                             # Unsupported by the cpp and haskell
                                             # backends; use solution.files.
      explanation: |                         # Markdown — *why* this works.
        Walk-through of the solution and the trade-offs.
```

### 3.3 Hint conditions

`condition:` syntax (evaluated against the student's current code or last
test output):

- `code_contains: <substring>` — fires when the source contains the substring.
- `code_missing: <substring>` — fires when the source does **not** contain it.
- `output_contains: <substring>` — fires when the captured output contains it.
- `output_missing: <substring>` — fires when the output does **not** contain it.

Combine multiple hints with different conditions to form a **graduated
help ladder** that responds to the student's actual mistake.

### 3.4 Inline Python object-reference labs

**Use an object-reference lab when a mistaken model of identity or sharing
would change the learner's prediction and the diagram can reveal why.** Use it
for assignment mistaken for copying, mutation confused with rebinding, nested
members assumed independent, parameters or loop names mistaken for caller or
container slots, equality mistaken for identity, shared defaults across calls,
and class state confused with instance state. Choose the learner's likely
reasoning error first; a matching Python keyword is not sufficient.

Apply an editorial test before embedding:

- State the competing predictions and the visible reference that distinguishes
  them. A correct printed result alone can be consistent with a wrong model.
- Check that the compact view actually displays that distinction. Primitive
  identities have separate cards too: verify that shared uses reach one card
  and equal-but-distinct values remain separate. Do not rely on equal displayed
  values alone to establish sharing.
- Replace a redundant static walkthrough of the same state rather than stacking
  prose, code, a snapshot, and another full lab. Keep a later independent task
  or a different object shape as transfer practice.
- Teach one contrast at a time. Start with append versus explicit assignment;
  use `+=` versus `+` as later synthesis. Avoid combining receiver rebinding,
  nested helpers, replacement construction, and returning an instance in a
  first member lesson. Neutral titles should not give away the prediction.

Place the lab beside the relevant explanation in `instructions:`, before the
independent task. Use this teaching sequence:

1. Ask for a prediction about an intermediate relationship and the eventual
   output: which two expressions reach one object, or which slot will move?
2. Give one inspection goal, such as following both list slots or comparing the
   caller's name with the local parameter after assignment. Use **Forward** and
   **Back** to compare specific states. Clicking through is not the learning goal.
3. Offer one controlled code change and ask for a new prediction **before editing**
   because edits retrace automatically. Put that prompt in `variation`, separately from the prepared answer.
   Put the changed case's reason and output in `variation_explanation`, revealed
   only through **Check the suggested change**. The visible **Try one change**
   prompt stays available while editing; reset closes the answer disclosure.
4. Return to the independent task in the tutorial editor. Explain on first use
   that the lab has its own editor. A worked lab does not complete the tutorial's
   task or replace its tests, quiz, or independent transfer question.

For copying, distinguish independence from the source from sharing *inside* a
deep copy. For a mutable default, compare an earlier returned alias with the
parameter on the next call: the compact view omits function/default-storage
edges, so explain definition-time retention in prose rather than claiming that
edge is drawn. A short later prediction about repeated construction or loop
binding can check transfer without adding a lab to every Python lesson.

The selection rationale and review of each previous placement are recorded in
`docs/object-reference-teaching-review.md`; research provenance, study limits,
and lecture-slide mappings are in `docs/object-reference-pedagogy-research.md`.
Treat Python-specific language traps inferred from the lecture/documentation
separately from empirically observed student models. Do not claim that the
examples are validated interventions or that all targets are the most frequent
errors without corresponding learner evidence.

An `instructions:` Markdown block can embed a prepared, editable Python lab:

```yaml
instructions: |
  Predict which references change, then step through the example.

  <div data-object-reference-example="shared_slots" data-object-reference-editor="inline"></div>
```

The marker is ordinary authored HTML, not a new step field or a code fence.
Place it beside the concept it explains. Prepared definitions live in
`_data/object_reference_examples.yml`, keyed by example name, with `title`,
`code`, `prediction`, and `explanation`. Optional `variation` contains the
controlled-edit question; optional `variation_explanation` supplies its separate
answer disclosure. Both are plain text like the other prose fields. Keep the
question free of its answer and specify that it starts from the prepared code.
Printing an unchanged prepared example includes both the variation and its
answer. Printing arbitrary edited code omits prepared explanations and variation
feedback, so an old answer cannot describe a new program. Generated
`_data/object_reference_labs.json` adds `trace` using the same Python tracer
as the browser lab. The generated data is exposed at
`/assets/object-reference-labs.json` by `object-reference-lab-examples.json`.
Keep source definitions and generated traces synchronized after editing code:
run `python3 scripts/build-object-reference-traces.py`, then validate with
`python3 scripts/build-object-reference-traces.py --check`. New examples must
complete without trace errors or omitted state.
The chapter include `{% include object-reference-lab.html example="shared_slots" %}`
embeds that same record directly in a static SEBook page; use the HTML marker
inside tutorial YAML because its content is not processed as a Liquid template.

Every lab now has one always-visible **Python code** editor beside the diagram.
It combines editing, Python syntax highlighting, line numbers, and a marker for
the operation represented by the displayed state. The old `data-object-reference-editor="inline"` and include
`editor="inline"` options remain harmless compatibility attributes; omitting
them no longer hides the editor. Do not add a separate read-only source pane.

The Python tutorial currently uses eight inline labs across seven lessons:

| Step key | Example | Mental-model contrast |
| --- | --- | --- |
| `lists` | `shared_slots` | A changed inner object versus a replaced outer-list slot. |
| `members` | `member_sharing` | Distinct instances can share a member; mutation differs from replacing one attribute. |
| `classes` | `class_attributes` | Class lookup and mutation do not create an instance attribute; assignment can. |
| `copies` | `shallow_copy` | Shallow members stay shared; deep copying separates source state but preserves internal aliases. |
| `equality` | `identity_equality` | Equal list values do not imply shared identity or shared mutation. |
| `calls-defaults` | `parameter_rebinding` | Caller and parameter have separate bindings; return supplies the call-site assignment. |
| `calls-defaults` | `mutable_default` | Separate omitted-argument calls can reuse one list, including an earlier returned result. |
| `loops` | `loop_rebinding` | A loop name is a binding to an object, not an alias for a container slot. |

The Python chapter uses these same eight records beside their relevant concepts.
The primitive-only `names_rebinding` and combined `returned_member_alias` scenes
were removed from the teaching set; nested-call and primitive-display behavior
remain covered by runtime tests. The comprehension lesson uses a short
prediction contrasting repetition, repeated evaluation of a name, and repeated
list construction rather than another widget.

The unified editor supports automatic retracing and forward/backward playback.

The lab shows recorded scopes, objects, and references alongside editable
Python. **Forward**, **Back**, and **Play** use one filtered timeline without executing
the program again. The Python tracer marks definition-only bookkeeping with
`skipPlayback: true`; the controller omits those stops and numbers the visible
steps consecutively. Raw traces retain every recorded event. Skip ordinary
function/class headers and class-entry/exit scaffolding, but keep executable
class-body assignments, called bodies, function returns, and errors. Potentially
effectful defaults, decorators, bases, and annotations stay visible conservatively.
Definitions still execute; skipping a playback stop does not bypass Python code.
Edits automatically record the current code after 650 ms without further input,
using a fresh disposable Pyodide worker; it does not execute the tutorial editor's files or change the
tutorial's own Python interpreter. Prepared examples work without starting that
worker. There is no Trace Python button; editing is the execution trigger.
Each update reruns
the whole program and restores the same visible step number, clamping to the
last available step if the successful trace is shorter. This is not execution
continuation or source-line matching: a control-flow change can change which
statement that step describes. Syntax/runtime errors retain the requested
position through correction; explicit Back/Forward/Play select a new position.
**Restart** returns to step 1 without changing the current code. **Restore original
code** restores the prepared source and trace at step 1. There is no Stop button;
a new edit cancels the previous run, and execution retains its time limit.

Typing stays enabled during loading/execution. A new edit cancels the pending
debounce and terminates the old worker; worker identity guards reject stale
messages. Do not execute during IME composition. Restore original code cancels
queued/running work. Restart during an update selects step 1 when it is ready. Dispose queued work
as well as workers when instructions unmount or the page is left. Do not steal
focus, selection, or editor scroll on an automatic result while it is focused.
The tracer's additive `visualizedLine` identifies the operation represented by
that snapshot, separately from the raw Python event's `line`. Ordinary pre-line
events highlight the previously executed line in that frame; call entry highlights
the call site that bound its arguments; resuming a caller highlights its call or
assignment. Return, exception, and error events identify their own source line.
Passive declaration bookkeeping is excluded from highlights. Initial states have
no marker, and final states retain the last represented operation or error.
The editor, status label, and printed source excerpt all use `visualizedLine`.
Ordinary status labels say `Line N`, or `Before first statement` when no operation
has run; special event labels retain their entry/return/error description. Keep
raw events, `line`, and `skipPlayback` unchanged so source metadata does not alter
recorded scopes, values, or filtering. Object IDs are diagram identities, not
memory addresses. Collection timing is not represented as a guarantee.
Bounded source, execution, output, and graph
limits report incomplete traces rather than silently presenting them as complete.

The diagram keeps individual name/reference slots beside their objects, without
scope panels. **Every visible data identity has one card, including strings,
numbers, Boolean values, and None.** Never inline primitive values at each use
or merge equal literals: both hide sharing. For `t = "draft"; row = [t]`, the
name and slot point to the same string card. Member reference buttons focus
the target card. Function/module objects and classes without displayed data
attributes remain omitted; Reference details retains the complete recorded state.

`js/object-reference-graph.js` loads its pinned local ELK 0.12.0 API and worker;
the ESM adapter isolates its API from Monaco’s AMD loader. No extra script tag
is needed in embeddings. Text-sized cards and fixed member
ports feed layered placement and orthogonal routing. Compare horizontal and
vertical layers with the external-channel planner; retain its synchronous path
for very narrow panes or optimizer failure. Shared targets may share stems, independent crossings
use bridges, and cycles keep their real direction. Never shrink diagram text to
fit. A scrollable diagram must remain keyboard accessible.
Arrowheads use fixed user-space dimensions with their tips exactly on the target
border; trim the painted shaft underneath the head to prevent endpoint blobs.
Keep card/edge clearance large enough for heads and crossing bridges. Smooth
bridges inherit the owning reference's stroke and selection/change state, with
background clearance around their arches. Name arrows use measured model ports
at rest so hidden print snapshots retain correct geometry, and displayed ports
during motion. Verify actual painted geometry in both themes, including selected
and changed references, not just the route's abstract endpoint coordinates.

The controller supplies the filtered playback steps through
`graph.setTimeline(steps)`. A `ReferenceTimeline` plans bounded windows of at most
24 steps, 32 identities, and 96 reference variants. It measures each identity's
largest future card and alias area, retaining distinct target/port-position
variants. Each preparation compares three ELK worker candidates: RIGHT with NETWORK_SIMPLEX,
RIGHT with balanced BRANDES_KOEPF, and DOWN with NETWORK_SIMPLEX. Also consider
synchronous channel layouts in neighbor and birth order. Render only the current
objects, names, values, and edges; future reservations never appear as content.

Prepare each candidate's states in forward order. Projection aligns card tops
across the reservation; `compactTimelineScene` can remove empty coordinate bands
when the space saving outweighs movement. Keep measured node intervals rigid,
protect 10px around route points, and cap vacant bands at 24px. Apply the same
ordered axis mapping to nodes and route points so ports, orthogonality, and
crossing order survive; never move an individual card independently of its route.
Compare projected and compacted frames using panel footprint plus a soft
surviving-card movement cost. Footprint is
`max(availableWidth, scene.width) * scene.height`, favoring shorter arrangements
that use the available width. Card tops, not alias-row origins, are motion anchors;
existing cards may move inside a window when layout improves. Score each routed
candidate's chosen frames for footprint, movement, visible crossings, and wire
length. References that never coexist must not count as a visible crossing.
These weights and bounded compaction are engineering adaptations, not a verbatim
implementation or performance guarantee from the research in the architecture note.

Preparation yields between measurements and scored states when its 4 ms work
slice is spent; one operation can exceed that scheduling budget. A timeline caches
plans for up to eight windows with three width/text-metric configurations each, and the
renderer retains up to 512 completed geometry scenes. Ordinary steps retrieve
prepared frames without rerunning ELK or compaction. Keep an empty initial state
immediately available while preparation runs. Replacing a trace or disposing its
owner invalidates pending work; obsolete results cannot commit. Changed text
metrics, width, invalidation, or cache eviction can require fresh preparation. An
over-budget state or measured union of port-position variants uses previous
positions for incremental placement, with new objects seeded near neighbors.
Correct ports and obstacle clearance take priority over continuity. While plans
remain cached and geometry/width are unchanged, content-only changes and
Back/Forward restore the same positions. See `docs/object-reference-layout.md` for
research evidence, scoring details, limits, fallback behavior, and the geometry
and latency verification contract.
The resizable native textarea scrolls independently and follows the execution
line without changing selection. `js/object-reference-code.js` owns the inert,
aria-hidden syntax mirror and line-number gutter; the textarea remains the only
editable/accessibility source. Native typing, selection, undo, IME, and Tab
navigation are preserved. Editing clears the old source marker while retaining
the desired playback position and the previous diagram, reference details, and
output. Status text explicitly identifies this as the previous run until the
replacement is ready; playback controls are disabled meanwhile. Pending code
must not print an older program’s states. Completion replaces the screen state
and print history together.

The graph rounds orthogonal bends and uses small arrowheads. Measure candidates
in an inert, invisible container; keep the old diagram mounted until the complete
replacement is ready. Reject stale layout results. Reuse unchanged cards and
paths, skip identical graph states (such as output-only steps), and do not fade
surviving objects. Position changes animate for 420 ms with attached arrow
endpoints. Track names by `(scope, name)` independently of their target object;
retain their label/path nodes across rebinding and animate pointer origins with
the names. Animate cards independently: identical start/end card coordinates
must not produce card motion. New elements can enter, while interrupted motion
continues from the actual displayed frame. Match route bends by normalized arc
length when connector shapes have different numbers of bends.

Reserve a stable annotation line for screen-only Added/Changed object badges.
Highlight changed data, new objects, and redirected/new name or member references
separately with a static glow; adding an alias must not mark its object as changed.
Compute cues against the previously requested step, not the last committed
diagram: rapid steps can reject intermediate layouts, while motion still starts
from the displayed frame. A same-step re-render (resize) keeps its cues.
Clear cues on an unchanged next state without changing geometry. Print omits these
transient comparison cues. Either the system or SEBook
reduced-motion preference requires still frames. Observe preference changes and
settle any active card/SVG transition immediately; a site override cannot enable
animation while the OS requests reduced motion. Static print uses immediate geometry. Test actual intermediate frames as well as rest.
Keep mirror/input font metrics identical; tokens may change color, not glyph
width. Forced-colors mode uses plain native input text and a gutter marker.
Syntax is a lexical aid (f-string interiors stay string-colored), not a parser.

Edits and playback are local to the mounted lab. They add no saved-progress
fields, storage keys, tests, or completion credit. Ordinary tutorial files,
assessments, and progress retain their existing behavior. The print view includes
syntax-highlighted code and the same object cards and routed arrows for each
visible playback state, with a text alternative. `js/object-reference-print.js`
owns printable history and prewarms static layouts for histories of at most 300
object snapshots. Static graphs share one `ReferenceTimeline` per history so a
window's measurement and layout work is reused across its snapshots. Larger
histories prepare when print is visible, avoiding a large hidden DOM for edited
programs.
An inert measuring container supplies real print text metrics even when the
history is hidden. A complete synchronous channel layout covers immediate native
Print while the compact layout is calculated. Programmatic autoprint awaits
`ObjectReferencePrint.prepareAll()`. Print graphs have no animation and release
their resize observers on history replacement/unmount.
Printable diagrams cap at 160mm to preserve readable type on A4/Letter. Test
actual PDFs, font/spacing changes, and print-media geometry, not screenshots alone.
The dedicated tutorial print page shows this history on screen as well as paper;
print always uses the light palette, including from a dark live session.

---

### 3.5 Compiler labs and reusable chapter embeds

`backend: compiler` uses the ordinary tutorial editors, file autosave, Reset,
Solution, hints, progress, and printable lesson files. It has no shell, debugger,
setup commands, or solution commands. Each Run creates a disposable Worker;
Stop or the four-second deadline terminates it. Run is independent of grading.
The interactive result remains in the main tutorial; output detaching is not
offered because the text-only output transport cannot retain the tree selector.
Instructions and grammar/source-file popouts remain available. The tokenizer
file uses the shared rules-table editor; its JSON model remains the autosave
and solution format, and it does not open in a raw-code popout.
Every tokenizer row has a leading native drag handle with an insertion marker.
Move up/down buttons remain the keyboard, touch, and assistive-technology
alternative. A drop moves all fields together through the existing file model;
cancellation does not modify it. Reordering announces the new position and
focuses the moved row's name. Preserve hidden settings and Reset/Solution sync.
The three file tabs display **Tokenizer rules**, **Grammar (EBNF)**, and
**Source**, keeping per-step persistence paths out of the editing controls.
The source also has a persistent labeled textarea bound to its file model, so
editing the grammar or tokenizer does not hide the source. Desktop compiler
layout places instructions above the work area, with source/rules left and syntax-tree
results right; splitter axes rotate with this layout. Smaller screens stack
the same controls in document order. Editing an input marks existing results as
out of date once; Run replaces the notice and the results together.

Each step may select its three files (defaults are the same root filenames):

```yaml
compiler_files:
  tokens: compilers/01/tokens.json
  grammar: compilers/01/grammar.ebnf
  source: compilers/01/source.txt
tests:
  - description: "An identifier retains its complete lexeme"
    compiler:
      source: "score42"
      tokens: [{type: NAME, value: score42}]
    hints: [{text: "Compare the first character with later characters."}]
```

The optional step field `compiler_focus: tokens` shows the token stream directly
and omits trees for a tokenizer lesson. By default, results show one syntax-tree
view, Previous/Next controls for distinct alternatives, and a secondary Tokens
disclosure. Do not ask beginning learners to distinguish representations or edit
projection policies; keep the activity on token boundaries and grammar grouping.

The JSON file contains `{tokenRules, ast?, startRule?}`; grammar/source are text.
Token rules are ordered `{name, pattern, skip?}` records. Patterns are Unicode
JavaScript regular-expression bodies without `/` delimiters. Longest complete
matching prefix wins (including inside alternation/lazy quantifiers); order
breaks ties. No zero-width tokens, anchors, lookaround, word boundaries, or
backreferences. Authors escape backslashes in the JSON file; learners enter
raw regex bodies in the table's Regex cells. The table provides token names,
skip flags, and add/remove/reorder controls. Supplied AST/start-rule settings stay
under the hood; table edits preserve them and other configuration metadata.

EBNF supports `name = sequence | alternative ;`, quoted token lexemes, named
tokens/nonterminals, grouping `()`, optional `[]`, repetition `{}`, empty
sequences, and `#`/`//` comments. All input must be consumed. Consuming direct
and indirect left recursion is supported, including the lecture's ambiguous
`expr = expr operator expr | IDENTIFIER | LITERAL_NUM`. Cycles that can recur
over the same span and nullable repetition are rejected because they permit
unbounded derivations. Alternatives enumerate all parses, not ordered choice.

AST policy is explicit: `discardTokens` removes punctuation; `inlineRules`
collapses a rule with one retained child; `foldRules: {sum: left, power: right}`
constructs `BinaryExpression` nodes from alternating operand/operator sequences.
The operator lexeme is `value`; ordered operands are `children`. Plain token
leaves keep their type/value. EBNF scaffolding is flattened in parse trees;
without projection, a grammar does not uniquely specify abstract syntax.

Each `tests[].compiler` accepts optional `source` (otherwise the source file),
`tokens` (complete ordered type/value pairs), `ast` (exactly one AST matching
the supplied type/value/children pattern), `asts` (complete unordered set of
patterns), or `error` (required diagnostic stage). `{}` checks full acceptance.
Omitted AST fields are unconstrained; source spans are ignored. A syntax-error
check cannot pass on invalid tokenizer/grammar configuration. Use one criterion
per check with normal graduated hints. A batch snapshots all three files;
edits, cancellation, or navigation cannot award credit to stale work.

`js/compiler-lab-core.js` exposes `CompilerLabCore.compile(config)` and CommonJS
`require`, with no DOM, tutorial, persistence, network, or source evaluation.
It returns `tokens`, all `parseTrees`, distinct `asts`, `astParseTreeIndices`,
first-tree aliases `parseTree`/`ast`, `ok`, `incomplete`, and `diagnostics`.
Limits include cumulative intermediate parser storage as well as work and final
forest size. They return `ok:false,incomplete:true` with empty tree arrays; never
describe an exhausted search as complete. Native regex execution needs the disposable
Worker watchdog in `js/compiler-lab-client.js`; core operation counts alone
cannot bound it. `js/compiler-tutorial-adapter.js` owns file/check adaptation;
`js/compiler-tutorial-editor.js` binds the rules table and persistent source
field to the existing file models and responds to Reset/Solution changes. `js/compiler-lab-view.js` owns
shared rule tables, connected record cards, Previous/Next tree controls,
alternative selectors, and complete structural text. `css/compiler-lab.css` owns both
themes, reflow, and light print presentation.

Outside tutorials, load the client and view scripts plus the compiler CSS
before `print-light.css`, then use `{% include compiler-lab.html
config=page.compiler_lab %}` or `CompilerLabView.mount(host, config)`.
The chapter playgrounds use `ast: 'auto'` and omit `startRule`, so replacing a
grammar starts from its first production without retaining old rule-name
dependencies. Auto mode compacts a complete recognized arithmetic tree; other
structures retain all named productions and token leaves. Explicit policies
remain supported and are still used by tutorial grading.
`CompilerLabView.render(host, result, {focus: 'tokens'})` renders an already
computed result in token-focused mode; omit the third argument for syntax trees.
Standalone mounts can set `config.focus` to the same value.
`CompilerLabView.markStale(host)` adds one update notice to existing results;
repeated edits do not produce repeated live announcements.
`CompilerLabView.createRulesEditor(host, settings, {onChange})` returns
`getValue()`, `setValue(settings)`, and `destroy()`; programmatic `setValue`
does not emit a change. Chapter tokenizer settings are initially collapsed.
JSON markers under `[data-compiler-lab]` auto-initialize; dynamic owners call
`destroyWithin` before replacement and `initFrom` afterward. Inline edits are
session-only. See `docs/compiler-lab.md` for limits, examples, and lecture mapping.

## 4. Architecture map

### 4.1 Layouts

Tutorial, instruction-popout, and print layouts load
`js/keyboard-shortcut-labels.js`. In instruction Markdown, use
`<kbd><abbr data-platform-modifier title="Control" data-no-tooltip="true">Ctrl</abbr>+Enter</kbd>`
for a platform-aware primary-modifier hint. The helper shows `⌘` with the
expansion `Command` on Apple platforms, including dynamically inserted steps;
other platforms retain `Ctrl`. This changes labels only, not key bindings.

- **`_layouts/tutorial.html`** (~700 lines) — the live, interactive layout.
  Wires `TutorialCode` (from `js/tutorial-code.js`), injects the parsed YAML
  config as JSON, sets up the navbar (Reset, Solution in instructor mode,
  Print, Read Aloud, Dark mode toggle), and instantiates the Monaco editor
  + chosen backend.
- **`_layouts/print-tutorial.html`** — the static, printable
  view. Renders every step's instructions, files (Rouge-highlighted),
  quizzes (with correct answers visibly marked), and solutions (hidden
  unless `?instructor-mode=true` is in the URL). The Print button on the
  live tutorial redirects to `<live-permalink>/print?autoprint=1` (preserving
  `?instructor-mode=true` if set).

**Assignment print and instructor views.**

Tutorial-level `print_starter_files: false` omits starter listings from the print
view while retaining the full instructions for every section. Default behavior
still prints each step's starter files. Use this for assignment briefs whose
sections share the same large project. Print views contain authored content,
not current editor drafts; a configured Download ZIP exports those drafts.
The interactive layout emits the instructor Solution control only if at least
one step defines `solution`. Homework 3 intentionally has no solution payload,
including in public checks or repository fixtures.

Both layouts load pinned Mermaid 11.16.0 followed by `js/mermaid-theme.js`.
Use `SebookMermaid.render(root)` after Markdown is in the DOM; do not initialize
Mermaid separately or override the shared palette. This helper returns a
Promise that settles after rendering. The print layout renders its static
fences on `DOMContentLoaded`, opens its instructional disclosures, and awaits
that Promise before `autoprint=1` opens the print dialog. Live prediction
reveals remain closed. Its existing `print-light-mode` policy also applies
to the diagrams.

The live, instructions-popout, and print layouts also load
`js/object-reference-graph.js`, `js/object-reference-code.js`,
`js/object-reference-print.js`, then
`js/object-reference-lab.js`, plus `css/object-reference-lab.css` for the inline
labs in §3.4. Load their stylesheet
before `css/print-light.css`. Dynamic instruction rendering calls
`ObjectReferenceLab.destroyWithin(root)` before replacing its content, then
`ObjectReferenceLab.initFrom(root)` after inserting the Markdown HTML. The
initializer returns a Promise and renders lookup/mount failures inside the
affected lab. Main step readiness and automatic printing await that Promise;
printing opens newly mounted explanation disclosures after initialization.
Tutorial destruction disposes active lab resources. Page hiding cancels a
pending run and pauses replay while retaining controls for browser history
restoration. In the instructions popout, navigation/progress snapshots refresh
the controls and test panel without replacing an unchanged step's HTML; this
preserves edits and replay position. A changed step index or instruction body
disposes the prior lab and initializes the new content.

For Mermaid instruction fences, a leading `%% caption: ...` line becomes a
visible figure caption and the image's accessible name. Add `accTitle:` and
`accDescr:` after the diagram directive to describe its structure and meaning;
the helper preserves Mermaid's description on the outer image role so assistive
technology can reach it. Keep a useful prose explanation next to the figure.
When a fence is inside a disclosure, write `<details markdown="1">` so the
print view's Kramdown parser processes its Markdown as well as the live view.
The image wrapper becomes keyboard focusable when it overflows horizontally;
a resize observer updates this after resizing, printing, or opening a reveal.
Its rendered SVG exposes the measured width through `--mermaid-intrinsic-width`
for the shared diagram stylesheet.

Tutorial presentation is stylesheet-owned:

- The live layout loads `css/tutorial.css`, `css/tutor-chat.css`,
  `css/uml-diagram.css`, and then `css/print-light.css` so print remains
  light even when the live tutorial is in dark mode.
- The print layout owns its static print presentation in
  `css/tutorial-print.css` and also loads `css/print-light.css`.
- Root popout windows share `css/tutorial-popouts.css`; generated UML/Python
  workspaces use `css/uml-python-workspace.css`.
- Do not put static `<style>` blocks or `style="..."` attributes in tutorial
  layouts, popout HTML, or tutorial Markdown. Use CSS classes for authored
  presentation and initial hidden states; JS may toggle classes or set only
  genuinely computed runtime values such as pane sizes, progress widths,
  pan/zoom transforms, or user-derived CSS custom properties.
- On screens at or below 900 CSS pixels wide, `css/tutorial.css` uses normal
  document flow: the navbar, instructions, quizzes, editor, and output remain
  reachable by scrolling the page. Instruction and quiz regions grow with
  their content; code and output retain usable minimum work areas. Preserve
  that reflow at high zoom and at 320 by 256 CSS pixels rather than trapping
  content below fixed-height chrome. Desktop panes and print keep their
  separate layout rules.
- Active file tabs reveal themselves by changing only their own tab strip's
  horizontal scroll. Avoid `scrollIntoView` here: it can move the document
  away from the lesson on initial load when the editor is below the fold.

### 4.2 Page-pair convention

Every real tutorial has two `.md` files in `SEBook/`:

```
SEBook/<section>/<slug>-tutorial.md                # layout: tutorial
SEBook/<section>/<slug>-tutorial/print.md          # layout: print-tutorial
```

Both reference the same `tutorial: <key>` front matter. `<key>` is the
filename of `_data/tutorials/<key>.yml` (without `.yml`). The directory
form for `print.md` is required so the print view sits at a clean URL
(`.../foo-tutorial/print`).

### 4.3 The `/SEBook/tutorials` auto-index

Source: `SEBook/tutorials.md` (`permalink: /SEBook/tutorials`,
`layout: sebook`). The page iterates `site.data.tutorials`, joins each
entry to a page in `site.html_pages` with matching `tutorial:` and
`layout: tutorial`, drops anything where the YAML has
`exclude_from_index: true`, sorts alphabetically by title, and renders a
card grid. **No manual list to maintain.** New tutorial → new YAML + new
page-pair → automatic listing.

### 4.4 Popout and generated-workspace windows

Six standalone `.html` files at the repo root, each a separate window that
synchronizes with the main tutorial via `BroadcastChannel` (see
`js/tutorial-popout-client.js` and `js/tutorial-popout-manager.js`):

- `tutorial-instructions-popup.html` — step instructions + quiz.
  Optional quizzes carry `allowSkip` in `quiz-show`; `quiz-skipped` requests
  navigation from the main runtime without recording a passed quiz. The main
  runtime accepts skip requests only for the current step when
  `require_quiz: false`. The final optional check offers Finish Review;
  `quiz-review-finished` mirrors the acknowledgment to the popout without
  claiming all tests or knowledge checks passed. Instructions snapshots and
  navigation messages include `hasUnpassedQuiz` so the final step's Next
  control can still open its knowledge check in the popout.
- `tutorial-output-popup.html` — stdout / stderr / preview iframe. Prolog's
  Run output remains detachable; its separate Terminal view and query
  history stay usable in the main tutorial. The main Output mode then shows
  a detached-output notice and a Reattach Output control.
- `tutorial-debugger-popup.html` — shared debugger UI for enabled backends.
- `tutorial-pane-popup.html` — single editor pane (test or code file).
- `tutorial-tab-popup.html` — single code file in Monaco.
- `tutorial-graph-popup.html` — Git commit graph (SVG).

Popouts and the print layout have their own `<head>`, so each includes
`_includes/ai-training-opt-out-meta.html` (the site-wide AI training opt-out)
right after its `<title>`. A new popout must include it too;
`tests/ai-training-opt-out.spec.js` fails for any built page without it.

The tab and pane editor popouts share `js/popout/shared-editor.js`. Both can
receive more than one initial snapshot before Monaco finishes loading. Their
bootstrap starts the editor only once: the tab uses the newest pending file
snapshot, while the pane queues snapshot application until its one editor is
ready. Keep that guard when changing snapshot or Monaco-loading behavior so
duplicate editors and stale initial content do not appear.

The graph popout keeps its scroll region inert and out of the accessibility
tree while the disconnected overlay is present. A graph snapshot or update
reveals a named, keyboard-focusable region and hides the overlay; keep those
state changes together when changing the popout's message handling.

Each popout listens for state-snapshot, state-update, and step-change
messages on the BroadcastChannel and re-renders accordingly.

React preview iframes in both the main tutorial and
`tutorial-output-popup.html` deliberately omit the sandbox
`allow-same-origin` token. Their `srcdoc` therefore has an opaque origin and
learner code cannot read or mutate the tutorial page's DOM or browser storage.
Keep preview refresh and hot reload on the existing `postMessage` boundary;
do not restore direct parent access to iframe globals or documents.
Repository-authored assertion commands and results are the exception to that
public transport: `js/react-assertion-broker.js` creates a private
`MessageChannel` before learner scripts execute. The host accepts only the
first transferred port from a freshly-created preview `WindowProxy`, and every
preview rebuild replaces the iframe element so an older learner realm cannot
race the next handshake. The same channel carries Playwright-compat commands;
the assertion broker captures the agent's temporary command function before
learner code runs and deletes the global hook. Preview reset callbacks return
the replacement frame and port so `js/playwright-compat/runner.js` can adopt
both before constructing its next broker. Learner-authored Playwright spec
source is evaluated only in a fresh, dedicated worker created from a `data:` URL,
which the HTML Standard assigns a unique opaque origin. The host fetches the
repository-owned runner source, transfers a private `MessagePort` before any
learner code executes, and uses a host-thread watchdog to terminate the worker
when synchronous spec loading or a test callback exceeds its configured bound.
Reset requests, preview commands, and results use only that capability port;
success, failure, bootstrap errors, and watchdog expiry all close the port and
terminate the worker. Keep the `data:`-URL origin boundary: a same-origin worker
would regain access to origin-scoped storage such as IndexedDB. Never move
assertion commands, request ids, or results back onto public worker/window
messages; learner code can observe and forge public message traffic.
Each Playwright-compat test owns a disposable preview broker. A per-test timeout
settles the result but cannot synchronously cancel arbitrary learner promises,
so disposing that broker must make every later command from the losing chain
reject before it posts to the shared session port. Keep this boundary when
adding Playwright-shaped APIs; otherwise a delayed action from a timed-out test
can mutate the freshly reset preview used by the next test.

`uml-python-workspace.html` is a separate generated-code workspace opened by
the UML editor's "Generate Python" action. It receives a one-shot
`postMessage` payload (`archuml-generated-python`) from the UML editor, then
boots the standard `TutorialCode` runtime with the `pyodide` backend,
Monaco, linter, live UML inference (`uml_diagram: true` in the right
Output/UML tab panel), and time-travel debugger enabled around the generated
`archuml_generated.py` file. It does not use URL payloads or add persistent
storage; it uses a short-lived `sessionStorage` key
(`archuml-generated-python-payload`) only to bridge the one-time
cross-origin-isolation reload. The editor also seeds, and the workspace may
mirror, the same temporary payload in `window.name` so the popup can boot when
COOP detaches the opener during that transition, then removes both copies as
soon as the workspace starts. Any
detached panes it opens reuse the normal `ttsync-<path>` tutorial popout
channel.

### 4.5 JavaScript runtime

- **Compiler lab modules** — `compiler-lab-core.js` is the independent regex,
  EBNF, and AST engine. `compiler-lab-worker.js` and `compiler-lab-client.js`
  isolate and bound each request. `compiler-tutorial-adapter.js` snapshots the
  three editor files and assesses declarative checks. `compiler-tutorial-editor.js`
  binds the rules table and persistent source field to those file models. `compiler-lab-view.js`
  renders tokens and every distinct tree for both tutorial and chapter hosts.
  Compiler print views parse the authored tokenizer JSON with the
  `compiler_settings` Liquid filter and render `compiler-rules-static.html` as
  a read-only token table, for both starter and solution files. The
  `compiler-file-label.html` include gives those files the same human-readable
  names as the editor tabs, without exposing JSON paths or projection settings.
  The chapter fallback uses the same table, so regexes and token order
  come from the original settings instead of a second authored copy.
  The tutorial runtime owns controls, draft persistence, and progression;
  these modules do not duplicate those responsibilities. See §3.5.

- **`js/tutorial-code.js`** — the unified tutorial runtime. Editor
  management, file I/O, test execution, autosave / restore, step
  progression, quiz gating, debugger sync. Where most behavioral changes go.
  For mixed-backend tutorials, the runtime resolves the active backend as
  `step.backend || backend || "v86"`, initializes each supported backend
  lazily, and runs supported `setup_commands_by_backend[backend]` entries
  when that backend boots. Later eligible backends may prewarm in the
  background. When a tutorial mixes multiple worker backends, such as `cpp`
  and `pyodide`, changing language terminates the previous worker, invalidates
  its readiness, initializes the requested worker, and restores the host's
  mirrored source files. The other worker backend is not prewarmed: replacing
  an active interpreter in the background would lose state and increase memory
  pressure. Compiler files and ordinary Python setup must therefore be
  reconstructible when revisiting a language. The active
  backend is switched before step file sync, Run, Test My Work, Reset, and
  Solution application. Mixed runtime UI keeps both the output panel and React
  preview panel in the DOM, toggling the inactive one with `hidden` so it is
  not exposed to assistive tech. Existing single-backend tutorials keep using
  top-level `setup_commands`.
  Backend initialization and restart promises are cached only while pending;
  successful, failed, invalidated, and superseded transactions must all release
  their cache entries. Background prewarming passes immutable loading-display
  options into its own initializer instead of mutating a shared suppression
  flag, so overlapping foreground initialization always retains its loading
  state. Fatal worker events carry the failed backend identity. If that backend
  is visible, the runtime reconstructs it immediately; if it is parked behind
  another mixed-backend step, the runtime invalidates it and rebuilds it lazily
  when the learner returns. Never infer the failed worker from the currently
  visible panel.
  WebContainer boot and shell-command handshakes are bounded. Module, boot, or
  workspace-initialization failure tears down any partial or late runtime before
  selecting the browser fallback. Authored WebContainer setup failures do not
  fall back because doing so would silently skip required tutorial state.
  Global setup, first-visit step setup, background shell work, and `step_dir`
  validation share one serialized command queue; each call awaits process exit
  and output drain, rejects on timeout or nonzero status, and leaves the queue
  usable after failure. Do not reintroduce fire-and-forget terminal writes or
  fixed delays for lifecycle commands.
  WebContainer Node entry files are normalized within the tutorial workspace
  and passed to `node` relative to the active `/tutorial` working directory
  (including a validated `step_dir`). Reject paths that escape that workspace;
  WebContainer's mounted filesystem does not reliably resolve host-style
  absolute `/tutorial/...` entry arguments. Prefix root-level filenames that
  begin with `-` so Node cannot interpret learner file names as CLI options.
  Live UML rendering depends on `UMLShared.applySvgAccessibility` from the
  ArchUML bundle. The hook must put `role="img"`, a usable accessible name,
  and an SVG `<title>` on each rendered SVG; `js/uml-auto-describe.js` wraps it
  to replace both the fallback name and title with a model-specific description.
  Step navigation is one serialized transaction with a single coalesced
  pending destination: the first idle `loadStep()` still updates its UI
  synchronously, rapid later requests discard intermediate destinations, and
  only the latest request may commit visited/hash/autosave/timer state.
  `start()` returns the initial lifecycle promise: it must not resolve until
  the selected step (including any saved-progress restoration), prompt, and
  loading state are ready. Callers may safely perform initial UML or other
  derived-view refreshes in `start().then(...)`; do not detach the `loadStep()`
  or restore chain from that promise. Initialization and restoration failures
  render the runtime's visible error state and reject this promise; layout
  entry points that intentionally start in place must catch that rejection
  after letting the runtime own its user-facing error message.
  Run is likewise one atomic transaction acquired before backend initialization or
  file sync; the inline `test_file` action, Run button, popout, and
  Ctrl/Cmd+Enter requests share that guard and both execution buttons remain
  disabled until the identity-matched transaction settles. Every backend must
  settle it on success, failure, Stop, or timeout.
  React hot reload sends source and style patches into the opaque-origin
  preview with `postMessage`; the parent runtime must not inspect frame globals
  such as `Babel`. The preview announces its generation as ready only after its
  ordered Babel script end-marker and initial React render have settled; until
  then the parent retains only the latest source/style patch for that generation.
  Repository-authored React `tests[].command` checks execute inside that preview
  through the private capability port installed by
  `js/react-assertion-broker.js`. The broker receives only a restricted `frame` facade
  (`contentDocument` and `contentWindow` for the preview itself), stripped
  learner `code`, an `assert` helper, and the learner `files` map. Never pass
  parent DOM nodes, storage, or other host-page capabilities through it. Keep
  the broker script before Babel and every learner-authored script in the
  generated `srcdoc`; its closed-over port is the trust boundary that keeps
  commands and results invisible to learner `message` listeners while still
  allowing interactive assertions to click and inspect the live React DOM.
  Timed practice is opt-in per step with `max-time` (minutes) and optional
  `lockout-time` (minutes, default 60). The countdown remains visible in the
  step nav while the step or quiz is active; at one minute or less it uses a
  heartbeat animation unless the site/OS reduced-motion preference is active.
  Active timed steps include a learner control to add five minutes while the
  countdown remains visible. If a step reaches its lockout screen, that step
  stays locked until the cooldown ends; students may still revisit earlier
  unlocked steps while waiting.
  The runtime stores deadlines and lockout windows in
  `localStorage["tutorial-time-practice-<id>"]` so refreshing the page does
  not reset an attempt. Older stored `timerDisabled` entries are ignored and
  removed on the next load so stale state cannot hide the countdown. When time
  expires, only that step is locked until the lockout ends.
  `applySolution()` returns a Promise; tests and runtime code that reveal
  solutions must await it before running step tests or advancing state, and it
  must wait for any active first-visit `setup_commands` chain before it mutates
  files or runs solution commands. In v86, it also uses a no-op shell prompt
  barrier before applying the solution; keep that barrier when editing this
  path so setup input cannot race with solution input. Setup and visible
  solution batches may contain multi-command Git workflows, so keep their
  timeouts long enough for the shell prompt to return instead of resolving
  against a partially applied repository state. Dynamic Bootstrap tooltips in
  this runtime intentionally wait 1 second before showing on pointer hover to
  keep dense tutorial chrome from flashing incidental boxes during cursor
  travel; keyboard focus still shows them immediately because focus is
  deliberate navigation. When keyboard focus leaves a tooltip trigger, hide
  its tooltip immediately without a fade so it cannot cover the next focused
  control. Preserve the hover grace period when the pointer is travelling
  from a trigger into its tooltip, and keep Escape dismissal available.
  `js/monaco-focus-exit.js` supplies the Escape-to-leave-editor behavior
  promised by the Monaco accessibility labels in both the main tutorial and
  code popouts. Monaco's suggestion, find, rename, parameter-hint, and snippet
  interfaces handle Escape first; otherwise focus moves to the next page
  control. Code popouts place a Close window button after the editor so that
  focus has a visible destination there.
  Monaco default syntax languages and accessible language labels share the
  `BACKEND_EDITOR_LANGUAGES` mapping in `js/tutorial-code.js`; keep both values
  together when adding a backend so SQL and other editors announce the right language.
  C++, Pyodide, SQL, Prolog, and Java worker messages are bounded RPCs: every
  callback is released by a response, timeout, termination, or `destroy()`.
  Global and per-step setup reject readiness when their command exits nonzero,
  and worker file sync resolves only after the worker acknowledges the write;
  callers must propagate those rejections instead of presenting a half-ready
  step or a false saved state. The output-panel Stop action terminates a wedged
  worker, reruns global setup, restores all Monaco files, reruns the active
  step setup, and only then re-enables Run (returning focus there when Stop was
  keyboard-activated). Execution timeouts use the same restart path, so an
  infinite learner program does not require a page reload.
  C++ and Python initialization belongs to its specific worker: cancelling
  that worker immediately settles its boot promise and clears the boot timer.
  Late events and superseded restart stages cannot change the newly selected
  language, replay files into it, or leave its Run control disabled.
  Browser-backend learner code runs in a fresh opaque-origin `data:` Worker,
  with repository-owned Node/module/fs/argv/server mocks. Host HTTP-client
  requests are routed to that Worker while a server step remains active. Every
  normal, stopped, failed, or timed-out completion terminates the exact Worker
  and clears callback/timer references before notifying callers. Keep the
  host-owned deadline: Worker termination is what prevents a synchronous
  learner infinite loop from freezing the tutorial page.
- **`js/tutorial-hero-celebration.js`** — shared test-pass celebration used
  by every `TutorialCode` backend and the `uml-editor` backend. After a
  visible gate-style test run passes all tests, it clones the saved SE Gym
  hero from the layout's `#quiz-avatar-tpl`, applies the user's
  `localStorage['se-gym-hero-avatar']` customization via `HeroAvatar`, shows
  the short "You aced this, keep going!" speech bubble in the test panel, and
  fires the site-wide confetti. The helper returns without rendering when no
  saved hero exists or reduced motion is active; keep new backends calling
  this shared helper after their common all-pass renderer instead of adding
  backend-specific celebration code.
- **`js/tutorial-quiz.js`** — shared quiz renderer (used by main page and
  the instructions popup). `single` / `multiple` / `parsons` types,
  `min_score` gating, `option_feedback` rendering.
  Optional checks use `allowSkip` and `onSkip`; `onPass` remains reserved for
  passing results. Skip is available while answering and returns on Try Again;
  results replace it with Continue/Finish Review so a passing score cannot be
  discarded through the skip action. Main and popout use the same engine so feedback, skip,
  low-score continuation, and keyboard focus behave consistently. Tutorial quiz answer
  options expose scoped shortcuts: visible option labels (`A`, `B`, `C`, …)
  and number keys (`1`, `2`, `3`, … through `9`) select/toggle the matching
  currently visible answer while the quiz has focus. For multiple-answer
  questions, `Enter` submits once at least one answer is selected and the
  Submit Answer button is enabled. Visible hints label that key as `Return`
  on Apple platforms. After question feedback appears, focus moves to the
  next-question button so `Enter` / `Return` activates the native button. On
  quiz results, focus moves to the active result action (`Continue` or
  `Try Again`) so the same native key activation works there. The shortcut
  hint appears at the bottom of active non-Parsons quiz questions and hides
  after the question is answered. Parsons questions number their shuffled
  lines; number keys move matching lines, `Space` moves the focused line, and
  `Enter` / `Return` checks the order before focus moves to the next-question
  button.
- **`js/tutorial-popout-manager.js`** / **`js/tutorial-popout-client.js`** —
  popout lifecycle and IPC.
- **`js/object-reference-lab.js`** — reusable inline Python lab controller.
  `initFrom(root)` mounts named or inline-JSON examples; `destroyWithin(root)`
  stops workers/playback and releases views before instruction replacement.
  `js/object-reference-graph.js` owns graph layout, rendering, and textual state
  descriptions. Its `ReferenceTimeline` reserves future geometry in bounded
  playback windows; the controller supplies the filtered trace with
  `graph.setTimeline(steps)`, and print graphs share a timeline per history.
  `js/object-reference-code.js` owns the unified native editor and
  shared Python syntax presentation. `js/object-reference-print.js` reuses those
  graph and syntax renderers for static
  printable history and releases its resources with the lab.
  `js/object-reference-worker.js` runs the bounded
  `js/object-reference-tracer.py` with the locally pinned Pyodide runtime in a
  worker separate from the tutorial backend. Worker lifetime and cancellation
  belong to the individual lab, not to the tutorial's main debugger.
- **`js/tutorial-refactorings.js`** — Monaco refactoring helpers
  (rename, extract, inline) used by the refactoring tutorials.
- **`js/debugger/*.js`** — time-travel debugger: `sync.js`,
  `ui-render.js`, `editor-attach.js`, `main.js`, `worker-extension.js`.
  Browser-backend Stop is a hard cancellation: `browser-channel.js`
  terminates the dedicated learner-runtime worker immediately, settles the
  controller on the next microtask, and generation-guards that completion so
  it cannot close a newer debug session. The next run always creates a fresh
  worker. Keep that host-owned termination path; a cooperative message cannot
  interrupt learner code that is stuck in a synchronous infinite loop.
  Breakpoint gutter clicks use `editor-attach.js`'s shared hitbox helper,
  which centers the pointer target on the visible Monaco breakpoint dot and
  is reused by the main editor and popout editors. Empty breakpoint hitboxes
  also paint the shared hover-preview glyph so students can discover where
  breakpoints can be added; keep that math aligned with the glyph-offset CSS
  variables in `js/debugger/debugger.css`. If a debugger tutorial loads in a
  webview without cross-origin isolation / `SharedArrayBuffer`, `main.js`
  still renders a fallback Debug tab and toolbar Debug button with reload /
  full-browser guidance so the debugger affordance is discoverable instead of
  silently disappearing.
- **`js/tutorial-uml-editor.js`** — lightweight backend for UML-modeling
  tutorials (`backend: uml-editor`). It reuses the standard tutorial
  instruction chrome on the left and `_includes/uml-editor.html` as the
  right-side workspace editor. Step `tests[].assertions` inspect the current
  ArchUML source for elements, members, relations, transitions, and messages.
  The step footer exposes a confirmed "Remove All Elements" action that
  replaces the current step's active diagram draft with an empty ArchUML
  document; it does not clear drafts saved for other diagram types.
- **`_includes/uml-editor.html`** also owns UML editor export actions. The
  "Generate Python" toolbar action reads the saved class-diagram and
  sequence-diagram ArchUML drafts for the editor instance, generates a
  Python module with classes, attributes, operations, and sequence-derived
  method bodies, opens `uml-python-workspace.html`, and hands the generated
  code to that Pyodide tutorial workspace with `postMessage`. Sequence
  features that do not map cleanly to Python (guards, loops, `par`,
  `critical`, `ref`, `neg`, found/lost messages, activation markers, notes,
  create/destroy) are preserved as helper calls or structured comments
  instead of being dropped.
- **Backend runtime adapters** — `js/pyodide-worker.js` (Python),
  `js/cpp-worker.js` (C++17 module worker using pinned local YoWASP Clang
  and the browser WASI shim), `js/sql-worker.js`, `js/java-worker.js`, `js/prolog-worker.js`,
  `haskell-runtime-frame.html` + `js/haskell-worker.js` (a sandboxed Haskell
  frame through `js/vendor/microhs/mhs-embed.js`, the local, pinned MicroHs
  WebAssembly runtime),
  `js/playwright-compat/runner.js` (in-browser Playwright for React; host-side
  preview proxy plus an opaque-origin, terminable learner-spec worker),
  `js/pyodide-git.js` / `js/pyodide-unix.js` (POSIX mocks).

Third-party code that executes in the tutorial page or a same-origin worker is
fail-closed. Page and preview scripts use exact versions plus Subresource
Integrity; dynamic cross-origin loads are accepted only when their URL has an
entry in `CDN_INTEGRITY`. Monaco 0.44.0 is served as the complete reviewed
`min/vs` tree under `js/vendor/monaco-editor/0.44.0/`, because its AMD loader
fetches modules, workers, CSS, translations, and its font transitively.
Pyodide 0.27.0 loads the reviewed core under
  `js/vendor/pyodide/0.27.0/`; both Python workers must import that local
`pyodide.js` and pass the same directory as `indexURL` so the Wasm, stdlib,
lock file, and glue script stay same-origin. That directory also owns the
lockfile-complete `pytest` and `hypothesis` wheels required by current
tutorial setup plus the exact `pyflakes` linter wheel. A new tutorial-level
`loadPackage()` dependency requires vendoring its entire lockfile closure;
otherwise the local index correctly fails instead of executing a mutable
remote package. Classic workers, whose `importScripts()`
API has no native SRI parameter, must load any remaining remote scripts through
`js/vendor/worker-script-integrity.js`; that adapter verifies pinned SHA-256
bytes before evaluating them, and SQL also supplies a verified Wasm binary.
Prolog loads the unchanged Tau Prolog 0.3.4 core and lists module from
`js/vendor/tau-prolog/0.3.4/`, with its upstream license and `SHA256SUMS`.
Its startup does not request a CDN. Verify that snapshot and the worker's real
language behavior with `node --test scripts/tests/prolog-worker.test.js`.
C++ loads YoWASP Clang `22.0.0-git20542-10` from
`js/vendor/yowasp-clang/22.0.0-git20542-10/` and the WASI execution shim from
`js/vendor/browser-wasi-shim/0.4.2/`. Both are local pinned snapshots with
licenses and `SHA256SUMS`; the compiler snapshot includes Clang/LLVM/LLD and
the WASI C/C++ headers and libraries. `scripts/vendor_cpp_runtime.py` records
the upstream archive integrities and reproduces the local gzip-resource loader
adaptation; compiler binaries are unchanged. The cold compiler download is
approximately 26 MB compressed. Student source is compiled locally, never sent
to a remote compilation service. YoWASP's upstream repository is archived;
future dependency changes require an explicit vendor review, not an assumption
of continuing upstream releases.
Never add a direct remote `importScripts()` call or a floating CDN version.
The root `coi-serviceworker.js` adds COOP/COEP to explicitly marked isolated
document navigations and adds COEP to same-origin dedicated/shared worker main
scripts. Keep both response paths: cross-origin isolation is recursive, so an
isolated document cannot start a worker whose own response omits COEP.

WebContainer has a separate, explicit trust boundary: the repository owns a
reviewed single-file `@webcontainer/api` wrapper under
`js/vendor/webcontainer/`, but that wrapper connects to StackBlitz's
cross-origin, versioned headless runtime and sends the WebContainer workspace
to it. The remote frame cannot execute in the tutorial page's origin, but it is
still a third-party processor of tutorial files; do not describe this backend
as fully local or fully vendored.

When updating a dependency, replace its whole versioned snapshot or refresh
its digest, verify the vendor `SHA256SUMS`, and run
`scripts/tests/runtime-supply-chain.test.js` plus the affected real-backend
tutorial tests.

The v86 engine and BIOS are repository-owned artifacts verified by
`vm/setup.sh`. VM regeneration takes its Alpine image digest, exact top-level
APK versions, TinyCC commit, and artifact hashes from `vm/build-inputs.env`;
do not restore `latest`, branch-head clones, mutable image tags, or `master`
URLs. The complete installed Alpine runtime closure must match
`vm/apk-runtime.lock`; refresh that lock only in a reviewed VM dependency
update. Repositories and generated file metadata remain live inputs, so the
rootfs is not claimed to be byte-for-byte reproducible.

The guest `/init` remains PID 1 and supervises an interactive login shell.
Each shell starts with `setsid -c` on `/dev/ttyS0`, giving Bash its own session
and controlling terminal so Ctrl+C interrupts its foreground job. Ctrl+D on
an empty input line ends input for commands such as `cat`; it is not a general
interrupt. Keep this behavior after shell restarts and in published snapshots.
`scripts/tests/v86-shell-control.test.js` checks both startup paths, interruption,
end-of-input, and file preservation before and after a shell restart.
Exiting that shell, including through `set -e` enabled by sourcing a learner's
script, starts a fresh shell without discarding the guest filesystem or
panicking the kernel. Shell-local learner variables and options reset normally.
`tutorial-code.js` installs its environment/history settings, command-recording
hook, current listener, Git prompt hook, and authored `step_dir` in ordered
`/etc/profile.d/tutorial-*.sh` files, which Alpine reloads for each login shell.
Each update atomically replaces one file and sources it in the current shell;
initial setup, clock synchronization, terminal sizing, and learner commands are
not replayed on shell restart. Persist only runtime-owned shell initialization
there; tutorial setup commands may have destructive or non-idempotent effects.
The Git prompt hook starts its asynchronous FIFO notifier inside a subshell,
keeping it out of the learner shell's job table. Redirecting notifier output
alone does not suppress Bash's job-completion notices. Preserve normal job
control and Ctrl+C; Git refreshes must not print notices, change command
history, or inject serial commands while the learner types or recalls input.
Prompt-triggered refreshes request fresh Git state over RPC if a pushed update
was missed; cached rendering alone is not a recovery mechanism. RPC returns the
state directly, avoiding a shared-file race. Opening the graph requests fresh
state immediately; pushed updates cancel redundant prompt refreshes. Commands
finishing during a refresh schedule one follow-up instead of being dropped.
Transport failures preserve the
last valid graph; a successful empty response clears it for a missing repository.
This image upgrade also invalidates older initial/step VM reset caches through
`V86_SNAPSHOT_CACHE_VERSION`, including cold-boot caches without an asset
validator, so restoring a cache cannot bring back the old PID 1 learner shell.
Saved learner source and tutorial progress remain in their existing stores.

The v86 VM includes `mandoc` and version-matched manuals for coreutils, Bash,
grep, sed, gawk (`man awk` also works), findutils, diffutils, Git, and Make.
`man [` uses the coreutils `test` manual, which documents bracket syntax.
Git includes its command, configuration, and guide pages, so both
`man git-commit` and `git help gitignore` work. Section selectors such as
`man 1 date` and `man 5 gitignore` are supported. The
`/usr/local/bin/man` launcher delegates to `/usr/bin/man -c -T ascii`, printing
into terminal scrollback or a pipe. ASCII output keeps punctuation readable
through the VM serial display, which handles bytes individually; default
UTF-8 output would show broken bullets in pages such as `git status --help`.
The VM shell has no controlling terminal, so
mandoc's normal pager setup would stop its process group before displaying a
page. Keep this launcher when rebuilding the VM; changing `PAGER` alone does
not bypass that job-control setup.
Upstream pages stay compressed; unused Info manuals and Bash HTML/ancillary
documentation are removed. Shell-only commands (`cd`, `set`, `export`, `local`,
`return`, `exit`, `source`, `read`, `shift`, `break`, `continue`, `help`, `type`) have
small preformatted `cat1/<command>.0` pages generated from the installed Bash
`help -m` during the build. They are compressed by the initrd archive rather
than individually because mandoc does not discover gzipped cat pages without
an index. For commands shared with coreutils, such as `echo`, `help echo`
describes the Bash implementation while `man echo` describes GNU coreutils.
This remains a curated command collection, not all Linux manuals; in
particular, do not install GCC documentation for the VM TinyCC wrapper.
After staging the external `bzImage`, the build removes the redundant guest
`/boot` kernel, initramfs, map, and config. These are not used by v86 direct
kernel boot and can otherwise fill the guest RAM disk during extraction,
silently omitting later command binaries. Snapshot generation rejects the
kernel's `Initramfs unpacking failed:` diagnostic even if a shell appears.

`vm/build-rootfs.sh` stages and validates both boot artifacts before replacing
the published pair. A successful rebuild deliberately deletes the old v86
save-state and its manifests because a snapshot embeds the kernel, initrd,
emulator/BIOS bytes, and memory configuration. After serving the rebuilt
files, run `make vm-snapshot`: `vm/build-snapshot.js` publishes
`state.bin.gz` atomically, writes `vm/dist/SNAPSHOT_INPUTS` with every
compatibility hash/configuration value, and writes `vm/dist/SHA256SUMS` for the
release artifacts. Never restore or commit only part of that set;
`scripts/tests/runtime-supply-chain.test.js` rejects package, kernel/module,
snapshot-input, or checksum drift.

### 4.6 Backends — what each supports

| Feature                | v86 | cpp | pyodide | webcontainer | browser | react | prolog | haskell | uml-editor | compiler |
|------------------------|-----|-----|---------|--------------|---------|-------|--------|---------|------------|----------|
| Shell terminal         | ✅  | ❌  | ❌      | ✅           | ❌      | ❌    | ❌     | ❌      | ❌         | ❌ |
| Compiled languages     | C   | C++17 | ❌    | (npm only)   | ❌      | ❌    | ❌     | ✅      | ❌         | ❌ |
| `git`                  | ✅  | ❌  | mocked  | ✅           | ❌      | ❌    | ❌     | ❌      | ❌         | ❌ |
| Debugger / recorded history | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Live preview iframe    | ❌  | ❌  | ❌      | ✅           | ❌      | ✅    | ❌     | ❌      | ❌         | ❌ |
| Playwright tests       | ❌  | ❌  | ❌      | ❌           | ❌      | ✅    | ❌     | ❌      | ❌         | ❌ |
| UML assertion tests    | ❌  | ❌  | ❌      | ❌           | ❌      | ❌    | ❌     | ❌      | ✅         | ❌ |
| `pytest`               | ❌  | ❌  | ✅      | ❌           | ❌      | ❌    | ❌     | ❌      | ❌         | ❌ |
| Linter                 | ✅  | ❌  | ✅      | ✅           | ✅      | ✅    | ❌     | ❌      | ❌         | ❌ |
| Regex / EBNF / AST checks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Mixed-backend tutorials support `v86`, `cpp`, `pyodide`, `react`, `webcontainer`,
and `browser`. They are for author-controlled backend switches between steps,
not for debugger flows or terminal-first Node labs.

`cpp` compiles a C++17 translation unit and runs its `main` function on every
Run; it does not reuse a binary from a previous successful compile. Current
workspace files are synced beneath `/tutorial`, which is also the include
root. Author a named `run_file`, normally `main.cpp`, and `language: cpp` for
the editor. Compilation uses the pinned local YoWASP Clang module worker;
the resulting WebAssembly executes in a fresh WASI program instance. Every
request starts with a fresh compiler filesystem assembled from the in-memory
source mirror, so a compile failure cannot execute an old program.

This backend uses the output panel, with compiler diagnostics and program
output, rather than a shell terminal. It requires no VM, `SharedArrayBuffer`,
or cross-origin isolation. There is no interactive stdin control, shell
command interface, or promise of arbitrary operating-system libraries. The
pinned WASI C++ library does not support exception handling, so compilation
uses `-fno-exceptions`; do not author `throw`, `try`, or `catch` exercises for
this backend. Classes, references, strings, streams, and local headers are
available. Use starter files and `solution.files`; `setup_commands`,
per-backend setup commands for `cpp`, and `solution.commands` are unsupported.
Compilation and execution share a 30-second host deadline for each Run or
automatic check.
Output is capped at 256 KiB per request, and the generated student program's
WebAssembly memory is capped at 128 MiB; the compiler itself has separate
memory requirements. Stop and deadline expiry terminate the worker; restart
restores the current editor files before Run becomes available again. This
compiler workspace adds no persistence beyond ordinary tutorial autosave.

The CS131 refresher alternates `cpp` and `pyodide` workers lazily, preserving
edited source in the host while replacing the active language worker. Its
Point exercise checks actual resulting coordinates; explanations still need
manual review. Other C++ exploration steps can run their programs and compare
the observed behavior with the lesson's manual review prompts. A successful
Run proves that one program executed, not that every exercise requirement was
verified; keep automatic `tests:` separate from that exploratory feedback.

A mixed tutorial that declares a `v86` step renders the terminal as a third
`.tvm-runtime-panel`, keyed off `TutorialCode._mixedNeedsTerminal`. That flag
also pulls xterm into `_loadDependencies` and starts the terminal in
`start()`; the panel is re-`fit()` each time it becomes visible, because xterm
measures a hidden container as zero columns. See §3.1 for the authoring
consequences (per-backend setup commands, no Run button, no v86 prewarm).

`prolog` is a single-backend worker mode. Run consults the step's `run_file`
(falling back to the active editor file) as source text in a fresh session,
then executes that step's `default_query`. It never reads the separate
Terminal prompt or command history. An absent or empty `default_query`
loads the program without submitting a goal. Prolog `files[].path`, `solution.files[].path`,
`open_file`, and `run_file` accept either workspace-relative paths (`main.pl`)
or absolute paths below `/tutorial/` (`/tutorial/main.pl`). The constructor
normalizes these to one relative editor identity without mutating the supplied
configuration. The two spellings may be mixed across references to the same
file; paths escaping `/tutorial/` are rejected. This keeps Run, tests, and
solution application from looking up different editor models or writing
`/tutorial//tutorial/...` paths. A bare source string such as `ready.` is never
treated as an implicit URL. Import list predicates explicitly with
`:- use_module(library(lists)).`. The worker installs the course compatibility
clause `not(Goal) :- \+ Goal.` before consulting learner code. Core terms,
unification, backtracking, recursion, arithmetic, negation, cut, and collections
use the real interpreter. This is a bounded educational environment, not full
SWI-Prolog: it does not supply SWI-specific constraint libraries
or host file/terminal access. Interactive queries display at most 100 answers;
each answer has a 100,000-inference budget, with the shared host watchdog and
Stop/restart path also active. Limits must be reported, not described as proof
of finite failure. No new persistence keys are used.

`haskell` is deliberately a single-backend mode. A hidden
`sandbox="allow-scripts"` iframe owns a persistent, serialized MicroHs REPL
session and loads the locally pinned, single-threaded MicroHs 0.16.6.0
WebAssembly runtime. Each expression is deserialized into fresh runtime values;
compiled combinator syntax and type information may be reused. The local bundle embeds the unchanged
upstream Wasm bytes through `Module.wasmBinary`, followed by the unchanged
upstream JavaScript loader; see `js/vendor/microhs/README.md` for the pinned
hashes and packaging recipe. Keep it self-contained so the opaque-origin
frame does not depend on CORS-enabled Wasm fetches. The
parent page talks to that frame through the Worker-like, namespaced
`postMessage` proxy in `TutorialCode`; keep the source, origin, and namespace
checks intact. Do not add Haskell to mixed-backend dispatch or enable the
cross-origin-isolation service worker for it; MicroHs does not use
`SharedArrayBuffer` or worker threads. Before each Run, the runtime syncs all
workspace files and invokes `:main` in the module derived from `run_file` (or
the active `.hs` path). Use `Main.hs` as the conventional entry point.
`js/haskell-worker.js` retains imports and compiled code only after successful
compilation. It compares complete workspace file bytes before each request,
including files written by learner IO; changed inputs trigger MicroHs's own
content-hash/dependency validation through `:reload`. The snapshot is bounded
at 1 MiB and 128 filesystem entries. Symlinks, oversized workspaces, and
unreadable entries disable reuse and fall back to reload. Scope changes remove
old imports; compiler/runtime errors invalidate reuse. Never cache expression
results or mutable top-level runtime values. MicroHs 0.16.6's `TranslateMap`
contains `Exp` syntax, and `translateWithMap` deserializes it anew per expression.
Normal requests finish when a request-specific REPL prompt appears on its own
line. This avoids compiling a second Haskell expression solely for completion;
ignore the marker inside its echoed `:set prompt=...` command. Reset the normal
prompt before the next request. Compiler zero-delay yields and adapter completion
callbacks use a `MessageChannel` task queue: timers are throttled in the hidden
sandbox and can exhaust an otherwise finite program's execution deadline. The
initialization hook replaces the pinned loader's `safeSetTimeout` only for a
zero delay, preserves `callUserCallback`, and leaves positive waits such as idle
input polling unchanged. Keep real task boundaries so Stop and incoming messages
can run; microtasks alone would starve them. The hook checks these internal
loader globals, just as the Asyncify stack hook below checks its pinned ABI.
Verify scheduling through `tests/haskell-scheduling.spec.js`, which restores
Chromium's normal background throttling; default Playwright launch flags mask
this failure. Haskell boot uses the shared worker-initialization owner so
termination clears the boot timer and rejects readiness; messages from a replaced
frame cannot settle a newer startup. Test pass/fail and live-debug completion still
use qualified `Prelude.putStrLn` markers. Author
`files[].path`, `solution.files[].path`, and
`run_file` as workspace-relative paths such as `Main.hs` or `Helpers/Math.hs`;
the host adds `/tutorial/` when syncing files. Absolute `/tutorial/...` paths
are not a supported Haskell authoring form. Haskell `setup_commands` and `solution.commands` are
intentionally unsupported; express setup and solutions through workspace files.

#### Prolog query interpreter

Every `backend: prolog` tutorial automatically offers **Output** and
**Terminal** view buttons, following the Haskell interaction model.
`js/prolog/interpreter.js` owns the accessible query transcript, inline `?-`
prompt, and bounded, page-session-only command history. Its light, dark, and
print presentation shares `css/tutorial-interpreter.css` with Haskell; `TutorialCode`
loads and disposes the component with the tutorial.

- **Run** and **Debug** use the step's authored `default_query` and designated
  `run_file`. **Test My Work** also checks that designated entry file. These
  actions never consume the Terminal draft or previous query. Run displays
  ordinary Output; returning to Terminal preserves its draft and transcript.
- Terminal queries use the active Prolog editor file, including
  unsaved changes. Each submission consults that file afresh, so query-created
  facts and bindings do not persist into the next command. Reusable facts and
  rules belong in the editor. An optional trailing period is accepted, and all
  answers are requested automatically within the existing worker limits.
- The existing worker `{ type: 'run', id, path, query }` protocol remains in
  use. While the exclusive interpreter execution transaction is active, its
  `onOutput` callback receives Prolog stdout/stderr for the transcript; other
  execution output follows the normal Output path. Keep interpreter output
  separate from ordinary Run, debugger output, and exercise checks.
- Terminal execution shares the host guard with Run, checks, step loading,
  and the debugger. Stop and timeout use the existing disposable-worker
  recovery path, restoring the current workspace before another query runs.
- Submitted commands and results share a scrolling terminal with a fresh inline
  prompt. Keep the input outside the live log, preserve text selection, and
  let Tab leave the prompt. Enter evaluates; Up/Down recall commands; Ctrl+L
  clears the transcript; Ctrl+C interrupts or cancels unfinished input while
  selected text retains Copy. These Ctrl shortcuts also use Ctrl on macOS.
  Visible Previous query, Next query, Clear transcript, and Stop evaluation controls
  provide pointer alternatives; keep `/shortcuts/` synchronized.
- The history and transcript add no browser storage keys. The Output popout
  remains an Output surface; it has no Prolog query textbox and does not mirror
  the Terminal. The terminal controls are hidden in print.

Keep the Prolog interpreter UI tests, existing Prolog tutorial tests, worker
contract tests, and language-debugger tests passing. Verify default-query Run
remains independent of interpreter edits, active-file queries use fresh source,
history restores unfinished drafts, and errors or Stop permit another query.

#### Haskell expression interpreter

Every `backend: haskell` tutorial automatically offers **Output** and
**Terminal** view buttons; no YAML opt-in is needed. The interpreter is
MicroHs, not GHCi. `js/haskell/interpreter.js` owns the accessible transcript,
inline shell prompt, and bounded, page-session-only history; presentation lives in
`css/tutorial-interpreter.css`, shared with Prolog. Its semantic color variables follow the site's
light/dark theme, including input, transcript, help, and control states.
`TutorialCode` loads both alongside cycle diagnostics.

- Evaluate one-line Haskell expressions, including calls to functions in the
  active `.hs` file, without adding `main`. Use `:type expression` or `:t expression`
  to inspect a type without evaluating its value.
- Each request syncs all editor models (including unsaved changes), validates
  workspace contents, and uses the active file's scope. Unchanged source can
  reuse compilation; every expression still receives fresh runtime values.
  Explicit modules respect their exports;
  a headerless `Main.hs` uses a temporary named module so its definitions are
  available without requiring `main`. Temporary source never replaces learner files.
- Terminal diagnostics explain unprintable function results and offer a conditional
  tuple-versus-curried-arguments hint (for example, `f(9,12)` versus `f 9 12`).
  Tuple arguments remain valid Haskell; never rewrite input or presume function
  arity. Preserve the original error in expandable **Compiler details**.
- Each request starts with fresh module scope. Reusable definitions belong in
  the editor; expression-local bindings use `let … in …`. Other colon commands,
  shell commands, and multiline input are rejected with a diagnostic.
- Worker protocol: `{ type: 'evaluate', id, path, expression, silent: true }`
  returns `{ type: 'run_done', id, exitCode, stdout, stderr }`. Results stay in
  the interpreter transcript, separate from program output and exercise checks.
- Evaluation shares the host execution guard with Run and checks. A paused
  Haskell debug session does not block the terminal: the expression runs in the
  main runtime, separate from the debugger's executor, and does not step or
  change the trace. Names that exist only in the paused call are not in scope.
  Stop and the execution deadline restart the sandbox, then permit another
  expression. Type queries bypass value-demand cycle checks; expression checks
  pass `executeExpression: true` to the cycle analyzer to follow known IO demand.
- Input and output share one scrolling terminal: submitted commands remain in
  the transcript, results follow them, and a fresh inline prompt becomes editable
  when execution completes. Keep the input outside the live log to avoid
  announcing keystrokes, preserve text selection, and let Tab leave the prompt.
  Keep terminal padding and transcript gaps compact without reducing readable
  type or button targets; leave room for focus outlines and let controls wrap.
  At the tutorial’s narrow-screen breakpoint, the interpreter uses natural
  document flow with bounded terminal scrollback so its prompt cannot collapse.
- Enter evaluates; Up/Down recall history; Ctrl+L clears the transcript; Ctrl+C
  interrupts execution or cancels unfinished input (selected text retains Copy).
  These Ctrl shortcuts also use Ctrl on macOS. Visible Previous/Next command buttons
  offer the same history actions. Keep `/shortcuts/` synchronized. No persistence
  keys are added. The terminal controls are hidden in print.
- The help includes local GHCi guidance (`ghci Main.hs`). Do not label the browser
  engine GHCi: that would imply compiler and session capabilities it does not have.

Run `tests/haskell-interpreter.spec.js` for actual compiler protocol and UI coverage,
including modules without `main`, fresh edits, type queries, error recovery, and
isolation from Run and gates. Keep the existing Haskell backend and tutorial suites
passing when changing its integration.

#### Prolog and Haskell debugging

Set `debugger: true` to expose Debug, source breakpoints, stepping, the
variable/stack inspector, recorded history, and synchronized debugger popouts.
The existing Prolog and Haskell tutorial families opt in. These two backends
use `js/debugger/language-channel.js` and cooperative runtime messages, so
neither requires cross-origin isolation or `SharedArrayBuffer`. Do not enable
the isolation service worker solely for their debugger flag.

Each debug session owns a separate Prolog worker or sandboxed Haskell frame.
It receives the current editor files and the same step `run_file` as Run;
Prolog receives the step's `default_query` as one complete goal string,
independently of the Terminal prompt and history. Stop destroys
that executor. Normal Run and Test keep their own runtime and file state.
The host applies a 120-second boot watchdog and a 30-second execution
watchdog by default (`debugger_options.execution_timeout_ms` overrides the
latter). A paused session has no reading deadline. Navigation, restart, and destruction discard old runtime
messages. Output and errors go to the normal output panel.

Prolog traces actual Tau Prolog resolution, including alternative solutions
and variable substitutions. Source highlights identify the owning clause;
they are not imperative line-by-line execution. Watches inspect in-scope
Prolog variables or terms without executing new queries. Conditional
breakpoints accept pure term equality and numeric comparisons. The
interpreter's inference and answer limits remain explicit errors, never false
proof of finite failure. The pinned vendor interpreter is unchanged. Prolog caps traces at 5,000 events
by default (`max_history` or `max_snapshots`, at most 50,000), with the existing
100-answer and 100,000-inferences-per-answer bounds.

Haskell debugging instruments top-level equation alternatives in
`js/debugger/haskell/instrument.js`. MicroHs performs the original pattern
matches in source order; fallbacks record failed matches. The trace exposes
attempts, matching patterns, selected equations, Boolean guards, and `if`
conditions (including conditions in an equation's `where` scope). Equation
breakpoints stop at selection; guard/condition breakpoints stop before the test.
Step Into also visits attempts and failures. Nested local functions and IO
statements have no independent call frames. Explicit module braces, semicolon
declarations, infix equations, and pattern guards produce actionable diagnostics.
Trace events and frames also carry `source_focus`: a semantic `role`, original
`text`, and a one-based Monaco `range` with an exclusive end column. Its columns
count UTF-16 units (a tab occupies one unit), unlike compiler diagnostic columns.
Pattern attempts focus the equation header; selection and return focus the
chosen body; tests focus their condition; local demand focuses the binding RHS.
Known suspended callers focus the application that demanded the current call.
History freezes these spans along with values. Main and detached editors box
the exact span only while its text still matches the editor model. While the
current event is choosing an equation (`call`, `try`, `match`, or `reject`),
and on the selection step itself, the editor lists the call's arguments and
every equation in a view zone and boxes each header. Gutter arrows use a
distinct shape for tried, not matched, matched, and not reached; words in the
list carry the same states. On the selection step the chosen body stays
highlighted beside that list. The overlay leaves on the following event.
Haskell does not show the equation list in Variables; that list is the editor
overlay. Variables shows argument bindings and local bindings, including
pattern-binding types. Hovering a pattern or local name
shows its type and current value.
This adds source precision to existing events, not a step for every primitive
arithmetic reduction. Never force values to populate a highlight or preview.

Trace locations map to original source lines. `instrument()` also records each
generated character's source offset (`origins`) and returns `locate(line,
column)`. The worker rewrites compiler diagnostics (`"file": line L, col C`) and
runtime error locations (`"file",L:C`, e.g. from `error`) to the learner's line
and column, matching an uninstrumented Run. MicroHs counts columns in code
points with tab stops every 8 columns; a column inside generated debugger code
keeps only its mapped line rather than a guessed column. Generated code must
stay byte-identical when changing origin tracking; verify every origin names
the same source character.

`js/debugger/haskell/helper-source.js` supplies lazy Haskell observers and the
private GETRAW handshake. Observers reveal values **only when demanded through
the observed call**; never use `show` on arbitrary arguments or traverse lazy
fields to populate the panel. Explicit signatures support Int, Word, Bool, Char,
Float, Double, lists, pairs, and Maybe; unannotated list patterns support list
structure. Unrecognized/custom types, polymorphic fields, and potentially
shadowed Prelude types stay opaque without adding type-class constraints.
Integer is not a primitive Int. Function-valued results remain functions.
An underscore means “not observed yet”, not proof of global unevaluatedness.
`js/debugger/haskell/call-sites.js` also retains supplied argument expressions
for direct saturated calls in an unambiguous same-module scope. Application
markers associate these with actual demanded calls. Literal list/pair syntax
and forwarded pattern bindings appear immediately; arbitrary computations stay
expressions until observed. Previews using source information are labeled
“supplied”, separately from each argument's `observed_repr`. Do not evaluate
source expressions in JavaScript or force Haskell arguments to fill this view.
Ambiguous local scopes, partial applications, and imported callees fall back to
ordinary observations. Source previews and structural copying are bounded.
Argument observations, supplied expressions, pattern bindings, equation status,
and condition outcomes are frozen in each history snapshot. A delayed condition may resume the scope
of a call that already returned; the view labels that explicitly.

`js/debugger/haskell/local-bindings.js` discovers direct simple `where` value
bindings. Their original RHS is wrapped lazily, preserving sharing and scope.
The Local bindings are still recorded. Hovering the name shows the defining
expression until demand, then the observed value. Concrete observers use
explicit local signatures or conservative type-equivalent use contexts; never
add `Show` constraints or guess a numeric type from literals. Unknown types
remain opaque. Binding-demand and binding-result events preserve the owning
call's context, including after its outer result returned; history stays frozen.
Nested local functions, destructuring bindings, and `let` scopes are not exposed
as local value definitions. Binding breakpoints stop on demand, not declaration.

Shared main/popout rendering shows the call stack and descriptive history
entries. Equation arguments and choices appear in the editor overlay through
the selection step. Hovering a name shows its type and value. Haskell hides
Watch. Variables lists argument bindings and local bindings. Arbitrary watch evaluation,
mutation, conditional breakpoints, and exception breakpoints remain unavailable.
See [`docs/haskell-debugger-design.md`](../../../docs/haskell-debugger-design.md)
for the GHCi, Hat, HOOD, and Haskelite research behind these choices.

Ordinary Continue events acknowledge input before MicroHs enters its polling
wait. Initial pauses, stepping, breakpoint sites, and history-limit events remain
deferred until stderr has been captured and Asyncify has unwound. Do not replace
those boundaries with synchronous resumption. Haskell traces stop at 2,000 events by default (`max_history`, at most
10,000). Output produced before a pause is available immediately. The adapter
sets the pinned loader's Asyncify continuation buffer to 256 KiB in
`Module.onRuntimeInitialized`, before its first allocation; this avoids the
upstream 4 KiB buffer's recursive-debug overflow without modifying vendor bytes.
The hook depends on the pinned generated loader's internal ABI and checks it
explicitly. Keep the deep-recursion/Step Out regression when upgrading; prefer
an upstream build-time `ASYNCIFY_STACK_SIZE` setting when rebuilding the bundle.
MicroHs
normally yields between reductions, but a demanded cyclic local alias can
remain inside its indirection-following loop without yielding. Because the
existing compiler needs an iframe rather than a Worker, that pathological
case can also delay the host watchdog and Stop; reloading the page may be
necessary. Do not claim hard cancellation for every Haskell expression.

Both traces are read-only. Step Back and the history slider inspect captured
states; moving forward through that history visits stored events until the
live pause, without repeating output or other effects. Completing execution
keeps the trace available for inspection; Stop or a new session clears it.
Language views and popouts share `ui-render.js` and the native keyboard
controls in `css/debugger-controls.css`. They reuse the existing breakpoint,
section-collapse, and popout storage families; there are no new storage keys.

#### Haskell alias-cycle preflight

Haskell always loads `js/haskell/syntax.js` followed by
`js/haskell/cycle-analysis.js`, independently of the debugger and Python
linter flags. The pure, bounded analyzer recognizes named
value aliases in top-level, `let`, and `where` groups with lexical binding
identity. Self/mutual cycles get source-location diagnostics; productive
constructor recursion and function recursion are not alias cycles.
`js/haskell/cycle-diagnostics.js` owns debounced Monaco markers and the readable,
keyboard-focusable diagnostic region (`css/haskell-diagnostics.css`). It handles
initial files and later edits, resets, solutions and host-mirrored popout edits.
The visual region is hidden when there are no findings; there is no idle message.
An always-mounted live region announces warnings even when the panel first appears.

Warnings alone do not block execution: unused bindings remain lazy. Run and
Debug check the selected entry's `main`; Test My Work checks each Boolean
expression rather than assuming it runs `main`. A proven mandatory demand of
an alias cycle blocks that action with an explanation and leaves controls usable.
Test expressions see only the module's exports; a missing module header exports
only `main`, matching the pinned MicroHs parser.
The MicroHs adapter repeats the same check on raw source before Run, Test, or
debug instrumentation, so direct runtime messages use the same policy.

This is a partial syntax/demand check, **not** a Haskell interpreter, type checker,
or termination proof. It follows value aliases, selected literal Boolean branches,
the first executed `do` action, and a small set of trusted Prelude demand edges.
Evaluating an IO action as a value does not imply running its output effects.
The check does not unfold functions, follow imports, force constructor fields,
prove completion of earlier effects/operands, or analyze general patterns,
guards, case expressions, or numeric-instance demand. Comparison demand requires
a complete literal value on the other side rather than assuming an operand
evaluation order. Imports, custom data/instances and language pragmas disable
the relevant Prelude assumptions. Unsupported equations are opaque; unsupported
module/binding structure or exhausted analysis budgets can yield no diagnostics.
No-warning output must never be described as safe to execute. Source, token,
nesting, demand, displayed-chain and diagnostic-count limits bound analysis cost.

The motivating runtime mechanism is the indirection-following loop in the pinned
MicroHs evaluator (`src/runtime/eval.c`, commit
`9e8f923c614c12f14412e63e329de25ff9309c4f`, around lines 5122–5128): a cyclic
indirection can prevent reaching its normal cooperative yield. Keep dangerous
fixtures static; runtime guard tests include an unrelated compile-error backstop
so removing a guard cannot execute that cycle in a browser. No vendored runtime
bytes or storage keys change.

If you add a backend, update this table.

### 4.7 Autosave / progress storage

Per-tutorial localStorage key: `tutorial-progress-<tutorialId>` →

```json
{
  "step": 0,
  "stepsPassed": [0, 1],
  "quizPassed": [0],
  "stepsUnlocked": [0, 1, 2],
  "stepsVisited": [0, 1],
  "files": { "example.py": { "content": "...", "language": "python" } },
  "stepFiles": { "key:hello": { "Main.hs": { "content": "...", "language": "haskell" } } },
  "activeFile": "example.py",
  "progressVersion": 2,
  "stepKeys": ["hello", "references", "functions"]
}
```

The SE Gym page (`/se-gym`) has Import / Export / Delete UI for these
keys. **If you change the persistence schema, also update**:
`js/tutorial-code.js` (the storage code), the SE Gym import/export UI in
`se-gym.html`, the storage inventory at `/cookies/` (per
`cookie-storage-tracker` skill), and this skill.

`progress_version` opts a tutorial into stable lesson identity. The numeric
fields remain available to SE Gym and existing exports; `stepKeys` records the
ordered step `key` values that give those numbers meaning. On restore, records
are mapped by key, so inserted lessons do not inherit unrelated test/quiz passes.
Deep links select the resume step without discarding restored completion records.
Tutorials without this option retain the existing numeric behavior.

Python also supplies `legacy_step_keys` for its original 12-step ordering. Before
versioning, both that ordering and the expanded ordering could produce saves.
New-only filenames, indices outside the legacy range, or an active file matching
only one candidate step distinguish them. The legacy one-past-last unlocked
sentinel is not evidence of the expanded ordering. If neither layout is certain,
only records whose positions mean the same lesson in both layouts survive;
resume uses a uniquely matching `open_file`, otherwise the first lesson.
Unversioned saves are also treated conservatively when a legacy lesson was
removed, since its missing file definition cannot identify a newer ordering.
The migration notice describes rechecking without promising optional navigation.
In versioned tutorials with required tests, only a matching test pass unlocks
Next; access to a later lesson does not credit a replacement lesson's tests.
All file overrides, including unknown filenames, remain in storage. An accessible
notice appears in the resumed instructions and popout during that visit, explaining
preservation or the need to recheck uncertain progress. Saving stamps the current
identity metadata, so reload does not migrate a second time. No check becomes
mandatory. Python has no legacy timed-practice/cooldown records to migrate;
reordering other timed tutorials requires separately handling those stores.

Navigation snapshots editor models synchronously before closing or reseeding them.
Session drafts survive step changes independently of Auto-save; Auto-save controls
disk persistence. Shared files remain under `files`; `reseed: true` drafts live under
`stepFiles`, keyed by `key:<step.key>` (or `index:<n>` when no key exists). Use stable
unique step keys when lessons may move. Empty drafts are valid. Returning to starter
content removes that override; session tombstones prevent older disk edits from
reappearing after a failed write. Full and explicit saves share this snapshot path.
Legacy path-only saves are attributed only to their recorded resume lesson, never
copied to all same-named lesson files. Versioned tutorials resolve that lesson through
the trusted key mapping before choosing a resume fallback; when the recorded lesson
was replaced, its draft stays under `files`, preserved but shown by no reseeded
lesson, so the fallback lesson never opens with another exercise's code. Reset saves the current lesson's starter after
its setup completes, preserving other drafts. Delete clears remembered drafts too.
Smalltalk continues using its native accepted-source/draft owner.

The optional `download` object enables a **Download ZIP** navbar button after
startup. `js/tutorial-download.js` reads `TutorialCode.getEditorFileContents(paths)`
at activation and uses locally vendored fflate 0.8.2 to package UTF-8 text with
the configured relative paths. Empty files are retained; a missing editor model
fails the entire export with a visible live-region message. The operation does
not read saved progress, execute student code, or upload anything. It is for
editor-managed files (Homework 3 uses nine shared files), not VM-generated files
or Smalltalk native source. The library, controller and stylesheet are loaded
only for opted-in pages. Keep the manifest aligned with submission requirements.

SE Gym's import/export preserves each progress object, including `stepFiles` and this metadata,
without changing its export envelope. Fresh saves do not show a migration notice.

`TutorialCode.saveProgress()` returns `true` only after `localStorage`
accepts the complete write and returns `false` when persistence is disabled
or the write fails. Auto-save callers route that result through the shared
status reporter: a rejected write shows a visible **Save failed** marker and
announces that the latest changes are not saved, and that warning remains
until a later write succeeds. Never display or broadcast a saved confirmation
without checking the persistence result first.

A separate `tutorial-cooldown-<tutorialId>` localStorage key holds the
"Test My Work" cooldown end timestamps when `cooldown_seconds:` is set
on a tutorial. Shape: `{ "<stepIndex>": <unix-ms-end-time> }`. Stored
under the same prefix family as other tutorial state so the global
"Delete all tutorial state" button on `/cookies/` clears it.

### 4.8 Test execution

- **Compiler front end** (`compiler`): `tests[].compiler` is declarative, not
  executable assertion code. Check full acceptance, complete token streams,
  one AST, all AST alternatives, or a specific error phase (§3.5). Every check
  uses the frozen current rules in a fresh Worker. Shared test results, hints,
  progression, autosave, and popout reporting remain owned by TutorialCode.
- **bash** (v86 / webcontainer): `command:` is shell. Exit 0 = pass.
- **C++** (`cpp`): every `tests[].command` is a complete C++17 harness
  translation unit with its own `main`, compiled against the current learner
  files. `/tutorial` is the include root, so a harness can include a current
  source or header by its workspace-relative path. When including a learner
  source file that already defines a driver `main`, rename that symbol with
  `#define main learner_main` before the include, then `#undef main` before
  defining the harness entry point. Assert the specified observable behavior
  through learner functions or objects rather than matching source text.
  The check passes only when compilation succeeds and the harness exits with
  code 0. Compilation errors, failed assertions, runtime errors, nonzero exit,
  output exhaustion, or the host deadline fail the check; they must never
  reuse an earlier executable or count partial output as success. Each check
  gets a fresh compiler filesystem and WASI program instance, sharing only
  the current source files with the student's Run. Harnesses are C++ programs,
  not shell commands, JavaScript assertions, or Python fragments. Keep manual
  reasoning prompts separate when code execution cannot assess them.
- **python** (pyodide): `command:` is Python with the helper
  `__run_capture('/path/to/script.py')` returning captured stdout. Use
  `assert <expected> in output, "<friendly fail message>"`.
  Separately, the toolbar Run/Test button uses step `run_file` by default;
  when a Pyodide pytest step needs that toolbar button to run multiple
  student-facing pytest files, set `run_files: [...]`.
- **Haskell** (`haskell`): each `tests[].command` is a Haskell Boolean
  expression evaluated after the current workspace is synced and the module
  selected by the step's `run_file` (or the active `.hs` file) is imported.
  `True` passes; `False`, a compile error, or a runtime exception fails. Keep
  the expression pure and self-contained, for example
  `doubleAll [1, 2, 3] == [2, 4, 6]`; do not use shell commands or Python-style
  `assert` statements. A workspace-sync failure must render an indeterminate
  result and settle the active test transaction; never leave the test spinner
  or `_testRunInFlight` waiting for a Haskell request that was never sent.
  Each Haskell **Test My Work** batch starts with fresh Output, preserving
  every diagnostic produced in that batch without accumulating errors from
  earlier checks. A subsequent **Run** likewise displays fresh program output.
  An optional `signature: {name, type}` requires an explicit top-level
  declaration in that same `run_file` and the exact expected monomorphic type.
  The host passes this descriptor to `runTest`; the worker owns both checks
  against the synced source. `js/haskell/signature-checks.js` locates the named
  declaration with the shared tokenizer/layout rules; an inferred type,
  expression annotation, local declaration, comment, or string does not count.
  It does not parse or compare types. MicroHs resolves the actual declaration,
  including local, parameterized and imported synonyms, shared-name signatures,
  formatting, comments and redundant parentheses.
  The worker creates a collision-free temporary module beside the learner's
  module. It imports the learner qualified and compares `Data.Typeable.typeOf`
  with the authored expected type in its own Prelude scope, preventing learner
  aliases from changing the expected meaning. `default ()` in this checking
  module rejects generic numeric declarations that could otherwise default to
  Double. It does not change default declarations in the learner module.
  Expected types must be one-line monomorphic types available in Prelude; use
  compiler-supported equivalent forms in the learner's declaration. This gate
  is not suitable for requiring a particular polymorphic/constrained interface.
  Identical signature requests reuse their temporary helper while it remains
  adapter-owned; headerless expression scopes follow the same rule. Scope
  changes defer cleanup until the following operation completes, because MicroHs
  may read a helper while deleting its import. Never unlink the active helper.
  Before reusing or deleting a helper, verify it is a readable regular file with
  the exact source the adapter wrote. An editor write transfers ownership; a
  replacement made through learner IO must also survive reuse and cleanup.
  Choose a new collision-free name when ownership is lost.
  Keep `command: "True"` for a signature-only check so the learner module still
  compiles; retain separate behavioral checks for its actual results. A compiler
  error must fail even when the source contains the expected declaration.
  Pair failures with layered hints distinguishing explicit-interface practice
  from inference. These checks do not measure whether a learner can explain the
  signature. Load `js/haskell/syntax.js` before cycle analysis and declaration
  checking in the runtime frame/worker; the host only needs cycle diagnostics.
- **Prolog** (`prolog`): each `tests[].command` is repository-authored JavaScript
  with `assert(condition, message)`, `await __query(goal)`,
  `await __consult(source)`, and `__read_file(path)`. Each test starts with a
  fresh consult of the same `run_file` used by Run, regardless of the selected
  editor tab. `__query` resolves to the complete list of formatted answers;
  finite failure resolves to `[]`. Syntax/runtime errors, inference exhaustion,
  and more than 100 answers reject and fail the grade; they never return a
  partial list that could masquerade as a passing result. Exactly 100 complete
  answers are valid. Use bounded Prolog goals that compare terms or complete
  `findall`/`sort` results, then assert the success count, instead of coupling
  grades to whitespace in formatted substitutions. Await sequential queries.
  Legacy un-awaited `__query`/`__consult` commands remain supported by the
  existing compatibility rewrite; new commands should explicitly await them.
  Write output is flushed at each completed command, so tests cannot leak
  buffered text into the next Run. `setup_commands` are consulted Prolog
  source, but each Run/Test replaces the session: put required program
  definitions and library imports in the step file.
- **React DOM assertions** (`react`): a plain `tests[].command` runs inside the
  opaque-origin preview through the broker's private `MessageChannel`. It
  receives `frame`, `code`, `assert`, and `files`; `frame.contentDocument`
  refers only to the preview document. Keep commands repository-authored, do
  not add host-page capabilities to this interface, and never expose assertion
  traffic through public window messages.
  By default checks in a batch share the initial preview. Step-level
  `react_reset_between_tests: true` makes `_runReactAssertionTests` rebuild the
  iframe before each subsequent check and use the new private assertion port,
  giving independent UI scenarios the equivalent of a per-test page refresh.
  This resets app state, not editor files. Homework 3 uses this for nine public
  scenarios authored independently from its private grader. Public checks contain
  interaction examples and literal expected boards, never a reference game or
  copied private grader cases. Python tests and submission checks remain local/Gradescope-only.
  Leaving the step stops remaining assertions before another preview rebuild.
- **playwright** (react): `command:` is Playwright-compat JS run by
  `js/playwright-compat/runner.js` (a subset of `@playwright/test`).
  Reference selectors via `page.getByRole(...)`, `page.getByText(...)`. Its
  locator/action requests and responses share the React assertion broker's
  private capability port; do not add a public-window fallback. Learner spec
  source runs in a fresh opaque-origin dedicated worker, and the host terminates
  that worker if synchronous loading or a test callback exceeds the configured
  Playwright timeout, so an infinite loop cannot freeze the tutorial page.
- **UML assertions** (`uml-editor`): `tests[].assertions` are structural
  checks against the current ArchUML source. Use `kind: element|class|state|
  participant`, `kind: member`, `kind: relation|transition|message`, or
  `kind: class_consistency` with
  `check: abstract_methods_implemented` to require concrete subclasses to
  implement inherited abstract/interface operations. Other assertions use
  fields such as `id`, `owner`, `text`, `from`, `to`, and `label_contains`.
  For flexible naming, use `id_contains`, `text_contains_any`,
  `from_contains`, `label_contains_any`, or the corresponding camelCase
  variants; matching is normalized and case-insensitive. Element assertions
  can accept multiple element types with `element_type_any`. Add
  `naming_hint` to an assertion when a failing same-kind candidate should
  produce a pedagogical naming nudge in the shared tutorial Hints panel; the
  UML runner only passes that hint to the panel when the model appears to
  contain a plausible candidate with a non-matching name or label, not when the
  element is missing entirely. Member
  assertions can require abstract operations with `is_abstract: true` (an
  interface or abstract-class member counts as abstract even without an
  explicit `{abstract}` marker), and can require an actual operation signature
  with `requires_arguments: true` so `setState()` passes but an attribute like
  `setState: PlayerState` does not. Use `argument_type` or
  `argument_type_any` when a method parameter must be typed as a particular
  class or interface; the checker accepts common UML forms such as
  `state: PlayerState`, `PlayerState state`, or `PlayerState`. Relation assertions can constrain semantic arrow type with
  `relation_type`, `relation_type_any`, or camelCase variants, or map the
  matched target element's type to the required arrow type with
  `relation_type_for_target_type` (for example, `interface: realization` and
  `abstract class: generalization`). They can also require endpoint
  multiplicities with `source_multiplicity`, `target_multiplicity`, or their
  `_any` / camelCase variants. Multiplicity checks use the semantic
  assertion endpoints, so aggregation/composition multiplicities follow the
  whole-to-part relationship even when the ArchUML line is written in the
  reverse textual direction. Keep the tutorial checker aligned with the
  visual UML editor's relation grammar so rendered-valid relationships do not
  fail tutorial assertions because of quote placement or reversed textual
  spelling. State-machine assertions can stay
  consistent with a prior class diagram by using `class_role`,
  `from_class_role`, and `to_class_role`; roles currently resolve concrete
  class names containing `normal`, `jail`/`prison`, or `bankrupt` from the
  saved class-diagram draft. Relation assertions also support
  `label_min_length` and `optional: true` for optional transitions that should
  be checked only when present. Sequence-diagram assertions use
  `kind: sequence` with `check:` values like `player_object`,
  `state_objects`, `messages_between_player_and_states`,
  `state_change_between_state_calls`, `state_change_argument_is_next_state`,
  `call_labels_have_argument_lists`, and `called_methods_exist`;
  `state_change_argument_is_next_state` requires the state-changing call
  between two state turn calls to pass the lifeline receiving the next turn
  call as an argument, and `call_labels_have_argument_lists` requires every
  non-return call label to use plain `methodName(arguments)` syntax without a
  receiver prefix such as `self.` or `state.`. The `called_methods_exist`
  check verifies call message labels against the receiver's class or inherited /
  realized operations in the saved class diagram, while dashed return messages
  are ignored because response values are not class operations. Generalization /
  realization and aggregation / composition assertions follow UML arrow semantics: both
  `Child --|> Parent` and `Parent <|-- Child` satisfy `from: Child` /
  `to: Parent`, and both `Whole o-- Part` and `Part --o Whole` satisfy
  `from: Whole` / `to: Part`.

Failure surfaces inline in `.tvm-test-panel` below the instructions
(green/red/yellow), with all matching `hints[].condition` hints
auto-expanded.

The result list and pass count use the individual `tests:` entries. Assertions
inside one entry share one result: a large conjunction hides which requirement
already works. Author separate entries for separate criteria (see §1, "Small
checks make partial progress visible"); this needs no additional runtime flag.
Shared applicable hints are deduplicated in the flat panel by authored title
and body; this does not merge test results or discard their criterion groups.

Code-test success records `stepsPassed` independently from navigation access.
`_isNextStepLocked` allows a passed step to open its knowledge check, while
`_renderTestResults` adds the following step to `stepsUnlocked` only when no
required quiz remains. Required quizzes unlock it through `_completeQuiz` and
`_advanceAfterQuiz`; popout navigation uses the same host state. Existing saved
visits and explicit step deep links retain their established access behavior.

---

## 5. When you add or change a tutorial-runtime feature

**These changes always require a SKILL.md update in the same commit:**

- New top-level YAML field → schema cheatsheet (§3.1) + checklist (§2)
  if authors must set it.
- New step-level field → step-fields cheatsheet (§3.2).
- New backend → §3.1 backend list, §4.6 capability matrix, the checklist.
- New popout window → §4.4 popout list.
- New test runner → §4.8 test-execution list.
- New quiz type → also update `quiz-format` SKILL.md (cross-skill).
- New hint condition keyword → §3.3.
- New autosave / reset mode → §3.1 + §4.7.
- New persistence key → §4.7 + storage inventory at `/cookies/` per
  `cookie-storage-tracker`.
- New popout IPC message → §4.4.
- Renamed file or moved layout → fix every cross-reference in this
  document.
- Renamed permalink convention or page-pair structure → §4.2 + checklist.

If you're not sure whether a change is "tutorial-runtime", ask: *would an
author building a new tutorial three months from now be surprised if I
didn't write this down?* If yes, write it down here.

---

## 6. Other skills to consult

| When you're working on… | Read this skill |
| --- | --- |
| Anything that reaches the browser (instructions, layouts, popouts, JS-injected CSS, diagrams, modals) | `.agents/skills/wcag-aa-compliance/SKILL.md` — WCAG 2.2 AA is a hard requirement |
| Any color, CSS, SCSS, inline `<style>`, JS-injected stylesheet, or SVG color | `.agents/skills/light-dark-mode/SKILL.md` — light *and* dark mode both required |
| Any new browser-storage key (cookie, localStorage, IndexedDB, Cache API, BroadcastChannel name, Service Worker registration) | `.agents/skills/cookie-storage-tracker/SKILL.md` — the `/cookies/` inventory must stay in sync |
| Authoring a quiz block (`quiz:` inside a step, or any `_data/quizzes/*.yml`) | `.agents/skills/quiz-format/SKILL.md` — `option_feedback` schema, shuffle-safe phrasing, Parsons format |
| Deciding *whether* a diagram earns its place | `.agents/skills/good-diagrams/SKILL.md` |
| Picking a diagram type and syntax (Mermaid / ArchUML / etc.) | `.agents/skills/diagrams/SKILL.md` |
| Pedagogy of a programming tutorial — sequencing, exercise design, paradigm-transition pitfalls, AI-enhanced learning, growth-mindset framing, PRIMM / fading / worked-examples / desirable-difficulties application | `.agents/skills/cs-tutorial-design/SKILL.md` |
| Broader pedagogical lens for non-tutorial content (lectures, slide decks, chapters, exams, rubrics, syllabi) — Mayer's multimedia, ICAP, Variation Theory, UDL, UbD | `.agents/skills/pedagogical-advisor/SKILL.md` |

---

## 7. Quick reference — minimal new-tutorial template

When starting from scratch, use this as a skeleton and fill in. Add YAML
comments above each step naming the PRIMM phase and any pedagogy.

```yaml
# _data/tutorials/<slug>.yml
title: "<Tutorial title>"
description: "<one-sentence student-facing summary>"

backend: pyodide                         # or cpp / v86 / webcontainer / react
require_tests: true
linter: true

setup_commands:
  - "import sys; sys.path.insert(0, '/tutorial')"

steps:
  # =========================================================================
  # STEP 1: <Concept>
  # =========================================================================
  # Pedagogy: PRIMM — Predict before Run, then Modify
  - title: "<Title-Cased Noun Phrase>"
    instructions: |
      ### Why this matters

      One short paragraph (2–4 sentences) — earn the student's attention.
      Lead with the durable reason this step exists in the curriculum.

      ### 🎯 You will learn to

      - <Bloom verb (Apply / Analyze / Evaluate / Create) + concrete behavior>
      - <…1–3 items total…>

      ### ✏️ Predict before you run

      What will the snippet below print?

      - (a) <plausible alternative — maps to a misconception>
      - (b) <plausible alternative — maps to a misconception>
      - (c) <correct answer, hidden among the rest>
      - (d) <plausible alternative — maps to a misconception>

      Commit to a letter, *then* read the gated reveal below.

      <details>
      <summary>Reveal</summary>

      <answer + explanation tied to each misconception>

      </details>

    files:
      - path: /tutorial/main.py
        language: python
        content: |
          # starter code with TODO markers naming the GOAL not the FIX
          def greet(name):
              # TODO: return a friendly greeting
              pass

    tests:
      - description: "greet('Tobi') returns a non-empty string containing 'Tobi'"
        command: |
          from main import greet
          out = greet("Tobi")
          assert isinstance(out, str) and out, "greet should return a non-empty string"
          assert "Tobi" in out, "greet should mention the name"
        hints:
          - text: "Re-read the docstring — what's the *shape* of the return value?"
          - text: "You'll need string formatting. f-strings are the cleanest way."
            condition: "code_missing: f\""
          - text: "Skeleton: `return f\"Hello, {...}!\"` — fill in the blank."
            condition: "output_missing: Tobi"

    quiz:
      title: "Step 1 — Knowledge Check"
      min_score: 0.8
      questions:
        - type: single
          question: "Which of these is an f-string in Python?"
          options:
            - '"Hello, %s" % name'
            - 'f"Hello, {name}"'
            - '"Hello, " + name'
            - '"Hello, {name}".format(name)'
          correct_index: 1
          option_feedback:
            0: "That's printf-style formatting (`%s`). Works, but it's the older style — not an f-string."
            2: "String concatenation works but is verbose for many values, and `+` only joins strings (no automatic conversion)."
            3: "`.format()` is the pre-3.6 templating method. Same idea as f-strings but more verbose."
          explanation: "F-strings (PEP 498, Python 3.6+) prefix the literal with `f` and inline expressions in `{ }`. They're the recommended modern style."

    solution:
      files:
        - path: /tutorial/main.py
          content: |
            def greet(name):
                return f"Hello, {name}!"
      explanation: |
        F-strings inline `name` directly into the literal. Returning the
        string keeps `greet` testable (vs. printing) — a habit worth
        building early.
```

Then create the page-pair:

```
SEBook/tools/<slug>-tutorial.md            # layout: tutorial
SEBook/tools/<slug>-tutorial/print.md      # layout: print-tutorial
```

…and you're done. The `/SEBook/tutorials` index will pick it up automatically.

### Smalltalk Browser refactoring and Versions views

`Browser.mount({root,workspace,createEditor,refactorings})` optionally composes
`RefactoringView.mount({root,workspace,refactorings,onApplied})`. TutorialCode loads
`refactorings.js` then `refactoring-view.js` before Browser and injects the native
facade. The Refactor button browses the native catalog; typed text/source, Boolean,
string-list and integer-list controls come from its declared metadata. Preview shows
all native before/after entries, warnings, consequences and the captured revision.
Apply consumes one native token. Changed options require another preview; a changed
accepted revision disables Apply with explicit stale guidance. Modal Cancel/Escape
abandons the token and returns focus to Refactor or the available Browser region.
Late Prepare tokens returned after dismissal/disposal are canceled through the
original facade; late completion never moves focus. Undo/Redo and their explanation follow the
Workspace history event, retaining owned keyboard focus on an available history
action or Browser when an action becomes disabled; recovery resets live handles. No preview/history state is
persisted and no general tutorial textual refactoring machinery is used.

Browser editors display LF-normalized retained native source. Before opening Refactor,
the editor must equal that accepted representation at the captured Workspace revision;
drafts require Accept/Revert first. Browser maps Monaco's UTF-16 boundaries back to
retained native CRLF/CR source, preserving astral code units. Selection actions require
a nonempty selection made before opening the dialog. This map is EOL representation
conversion, not a parser or refactoring implementation.

Versions queries native ChangeSet history for the selected method. Select version
shows native source and query revision. Restore version uses Workspace.commit with
`action:'restoreVersion'`, captured target/source/revision and method protocol; this is
a new accepted edit and ends refactoring Undo history. Captured targets survive later
navigation; existing method drafts require Accept/Revert first. Missing native history remains
unavailable. Refresh Versions after a restore or stale rejection. Source provenance is
never reconstructed from textual edits or external files.

### Smalltalk runtime ownership and recovery

Keep accepted source policy in `js/smalltalk/workspace.js`; public Program contains code,
not image bytes or object state. `SEBookChanges.st` owns native source capture/export and
file rebase, while `SEBookTransactions.st` owns stable mutation IDs and acknowledgment.
`checkpoint.js` retains actual image/filesystem/scheduling state through private host
records. Failed Accept restores that graph, preserves the draft and changes inspector
handle generation. Never replace this recovery with source replay.

`source-watch.js` compares native-rooted source metadata before invoking full native
reconciliation. It is a pinned VM adapter, not a Smalltalk parser. Cold source text is
read from immutable verified assets through bounded byte-range primitives and the native
chunk reader. Keep all adapters, native source inventory, prepared image and manifest
coherent when rebuilding. Ordinary warm Evaluate does not checkpoint or reload code.
`RuntimeHost` budgets each `loadProgram` initialization with `bootMs` (120 seconds
by default), as it loads definitions/overlays and captures the native source baseline.
Asset acquisition and image boot each use the same finite startup budget. Ordinary
foreground requests retain `operationMs` (30 seconds); explicit Run/check retains
`runMs` (60 seconds). Loading remains cancellable; do not increase all request limits
to accommodate initialization.

Fresh grading and raw-file rebase share `RuntimeHost.withFreshSession`; a cancelled
queued job must not stop another job's Worker. Browser and terminal use the one live
Workspace, including its draft/revision events and recovery announcements.

Workspace disposal must abort its own lifetime, including pending boot/recovery and
queued fresh rebase, without reviving an image or stopping a newer owner. Use exact
session cleanup; role-wide stop is reserved for explicit host-wide controls. Accept
clears only the submitted draft token, preserving edits made while acknowledgment is
pending. Native export must consume retained method/comment text, not mutable source
files that learner code may have overwritten after the compiler notification.

Native refactoring ownership lives in `smalltalk/image/SEBookRefactorings.st`: the
catalog's typed, labeled inputs and native constructors form one declaration. The
JavaScript facade in `js/smalltalk/refactorings.js` exposes catalog/prepare/cancel
through the Workspace queue and Apply/Undo/Redo through its acknowledged checkpoint
transaction. Native `primitiveExecute` builds a separate full-image model; only Apply
executes its saved change. Show every affected definition and warnings for changes
outside the selected target package and undiscoverable dynamic sends. There is no
package access-control policy.

Browser current method/comment source, native model ASTs, and native inverse method
changes read the same retained source ledger. Selections are zero-based UTF-16,
end-exclusive; native conversion rejects split surrogate positions. Preview tokens
and native undo/redo are session-only. Successful ordinary Accept operations (including
comments, raw source files, and resources) clear native history at the accepted-program
boundary. Reconciled source or metadata changes from evaluation/background execution
also clear it; object-only evaluation and source inspection preserve it. This policy
is stricter than the upstream manager's comment/recategorization notification filter.
Failed mutations restore native history with the image, live graph, and ephemeral files.

The native catalog declares 24 enabled operations: rename class/method/instance variable/
class variable/temporary/argument; extract method/temporary; inline method/temporary;
move method/local variable definition; pull up or push down method/variable; add/remove/
reorder parameters; add/remove class/method; and create accessors. `splitClass` is listed
but unavailable: native split loses retained values, leaves components uninitialized,
and lacks verified reverse migration for Undo. Keep that reason visible.

Parameter reordering and removal reject complex caller arguments whose evaluation would
move or disappear; first extract those expressions to temporaries. Temporary inlining
accepts immutable immediate literals or a sole immediately following return use. The
inline-method expression option explicitly warns that substitution can repeat or defer
effects. Hierarchy field moves can discard values, and Code Undo cannot recover them.
Class-removal Undo recreates source and metadata, not the original class identity or
obsolete instances. Instance-variable rename retains declaration order and native slot
values through a local native change adapter; it does not promise arbitrary reflective
or retained-activation equivalence.

Native changes and every returned inverse use the existing RB history manager and the
retained source adapters. Cumulative native export stages inherited layouts, installs
methods, removes obsolete methods, and finalizes class definitions in superclass order.
The real-image matrix is in `tests/smalltalk-refactorings.spec.js` and its catalog fixture
files. Catalog fixture success alone does not prove scheduling isolation: production
Apply/Undo/Redo must also satisfy the separately verified native safe-application gate.

The current distribution explicitly defers refactoring: the single frozen
`SEBookSmalltalk.FEATURES.refactorings` capability in verified `protocol.js` is false.
Browser and popup composition hide refactoring actions. Native catalog/preview/cancel
and Apply/Undo/Redo requests fail with `REFRACTORING_UNAVAILABLE`; history remains
queryable for Workspace lifecycle compatibility. The worker skips guard attachment,
the native service skips trusted-code capture, and native notification/definition
overrides remain uninstalled. Class definition Accept retains its validation and
transaction/checkpoint path while executing through the ordinary workspace compiler
with ordinary scheduling. Source, native packages, and capability-gated refactoring
tests remain preserved for a deliberate later release. Do not advertise compound
isolation while this capability is disabled.

`structural-guard.js` and `SEBookStructuralGuard.st` provide that narrow execution
capability. The VM adapter pins the reviewed VM artifact and binds exclusion to the
existing applying transaction and native Process. Pristine cold startup captures
CompiledCode provenance before ready or learner file-in; checkpoint restoration reuses
those original rooted snapshots and must never recapture learner-modified code. Native
class-definition execution admits only the exact validated definition method for that
mutation. Layout-changing operations conservatively reject retained affected receiver
contexts/closures and unsupported representations. Deferred native notifications replay
after the complete change, inside RB manager history suppression. Failure while held
requires full host checkpoint replacement; never release into a partial image. Ordinary
method Accept, terminal Evaluate and raw-file execution retain ordinary scheduling and
do not promise compound isolation. Keep the guard's real-image tests and supported
domain evidence current when changing the VM, compiler, class builder or notification
paths; it is a language-tool capability, not a security boundary against image reflection.

### Smalltalk popups share the current Workspace owner

`Browser.mount` accepts optional `onDetach(target)` and `onDetachFile(path)` hooks.
The visible Detach System Browser action opens the pane shell; Source views offers
Detach source file for raw authored source. `SourceViews.open({path})` selects that
file. `shared-editor.js` reuses Monaco registration and composes the production
Browser, SourceViews, Inspector and RefactoringView against `PopupWorkspace`.
Popup pages load no RuntimeHost and never create an image. Popup Run calls the
opener's existing TutorialCode Run transaction; its output remains in the tutorial.

`js/smalltalk/popup.js` exposes `PopupWorkspace.connect({port,sessionId})` and the
opener-side `PopupWorkspaceOwner.serve`. TutorialPopoutManager authenticates the
handshake against the registered popup WindowProxy, origin and tab session, then
transfers a private MessagePort with a fresh connection identity. Every command
includes request ID, connection session ID, step key and base revision. This
identity is independent of the reload-persistent BroadcastChannel tab nonce.
BroadcastChannel carries theme only for Smalltalk editor popups; generic file-edit,
final file snapshots and apply-refactor-edits never accept Smalltalk code.

The facade mirrors synchronous snapshots/drafts/history and forwards asynchronous
Workspace operations. Draft messages are ordered before Accept. Pending local edits
overlay owner events until their matching acknowledgment, preserving newer typed
source while another accepted-program event arrives. Browser mirrors selected draft
updates and retains a renamed/removed target's original draft and base revision for
recovery. Stale Accept reports changed source; it never silently rebases the target.
Revert explicitly drops that draft and reconciles every subscribed Browser with its
current accepted source, using native navigation fallback for an obsolete target.
Connection teardown preserves already-received draft edits independently of pending
native work, without executing queued Accepts or reviving a disposed Workspace.

Each connection owns only its returned evaluation/inspection handles and prepared
preview tokens. Workspace evaluation and Prepare results include captured native
`sessionId`; inspection already does. Cleanup passes that identity to
`releaseHandles` or `refactoringQuery('cancelRefactoring',payload,{sessionId})`;
Workspace checks it inside its queue so delayed cleanup cannot affect a newer image.
Connection closure releases/cancels both delivered results and results arriving after
close. Closing a connection never disposes Workspace. Workspace disposal emits one
`runtime` event with `detail.type:'disposed'` before clearing subscriptions, letting
the facade reject pending requests. Tutorial step/view disposal and opener pagehide
also disconnect ports. Popup closure restores the detach control's focus where it
still exists. No new persistence keys, native image storage, or shortcuts are added.

### Smalltalk Browser creation and variable references

Browser's Create package form uses the existing Workspace `createPackage` transaction
at its captured revision. The retained Add/remove class and method implementation
uses the native refactoring preview and Apply flow when that capability is enabled.
An empty package is a native `addClass` catalog
target: the catalog supplies `superclassName: Object`, the selected package category,
and an empty immediate-subclass list. Existing-class creation keeps its selected
superclass. Native input defaults populate controls only when the request does not
supply that option; explicit false, empty strings and empty lists retain precedence.
No Browser control parses Smalltalk or owns a second acceptance controller.

`browse({kind:'variables',target,...})` returns native variable descriptors on each
item: `variable:{kind:'instance'|'class',name}` and a `declaringClass` EntityRef.
Reference navigation submits the explicit additive query
`{kind:'variableReferences',target:<class EntityRef>,variable,offset,limit,search?}`.
`search` remains a result-label filter. The native Browser resolves the declaring
instance-slot hierarchy before its compiled-method access scan, and resolves actual
class-pool association identity for class-variable references across both method
sides. Unrelated same-spelled variables are excluded. Results carry native method
targets and a `scope` explanation. Browser Back/Forward uses those targets unchanged.
The print source preview is exposed once when CSS hides its editing control.


### Deferred Smalltalk refactorings

The single production capability declaration is the frozen
`SEBookSmalltalk.FEATURES.refactorings` in `js/smalltalk/protocol.js`; it is currently
`false`. Tutorial and detached Browser composition do not initialize the refactoring
facade or view while disabled. Refactor, Add/remove class and method, Undo/Redo, and
refactoring history controls are not exposed. Their implementation and native tests
remain for future activation; capability-dependent tests declare the deferral
explicitly instead of weakening their assertions.

Create package uses its ordinary Workspace transaction. Native browsing queries,
Back/Forward, class-side navigation, Versions, and method/class/comment source
Accept remain active. Full Smalltalk terminal evaluation and source-file editing
remain the available routes for defining or removing classes and methods. Do not
add a replacement refactoring path or advertise the deferred GUI controls.

### Smalltalk workspace layout

Browser class and method searches use the whole image when submitted with nonempty
text; empty searches remain scoped to the selected package or class/protocol.
Method search respects the current instance/class side and labels image-wide
results with their defining class. Pagination retains that search scope, and
selecting a result restores its package, class, protocol and source context.
The `*` protocol choice lists all methods on the current class side. It is a
Browser navigation target (`allProtocols: true`), translated to an ordinary class
target before native queries; Back/Forward retains this choice. Re-clicking the
selected class, or pressing Enter while its Classes list has focus, reopens the
class definition without discarding method navigation history.

`js/smalltalk/layout.js` owns only transient tutorial layout state. The right-hand
Output / terminal dock starts at 204px on laptop screens and offers Collapse and
Expand; Focus source editor temporarily hides instructions and browsing controls
and collapses the dock. Restore layout preserves the prior dock state. These
actions retain mounted Monaco editors, drafts, selection, terminal history and the
same Workspace/image. Recovery announcements remain outside the collapsible body.
There is no layout persistence or additional keyboard shortcut.

Tutorial Browser composition uses compact native Search and Browser tools
disclosures; standalone and detached tools retain their existing composition.
Native queries replace the pane lists while open, with synchronous focus transfer
from the closing tools disclosure. The terminal keeps its expression, Evaluate and
latest result visible; history, Transcript and help are disclosed on demand.
Opening terminal details or an inspected object expands the dock without rebuilding
views. CSS owns geometry, both themes and print. Below 901px wide or 650px high the
workspace returns to document flow; print exposes output even if its dock was
collapsed. Preserve paragraph-size controls and heading sizes when changing this
layout, and measure actual unoccluded Monaco rows rather than editor rectangle
height alone (`tests/smalltalk-workspace-layout.spec.js`).
