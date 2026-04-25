---
name: good-diagrams
description: Editorial guidelines for deciding WHEN a diagram earns its place in SEBook, and HOW to design it so it actually teaches. Invoke this skill every time you are about to add, edit, or review a diagram, or when you are deciding whether prose alone is sufficient. Pairs with the `diagrams` skill (which covers syntax / renderer choice) — this skill covers pedagogy and editorial judgment. Grounded in Mayer's multimedia-learning principles, Tufte's data-ink, Sweller's cognitive-load theory, Ambler's UML style, and Brown's C4 model.
---

# Good diagrams in SEBook

Syntax is covered by the `diagrams` skill. This skill answers two harder questions: **should a diagram exist here at all**, and **will it actually help a student learn**.

## The prime directive

**A diagram earns its place only when it carries structural or temporal information that prose cannot compress.** Decorative figures and "chapter needs a picture" additions hurt learning — Mayer's Coherence Principle shows adding relevant-but-non-essential material *reduces* retention (effect size 0.86 across 23 of 23 experiments).

Before adding a diagram, write its caption first:

> "After reading this diagram, the student should understand that ___."

If you cannot finish that sentence with a concrete takeaway that the surrounding prose doesn't already convey, **don't add the diagram**.

## Decide: is a diagram warranted?

### Add a diagram when

- You are describing relationships among **3+ entities** (who calls whom, what contains what, what happens before what).
- You find yourself writing phrases like *"A sits between B and C"*, *"the request flows through X then Y then Z"*, *"these four states transition as follows"*, *"the tree looks like..."*.
- You're explaining a **topology, hierarchy, process, or lifecycle** — architecture, folder tree, git history, state machine, message sequence, class inheritance.
- The reader must hold **spatial or temporal structure** in working memory to follow the next paragraph.
- You're showing a **before/after** or contrasting two designs — small multiples (Tufte) excel here, especially for refactoring and design-pattern applications.
- A concept has **multiple simultaneous attributes** (role + lifecycle + communication channel) that prose can only serialize awkwardly.

### Do NOT add a diagram when

- The content is **linear** — a numbered list or bulleted list already captures it.
- You'd draw only **one or two boxes**. A sentence is faster and clearer.
- The figure would **merely restate prose** with no new structural insight (Redundancy Principle violation).
- You cannot write a one-sentence caption stating the takeaway — it's decorative, not explanatory.
- The material is **deeply abstract** (e.g., referential transparency, type erasure) with no natural spatial metaphor — forcing boxes invents false structure.
- Accurate rendering would require **so much detail the diagram becomes a reference schematic** — split it, or drop to prose + code.
- The page already has a diagram covering the same concept — don't duplicate.
- The surrounding page is already dense with diagrams and readers would skim. Coherence matters: fewer, better figures beat many mediocre ones.

### Hard "no" signals

If the answer to any of these is yes, you're about to add a bad diagram — stop:

