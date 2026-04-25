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
shuffle: true                   # optional, default true — randomizes question + option order
questions:
  - <question>
  - <question>
```

There is also a meta form for assembling quizzes from sub-decks:

```yaml
title: "Combined Quiz"
description: "Pulls from multiple decks"
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

## Question shapes

### `type: single` (default)

```yaml
- id: 1                         # optional — used for analytics (PersonalGym)
  type: single                  # may be omitted (default)
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

**Parsons does not support `option_feedback`.** There's no per-line model for misconception feedback — the granularity here is order/inclusion, not selection from alternatives. If you have specific misconceptions about ordering, encode them in `explanation:`.

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
| Liquid integer-key access fails | Quote the keys as strings (`"0":`); the rendering layer falls back to string keys. |
| Print view missing feedback | Check the relevant `@media print` block — there are three (tutorial.css, quiz.html inline, print-tutorial.html inline). |
| Markdown not rendering in feedback | Make sure the Liquid template runs `| markdownify` (it does, in `_includes/quiz.html` line ~119). |
