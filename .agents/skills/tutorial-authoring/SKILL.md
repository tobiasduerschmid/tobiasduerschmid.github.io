---
name: tutorial-authoring
description: Authoring guide and architecture reference for the SEBook in-browser tutorial system. Use this skill EVERY TIME you create, edit, review, restructure, or extend anything that touches `_data/tutorials/*.yml`, the `_layouts/tutorial.html` / `_layouts/print-tutorial.html` layouts, the `tutorial-*-popup.html` popout windows at the repo root, the `js/tutorial-*.js` runtime (`tutorial-code.js`, `tutorial-quiz.js`, `tutorial-popout-manager.js`, `tutorial-popout-client.js`, `tutorial-refactorings.js`), backend workers (`pyodide-worker.js`, `sql-worker.js`, `java-worker.js`, `prolog-worker.js`, `playwright-compat/*`), the time-travel debugger under `js/debugger/`, the autosave / progress / reset machinery, the in-tutorial quiz / hint / test schemas, the print view, the SE Gym tutorial-progress import/export flows, the `SEBook/<section>/<slug>-tutorial.md` + `SEBook/<section>/<slug>-tutorial/print.md` page-pair convention, the `/SEBook/tutorials` auto-generated index, or any new feature added to the tutorial runtime. Also trigger on requests like "add a new tutorial on X", "add a step to <tutorial>", "convert this lecture into a tutorial", "design a quiz / hint / test for step N", "set up a print view for this tutorial", "add a new tutorial backend", "wire up a new popout window", "add a new YAML field to the tutorial schema", "review this tutorial draft", "audit tutorials for PRIMM / spaced practice / Bloom coverage", or any task that involves the tutorial runtime, schema, or content. **You MUST update this SKILL.md whenever you add, rename, remove, or change the semantics of a tutorial-runtime feature** — new YAML fields, new backends, new popout windows, new test runners, new quiz / hint mechanics, new autosave / reset modes, new debugger capabilities, changed permalink conventions, or any architectural change that an author or future agent needs to know to build or modify a tutorial correctly. Out-of-date schema or architecture notes here cause real downstream bugs (broken tutorials, missing print views, mis-shaped quizzes, lost progress).
---

# SEBook tutorial authoring & architecture

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

Step `tests:` are the gate that lets a student advance. They have two
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

### Multi-layered hints

Hints are the project's primary way to keep students unstuck without giving
the answer. Conventions:

- **Three hints minimum** for any non-trivial test. The first is *least*
  revealing.
- **Layer 1 — orientation.** Re-state the goal in different words, point at
  the relevant section of the docs / earlier step. No code.