- "I just want something visual on this page." (chartjunk)
- "Let me illustrate every sentence in this section." (redundancy)
- "This is hard to understand — maybe a picture will save it." (usually the prose needs fixing first; pictures don't rescue bad explanations)
- "I'll show the whole system." (almost always wrong abstraction level — narrow the scope)

## Design rules (apply to every diagram you add)

These are the 10 rules a reviewer should check against. Each is tied to a specific empirical principle.

**1. One diagram = one takeaway.** If it teaches two things, split it into two figures. (Coherence Principle.)

**2. Pick one abstraction level and commit.** Don't mix a user-facing service box with a database's internal schema on the same figure. The C4 model's whole point is that Context, Container, Component, and Code are *separate* diagrams. Mixing levels makes peers unidentifiable.

**3. Place the diagram adjacent to the prose that references it.** Same screen, same scroll. The Spatial Contiguity Principle shows co-location produces learning gains (effect size 1.10, 22/22 experiments). If the paragraph that introduces the diagram is two screens up, readers lose the thread.

**4. Labels go on the thing, not in a distant legend.** Split-Attention Effect (Chandler & Sweller): forcing readers to fuse an image with a separate key inflates cognitive load. Put the role name inside the box, the verb on the arrow, the multiplicity at the endpoint — not in a side table.

**5. Signal what matters most.** Use weight, color, numbered callouts, or arrow emphasis to mark the critical path. Supporting infrastructure should recede visually. Mayer's Signaling Principle: cued elements are processed more deeply.

**6. Strip every mark that doesn't carry meaning.** No 3D effects, no gratuitous icons, no decorative gradients. Tufte: "Above all else show the data." In non-data diagrams: every shape, color, and line should encode a distinction. If color isn't a variable, don't use color.

**7. Keep notation consistent with the rest of the book.** Same shape means the same thing everywhere. If a cylinder is a database in the architecture chapter, it cannot be a queue in the state-machine chapter. Check neighboring chapters before inventing notation.

**8. Prefer the most specific diagram type available.** A state machine drawn in freeform is worse than one drawn with `language-uml-state` — the renderer gives you proper initial/final markers, guard syntax, and transition labels for free. Same for commit DAGs (use `diagram-gitgraph`), directory trees (use `diagram-folder-tree`), class hierarchies (use `language-uml-class`), set-membership comparisons (use `diagram-venn`, not freeform circles), and database schemas (use `diagram-er` for Chen-notation entities/relationships).

**9. Cap complexity per figure.** Soft caps that have worked in SEBook:
   - Class diagram: ≤ 7 classes visible at once; show only methods/fields relevant to the point (Fowler's "sketch mode").
   - Sequence diagram: ≤ 5 lifelines; if you need more, split by phase.
   - State diagram: ≤ 8 states; collapse related states into a composite state if needed.
   - Venn: 2–3 sets is comfortable; 4–5 are legible but tight. Never more — for 6+ attributes, use a comparison table or UpSet plot instead.
   - ER: ≤ 6 entities per figure; if your schema is bigger, split into sub-domains (customers + orders in one figure, catalog + inventory in another).
   - Freeform: ≤ 10 boxes; any more is usually a sign the abstraction is too low.

**10. Prose and diagram do different work.** The diagram shows *structure and relationships*. The prose provides *causality, motivation, edge cases, and the "why"*. If your prose reads like a tour of the boxes ("the Controller connects to the Model, which connects to…"), delete one of them — you're just duplicating.

## Placement and caption conventions

- The diagram goes **immediately after** the paragraph that introduces it, not at the top of the section or the end of the page.
- The paragraph immediately before the diagram should set up the question the diagram answers ("how does a request flow through the layers?" / "what state is the connection in when the timer fires?").
- Prefer a short caption or a one-sentence lead-in that names the takeaway. SEBook doesn't enforce a caption style; a bold lead-in sentence immediately below the figure is acceptable ("**Figure:** the controller mediates between view and model; the model never calls the view directly.").
- Don't re-introduce a diagram in a later section — reference it back if needed.

## Small multiples for before/after

When teaching a refactoring, a design pattern's application, or "the problem vs. the fix", use **two diagrams side-by-side with identical notation and scale**. Tufte's small-multiples principle: the eye detects the *difference* between comparable pictures far faster than it reconstructs a change from prose. In SEBook this typically means two `diagram-freeform` or two `language-uml-class` blocks in succession, with matching layouts so the reader's eye lands on the same spot in each.

## Audit checklist (use when reviewing an existing page)

Go through each diagram on the page and ask:

1. **Caption test** — can you finish "the student should learn that ___"? If not, flag for removal.
2. **Prose overlap** — does the surrounding paragraph narrate the diagram? If yes, cut the narration or cut the diagram.
3. **Abstraction level** — are all elements peers at one level? Flag mixed levels.
4. **Complexity** — over the soft caps in rule 9? Split.
5. **Label placement** — any labels in a legend that could live on the element? Move them.
6. **Notation consistency** — same shapes/arrows as neighboring chapters? If not, reconcile.
7. **Signal** — is the critical path visually distinct from supporting elements? If everything is the same weight, add emphasis.
8. **Redundancy** — every box, arrow, color carries information? Strip what doesn't.
9. **Right type** — is this freeform when a specific type (`language-uml-state`, `diagram-gitgraph`, `diagram-folder-tree`, etc.) would fit? Switch.
10. **Co-location** — is the diagram on the same screen as its introducing paragraph? Move it.

## How this skill pairs with others

- **`diagrams` skill** — tells you *which renderer class to use and where to find syntax*. This skill tells you *whether to draw at all, and how to design for learning*. Invoke both together: this skill first (should I? what should it show?), then the `diagrams` skill (how do I render it?).
- **`uml-diagramming` skill (if available)** — deeper UML-specific style critique (arrow semantics, multiplicity, naming). Invoke after the other two when the diagram is UML.

## Sources

Empirical claims above come from:

- Mayer, *Multimedia Learning* — Coherence, Signaling, Redundancy, Spatial Contiguity, Temporal Contiguity, Modality Principles. (Cambridge Handbook of Multimedia Learning.)
- Chandler & Sweller (1992) — Split-Attention Effect. Cognitive Load Theory.
- Paivio — Dual-Coding Theory.
- Tufte, *The Visual Display of Quantitative Information* and *Envisioning Information* — data-ink ratio, chartjunk, small multiples.
- Ambler, *The Elements of UML 2.0 Style* — general diagramming guidelines; consistency.
- Fowler, *UML Distilled* — "sketch mode"; UML as communication.
- Brown, C4 model — one abstraction level per diagram; legends and titles.
- Novak et al. — concept maps and learning.
