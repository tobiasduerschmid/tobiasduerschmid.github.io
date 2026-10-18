# Project context

Local adaptation of upstream version 2.2.0. Paths below are relative to the skill root.


This skill lives inside the `tobiasduerschmid.github.io` project — an
educational website built around a software-engineering textbook (SEBook),
interactive practice (SE Gym), and a YAML-driven in-browser tutorial system.
The author is a CS educator at UCLA. Most uses here will involve one of these
artifact types — and for each, there is a *project skill* that owns the
mechanics. Your job is to ground the **pedagogy** (the why); defer to those
skills for the **operational mechanics** (the what / where / how to write it).

| When the artifact is…                                          | Pedagogy lens (here)                                | Operational guide (read alongside)                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| SEBook chapter (`SEBook/<section>/<topic>.md`)                 | `references/content-types/sebook-chapter.md` alongside `procedures/16_material-review-and-repair.md` | [`good-diagrams`](../../good-diagrams/SKILL.md), [`diagrams`](../../diagrams/SKILL.md) for any embedded visual          |
| Interactive tutorial (`_data/tutorials/<slug>.yml`)            | `knowledge/24_computing-education-and-ai.md`             | [`tutorial-authoring`](../../tutorial-authoring/SKILL.md) (YAML schema, runtime constraints) **and** the project `cs-tutorial-design` skill (PRIMM, desirable difficulties for CS) |
| Quiz (`_data/quizzes/<slug>.yml` or in-tutorial `quiz:` block) | `procedures/10_exam-design-workflow.md`     | [`quiz-format`](../../quiz-format/SKILL.md) for the schema, `option_feedback` semantics, and shuffle-safe phrasing   |
| Testing-focused chapter or tutorial                            | the matching content-type file                      | [`test-design`](../../test-design/SKILL.md) for what makes a test capture a *spec* rather than an *implementation*   |
| Flashcards (`_data/flashcards/`), CS130 / CS35L course content | `procedures/17_teaching-operations.md`                 | inspect peer cards / quizzes already in the same course for tone and difficulty calibration                       |
| SE Gym exercise (with hero avatar customizer)                  | `knowledge/14_motivation-belonging-and-climate.md`                   | [`avatar-svg-design`](../../avatar-svg-design/SKILL.md) (artwork), [`asset-creator`](../../asset-creator/SKILL.md) (other SVGs) |

A few project-specific facts that change pedagogical advice here:

- **Audience.** Default audience is UCLA upper-division CS undergraduates
  (CS130 = Software Engineering, CS35L = Software Construction Lab). They
  have prior programming experience but variable software-engineering
  intuition. Calibrate expertise-reversal worries accordingly.
- **Tutorial pedagogy is already PRIMM-shaped.** The runtime supports
  Predict → Run → Investigate → Modify → Make. Select phases to fit the objective and prior knowledge; do not require
  every phase in every step. Preserve prediction-before-reveal when intended.
- **Quizzes use sparse `option_feedback` for clarifying wrong reasoning.**
  When critiquing a quiz, check whether each distractor has feedback that
  *clarifies the wrong reasoning* — but **don't use the word "misconception"
  in feedback strings**; that's a project authoring convention. Just
  clarify why the reasoning is off and what would be correct instead.
- **Accessibility is a hard constraint.** Every reachable page must remain
  WCAG 2.2 AA compliant. Pedagogical recommendations that would harm
  accessibility (color-only coding, motion that can't be disabled,
  keyboard-inaccessible interactions) are non-starters here — flag the
  conflict and propose an alternative. See [`wcag-aa-compliance`](../../wcag-aa-compliance/SKILL.md).
- **Diagrams have an editorial bar.** Don't recommend "add a diagram" as a
  generic improvement — read [`good-diagrams`](../../good-diagrams/SKILL.md)
  first to see when a diagram actually earns its place.

When your advice would change something *physical* in the codebase (a YAML
step, an inline diagram, a quiz option, a focus order, a stored cookie key),
the project skill that owns that surface is authoritative on the mechanics.
Cite it, don't recreate it.
