# Cognitive Load Theory

Sources: Sweller (1988, 2011), Sweller, van Merriënboer, & Paas (1998),
Kirschner, Sweller, & Clark (2006), Kalyuga (2007). The project contains
Moreno & Park and related chapters from *Cognitive Load Theory* (Plass,
Moreno, & Brünken, eds., Cambridge 2010).

CLT is the most actionable theory for decisions about *how to present*
instructional content. It is grounded in human cognitive architecture:
a long-term memory that is effectively unlimited but can only be acted on
indirectly through a very limited working memory. Instructional design
that ignores these limits fights against how learning works; design that
respects them aligns with it.

## The core architecture

**Working memory** is small — classically 7±2 items (Miller), revised
down to 4±1 when the items have to be actively manipulated (Cowan).
Information that isn't rehearsed or encoded is lost within ~20 seconds.

**Long-term memory** stores *schemas* — organized structures of
knowledge. A schema in LTM acts as a single item in working memory,
regardless of how complex it is. This is why an expert can reason
fluidly about situations that overwhelm a novice: what's many
interacting elements for the novice is one chunk for the expert.

**Learning = schema acquisition**. The goal of instruction is to build
schemas in long-term memory that the learner can then deploy efficiently.
When we say "learning happened," we mean schemas were constructed that
allow the learner to act in this domain with less working-memory load
than they needed before.

This has sharp implications:

- **Working memory is the constraint.** If an instructional moment
  presents more than the learner's working memory can handle, schema
  construction fails.
- **Novices and experts need different instruction.** What helps a novice
  build schemas can hinder an expert who already has them (expertise
  reversal effect).
- **The goal is automation.** Once a schema is built and automated, it
  costs little working memory to use. This frees capacity for more
  complex learning. This is why practice matters.

## The three types of cognitive load

CLT's organizing concept: the total load on working memory is the sum of
three components, and only the total matters for overload.

**Intrinsic cognitive load** is the load imposed by the *material itself*
— specifically by the element interactivity. A single fact has low
intrinsic load; a concept that requires simultaneously understanding five
interacting elements has high intrinsic load. Intrinsic load is a
property of the material relative to the learner's current schemas — as
the learner builds schemas, what was high interactivity becomes low.

Intrinsic load is often described as "unchangeable by instructional
design," but that's not quite right. You can't change the underlying
complexity, but you *can*:

- Sequence from simple to complex
- Decompose high-interactivity material into parts learned separately
  before combining
- Pre-teach prerequisite schemas so that what would have been multiple
  elements becomes one chunk
- Simplify the scenario first, then add complexity

**Extraneous cognitive load** is load imposed by the *way material is
presented* that doesn't contribute to learning. It's what can be reduced
by better instructional design. Sources include:

- **Split-attention**: learner has to integrate information presented
  separately (diagram here, labels there)
- **Redundancy**: the same information presented in multiple ways
  simultaneously (on-screen text plus identical narration)
- **Poor sequencing**: concepts presented out of order, forcing the
  learner to hold things open
- **Search costs**: having to find the relevant information in a cluttered
  layout
- **Unclear language**: convoluted sentences that add parsing load
- **Irrelevant detail**: interesting but off-topic material that diverts
  processing

**Germane cognitive load** is load imposed by *cognitive activities that
build schemas*. Self-explanation, comparison across examples, elaboration
— these all consume working memory but do so in service of learning. When
there's room, germane load should be maximized; when there's no room
(because intrinsic + extraneous are saturating), germane activities
won't fit.

The key design move: **minimize extraneous load so that the remaining
working-memory capacity is available for intrinsic and germane load**.
When intrinsic load is high (complex material), this matters a lot.
When intrinsic load is low (easy material), extraneous load doesn't
bottleneck learning as much.

## The CLT effects — patterns that design must respect

CLT has identified dozens of empirical "effects" over 30+ years. The
most important for instructional design:

### The worked-example effect

For novel procedural skills, *studying a fully worked-out example leads
to better learning than attempting to solve a comparable problem*, even
though the problem-solving seems more engaging. Problem-solving without
a schema produces means-ends analysis, which consumes working memory but
doesn't build schemas. Worked examples show the schema in action, letting
the learner encode it.

**Design implication**: introduce new procedures with complete worked
examples. Don't ask learners to independently solve problems involving
the procedure until they've studied several worked examples.

### The faded-scaffolding / completion effect

Worked examples shouldn't continue indefinitely. As the learner builds
schemas, they need to practice independently or the schemas don't
consolidate. The move from worked → partially worked (some steps hidden
or blank) → independent problem-solving is called *scaffold fading*.

**Design implication**: sequence from fully worked examples, to
completion problems (fill in the gap), to independent practice. Don't
skip steps.

### The expertise reversal effect

The worked example effect works for novices. For experts, it reverses:
experts learn *less* from studying worked examples than from solving
problems. Experts already have the schemas, so the worked example is
redundant. The cognitive effort of processing the example competes with
applying existing schemas.

**Design implication**: instruction that works for novices may need to
be stripped down for more advanced learners. Don't apply beginner
scaffolds to advanced learners — you'll slow them down. This is part of
why one-size-fits-all instructional design fails; expertise level
matters.

