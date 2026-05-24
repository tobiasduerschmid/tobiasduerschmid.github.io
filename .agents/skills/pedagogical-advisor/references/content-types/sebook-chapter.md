# SEBook Chapters (project-specific supplement)

This file supplements the generic `textbook-chapters.md` with patterns
specific to the `tobiasduerschmid.github.io` SEBook. **Read
`textbook-chapters.md` first** — what's here is the project-specific
overlay, not a replacement. The generic file owns "what makes any textbook
chapter work"; this file owns "what's unique about *these* chapters and
the affordances they have already."

## What an SEBook chapter actually is

Chapters live under `SEBook/<section>/<topic>.md` (or `SEBook/<topic>.md`
at the top level). They are Jekyll Markdown with `layout: sebook` front
matter:

```yaml
---
title: Software Testing
layout: sebook
---
```

Beyond plain prose and figures, an SEBook chapter typically contains four
kinds of content the generic file doesn't model. Each one has pedagogical
implications you should reason about explicitly:

1. **Inline ArchUML diagrams**, rendered client-side from PlantUML-style
   markup embedded in `<div class="uml-class-diagram-container"
   data-uml-type="..." data-uml-spec='@startuml…@enduml'></div>`. Supported
   types include `class`, `sequence`, `state`, `component`, `deployment`,
   `usecase`, `activity`, `freeform`, `gitgraph`, `folder-tree`, `venn`,
   `er`. These are zoomable, theme-aware, and interactive.

2. **End-of-section retrieval pairs**, almost always written as
   `{% include flashcards.html id="<topic>" %}` immediately followed by
   `{% include quiz.html id="<topic>" %}`. The IDs map to files under
   `_data/flashcards/<id>.yml` and `_data/quizzes/<id>.yml`. This is the
   chapter's *embedded retrieval-practice mechanism* — Dunlosky's
   highest-utility study technique, already built into the chapter format.

3. **Outbound links to hands-on tutorials** — Markdown links like
   `[Testing Foundations](/SEBook/tools/testing-foundations-tutorial)`
   that send readers into a sandboxed code editor at
   `_data/tutorials/<slug>.yml`. Chapter ↔ tutorial pairs implement the
   read-then-do rhythm.

4. **Course aggregator pages** — `SEBook/CS130.md` and `SEBook/CS35L.md`
   pull together chapter content for specific UCLA courses, layering
   course-specific flashcard and quiz pools (`CS130_2026_current`,
   `CS35L_2026_current`). Individual chapters must therefore be
   *standalone-readable*; the course page just curates and supplements.

There is also a **reader-side bookmark system** (`SEBook/bookmarks.md`,
`SEBook/CS130_bookmarks.md`, `SEBook/CS35L_bookmarks.md`) that lets
students save spots in chapters they want to return to. This isn't
authored content — it's a persistence layer over the chapter set. But it
shapes how chapters should be *structured* (see below).

## Pedagogical considerations particular to this format

### ArchUML diagrams in prose

The generic file warns about split-attention and the redundancy principle.
ArchUML embeds in this project have specific failure modes:

- **Self-contained labels.** A diagram with abstract labels (S1 / S2 / S3,
  C1 / C2) that only the surrounding prose disambiguates triggers
  split-attention — the reader has to bounce between diagram and prose to
  decode it. Diagrams should be interpretable on their own. The
  `process.md` Waterfall state machine is a good example: states are
  labeled `Requirements`, `Design`, `Implementation`, `Testing`,
  `Maintenance` — readable without the prose.

- **`note right of` for the *why*.** PlantUML's `note right of <state>` is
  the project-idiomatic place to put the pedagogical *why* of a diagram
  element inside the diagram itself. Example from `process.md`: the
  "Customer sees working software for the FIRST time here" note attached
  to the `Testing` state. Use this when the why is what the reader needs
  to walk away with — it survives split-attention because it lives next to
  the thing it explains.

- **Interactivity is real and creates new failure modes.** Readers can
  zoom, pan, and switch light/dark. A diagram that's only legible at one
  zoom level (label overlap when scaled, illegible arrows on dark
  background) is a real defect, not just an aesthetic one. Pair any
  diagram critique with [`good-diagrams`](../../../good-diagrams/SKILL.md)
  and [`diagrams`](../../../diagrams/SKILL.md).

- **Don't recommend "add a diagram" as a generic improvement.** The
  `good-diagrams` skill encodes an editorial bar — many concepts teach
  better as prose with a worked example than as a UML box-and-arrow.
  If you find yourself recommending a diagram because the section "feels
  visual", stop and check whether prose plus a small worked example
  would actually transfer the schema better.

### The flashcard + quiz pair at end of section

When a chapter ends with the `flashcards.html` + `quiz.html` include pair,
the retrieval-practice infrastructure is *already in place*. Pedagogical
recommendations should leverage it, not reinvent it:

- **Audit coverage against learning objectives.** Open the YAML files
  (`_data/flashcards/<id>.yml`, `_data/quizzes/<id>.yml`) and check
  whether items span the chapter's actual objectives or only the
  most-memorable surface facts. Lopsided coverage is a common defect: the
  procedural skill the chapter builds gets one quiz item, the easy
  definition gets six.

