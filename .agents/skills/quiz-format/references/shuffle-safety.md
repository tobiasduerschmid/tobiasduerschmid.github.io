# Shuffle safety — long form

Read this when you're auditing a quiz file for letter-position references, fixing a flagged offender, or designing a new question that you suspect might fall into the trap. The SKILL.md cheat sheet covers the rule; this file covers the mechanics, the audit recipe, and several worked examples.

## How shuffling actually works

| Surface | Shuffles options? | Shuffles questions? | Default | Settable? |
|---|---|---|---|---|
| `_data/quizzes/<id>.yml` rendered via `_includes/quiz.html` | yes | yes | shuffle on | top-level `shuffle:` key |
| `_data/tutorials/<name>.yml` step `quiz:` rendered via `js/tutorial-quiz.js` | yes | yes | shuffle on | `shuffle:` inside the step's `quiz:` block |
| Tutorial popup (BroadcastChannel render) | yes | yes | inherits | inherits |
| Print views (`@media print`, `print-tutorial.html`) | **no — always YAML order** | no | n/a | n/a |

The render-time shuffle is a Fisher-Yates pass on the options array (and a separate pass on the questions array when shuffling is on at the question level). It runs once per page load — within a single session the order is stable, but across reloads or across students, the order is randomized.

What the student sees as "A, B, C, D" is *purely a label the renderer assigns to whatever ended up at positions 0, 1, 2, 3 after the shuffle*. There is no stable mapping back to YAML indices in the rendered text.

The exception is print views, where shuffling is intentionally skipped so that printed answer keys retain a canonical order. That's why a letter reference might *look* fine when you print the answer key — but the live web quiz is what students actually take.

## What `option_feedback` does (and why it's shuffle-safe)

The keys in `option_feedback:` are 0-based indices into the YAML `options:` list. The renderer carries the indices through the shuffle: when option YAML-index-1 is moved to display position D, its `option_feedback[1]` follows it. The student picks "D"; the renderer fires `option_feedback[1]`; the right correction lands.

That's the whole point — `option_feedback[i]` is bound to *content* (the option at YAML index `i`), not to *position* (the letter the student saw).

## The trap (anti-patterns)

Anything in plain prose that names an option by its rendered position is unstable:

```yaml
# BROKEN — letters
explanation: "Option A is wrong because… Option C confuses…"

# BROKEN — ordinals
explanation: "The first option assumes X. The third choice misreads Y."

# BROKEN — spatial
explanation: "The option above is the trap; the one below is what you want."

# BROKEN — quantifiers
explanation: "Options A and B both swallow exceptions; D is correct."
```

All of these break under shuffle. If your `explanation` mentions any specific wrong option, that reasoning belongs in `option_feedback[i]`.

## Stable references (these are fine)

Three patterns survive shuffling:

### 1. Content-anchored prose

Refer to options by what they *do*, not where they sit:

```yaml
# OK
explanation: "The spread-operator approach creates a new object reference, which is what triggers React's re-render. The mutating approaches reuse the existing reference and React skips the update."
```

This works regardless of which letter the spread-operator option ended up under.

### 2. Code-block labels in the question body

If the question itself names code blocks "Option A" / "Option B" as part of the *question text* (e.g. as `// Option A` comments inside a code snippet), those labels are stable — they're part of the question, not the answer-position list. The answer choices then reference those code-block names.

Canonical example: `_data/tutorials/nodejs.yml` ~line 2524:

```yaml
- question: |
    Two independent API calls each take 100ms. Which approach is faster?
    ```javascript
    // Option A
    const a = await fetchA();
    const b = await fetchB();

    // Option B
    const [a, b] = await Promise.all([fetchA(), fetchB()]);
    ```
  options:
    - "Option A — sequential awaits are optimized by V8 to run in parallel"
    - "Both are the same — await does not affect execution time"
    - "Option B — `Promise.all` starts both operations concurrently, so total time is ~100ms instead of ~200ms"
    - "Option A — `Promise.all` adds overhead that makes it slower for only two Promises"
  correct_index: 2
  explanation: "Option A awaits fetchA first (100ms), then starts fetchB (another 100ms) — total ~200ms. Option B starts both immediately and waits for the slower one — total ~100ms."
```

Here "Option A" and "Option B" in the explanation refer to the *code blocks* labeled as such in the question, not to answer positions. Even after the answer choices shuffle, the code-block labels stay put because they're inside the (unshuffled) question text. This pattern is fine.