- **Layer 2 — strategy.** Name the technique to use ("you'll need a
  `dict.get()` with a default value") without showing the code.
- **Layer 3 — structural skeleton.** Show the *shape* of the solution with
  the interesting parts as `...` or named blanks. Never paste the literal
  solution.
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
- [ ] **Consult `cs-tutorial-design` and `pedagogy-advisor` agents.**
      These are subagents (when present) specialized in CS pedagogy and
      tutorial-system design — give them the tutorial draft for review
      before you commit. If those subagents aren't installed locally,
      mirror their checklist here: PRIMM coverage, Bloom mix in quizzes,
      misconception coverage in `option_feedback`, scaffolding fade,
      spaced practice across steps.

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
- [ ] **Solutions live in `solution:`, not in `instructions:`.**
- [ ] **Hints are multi-layered** (≥3 layers for non-trivial tests),
      with `condition:` where useful, and **never reveal the literal
      solution**.
- [ ] **Tests cover all required behavior** *and* **only the required
      behavior** — see "Tests should be precise" above. Mentally run 3
      wrong solutions and 2 alternative correct solutions against each
      test.
- [ ] **In-tutorial quizzes**: recall + spaced + higher-Bloom only. Never
      introduce new content in a quiz. Re-quiz at least one earlier-step
      concept by step 5+.
- [ ] **`option_feedback` written for the wrong distractors** that name a
      real misconception (per the `quiz-format` skill). Skip feedback for
      distractors that are obviously wrong — fix or cut the distractor
      instead.
- [ ] Diagrams added where they earn their place; type & syntax chosen
      via the `diagrams` skill; pedagogy checked via `good-diagrams`.

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

# === Backend selection ===
backend: v86 | pyodide | webcontainer | react | uml-editor   # default: v86

# v86           — full Linux VM (shell, gcc, git, etc.). Most tutorials.
# pyodide       — Python in-browser, no shell. Required for `debugger: true`.
# webcontainer  — Node.js + npm + dev server (StackBlitz). Needs COOP/COEP.
# react         — React + Vite + live preview iframe + Playwright-compat.
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
                                       # Works on every backend (v86, pyodide,
                                       # webcontainer, react, browser, sql,
                                       # prolog, java, uml-editor) plus the
                                       # instructions popout. Implementation:
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
debugger: boolean                      # Time-travel debugger (pyodide only).
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
make_dag: /path/to/dir                 # v86 only. Live SVG pane that visualises
                                       # the dependency graph `make -n` would
                                       # walk for the Makefile in <dir>.
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
                                       # mtimes into <dir>/.makedag_state.
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
setup_commands: [string]               # Run once at tutorial load.
                                       # bash for v86, python for pyodide.
post_fileload_setup: [string]          # Run after files are synced.
user_command_listener: string | null   # JS callback name for command events
                                       # (used by git-playground).

# === Autosave / progress / reset ===
autosave_type: files | commands-and-files | false    # default: files
reset_type:    files | commands                       # default: files
# autosave: what is persisted to localStorage between visits.
#   files                 — current contents of every editor.
#   commands-and-files    — also replay saved solution commands on restore.
#   false                 — no persistence. (Demos / lectures.)
# reset:    what "Reset Step" replays.
#   files                 — restore step's starter files only.
#   commands              — also replay setup_commands + prior solution
#                           commands to restore VM state.

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
    instructions: |                          # Required. Markdown.
      Multi-paragraph step instructions.
      Code blocks Rouge-highlighted.

    files:                                   # Starter files for this step.
      - path: string                         # e.g. "/tutorial/main.py"
        content: |
          # File content
        language: python                     # Monaco language id.
        pane: editor | tests | preview       # Which Monaco pane to load
                                             # the file into. default: editor.
        print_language: python               # Override syntax highlight in
                                             # the print view.

    open_file: string                        # Which file to focus on load.
    view: editor | git_graph | uml | make_dag    # Override default pane visible.
                                             # `make_dag` requires a top-level
                                             # `make_dag:` config; opens the
                                             # live Make dependency graph.
    step_dir: /absolute/path                 # v86 / webcontainer only. When
                                             # this step opens, drop the user's
                                             # interactive terminal into the
                                             # specified directory (a `cd` is
                                             # injected into the same bash
                                             # session via _runSilent, so the
                                             # PWD persists for everything the
                                             # student types next). Used by
                                             # multi-step build / Make tutorials
                                             # where every step works in the
                                             # same project directory and
                                             # forcing the student to
                                             # `cd <dir>` at every step is
                                             # friction without learning value.
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

    tests:                                   # Step gate (when require_tests).
      - description: "What this verifies"
        command: |                           # The assertion code.
          # bash for v86: `test -f /tutorial/foo.py`
          # python for pyodide: `output = __run_capture('/tutorial/x.py');
          #   assert "expected" in output`
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
      questions:
        - type: single | multiple | parsons
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

---

## 4. Architecture map

### 4.1 Layouts

- **`_layouts/tutorial.html`** (~700 lines) — the live, interactive layout.
  Wires `TutorialCode` (from `js/tutorial-code.js`), injects the parsed YAML
  config as JSON, sets up the navbar (Reset, Solution in instructor mode,
  Print, Read Aloud, Dark mode toggle), and instantiates the Monaco editor
  + chosen backend.
- **`_layouts/print-tutorial.html`** (~900 lines) — the static, printable
  view. Renders every step's instructions, files (Rouge-highlighted),
  quizzes (with correct answers visibly marked), and solutions (hidden
  unless `?instructor-mode=true` is in the URL). The Print button on the
  live tutorial redirects to `<live-permalink>/print?autoprint=1` (preserving
  `?instructor-mode=true` if set).

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
- `tutorial-output-popup.html` — stdout / stderr / preview iframe.
- `tutorial-debugger-popup.html` — time-travel debugger UI (pyodide).
- `tutorial-pane-popup.html` — single editor pane (test or code file).
- `tutorial-tab-popup.html` — single code file in Monaco.
- `tutorial-graph-popup.html` — Git commit graph (SVG).

Each popout listens for state-snapshot, state-update, and step-change
messages on the BroadcastChannel and re-renders accordingly.

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

- **`js/tutorial-code.js`** — the unified tutorial runtime. Editor
  management, file I/O, test execution, autosave / restore, step
  progression, quiz gating, debugger sync. Where most behavioral changes go.
  `applySolution()` returns a Promise; tests and runtime code that reveal
  solutions must await it before running step tests or advancing state, and it
  must wait for any active first-visit `setup_commands` chain before it mutates
  files or runs solution commands. In v86, it also uses a no-op shell prompt
  barrier before applying the solution; keep that barrier when editing this
  path so setup input cannot race with solution input. Setup and visible
  solution batches may contain multi-command Git workflows, so keep their
  timeouts long enough for the shell prompt to return instead of resolving
  against a partially applied repository state.
- **`js/tutorial-quiz.js`** — shared quiz renderer (used by main page and
  the instructions popup). `single` / `multiple` / `parsons` types,
  `min_score` gating, `option_feedback` rendering. Tutorial quiz answer
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
- **`js/tutorial-refactorings.js`** — Monaco refactoring helpers
  (rename, extract, inline) used by the refactoring tutorials.
- **`js/debugger/*.js`** — time-travel debugger: `sync.js`,
  `ui-render.js`, `editor-attach.js`, `main.js`, `worker-extension.js`.
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
- **Backend workers** — `js/pyodide-worker.js` (Python),
  `js/sql-worker.js`, `js/java-worker.js`, `js/prolog-worker.js`,
  `js/playwright-compat/runner.js` (in-browser Playwright for React),
  `js/pyodide-git.js` / `js/pyodide-unix.js` (POSIX mocks).

### 4.6 Backends — what each supports

| Feature                | v86 | pyodide | webcontainer | react | uml-editor |
|------------------------|-----|---------|--------------|-------|------------|
| Shell terminal         | ✅  | ❌      | ✅           | ❌    | ❌         |
| Compiled languages     | ✅  | ❌      | (npm only)   | ❌    | ❌         |
| `git`                  | ✅  | mocked  | ✅           | ❌    | ❌         |
| Time-travel debugger   | ❌  | ✅      | ❌           | ❌    | ❌         |
| Live preview iframe    | ❌  | ❌      | ✅           | ✅    | ❌         |
| Playwright tests       | ❌  | ❌      | ❌           | ✅    | ❌         |
| UML assertion tests    | ❌  | ❌      | ❌           | ❌    | ✅         |
| `pytest`               | ❌  | ✅      | ❌           | ❌    | ❌         |
| Linter                 | ✅  | ✅      | ✅           | ✅    | ❌         |

If you add a backend, update this table.

### 4.7 Autosave / progress storage

Per-tutorial localStorage key: `tutorial-<tutorialId>` →

```json
{
  "step": 0,
  "stepsPassed": [0, 1],
  "quizPassed": [0],
  "stepsUnlocked": [0, 1, 2],
  "stepsVisited": [0, 1],
  "files": { "path": "content" }
}
```

The SE Gym page (`/se-gym`) has Import / Export / Delete UI for these
keys. **If you change the persistence schema, also update**:
`js/tutorial-code.js` (the storage code), the SE Gym import/export UI in
`se-gym.html`, the storage inventory at `/cookies/` (per
`cookie-storage-tracker` skill), and this skill.

A separate `tutorial-cooldown-<tutorialId>` localStorage key holds the
"Test My Work" cooldown end timestamps when `cooldown_seconds:` is set
on a tutorial. Shape: `{ "<stepIndex>": <unix-ms-end-time> }`. Stored
under the same prefix family as other tutorial state so the global
"Delete all tutorial state" button on `/cookies/` clears it.

### 4.8 Test execution

- **bash** (v86 / webcontainer): `command:` is shell. Exit 0 = pass.
- **python** (pyodide): `command:` is Python with the helper
  `__run_capture('/path/to/script.py')` returning captured stdout. Use
  `assert <expected> in output, "<friendly fail message>"`.
- **playwright** (react): `command:` is Playwright-compat JS run by
  `js/playwright-compat/runner.js` (a subset of `@playwright/test`).
  Reference selectors via `page.getByRole(...)`, `page.getByText(...)`.
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
| Pedagogy review of a tutorial draft | `cs-tutorial-design` and `pedagogy-advisor` subagents (when installed). If unavailable, mirror their checks: PRIMM coverage per step, Bloom mix in quizzes, misconception-grade `option_feedback`, scaffolding fade across steps, spaced practice across steps, `tests` precision against 3 plausible wrong solutions and 2 alternative correct ones, hint laddering. |

---

## 7. Quick reference — minimal new-tutorial template

When starting from scratch, use this as a skeleton and fill in. Add YAML
comments above each step naming the PRIMM phase and any pedagogy.

```yaml
# _data/tutorials/<slug>.yml
title: "<Tutorial title>"
description: "<one-sentence student-facing summary>"

backend: pyodide                         # or v86 / webcontainer / react
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
