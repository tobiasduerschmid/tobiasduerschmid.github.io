---
name: quiz-format
description: >-
  Authoring guide for the SEBook quiz YAML format — schema, pedagogy of misconception feedback, shuffle-safe authoring, and example questions. Use this skill EVERY TIME you're creating, editing, reviewing, or generating new content for any quiz file under `_data/quizzes/*.yml` (SEBook + SEGym standalone quizzes) or `_data/tutorials/*.yml` (in-tutorial step quizzes nested under `quiz:`). Also trigger on requests like "add a quiz on X", "improve this question", "draft a few quiz questions about Y", "what's the format for option_feedback", "review my quiz", "this quiz is missing wrong-answer feedback", "fix references to Option A/B in explanations", "audit quiz explanations for letter references", or any task that involves writing the `option_feedback`, `correct_indices`, `optional_indices`, `lines`, or `distractors` fields. The format has two non-obvious traps authors regularly hit without this guide: a sparse-hash field for per-option misconception feedback, and a shuffle mechanism that makes any "Option A/B" letter reference or "the third choice" position reference in an `explanation` unstable at render time.
---

# SEBook quiz authoring

This SEBook project has a custom YAML quiz format used in three places — SEBook chapters, SEGym workouts, and tutorial step gates — all driven by the same schema. The point of this skill is to keep quizzes pedagogically sharp, especially the per-option misconception feedback.

If you only remember four things:

1. **`option_feedback` is a sparse hash, not an array.** Keys are integer indices into `options`. Only add entries for options where you can name the wrong reasoning a student would actually hold. If a distractor is so trivially wrong that you cannot finish *"a student picks this because they are thinking…"*, the *distractor itself is the problem* — fix or cut it before reaching for feedback. Good distractors and good feedback correlate; bad distractors cannot be rescued by feedback. (See `references/schema.md` → "Distractor design".)
2. **Per-option feedback corrects the mental model.** It is *not* a second copy of the general `explanation`. Clarify the wrong reasoning directly, point at the proximate distinction, stay under three sentences. For code questions, name the *semantic* distinction (what the code actually does) rather than the syntactic one (which character is different) — students can see the character; they need the meaning. Do not use the word "misconception" or label the error.
3. **Triggering rules are asymmetric.** `option_feedback[i]` only fires when option `i` was *answered* wrongly — selected when wrong (commission) or unselected when correct in multi-choice (omission). It never fires for `optional_indices` entries, and it never fires when the question is fully right.
4. **Options shuffle at render time.** "Option A" / "the third choice" / "the last one" in an `explanation` is a position reference into the YAML order — but the student sees a randomized order. Per-option reasoning belongs in `option_feedback[i]`, where the index is bound to content, not display position. If you must mention an option in `explanation`, refer to it by its *content* ("the spread-operator approach", "the `&&` short-circuit"), never by letter or ordinal. See the **Shuffle safety** section below.

For longer-form material:
- **`references/schema.md`** — full YAML reference for `single`, `multiple`, and `parsons` types, including tutorial-step nesting and the `min_score`/`shuffle` gating fields. Read this if you're authoring an unusual question type or debugging a Liquid render issue.
- **`references/pedagogy.md`** — the theory behind misconception feedback (Variation Theory, Hattie/Shute on corrective feedback, growth-mindset framing) plus two flagship worked examples (recursion base case, unit-testing properties). Read this when stuck on whether a feedback string is good enough.
- **`references/examples.md`** — a small library of additional templates across SE topics (big-O, async, mutability, design patterns, SQL). Read this when you want concrete inspiration for a new quiz.

Read these only when the task warrants — drafting your first quiz from scratch, debating whether a feedback string is good enough, or auditing an existing quiz file. For everyday tweaks the SKILL.md alone is enough.

## Schema cheat sheet

```yaml
# _data/quizzes/<id>.yml — SEBook + SEGym
title: "Quiz Title"
description: "One-line description."
active: true                  # optional, default true; set false to hide from SE Gym (embeds still work)
questions:
  - id: 1                       # optional, used for analytics
    type: single                # 'single' (default), 'multiple', or 'parsons'
    difficulty: intermediate    # OPTIONAL: basic | intermediate | advanced | expert
                                # SEBook embeds always show; SEGym is user-toggleable
    question: "Markdown question text"
    options:
      - "Option A"
      - "Option B"
      - "Option C"
      - "Option D"
    correct_index: 1            # for type: single
    correct_indices: [0, 2]     # for type: multiple
    optional_indices: []        # for type: multiple — acceptable bonus
    option_feedback:            # OPTIONAL sparse hash, keyed by option index
      0: "Misconception note for option 0"
      2: "Misconception note for option 2"
    explanation: "General explanation, shown for both correct and wrong outcomes."
```

`difficulty` is also supported on flashcards (`_data/flashcards/*.yml`). It is **not** used for tutorial-step quizzes (tutorial steps already gate on `min_score`).