The rule of thumb: if removing the question text would make the explanation ambiguous, the references are content-anchored (good). If the explanation could only be reconstructed by counting answer positions, the references are position-anchored (broken).

### 3. `correct_index` / `correct_indices`

These are renderer-internal — never shown to the student as letters. The renderer translates them through the shuffle automatically. You don't need to do anything.

## Audit recipe

Run this against the project root:

```bash
grep -rn "Option [A-D]\b\|\b\(first\|second\|third\|fourth\|last\) \(option\|answer\|choice\)\b\|\bthe option \(above\|below\)\b" \
  _data/tutorials _data/quizzes \
  | grep -v "_old\." | grep -v "_backup\." | grep -v "option_feedback"
```

For each hit, decide:

1. **Is it inside a `question:` block** that names code-block labels (the stable code-label exception)? → Leave it.
2. **Is it a tutorial design choice** named "Option A/B" outside any quiz block (e.g. instructional prose offering two refactor approaches)? → Leave it. These are not multiple-choice answers; they're labels in tutorial body text.
3. **Is it inside an `explanation:`, or in quiz-question prose, mentioning an answer choice by letter or position?** → Fix it (see below).

When fixing:

- Identify each wrong-option clause in the explanation and the YAML index of the option it refers to.
- Add an `option_feedback:` entry keyed by that 0-based YAML index, containing the per-option reasoning.
- Trim the `explanation:` to cover only the correct answer or the underlying principle.
- Re-grep to confirm zero remaining letter/ordinal references.

## Worked examples

These are real before/afters from the project — fixed during the April 2026 audit.

### Example 1 — `_data/tutorials/shell-scripting.yml` (pipelines)

Before:

```yaml
- question: "Which pipeline correctly counts admin WARN events?"
  options:
    - "`grep \"WARN\" server.log | grep \"admin\" | wc -l`"
    - "`cat server.log | grep \"WARN\" && grep \"admin\" > wc -l`"
    - "`grep \"WARN\" server.log > grep \"admin\" | wc -l`"
    - "`wc -l $(grep \"WARN\" server.log | grep \"admin\")`"
  correct_index: 0
  explanation: "Chaining `grep | grep | wc -l` correctly pipes each command's stdout into the next command's stdin. Option D tries to use command substitution `$(...)` to pass the filtered text as an argument to `wc -l`, but `wc -l` expects either a filename argument or piped stdin — not raw text pasted into the command line. Option B uses `&&` (run next only if previous succeeds), which is not the same as `|` (connect stdout to stdin)."
```

After:

```yaml
- question: "Which pipeline correctly counts admin WARN events?"
  options:
    - "`grep \"WARN\" server.log | grep \"admin\" | wc -l`"
    - "`cat server.log | grep \"WARN\" && grep \"admin\" > wc -l`"
    - "`grep \"WARN\" server.log > grep \"admin\" | wc -l`"
    - "`wc -l $(grep \"WARN\" server.log | grep \"admin\")`"
  correct_index: 0
  option_feedback:
    1: "`&&` runs the next command only if the previous one succeeded — it does not connect their output. `|` connects stdout of one command to stdin of the next. Also, `> wc -l` tries to write output into a *file* literally named `wc`, not run `wc -l`."
    2: "`>` redirects stdout to a file; here it would create a file named `grep` instead of piping output to the `grep` command. Replace `>` with `|` to connect the two commands."
    3: "`$(grep ...)` captures the matching lines as a string and passes them as a command-line argument to `wc -l`. But `wc -l` counts lines from its stdin or a filename argument — not from inline text. Use a pipe instead."
  explanation: "Chaining `grep | grep | wc -l` pipes each command's stdout directly into the next command's stdin — the standard way to build multi-stage filters in Bash."
```

The wrong-option content moved into `option_feedback`, keyed by the YAML index of each wrong option. The general explanation now only describes what the correct answer does. After shuffle, each piece of feedback still lands on the right option.

### Example 2 — `_data/tutorials/sql.yml` (library schema)

Before:

```yaml
correct_index: 1
explanation: "Option B is best: it has a `PRIMARY KEY` for unique identification, `NOT NULL` on required fields (title, author), appropriate types (INTEGER for year, not TEXT), and leaves optional fields (pages) nullable. Option A lacks a primary key. Option C makes everything TEXT, losing type safety. Option D stores everything in one column — no schema enforcement at all."
```

After:

```yaml
correct_index: 1
option_feedback:
  0: "Missing a `PRIMARY KEY` — without one there's no guaranteed way to uniquely identify each book, making updates and deletes ambiguous."
  2: "Storing `year` as `TEXT` instead of `INTEGER` loses type safety — you can't sort or range-query correctly, and the column accepts non-year strings."
  3: "Storing all data in a single `TEXT` column gives up all schema enforcement: no types, no `NOT NULL` constraints, and no ability to query individual fields."
