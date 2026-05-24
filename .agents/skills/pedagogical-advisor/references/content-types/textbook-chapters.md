# Textbook Chapters, Readings, and Written Explanations

This file covers asynchronous, text-based instruction: textbook chapters, written
tutorials in prose form, educational articles, course handouts, long-form
explainer posts, written lesson materials. The learner reads on their own,
usually at their own pace, possibly revisiting.

This format has distinct affordances and distinct pitfalls. Learners can re-read,
which is a superpower — but they often re-read passively, which is a known low-
utility study strategy (Dunlosky). The text has to do more work than a lecture
because there's no one in the room to course-correct when confusion sets in.

## What makes a textbook chapter work

A good chapter:

1. **Sets up the destination** — what's the big idea, what will the reader know
   or be able to do by the end, why should they care.
2. **Activates and builds on prior knowledge** — connects new material to what the
   reader is assumed to already know, and is explicit about that assumption.
3. **Manages cognitive load throughout** — sentence complexity, element
   interactivity, and layout density stay within reasonable bounds.
4. **Uses worked examples before independent practice asks** — if the chapter
   asks the reader to do something, it has first shown them how.
5. **Varies examples strategically** — multiple examples that illuminate the
   concept from different angles, including contrasting non-examples where they
   help.
6. **Integrates retrieval opportunities** — embedded questions, end-of-section
   checks, chapter-end exercises designed for recall and transfer, not just
   recognition.
7. **Signals structure** — headings, summaries, forward/backward references, so
   the reader can maintain a mental model of where they are and how this
   fits.
8. **Provides means for the reader to self-monitor** — answers to embedded
   questions (often in back or delayed), self-explanation prompts, reflection
   questions.

## The most common problems

- **Encyclopedia-mode.** The chapter reads like a dump of everything the author
  knows about the topic, with no clear architecture. No sense of what matters
  most or why. The enduring-understandings layer is missing (Wiggins & McTighe).
- **No signaling.** Long stretches of undifferentiated prose. The reader can't
  tell what's central versus supporting. The coherence principle and signaling
  principle (Mayer) are ignored.
- **Embedded figures that require split attention.** Diagram on one page,
  explanation on another; caption that doesn't actually label the parts being
  discussed.
- **Redundancy overload.** The same information is presented in prose, on the
  diagram, in a callout box, and in a bullet summary. Each format is competing
  for working memory.
- **Exercises that don't align with the content.** The prose covers concepts A,
  B, C; the end-of-chapter problems test D, E, F. Or — very commonly — the prose
  covers A, B, C at conceptual level, and the problems require procedural fluency
  that was never built.
- **No retrieval cues.** The reader gets to the end and has no way to check
  whether anything stuck. Re-reading the chapter is the only study strategy
  available, and re-reading is a known low-utility technique.
- **Expert blind spot in prose density.** Sentences that chain four clauses,
  each with a technical term, that the expert author processes as one idea and
  the novice reader experiences as five.
- **Motivation afterthought.** Relevance is either assumed or stated once in
  the intro and never returned to. No connection to what the learner cares
  about or will do with this.

## Diagnostic checklist

**Architecture and framing**
- Is there a clear statement of what the chapter covers and why, at the start?
- Are learning objectives stated (explicit or clearly implied)?
- Is there a visible organization — sections with meaningful headings, a flow
  from foundational to more complex ideas?
- Can a reader scan and form a mental map of the chapter?
  → `design/backward-design.md`, `design/learning-objectives.md`

**Cognitive load in the prose**
- Are sentences reasonable in length and clause count for the target audience?
- Is new terminology introduced, defined, and re-used in a way that builds
  schema rather than accumulating novel elements?
- Is element interactivity managed? When a concept has many interacting parts,
  is it decomposed, or dumped all at once?
- Are figures integrated with their explanations — labels and explanations
  physically near the parts they describe? (split-attention)
- Does the chapter avoid redundancy — saying the same thing in three formats
  at once?
  → `cognition/cognitive-load-theory.md`, `cognition/multimedia-learning.md`

**Multimedia / layout**
- Do figures/diagrams follow multimedia principles — integrated labels,
  coherent (extraneous visual detail excluded), signaled (important parts
  highlighted)?
- Does the layout respect coherence — callouts, sidebars, and margin notes
  that actually contribute, rather than interrupt?
- Is there a consistent visual language — code blocks formatted the same way,
  key terms marked the same way, worked-example structure recognizable across
  the chapter?
  → `cognition/multimedia-learning.md`

**Examples and worked problems**
- For each significant new concept, how many examples? (Usually one is not
  enough; three to five that vary strategically is often right.)