For tutorial quizzes the same block nests under each step's `quiz:` key inside `_data/tutorials/<name>.yml`, and may add `min_score: 0.8` (gating threshold) and `shuffle: true` (default).

Parsons (code-ordering) questions use `lines:` and `distractors:` instead of `options:`. They do **not** support `option_feedback`. See `references/schema.md`.

## When `option_feedback[i]` fires

| Question type | Option `i` is in… | Student action | Feedback fires? |
|---|---|---|---|
| single | `correct_index` | picked it | no — answer was right |
| single | not correct | picked it (wrong) | **yes** |
| single | not correct | didn't pick it | no — student picked something else |
| multiple | `correct_indices` | selected it | no — correctly identified |
| multiple | `correct_indices` | omitted it | **yes — omission error** |
| multiple | `optional_indices` | either way | never — these are acceptable as-is |
| multiple | wrong (neither correct nor optional) | selected it | **yes — commission error** |
| multiple | wrong | not selected | no — correctly skipped |

In print views (`_layouts/print-tutorial.html` for tutorials; `@media print` of regular pages for SEBook/SEGym), **all** option_feedback entries render, regardless of student state — the printout is the answer key plus its rationale.

## DO / DON'T for option_feedback

DO:
- **Clarify** what's wrong directly — lead with the fact, the proximate distinction, or what's really happening. "That's C++, not C — `cout` is from `<iostream>`" beats "this is wrong."
- Correct the **mental model** — explain what's actually true and, if useful, gesture at why the wrong reasoning was plausible ("Spreadsheets coerce blank cells to 0, which sets up the wrong intuition for SQL NULL").
- Stay short and concrete.

