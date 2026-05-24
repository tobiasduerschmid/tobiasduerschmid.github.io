# Variation Theory

Source: Marton & Booth (1997), *Learning and Awareness*. Marton (2015),
*Necessary Conditions of Learning*. Runesson (2005), "Beyond Discourse
and Interaction."

Variation Theory is about **example design**: how to select and
sequence examples so that learners can discern what matters. The central
insight is deceptively simple but consequential: **learners can only
learn about a feature if it varies in their experience**. If a feature
is held constant across all the examples they see, they have no way to
notice it as a dimension of the concept.

This makes example design one of the most underrated parts of
instruction. Most instructors pick examples by familiarity or
convenience. Variation Theory asks: what does the *pattern of variation*
across the examples let the learner discern?

## The core idea

Every concept has **critical features** — the aspects that define it,
distinguish it from similar concepts, and make the concept work. To
learn the concept, the learner has to come to *discern* these critical
features.

Discernment requires variation. If every example of "function" in a
programming course is a pure function that takes an integer and returns
an integer, the learner can't tell whether:
- "returns a value" is critical (it might be; it might just be what
  these examples happened to do)
- "takes one argument" is critical (also might or might not)
- "integer types" is critical (might be incidental)
- "no side effects" is critical

Only when examples *vary* on a feature can the learner figure out
whether that feature matters.

## The four patterns of variation

Marton distinguishes four patterns of variation that serve different
learning purposes.

### Contrast

To learn that something *is* the case, the learner must experience what
it is *not*. To understand what a function is, the learner must see
something that isn't a function.

Contrast means juxtaposing an example with a non-example that differs
on exactly the critical feature being taught, while holding other
features constant. This makes the critical feature pop out.

- Learning what recursion is: show a function with self-reference
  (recursive) vs. a function without self-reference (not recursive).
- Learning what a covalent bond is: show a covalent bond vs. an ionic
  bond.
- Learning what a thesis statement is: show one that previews an
  argument vs. one that's just a topic announcement.

**Design move**: for each critical feature, pair examples that differ
on that feature and are matched on others.

### Generalization

Once the learner has discerned a feature, they need to see it in
varied contexts to recognize it outside the specific examples
originally used. Generalization means varying features that *aren't*
critical while holding the critical one constant.

- After teaching what a function is with an integer → integer example,
  show function examples with different argument types, different
  return types, different body complexities. The learner sees that
  "function-ness" persists across these variations.
- After teaching what a valid thesis is, show examples on different
  topics, in different disciplines. The pattern persists.

**Design move**: show the concept across varied surface features to
abstract it from any specific example.

### Separation

Some concepts have multiple critical features that are always
together in real examples, making it hard to see them separately.
Separation means constructing examples that decouple features that
usually co-occur.

- In programming: iteration and mutation often come together (for-loops
  that update state). To separate them, use examples of iteration
  without mutation (map, list comprehension) and mutation without
  iteration (a single assignment). This reveals that they're separate
  features.
