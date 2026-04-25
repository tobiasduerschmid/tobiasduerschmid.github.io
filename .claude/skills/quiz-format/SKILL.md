---
name: quiz-format
description: Authoring guide for the SEBook quiz YAML format — schema, pedagogy of misconception feedback, and example questions. Use this skill EVERY TIME you're creating, editing, reviewing, or generating new content for any quiz file under `_data/quizzes/*.yml` (SEBook + SEGym standalone quizzes) or `_data/tutorials/*.yml` (in-tutorial step quizzes nested under `quiz:`). Also trigger on requests like "add a quiz on X", "improve this question", "draft a few quiz questions about Y", "what's the format for option_feedback", "review my quiz", "this quiz is missing wrong-answer feedback", or any task that involves writing the `option_feedback`, `correct_indices`, `optional_indices`, `lines`, or `distractors` fields. The format has a non-obvious sparse-hash field for per-option misconception feedback that authors regularly get wrong without this guide.
---

# SEBook quiz authoring

This SEBook project has a custom YAML quiz format used in three places — SEBook chapters, SEGym workouts, and tutorial step gates — all driven by the same schema. The point of this skill is to keep quizzes pedagogically sharp, especially the per-option misconception feedback.

If you only remember three things:

1. **`option_feedback` is a sparse hash, not an array.** Keys are integer indices into `options`. Only add entries for options where you can name an actual misconception. Don't fill in entries for trivially-wrong distractors.
2. **Per-option feedback corrects the mental model.** It is *not* a second copy of the general `explanation`. Clarify the wrong reasoning directly, point at the proximate distinction, stay under three sentences. Do not use the word "misconception" or label the error — just clarify.
3. **Triggering rules are asymmetric.** `option_feedback[i]` only fires when option `i` was *answered* wrongly — selected when wrong (commission) or unselected when correct in multi-choice (omission). It never fires for `optional_indices` entries, and it never fires when the question is fully right.

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
questions:
  - id: 1                       # optional, used for analytics
    type: single                # 'single' (default), 'multiple', or 'parsons'
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

## Authoring checklist

Before merging a quiz file with new `option_feedback`:

- [ ] Each entry corresponds to a misconception students actually hold (if you can't name it, skip it).
- [ ] Each feedback string ≤ 3 sentences.
- [ ] Feedback corrects a mental model, not just labels the option as wrong.
- [ ] Misconception named with a diagnostic label where one exists.
- [ ] Hash keys are integers matching `options[]` indices.
- [ ] For multi-choice with `optional_indices`: no feedback assigned to those indices.
- [ ] For multi-choice: omission feedback added on correct options where forgetting to select matters.
- [ ] Feedback does not duplicate the `explanation:` field.
- [ ] No second-person blame; misconception is framed in the third person.
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