DON'T:
- **Use the word "misconception"** in the feedback content, or label the error with phrases like "This is the *X* misconception / trap / fallacy / conflation". Just clarify the wrong reasoning. Labeling reads as a template tic when repeated across many questions and shifts attention from the correction to the vocabulary.
- Repeat the general `explanation:`. The general explanation carries canonical reasoning; option_feedback gives surgical correction.
- Write more than ~3 sentences. Anything longer belongs in `explanation:`.
- Use accusatory second-person framing — "*you* confused X with Y" pins the error on the learner. Frame it in the third person around the *idea*, not the student.
- Add option_feedback to `optional_indices` options — it never fires there.
- Add option_feedback to options whose wrongness is obvious from the question text alone (a syntactically malformed distractor, a year that's clearly wrong) — there's no real reasoning to correct.

## Shuffle safety: never reference options by letter or position

Quiz options shuffle at render time by default — `_includes/quiz.html` and `js/tutorial-quiz.js` both run a Fisher-Yates pass on the options array before showing the question. Tutorial quizzes also shuffle the *questions* themselves (`shuffle: true` is the default, settable per-quiz). Standalone SEBook/SEGym quizzes shuffle options too.

So what you wrote at `options[1]` in YAML can appear to the student as A, B, C, or D depending on the seed. The trap is anything in `explanation:` (or `question:`, or anywhere outside `option_feedback`) that names an option by its *position* in the rendered list:

- **Letter labels:** "Option A", "Option B", "answer C", "choice D"
- **Ordinals:** "the first option", "the second answer", "the third choice", "the last one"
- **Spatial:** "the option above", "the one below"

Once shuffled, none of these anchors line up with what the student sees, and the explanation becomes nonsense. This is the single most common authoring bug we hit.

### The rule

**Per-option reasoning belongs in `option_feedback[i]`, keyed by the option's *content* via its YAML index.** The renderer fires `option_feedback[1]` whenever the student picks the option that was at YAML index 1 — regardless of where the renderer placed it on screen. The general `explanation:` should describe only the correct answer (or the underlying principle).

If you need to mention an option in `explanation`, refer to it by what it does: "the spread-operator approach", "the `&&` short-circuit", "the variant that uses `$()`". Content-anchored references survive shuffling.

### Stable exceptions (these are not position references)

Two cases look like position references but aren't:

1. **Code-block labels inside a question body.** A question whose code snippet has `// Option A` and `// Option B` as comments is naming those *code blocks*, not answer positions. The labels are part of the question text and never shuffle. `_data/tutorials/nodejs.yml` (the Promise.all question) is the canonical example — see `references/shuffle-safety.md`.
2. **`correct_index` / `correct_indices`** — these are renderer-internal, not student-facing.

If unsure, ask: *"Will this letter or number still mean the same thing after the renderer randomizes the order?"* If no, fix it.

### Quick worked example: shell pipelines

Before (broken — references "Option D" and "Option B" by letter):

```yaml
correct_index: 0
explanation: "Chaining `grep | grep | wc -l` correctly pipes each command's stdout into the next. Option D tries to use `$(...)` to pass filtered text as an argument… Option B uses `&&` (run next only if previous succeeds)…"
```

After (per-option reasoning lives in `option_feedback`, the explanation covers only the correct answer):

```yaml
correct_index: 0
option_feedback:
  1: "`&&` runs the next command only if the previous succeeded — it does not connect their output…"
  2: "`>` redirects stdout to a file; here it would create a file named `grep` instead of piping…"
  3: "`$(grep ...)` captures lines as a string and passes them as an argument to `wc -l`…"
explanation: "Chaining `grep | grep | wc -l` pipes each command's stdout directly into the next command's stdin — the standard way to build multi-stage filters in Bash."
```

No string in the file mentions "Option A/B/C/D" by letter, and the `option_feedback` indices stay bound to the right rationale even after the renderer shuffles.

### Auditing existing files

To find offenders quickly:

```bash
grep -rn "Option [A-D]\b\|the \(first\|second\|third\|fourth\|last\) \(option\|answer\|choice\)" \
  _data/tutorials _data/quizzes \
  | grep -v "_old\." | grep -v "_backup\." | grep -v "option_feedback"
```

Watch for "Options A and B…", "option C…", "the third choice…", and ordinal phrasings. The grep filters skip backup files (`*_old.yml`, `*_backup.yml`) and the field name `option_feedback` (which contains "option" but isn't a position reference).

For the full step-by-step "audit and fix" recipe, several before/after worked examples, and the canonical stable-exception case, see **`references/shuffle-safety.md`**.

## Authoring checklist

Before merging a quiz file with new `option_feedback`:

- [ ] Each entry corresponds to a misconception students actually hold (if you can't name it, skip it).
- [ ] Each feedback string ≤ 3 sentences.
- [ ] Feedback corrects a mental model, not just labels the option as wrong.
- [ ] Feedback clarifies the wrong reasoning directly — without using the word "misconception" or label phrases like "the X trap / X conflation / X fallacy" (see `references/pedagogy.md` Principle 1).
- [ ] Hash keys are integers matching `options[]` indices.
- [ ] For multi-choice with `optional_indices`: no feedback assigned to those indices.
- [ ] For multi-choice: omission feedback added on correct options where forgetting to select matters.
- [ ] Feedback does not duplicate the `explanation:` field.
- [ ] No second-person blame; misconception is framed in the third person.
- [ ] **Shuffle-safe**: no letter or ordinal references ("Option A", "the third choice", "the last one", etc.) in `explanation:`, `question:`, or anywhere outside `option_feedback`. Per-option reasoning lives in `option_feedback`; the `explanation` describes the correct answer or underlying principle. *Collective, content-anchored* references to wrong-option **categories** are fine ("approaches that mutate state", "options that use `WHERE` for aggregates"); references to specific options by letter or YAML index are not.
- [ ] **Distractors pass the six tests** in `references/schema.md` → "Distractor design": plausible to a partial-knower, misconception-grounded, variation-clean (one critical feature), homogeneous with the key, free of cueing, *and consistent with what the stem shows*. If a distractor fails these, fix the distractor — feedback can't rescue it.
- [ ] **Stem hygiene** (`references/schema.md` → "Stem design"): paraphrased from the lesson, no filler clauses, options of comparable shape and length to the key. If any clause in the stem could be cut without changing the question, cut it.
- [ ] **For Parsons: count the lines.** Sweet spot 4–8; standard algorithms 9–12 are fine; never past 14. Don't claim "kept within the cap" without counting.
- [ ] **At least one distractor encodes the canonical novice misconception** for this concept (mutable defaults, `==` vs `is`, forgotten base case, `WHERE` vs `HAVING`, off-by-one). If none do, the question tests recall, not discrimination.
- [ ] **Difficulty calibrated.** Target ~70–80% correct on first attempt for an in-tutorial gate (`min_score: 0.8` only works when items hit this band). For SEGym workout questions, 50–70% is appropriate (deliberate practice tolerates more failure). If you'd expect <40% correct, the prerequisite isn't in place — fix the tutorial, not the quiz.
- [ ] For tutorial quizzes: `min_score:` set deliberately (default 0.8), or omitted if you accept the default.

## File pointers (project structure)

If you need to debug rendering rather than authoring:

- Quiz engine for tutorials: `js/tutorial-quiz.js` (used by `js/tutorial-code.js` and the popup).
- Quiz engine for SEBook + SEGym: `_includes/quiz.html` (Liquid template + inline JS + inline CSS).
- Tutorial print layout: `_layouts/print-tutorial.html` (separate page; uses `.print-quiz-*` classes).
- Tutorial quiz CSS: `css/tutorial.css` under `.tvm-quiz-panel`.
- SEBook/SEGym quiz CSS: inline `<style>` block in `_includes/quiz.html`.

## When in doubt

If you're drafting a question and unsure whether to attach `option_feedback` to a given option, ask: *"What is the student probably thinking when they pick this?"* If you can answer that crisply and your answer points at a fixable mental model, write the feedback. If you can't — leave it out. The general `explanation:` will still carry the reasoning. Quality beats coverage; sparse, well-targeted feedback is better than a feedback entry per option.