- **Audit Bloom-level mix.** The quiz format supports MCQ with a sparse
  `option_feedback` hash per distractor — which is powerful for
  *clarifying wrong reasoning*, an analysis/evaluation move (Bloom 4–5),
  not just recall (Bloom 1). If every item is recall, that is a
  pedagogical gap even when the individual items are well-written.

- **Audit shuffle-safety of explanations.** Quiz options are shuffled at
  render time, so any phrasing like "Option B is wrong because…" or "the
  third choice" in the `explanation:` field becomes nonsense for half the
  readers. The [`quiz-format`](../../../quiz-format/SKILL.md) skill
  captures this and the schema in full — cite it rather than rewriting
  the rule.

- **"Misconception" wording rule.** Project authoring convention: don't
  use the word "misconception" in `option_feedback` strings. The
  feedback should clarify the wrong reasoning without labeling the
  reader's thinking. (This lives in the user's authoring memory, not in
  any runtime check.)

### Chapter ↔ tutorial pairs

If a chapter has a sibling interactive tutorial under
`SEBook/<section>/<slug>-tutorial.md` (rendered from
`_data/tutorials/<slug>.yml`), the pedagogical division of labor is:

| Surface         | What it carries                                                |
| --------------- | -------------------------------------------------------------- |
| **Chapter**     | concepts, worked examples in prose, retrieval (flashcards/quiz) |
| **Tutorial**    | guided practice (PRIMM: Predict → Run → Investigate → Modify → Make), hints, in-step tests |

Critiques that say "this chapter needs more hands-on exercises" usually
mean *the tutorial pair is missing or weak*, not that the chapter should
grow exercises inline. Check whether a tutorial exists before recommending
the chapter absorb practice. Pair tutorial-side recommendations with
[`tutorial-authoring`](../../../tutorial-authoring/SKILL.md).

### Standalone-readability under the course aggregator

Chapters are pulled into `CS130.md` / `CS35L.md` and read out of order, by
different cohorts, in different sequences than the SEBook table of
contents implies. They cannot assume a single linear reading path.
Implications:

- Forward / backward references should be **specific links to the named
  section**, not chapter-position-dependent prose ("as we saw earlier" or
  "in the next chapter"). Such prose silently lies when the chapter is
  read out of order.
- Prerequisite knowledge should be stated at the top of each chapter or
  in a clearly-marked early section, so a reader landing from the course
  aggregator knows what they're walking into.
- End-of-chapter retrieval items should match what *this* chapter built,
  not the cumulative state of the textbook.

### The reader-side bookmark system

Readers can save bookmarks at any heading anchor (`#section-name`). This
shapes chapter structure:

- **Section headings should be short, semantic, and stable.** Renaming a
  heading silently breaks every saved bookmark to it. When a heading needs
  to change, ask whether the rename is worth the broken bookmarks; if so,
  consider leaving an HTML anchor with the old slug as a stub.
- **Long undifferentiated runs of prose without sub-headings are doubly
  bad** — they kill scannability *and* deny readers a meaningful spot to
  return to.
- **Don't over-fragment.** A bookmark to a one-paragraph heading isn't
  more useful than a bookmark to a multi-paragraph one; it just bloats
  the table of contents. Heading granularity should follow the actual
  conceptual structure, not the bookmark mechanism.

### Print layout

The `_layouts/print-tutorial.html` layout (and chapter print views)
strips interactivity. Pedagogical recommendations that hinge on an
interactive widget — a quiz the reader can click, a diagram they can
zoom — need to ask whether the print rendering still teaches. Diagrams
should be legible as static SVG; quiz includes either fall back to a
readable form or are omitted in print.

## Which theory files to read (in addition to the generic file's list)

The generic file's loadout still applies. *In addition*, consider:

- **For chapters with a flashcard + quiz tail**: load
  `practices/effective-techniques.md` (retrieval-practice section). The
  audit recommendations above hinge on it.
- **For chapters paired with a tutorial**: also read
  `tutorials.md` (the content-type file in this same directory) so your
  chapter-side recommendations don't conflict with what the tutorial
  side is doing.
- **For chapters heavy on ArchUML / state / sequence diagrams**: keep
  `cognition/multimedia-learning.md` open and apply *signaling*,
  *spatial-contiguity*, and *coherence* principles to the actual
  rendered diagrams (zoom around them, view light *and* dark).

## Output format

Same as the generic file (Strengths → Critical → Important → Refinements
→ Tradeoffs → Next Steps), but cite locations using the project's path
conventions so recommendations are actionable:

- `[SEBook/testing.md, "Testing Pyramid" section, paragraph 2]`
- `[SEBook/process.md, ArchUML state diagram after "feedback loop closes" sentence]`
- `[_data/quizzes/testing_overview.yml, item 3, distractor C]`
- `[_data/flashcards/testing_overview.yml, card 5]`
- `[_data/tutorials/playwright.yml, step 4]`

When a recommendation crosses files (chapter prose + quiz YAML + tutorial
YAML + flashcard YAML), name each file the change would touch. That makes
the recommendation reviewable and prevents the common failure mode where
a "fix the chapter" suggestion implicitly requires three other files to
be updated too.
