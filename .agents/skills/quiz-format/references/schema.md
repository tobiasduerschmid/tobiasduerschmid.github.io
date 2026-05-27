# Quiz schema reference

This is the long-form reference — the SKILL.md cheat sheet covers the common path. Read this when you're authoring an unusual question type, debugging a Liquid render issue, or onboarding a new contributor.

## Where quiz files live

| File location | Used by | Top-level shape |
|---|---|---|
| `_data/quizzes/<id>.yml` | SEBook chapter pages (via `{% include quiz.html id="<id>" %}`) and SEGym workouts (cookie-driven) | Standalone quiz with `title`, `description`, `questions[]` |
| `_data/tutorials/<name>.yml` | In-tutorial step gates (via `js/tutorial-quiz.js`) | Each step's `quiz:` key holds the same shape, plus `min_score`, `shuffle` |
| Tutorial popup | Receives pre-rendered HTML over BroadcastChannel — uses the same engine | (transparent — no separate authoring) |

## Standalone quiz file (`_data/quizzes/`)

```yaml
title: "Quiz Title"            # required — shown in the quiz header
description: "One-line."        # optional — shown under the title
active: true                    # optional, default true — set false to hide from the SE Gym library
shuffle: true                   # optional, default true — randomizes question + option order
questions:
  - <question>
  - <question>
```