explanation: "The best schema has a `PRIMARY KEY` for unique identification, `NOT NULL` on required fields (title, author), appropriate types (`INTEGER` for year, not `TEXT`), and leaves optional fields (`pages`) nullable."
```

Notice the explanation no longer says "Option B is best" — instead it describes what the correct schema does. That single sentence is shuffle-safe because it doesn't anchor on any position.

### Example 3 — `_data/quizzes/design_principle_solid.yml` (multiple questions)

These already had `option_feedback` for each wrong option, but the `explanation` *also* listed wrong options by letter — duplicating the per-option feedback. The fix was to remove the per-option list from the explanation entirely:

Before:

```yaml
explanation: "OCP = open for extension, closed for modification. Strategy/polymorphism lets you add a new `Carrier` without touching calculator code. Option A modifies tested code (the very thing OCP warns against); option C duplicates code; option D replaces a switch with a more fragile mechanism…"
```

After:

```yaml
explanation: "OCP = open for extension, closed for modification. Strategy/polymorphism lets you add a new `Carrier` without touching calculator code."
```

The trailing letter-list was redundant with the existing `option_feedback` entries. Removing it both fixed the shuffle bug and eliminated duplication — a two-for-one cleanup that the broader DO/DON'T rule ("feedback does not duplicate the explanation") also wants.

### Example 4 — `_data/tutorials/python.yml` (list comprehension)

Before:

```yaml
correct_index: 0
explanation: |
  The filter condition goes at the end: `[expr for var in iterable if condition]`.
  Option B has the `if` before `for` — that is a syntax error.
  Option C calls `odd(x)` which is not a built-in Python function.
  Option D uses `()` which creates a *generator*, not a list.
```

After:

```yaml
correct_index: 0
option_feedback:
  1: "Swapping `if` before `for` is a syntax error — the filter condition must come after the iteration: `[expr for var in iterable if condition]`."
  2: "`odd()` is not a built-in Python function. Use `x % 2 != 0` as the filter condition."
  3: "Parentheses `()` create a *generator expression*, not a list. Use square brackets `[]` for a list comprehension."
explanation: |
  The filter condition goes at the end: `[expr for var in iterable if condition]`.
```

The explanation now contains only the canonical rule. The three per-option corrections live in `option_feedback`, keyed by the YAML index of each wrong option.

## Decision flow

Use this when you're authoring a new question and aren't sure where reasoning belongs:

1. Is the reasoning *about a specific wrong option* (why someone might pick it, what the wrong mental model is)?
   - **Yes** → put it in `option_feedback[i]` for that option's YAML index.
   - **No, it's about the principle / the right answer / the discrimination across all options collectively** → it can live in `explanation:`.
2. Does the reasoning need to mention an option in `explanation:`?
   - **Avoid it if you can.** Most explanations read better when they describe the *underlying principle* without naming options.
   - If you must, use **content-anchored** language ("the spread-operator approach", "the strategy-pattern variant"). Never letter or ordinal.

## Common false positives in audit grep

When grepping for `Option [A-D]`, expect noise from:

- The string `option_feedback` (filter with `grep -v option_feedback`).
- Tutorial *body* text that uses "Option A / Option B" as labels for design choices in instructional prose, not multiple-choice answers (e.g. `_data/tutorials/code-smells-refactoring.yml` discusses "Option A: Introduce Parameter Object" vs "Option B: Extract Function" as two refactoring strategies the student is being taught about). These are stable labels in the tutorial narrative — leave them.
- `_data/tutorials/testing-foundations.yml` and `_data/tutorials/tdd.yml` use "Option A / Option B" inside code blocks as *comments* showing two implementations side-by-side. Stable.
- Backup files (`*_old.yml`, `*_backup.yml`) — skip them.

If a hit is in an `explanation:` or in quiz prose, fix it. If it's narrative or code-comment, leave it.