- Do the examples include worked-out solutions showing the *process*, not
  just the answer — and especially for novices, is there a progression from
  fully worked → partially worked → independent?
- Is the variation across examples deliberate? Do they vary on dimensions
  that would help the reader see the critical features?
- Are there contrasting cases where they'd help — e.g., a near-miss example
  to clarify a boundary?
  → `practices/variation-theory.md`, `cognition/cognitive-load-theory.md`
  (worked example effect)

**Retrieval and consolidation**
- Are there embedded self-check questions throughout the chapter, not just
  at the end?
- Do the end-of-chapter exercises include retrieval practice (recall
  questions), not only application questions?
- Does the chapter explicitly cue connection to prior chapters and upcoming
  chapters?
- Are there prompts for self-explanation ("in your own words, why does…")
  which are among the higher-utility techniques (Dunlosky)?
  → `practices/effective-techniques.md`

**Assessment alignment**
- Do the end-of-chapter exercises match what the prose built? At the right
  Bloom level?
- Are there multiple item types — recall, application, analysis, transfer —
  if the objectives implicate them?
- Do the exercises set up for spaced practice (revisiting earlier material),
  not just blocked practice on the most recent topic?
  → `design/bloom-taxonomy.md`, `assessment/assessment-principles.md`

**Motivation and relevance**
- Is the *why* of the material made visible? Not just "this is what you need to
  know" but "here's what this lets you do that you couldn't before."
- Is utility-value surfaced (how this connects to things the reader already
  cares about)?
- Is the chapter honest about difficulty — neither trivializing it ("this is
  easy!") nor catastrophizing it ("this is really hard")?
  → `motivation/mindset-expectancy.md`

**Accessibility and inclusivity**
- Are figures described for screen readers (alt text, thoughtful captions)?
- Is the prose accessible for readers with different linguistic backgrounds
  without watering down content?
- Do the examples draw from a reasonable range of contexts, not only ones that
  presume particular cultural background?
  → `design/universal-design.md`

## Which theory files to read

For most textbook chapter tasks, load:

1. **`cognition/multimedia-learning.md`** — Mayer's 12 principles, especially
   signaling, coherence, spatial/temporal contiguity, redundancy, and modality.
   This is the most actionable theory for prose + figures content.
2. **`cognition/cognitive-load-theory.md`** — element interactivity, worked
   example effect, expertise reversal.
3. **`practices/effective-techniques.md`** — self-explanation prompts,
   retrieval practice, spaced/interleaved exercises.
4. **`practices/variation-theory.md`** — example design.

Then as background:
- `principles/how-learning-works.md` — always useful
- `design/backward-design.md` — if the chapter's goals are hazy
- `design/bloom-taxonomy.md` — when looking at exercises

Situational pulls:
- If the chapter teaches a procedural skill (math, programming, lab protocol):
  add `cognition/cognitive-load-theory.md` with focus on worked examples and
  faded scaffolding.
- If it teaches conceptual understanding of a contested or counterintuitive
  topic: add `practices/variation-theory.md` with focus on contrasting cases.
- If it's a chapter with heavy embedded exercises: add `assessment/item-writing.md`.
- If written for a very diverse audience: add `design/universal-design.md`.

If the chapter is part of a textbook being designed (not an existing chapter
being critiqued), also load `practical/course-and-syllabus.md` for how the
chapter fits into a larger course arc — especially reading load, sequencing,
and the relationship between chapter and class meetings.

## Output format

For critique, use the same Strengths → Critical → Important → Refinements →
Tradeoffs → Next Steps structure described in the SKILL.md workflow. Cite
locations specifically (`[Section 3.2, paragraph 1]`, `[Figure 4]`,
`[Exercise 3.14]`).

For design, structure the output as a chapter blueprint:

```
## Chapter title
## Learning objectives
## Prior knowledge assumed
## Chapter outline (sections, flow, approximate length each)
## Key figures / diagrams (with purpose)
## Worked examples / example progression (with the critical features each foregrounds)
## Embedded retrieval / self-check prompts (placement and purpose)
## End-of-chapter exercises (with Bloom level coverage and variety)
## Connections forward and backward (how this chapter fits in the larger curriculum)
```

## A note on "textbook chapter" vs. "tutorial"

If the content is heavily procedural ("here's how to do X, step by step,
building up a skill"), read `tutorials.md` in addition to this file — tutorials
have their own pattern language (worked examples, scaffolded practice, paradigm
transitions) that's more specific than a general chapter.

If the content is primarily conceptual (explaining what a thing is, why it's
true, how to think about it), stay with this file.

If it's a mix — common in CS/engineering textbooks — read both.