`active: false` only hides the quiz from the SE Gym listing (`/se-gym/`). Page embeds via `{% include quiz.html id="..." %}` and existing personal-gym entries (already saved in a learner's localStorage) keep working — the engine still has the data, the library just doesn't advertise it.

There is also a meta form for assembling quizzes from sub-decks:

```yaml
title: "Combined Quiz"
description: "Pulls from multiple decks"
active: true                                              # same semantics as above
decks: [design_pattern_command, design_pattern_state]
```

When `decks:` is present, the include flattens `questions:` from each named deck. Don't mix `decks:` with a sibling `questions:`.

## Tutorial-step quiz (`_data/tutorials/`)

```yaml
- title: "Step 5 — TDD basics"
  instructions: |
    ...markdown...
  quiz:
    title: "Knowledge Check"
    min_score: 0.8              # optional, default 0.8 — fraction needed to advance
    shuffle: true                # optional, default true
    questions:
      - <question>
```

The student must score ≥ `min_score` to unlock the next step. `min_score: 1` is fine (perfect score required). `min_score: 0` effectively disables the gate but still shows feedback.

## Choosing a question type

Pick the type that matches the cognitive level you're testing. The wrong type quietly demotes a high-Bloom objective to recognition — an Apply-level objective evaluated by recognition-level questions trains pattern-matching, not synthesis.

| Bloom level | What the student does | Right tool |
|---|---|---|
| Remember | Recall a fact, definition, or rule | `single` MCQ with paraphrased stem |
| Understand | Explain or interpret an idea | `single` MCQ where distractors encode partial understandings |
| Apply | Use a concept on a *novel* scenario | `single` or `multiple` with a fresh scenario in the stem and distractors that encode procedure-misuse |
| Analyze | Discriminate across a set of items | `multiple` forcing exhaustive selection across the set |
| Procedural sequencing | Arrange steps into a working solution | `parsons` |
| Apply / Create (writing code) | Produce code from scratch | **Not a quiz.** Use a coding exercise (the tutorial's code editor + assertions). |

**Two diagnostic questions to ask before drafting:**

1. *Is the stem novel?* For Apply/Analyze, the student must not have seen the exact scenario in the tutorial. If your stem is verbatim from the lesson, you're testing Remember.
2. *Could the student answer by recognising syntax alone?* If yes, you're testing typing, not understanding. Replace at least one distractor with a *semantic* near-neighbour (a legal alternative encoding a real wrong belief), or convert the question to `parsons`. See "Distractor design" below.

## Stem design

The stem (`question:` field) is what the student reads first and holds in working memory while evaluating options. Five rules keep it pulling its weight:

1. **Paraphrase, don't quote the lesson.** Verbatim text from the tutorial cues recall (Bloom Remember), not understanding. If the stem reads identically to a sentence in the lesson, the question is testing memory of phrasing.
2. **No filler.** "for cleanup before merging" or "as a best practice in modern projects" pads without changing the construct under test. Trim until every clause carries the question.
3. **Comparable shape and length, key vs distractors.** A noticeably longer or more-qualified key leaks the answer to test-wise students (Rodriguez 2005). Two concrete bars: (i) the correct option's visible length should be **≤ ~1.8x** the median wrong-option length, and (ii) the correct option should **not be strictly the longest by more than ~15 characters** — a student who scans the four options at a glance picks the visibly longest one regardless of the ratio. Aim to land the key **within ~15 chars of the longest distractor**. Any markdown emphasis (`**bold**`, `*italic*`, `` `code` ``) used in the key must also appear in at least one distractor — otherwise the formatting itself becomes a tell. The fix when the correct answer naturally needs more qualification is to **shorten the key** and move the qualifying parentheticals into `option_feedback` or `explanation`; padding the distractors instead makes the quiz tedious and dilutes each distractor's misconception. Run `scripts/audit_mcq_tells.py` to flag all three patterns mechanically.
4. **Bold the negative if you must use it.** "Which is **not** valid?" — students miss the unbolded negative regularly. Better: rewrite as a positive question.
5. **Stem and distractors must be consistent.** If the stem shows observed behavior (output, error, code trace, a comment like `# → [1, 2]`), every distractor must propose a mechanism *compatible with that observation* — see "Distractor design" → test 6 below for the full rule.

For code stems specifically, the **cognitive-load budget** is set in `pedagogy.md` Principle 4: keep the stem ≤5 lines when options also contain code, and aim for options that differ along *one* dimension.

## Question shapes

### `type: single` (default)

```yaml
- id: 1                         # optional — used for analytics (PersonalGym)
  type: single                  # may be omitted (default)
  difficulty: intermediate      # optional — basic | intermediate | advanced | expert
  question: |
    Markdown question text. Can include code blocks, lists, tables.
  options:
    - "Option A (markdown OK)"
    - "Option B"
    - "Option C"
    - "Option D"
  correct_index: 1              # 0-based index into options
  option_feedback:              # optional sparse hash, keyed by option index
    0: "Misconception note for option 0"
    2: "Misconception note for option 2"
  explanation: |
    General explanation, shown for both correct and incorrect outcomes.
```

`difficulty` is optional and only applies to standalone SEBook + SEGym quizzes (not tutorial-step quizzes). Permitted values are `basic`, `intermediate`, `advanced`, `expert` (case-insensitive). The same field is supported on flashcards in `_data/flashcards/*.yml`. SEBook embeds always show the difficulty as a color-coded chip with text label; SEGym lets the learner toggle whether the chip shows during the question (the chip always shows on the explanation panel) and lets them check off levels to exclude from the next workout.

### `type: multiple`

Several options can be correct; the student must select all of them (and only them, unless they're in `optional_indices`).

```yaml
- id: 7
  type: multiple
  question: "Which of the following are characteristics of a good unit test?"
  options:
    - "Tests one specific behavior"
    - "Runs in milliseconds"
    - "Has a descriptive name"
    - "Hits the real database"
  correct_indices: [0, 1, 2]    # all of these must be selected
  optional_indices: []          # may be omitted — selecting these is acceptable but not required
  option_feedback:
    0: "Omission feedback if student fails to select option 0"
    3: "Commission feedback if student wrongly selects option 3"
  explanation: "Good unit tests are F.I.R.S.T. — Fast, Isolated, Repeatable, Self-checking, Timely."
```

`optional_indices` is for "acceptable but not required" answers. The student can select them or skip them — neither is wrong. This is useful when an option is *defensible but not load-bearing* — it shouldn't penalize the student either way.

### `type: parsons`

The student must arrange code lines into a correct order. Distractors are extra lines that should not be used.

```yaml
- id: 11
  type: parsons
  question: "Arrange the steps to introduce the Command pattern:"
  display: block                # 'block' (default) for one line per row, or 'inline' for inline tokens
  lines:                         # the correct order
    - "Identify the dispatcher (the if-else chain or method-by-name lookup)"
    - "Extract each branch's body into its own ConcreteCommand"
    - "Replace the dispatch logic with `cmd.execute()`"
  distractors:                   # optional — extra lines that should not be placed
    - "Move the receiver into the invoker"
  explanation: "The direction is from concrete dispatch logic to polymorphism."
```

#### When to choose Parsons over MCQ

Parsons is the right tool when the student already understands each line in isolation but you want to test the *ordering* schema — control-flow shape, sequencing of state changes, dependency between steps. It removes syntax-recall load (Sweller's germane focus) while still demanding structural reasoning. Choose Parsons over a "which version compiles?" MCQ when your goal is to teach the *shape* of a solution. Choose MCQ over Parsons when discrimination between conceptual neighbours matters more than ordering.

#### Length

4–8 correct lines hits the working-memory sweet spot for novel algorithms — that's the default to aim for. Standard algorithms with a clean iterative or recursive skeleton (binary search, BFS/DFS, classic recursion patterns) often run **9–12 lines** and remain usable: the schema is familiar enough that intrinsic load stays bounded. **Past 14**, the task degrades into a slot-puzzle and intrinsic load swamps the schema work — split the question, omit lines that don't carry the construct, or move to a code-execution exercise.

Whatever your line count, **count the lines before shipping** — authoring agents commonly believe they're inside the cap when they're not. If you've shipped 11 lines, name it ("11 lines — within the standard-algorithm band"); don't claim "kept within 4–8" when it's not.

#### Distractor design (for Parsons)

Each Parsons distractor should encode a specific wrong mental model: an off-by-one boundary, a wrong order of dependent steps, a step that belongs to a *different* algorithm. Avoid syntax-only distractors ("same line with `==` instead of `=`") — those test typing, not structure. Aim for 1–2 distractors max; each one doubles the search space.

#### `display: inline` vs `block`

Use `inline` for expression-level ordering (function-composition pipelines, regex tokens, single-line statement reordering). Use `block` (default) for statement-level ordering — the typical case.

#### Why no `option_feedback`

Parsons error modes are combinatorial (n! orderings); per-line feedback would explode and cannot map cleanly to a single misconception. **Parsons does not support `option_feedback`.** Encode the top 1–2 ordering misconceptions in `explanation:` ("a common error is putting the recursive call before the base case — that produces infinite recursion"). The granularity here is order and inclusion, not selection from alternatives.

## Distractor design (read before drafting options)

A wrong answer earns its place by encoding a *specific* wrong mental model. Item-writing literature (Haladyna 2004; Rodriguez 2005 on three- vs. four-option items) is unanimous on what makes a distractor work — and a distractor that fails these tests is unrescuable by feedback.

### Five tests every distractor must pass

1. **Plausible to a partial-knower.** Wrong for a *reason* a student might actually hold, not wrong because it's silly or off-topic. If you cannot finish the sentence *"a student picks this because they are thinking…"*, cut the distractor.
2. **Misconception-grounded.** Encodes a specific neighboring concept, procedure-misuse, or partial knowledge — not random noise. Distractors that fail this test waste a slot and dilute discrimination.
3. **Variation-clean.** Differs from the correct answer on *one* critical feature where possible. A distractor that varies on two dimensions at once (e.g. wrong operator AND wrong order) makes it ambiguous which mental model the item is testing — and which one the feedback is correcting.
4. **Homogeneous with the key.** Parallel grammatical form, comparable length, similar level of qualification, and matching markdown emphasis. A noticeably longer or more-qualified key leaks the answer to test-wise students (Rodriguez 2005); so does `**bold**` / `*italic*` / `` `code` `` that appears only in the correct option. Two concrete bars: (i) key length ≤ ~1.8x the median wrong-option length; (ii) the key is **not strictly the longest by more than ~15 chars** — students notice the visibly longest option even when the ratio is borderline. Any formatting used in the key must also appear in at least one distractor. Avoid "all of the above" / "none of the above" — they encode test-taking strategy, not understanding. The `scripts/audit_mcq_tells.py` lint catches all three patterns mechanically.
5. **Free of cueing.** No grammatical agreement leaks (e.g. *"a"* before an option that starts with a consonant), no copy-paste from the lesson signaling the right answer, no negative phrasing without bolding the negative.
6. **Consistent with what the stem shows.** When the stem includes observed behavior — output (`# → [1, 2]`), an error, a code trace, or any "given" — every distractor must propose a mechanism that *would produce that observation*. A distractor that implies "the shown output is actually different" or proposes a mechanism that would output something else is asking the student to disbelieve the stem; that's a different (epistemic) question, not the mechanism question you're posing. A partial-knower can rule out such distractors without engaging the construct, which fails test 1. If you genuinely want to test "is the shown output correct?", reframe the stem to ask that explicitly.

### Three-option items are often better than four

If your fourth distractor would be a filler that fails the five tests above, **ship three options** (Rodriguez 2005). Three plausible distractors beat four where one is obviously wrong. Don't pad to four out of habit.

### Distractor taxonomy for code questions

Three useful categories, in descending pedagogical value:

1. **Semantic near-neighbours** (best). The option compiles/parses but means something different — `WHERE SUM(x)` instead of `HAVING SUM(x)`, `n > 0` as a base case instead of `n == 0`, sequential `await` instead of `Promise.all`. These encode real mental models and earn a high-quality `option_feedback` entry.
2. **Wrong-construct substitutes** (good). A different but legal construct that a confused student would pick — `&&` instead of `|`, `()` instead of `[]` for a list comprehension, `is` vs `==`. Earns feedback if a coherent confusion explains the choice.
3. **Syntactically malformed** (use sparingly). Unbalanced parens, made-up keywords, code that won't compile. Useful only for difficulty calibration in early-novice items; do *not* attach `option_feedback` to these — there's no mental model to correct. If most of your distractors are category 3, the question is testing syntax recognition, not understanding — rewrite the distractors as category 1, or convert the question to a Parsons.

A distractor passing all five tests typically *deserves* an `option_feedback` entry — they correlate.

## `option_feedback` — full triggering semantics

Keys are integer indices into `options[]`. Both integer keys (`0:`) and quoted-string keys (`"0":`) work — the rendering layer accepts both. Prefer integer keys for clarity.

| Question type | Option `i` is in… | Student action | Feedback fires? |
|---|---|---|---|
| single | `correct_index` | picked it | no |
| single | not correct | picked it | **yes** (commission) |
| single | not correct | didn't pick it | no |
| multiple | `correct_indices` | selected | no |
| multiple | `correct_indices` | omitted | **yes** (omission) |
| multiple | `optional_indices` | either way | never |
| multiple | wrong (not in correct ∪ optional) | selected | **yes** (commission) |
| multiple | wrong | omitted | no |
| any type | — | answer fully correct | no callouts at all |

### Print views

In print:
- `_layouts/print-tutorial.html` (tutorial print page): renders all `option_feedback` entries below their respective options in the printed answer key.
- `@media print` rules in `css/tutorial.css` and `_includes/quiz.html`: force all `.option-feedback` divs visible regardless of student state.

This means option_feedback doubles as instructor's notes for printed answer keys.

## Markdown rendering

`question`, `options[]`, `explanation`, and `option_feedback` values all support Markdown — paragraphs, code spans, fenced code blocks, lists, **bold**, *italic*, links. Avoid raw HTML; use Markdown.

For multi-line content, use the YAML pipe syntax:

```yaml
question: |
  Multi-line question text
  preserves newlines.

  Including blank lines for paragraphs.
```

For code blocks inside YAML, indent consistently and prefer fenced blocks:

````yaml
question: |
  ```python
  def factorial(n):
      return n * factorial(n - 1)
  ```
  What's missing?
````

## Engine internals (for debugging)

When something renders wrong, look at:

| Symptom | Likely culprit |
|---|---|
| Feedback shows above the wrong option | The `_includes/quiz.html` shuffle loop isn't moving the feedback div with its button. |
| Feedback never appears for tutorial quizzes | `q.option_feedback` not propagating through the `buildHTML()` map in `js/tutorial-quiz.js`. |
| Liquid render glitches with integer keys | The rendering layer accepts both integer and string keys (see "full triggering semantics" above) — quoting as strings (`"0":`) is the safe fallback if a Liquid render misbehaves. Integer keys remain the recommended default. |
| Print view missing feedback | Check the relevant `@media print` block — there are three (tutorial.css, quiz.html inline, print-tutorial.html inline). |
| Markdown not rendering in feedback | Make sure the Liquid template runs `| markdownify` (it does, in `_includes/quiz.html` line ~119). |