### The split-attention effect

When learners must integrate information from multiple sources (e.g., a
diagram and explanatory text shown separately), the integration itself
costs working memory. Physically integrating the sources reduces this
load.

**Design implication**: embed labels in diagrams rather than using
legends. Place text near the parts it describes. Avoid flipping between
pages or windows. This is Mayer's spatial contiguity principle in CLT
language.

### The redundancy effect

When the same information is presented in multiple formats
simultaneously — e.g., on-screen text that duplicates the narration —
working memory is spent processing redundant representations, at cost
to learning.

**Design implication**: don't duplicate. If the narration covers it,
don't put it on the slide. If the diagram shows it, don't also describe
it verbally. (Note: this is different from genuine complementarity, where
visual and verbal each carry distinct information.)

### The modality effect

Presenting information in mixed modalities (visual + auditory) often
outperforms single-modality presentation because the auditory and
visual working-memory channels are somewhat separate (dual-channel
assumption, Baddeley & Mayer).

**Design implication**: narrated diagrams often outperform text-next-to-
diagram, especially for novel content. But this interacts with
redundancy: if the narration and text are identical, the redundancy
effect can dominate.

### The element-interactivity effect

Effects like split-attention and redundancy only appear when
element-interactivity is high (complex material). For simple material,
these effects are negligible. Research controversies in CLT often stem
from studying effects with simple material where they don't emerge.

**Design implication**: apply CLT principles most rigorously to the
hardest parts of your material. For simple introductory content, cleanliness
matters less.

### The imagination effect and self-explanation effect

Asking learners to imagine or self-explain a worked example (rather than
just read it) improves learning. These are germane-load-increasing
moves — they consume working memory in service of schema construction.

**Design implication**: embed prompts like "Before reading the solution,
predict what will happen" or "Explain in your own words why step 3 is
necessary."

### The variability effect

Worked examples that vary on the surface (different cover stories,
different numbers) while sharing the deep structure produce better
transfer than repeating near-identical examples. This is CLT's version
of Variation Theory.

**Design implication**: multiple examples of a concept should vary, not
repeat. See `practices/variation-theory.md`.

## Applying CLT to design and critique

### Checklist for presentation-heavy content (lectures, textbooks, videos)

**Element interactivity**
- For each segment, count the novel interacting elements. If > 4-5 for a
  novice learner, decompose or sequence.
- Are complex topics introduced piece by piece, or dumped all at once?

**Worked examples for novel procedures**
- Before any independent practice on a new procedure, are there worked
  examples?
- Do the worked examples show the *reasoning* (why each step), not just
  the steps?
- Is there a progression from fully worked → partial → independent?

**Split-attention**
- Are diagrams integrated with their labels/explanations?
- Do code and its explanation appear together?
- Is information physically co-located when it must be mentally
  integrated?

**Redundancy**
- Is the same information being delivered in multiple channels
  simultaneously?
- Can redundant text be removed from narrated slides?

**Expertise level**
- Is the scaffolding calibrated to the target audience's expertise?
- Would an advanced learner find this slow and over-scaffolded?
- Would a beginner find this too compressed?

**Engagement with the material** (germane load)
- Are there self-explanation prompts?
- Are there prediction/generation moments?
- Are learners asked to compare examples?

### Common CLT failures in instructional materials

1. **The "dump" slide**: introduces 6+ new concepts with their relationships
   all at once. Element-interactivity through the roof.
2. **The legend diagram**: complex diagram with labels in a separate legend,
   forcing split-attention.
3. **The narrated text slide**: slides with dense text that the speaker
   reads aloud. Both redundancy and split-attention.
4. **The problem-first instruction**: "try to solve this problem"
   before any worked example. Works for experts, fails for novices.
5. **The one-and-done worked example**: a single worked example followed by
   many independent problems. Worked example effect is real but the
   scaffold fade is too fast.
6. **The expert-designed beginner tutorial**: the expert can't see the
   interactivity that's overwhelming beginners. The "obvious" connections
   aren't.

## On "germane load" specifically

The concept of germane load has been somewhat contested within CLT
research. Some theorists argue it's not a separate category — it's just
intrinsic load processed productively. For design purposes, the
practical point is the same: we want learners to be spending working
memory on schema-building activities (self-explanation, comparison,
imagination, worked-example study, retrieval) rather than on
extraneous-load activities (search, integration, redundancy).

## Relationship to multimedia learning

Mayer's cognitive theory of multimedia learning (see
`cognition/multimedia-learning.md`) is essentially an extension of CLT
applied to multimedia (text + images + audio) content. The twelve
principles Mayer articulates all trace back to CLT concepts plus
dual-channel assumptions. If you're looking at a slide deck, video, or
multimedia tutorial, use both CLT and Mayer's principles.

## Summary

The core design move from CLT: **build schemas deliberately**. Scaffold the
presentation so that working memory isn't overwhelmed, so that errors
from overload don't compound, so that germane activity (the stuff that
actually builds schemas) has room to happen. Work with cognitive
architecture, not against it.

The core evaluation move from CLT: **count the interacting elements**
and ask whether the design respects working-memory limits — or expects
a novice to have the working memory of an expert.