- In physics: force and motion often feel linked, but objects at
  constant velocity have no net force (Newton's first law). This
  separation is the conceptual hurdle.

**Design move**: when features always co-occur in naturalistic
examples, deliberately construct examples where they don't.

### Fusion

After learners have discerned multiple critical features separately,
fusion brings them back together — varying multiple features
simultaneously to show how they interact and how the concept
integrates.

- After teaching functions separately from data types, show examples
  where both vary and the interaction matters.
- After teaching melody and harmony separately in music, show their
  interaction.

**Design move**: after separation, provide examples that vary multiple
critical features together to build integrated understanding.

## The structure of an effective example sequence

A well-designed example sequence typically moves through these patterns:

1. **Start with contrast** to establish what distinguishes the concept.
2. **Move to generalization** to show that the concept persists across
   varied contexts.
3. **Use separation** to untangle features that appear fused in
   practice.
4. **End with fusion** to show integrated understanding.

This isn't a rigid script, but the logic is important. Jumping straight
to varied examples (generalization) without contrast leaves learners
unsure what's even being generalized. Staying in separation without
fusion leaves them with disconnected features.

## The common failure patterns

### Single-example teaching

One example per concept. The learner has no way to tell the critical
features from the incidental ones.

**Symptom**: "In this example, we have an integer variable `count`
initialized to 0…" → concept is taught → no further examples. Students
come to believe that `count` is somehow part of the concept.

### Kitchen-sink examples

Examples so loaded with detail that variation is inaccessible. Every
example varies along 15 dimensions, so contrast is impossible.

**Symptom**: the instructor walks through an elaborate, real-world case
study to illustrate a concept, where the concept is buried under the
details.

### Positive-only examples

Only examples of the concept, no non-examples. Learners can induce
what the concept is, but less reliably than with contrast.

**Symptom**: "Here are seven examples of recursion." No examples of
what's not recursion. Students who don't quite get it have nothing to
compare against.

### Unvaried critical features

The critical features are held constant across all examples, often
incidentally. Learners don't discern them.

**Symptom**: every example of "polynomial" in a calculus class is in
the form $x^2 + x + 1$. Students don't realize that $x^3$ is also a
polynomial, or that $x^{0.5}$ is not.

### Confounded variations

Examples vary along multiple dimensions simultaneously, making it
impossible to know which dimension the learner is supposed to notice.

**Symptom**: to contrast "recursive" vs "iterative" solutions, the
instructor shows a recursive factorial vs. an iterative Fibonacci.
Both recursion status AND algorithm differ. The contrast is muddled.

## Contrasting cases specifically

Contrasting cases are a particularly powerful form of structured
variation. A contrasting case is a pair of near-identical items that
differ on exactly the critical feature. The two examples are as
similar as possible *except* for the one thing the learner is supposed
to notice.

Research by Schwartz, Bransford, and colleagues has shown that
contrasting cases prime learners for subsequent instruction even more
than direct instruction does. The move: give learners contrasting
cases, ask them to identify what's different, and only then provide
the formal explanation. This puts them in a state where the
explanation is maximally meaningful.

## Applying VT in different content formats

### In lectures and demonstrations

- For each core concept, plan 3-5 examples that exhibit the four
  patterns of variation.
- Use non-examples ("here's what this isn't and why").
- Explicitly narrate the contrasts: "notice that in this example X
  changed but Y didn't — that's because Y is the critical feature of…"
- Before revealing the concept's definition, show contrasting cases
  and ask learners what they notice.

### In textbook chapters and written tutorials

- Don't present the concept first and then a single example. Present
  contrasting cases first.
- Sequence examples to move through contrast → generalization →
  separation → fusion.
- Use sidebars for non-examples ("common misconception: students often
  think this is an X, but it isn't because…").
- At key junctures, ask the reader "why do these two examples count as
  instances of the concept but this third one doesn't?"

### In homework and practice problems

- Problem sets should mix examples and non-examples early on
  (classification problems that build discrimination).
- Problems should vary on different dimensions to build
  generalization.
- Interleaving across problem types builds discrimination (this is
  where Variation Theory meets Dunlosky's interleaving finding).

### In exam questions and assessments

- Use distractors in multiple-choice questions that vary along
  dimensions that matter — to assess whether the learner discerns the
  critical features.
- Include items that test generalization — novel surface features,
  same deep structure.
- Include items that test discrimination — superficially similar to
  the target but critically different.

## The object of learning

A concept from Variation Theory worth calling out: the **object of
learning** is not the topic. It's the specific understanding you want
the learner to come to. "Recursion" is a topic. "Understanding that
recursive solutions require a base case that terminates and a
recursive case that makes progress toward the base case" is an object
of learning.

The object of learning is much more specific than the topic, and it
identifies the critical features directly. Being explicit about the
object of learning (to yourself as designer and to the learner as a
compass) forces the critical features to be surfaced and makes
variation design possible.

## Critique checklist

When examining how a piece of content uses examples:

1. **Is the object of learning clear?** Not just the topic, but
   specifically what's supposed to be understood.
2. **Are critical features identified** (explicitly or implicitly)?
3. **Is there contrast?** Non-examples? Near-misses?
4. **Is there generalization?** Multiple examples varying on
   incidental dimensions?
5. **Is there separation where features normally fuse together?**
6. **Is there fusion of features that were separated?**
7. **Are variations clean** — varying one dimension at a time — or
   confounded?
8. **Do examples include common misconceptions** the learner is
   likely to hold?

## Red flags

- Single-example teaching for non-trivial concepts.
- Examples that all look alike on the surface.
- Examples that vary on multiple dimensions at once without
  commentary.
- Absence of non-examples for concepts that have fuzzy boundaries.
- Concept first, example second, no further examples.

## Variation Theory + CLT

A tension worth acknowledging: adding more examples increases cognitive
load. For novice learners with no schemas, too many varied examples at
once can overwhelm working memory.

Resolution: **sequence with difficulty**. Start with a small number of
clearly contrasted examples, building initial schemas. Then expand to
more varied examples for generalization as the schemas consolidate.
Don't dump all variations on the learner at first exposure.

This is part of why faded scaffolding (in CLT terms) and progressive
variation are complementary design moves.

## Summary

**Design example sequences, not just examples**. The learner can only
learn about what varies. Select contrasts, generalization, separation,
and fusion patterns that let the critical features become discernible.
Use non-examples. Vary surface features while holding structure
constant. Hold surface features while varying structure. Name the
object of learning explicitly.

**Most instruction fails the VT test**, and fixing it has large effects
on conceptual understanding and transfer.
