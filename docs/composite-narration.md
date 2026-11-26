# Composite narrated lesson

The Composite chapter opens with a 12½-minute narration built on the shared
player in `docs/narrated-pattern.md`. Its example is a phone story, a summer
photo dump: the story is split side by side into the beach photo and a right
half, the right half is stacked into the cat and a bottom split, and the
bottom split holds the gig and the taco side by side. Every tile, photo or
split, shows a photo count and has a Share button. The collage *is* the
object tree: each split cuts its area into equal parts and hands one to each
of its tiles, so drawing the story paints the tree, and one press of Share
visibly travels down it.

## Sources

See [the shared format](narration-format.md). Spoken `say` cues and teaching
text live in `_data/narrations/composite.yml`; diagrams, code focus, and panel
state live in `_data/narration_visuals/composite.json`.

The lesson follows four books and copies none of their examples (no graphics
editor or equipment cabinet, no restaurant menus, no CAD car, no XML tags or
product parts). The narration never says their names aloud; each cue that
draws on one shows the source on screen in its `source` field:

- **Design Patterns (GoF), Composite:** the intent and applicability
  (part-whole hierarchies; clients that ignore the difference between a
  composition and a single object), the participants and collaborations (a
  composite forwards requests to its children, possibly doing work before or
  after), the consequences (primitive and composite objects compose
  recursively; simple clients, which need no tag-and-case code over the
  classes in the structure; easy new kinds of components; an overly general
  design whose restrictions need runtime checks), and three implementation
  issues: sharing components (a photo that never changes and knows no parent
  can sit in two stories), declaring the child-management operations (safety
  versus transparency), and child ordering (list order is reading order). The
  related-patterns section and the discussion of Composite versus Decorator
  supply the applicability scene's neighbors.
- **Refactoring to Patterns (Kerievsky):** *Move Accumulation to Collecting
  Parameter*, which he notes works nicely with Composite, gives `draw` its
  canvas parameter; *Replace Implicit Tree with Composite* supports adding only
  the child operations the program needs (the lesson has `add`, but no
  `remove` and no parent references).
- **Head First Design Patterns:** the safe and transparent variants, and the
  observation that the transparent version trades single responsibility for
  uniform clients, while the safe one makes adding code check types.
- **Pattern-Oriented Software Architecture, Vol. 1, Whole-Part:** Composite as
  the variant of a whole-part structure whose wholes and parts share one
  interface, which frames the context scene's "wholes made of parts".

## The first design checks types

The first design is code a reasonable developer writes for version 1: `Photo`
and `Split` share no type, so a split's items are photos or splits, and every
operation asks which one it holds (`if photo … elif split …`, with no `else`).
`Split.draw` draws a photo itself or forwards to a nested split, `Split`'s
photo count adds one or asks the nested split, and the Share button checks its
selection the same way, so drawing a photo lives in two places.

For the photo story, both designs draw exactly the same lines. When captions
arrive, all three checks need a new branch; the lesson's version misses the
one in `Split.draw`, so the caption's area stays blank and nothing reports an
error (the count stays right, because a caption has no photos). Two lists, one
for photos and one for splits, would have been a strawman here, since a
layout's order obviously matters. `_data/explainers/composite_ui.yml` records
the blank caption as `first_design_caption`, and the node test checks each
design against it.

## Learning sequence

Each scene shows its part of the pattern description (Context, Problem,
Solution, Consequences):

1. Introduction: the summer story; every tile has a live Share button to try.
2. Context: part-whole hierarchies that nest, clients that treat one item and
   a group alike, and trees elsewhere; leaf and composite are defined.
3. Problem: the area helper both designs share, the first design and its
   photo-or-split checks in every operation and in the Share button, a
   prediction about captions, the cost (three branches; a missed one leaves a
   blank area with no error), and four demands on a solution.
4. to 6. The concrete redesign, one class per scene: `Tile` (one shared type;
   `draw` takes the canvas that collects one line per tile), `Photo` (answers
   directly; never changes, so two stories can share it), and `Split` (one
   ordered list; the photo count sums, `draw` cuts and forwards in list order;
   `add` only here is the safe choice, and a separate cue gives the
   transparent one).
7. Collaborations: one press of Share traced on a sequence diagram and on the
   canvas, with a prediction before the first tile is drawn. The code panel
   shows `Split.draw` and `ShareButton.press` together: the `split` block holds
   both classes, so the trace can mark either.
8. The abstraction: Component, Leaf, Composite, and Client on a role diagram,
   set beside the tree of objects, each role mapped to the class that played
   it.
9. Consequences (simple clients, new kinds fit in, overly general with a
   photo-booth strip, safety or transparency), then applicability (real
   nesting; a carousel post is a plain list, and one class with optional
   children can do for one kind of leaf; a polaroid frame is a Decorator;
   Composite inside Model-View-Controller and macro commands), then a
   transfer task: a caption is one new class.
10. A summary of all four parts, then a six-question quiz on a study planner
    whose projects hold tasks and other projects.

The transfer shows no code: the player shows one code block for a whole
scene, so the `caption` block would answer the prediction before it is asked.
Its class diagram switches to the variant with `Caption` at the answer, and
the `caption` block appears in the reader's complete examples. The `area`
block is never on the stage either; the problem's `area` cue marks the first
design's calls to `area.part` and explains the helper in words.

## Files

- `_data/narrations/composite.yml`: speech, scenes, parts, and teaching text.
- `_data/narration_visuals/composite.json`: diagrams and renderer state.
- `_data/explainers/composite_code.yml`: the four-language examples. The first
  design uses the same class names, so the node test runs it as its own
  program; TypeScript and C++ declare its "photo or split" type once, so the
  test can widen it for captions.
- `_data/explainers/composite_quizzes.yml`: section checks and the summary quiz.
- `_data/explainers/composite_notes.yml`: key points for the editable handout.
- `_data/explainers/composite_study.yml`: review retries, two diagram
  exercises, and two design comparisons for the study tools.
- `_data/explainers/composite_ui.yml`: the oracle. It holds the story's rows,
  the captioned rows, position words for every area a Share press can draw,
  the expected canvases (the splits each draw cuts and the tiles it draws), and
  one panel per narrated picture.
- `tests/helpers/composite-collage.js`: an independent specification of both
  designs. The node test pins it to the oracle's hand-written values, and the
  four-language programs, the static panel, and the live script are each
  compared with it.
- `_includes/composite-collage-panel.html`, `css/composite-narration.css`, and
  `assets/narration/composite-art/*.svg`: the static collage (reader, print,
  notes). The canvas is a 4 × 4 grid (one cell is 270 × 480 story pixels), and
  every tile is placed by class, never by inline coordinates.
- The site inverts article SVGs and SVG images in dark mode
  (`html.dark-mode .post-content svg`, `img[src$=".svg"]`). The photo
  illustrations keep their light colors in every theme, as photos do, and the
  Share icons take the theme's colors, so both opt out with `filter: none`.
- `js/composite-collage.js`: the live collage in the player, built with the
  pattern it teaches. Each cue's state comes from the static panel's
  `data-composite-cue`; a trace that continues the previous cue's trace draws
  the newly drawn tiles one at a time. Learners can press Share on any tile, in
  the first design or the composite, and watch it fill the story; a polite
  status reports each press. Reduced motion skips the stepping.

## Regeneration and checks

Render with a Drama 3 server, as described in
[Speech engines](narration-format.md#speech-engines):

```sh
python scripts/render-explainer-narration.py --topic composite
```

`node --test scripts/tests/composite-narration.test.js` pins the
specification to the oracle, checks every panel, the storyboard's targets and
marks, pauses, timing, and quizzes, and runs both designs in every language:
the complete example, every tile shared on its own, a captioned story that
reuses the photo story's objects, a GIF leaf the lesson never wrote, and the
first design's blank caption. Python 3, a JDK, clang++ (C++17, `-Werror`), and
Node.js with type stripping are needed for the language checks; missing tools
are skipped. The same test type-checks the TypeScript programs with
`tsc --strict`. `tests/composite-narration.spec.js` covers the player, the
live collage, the reader and print views, themes, mobile layout, and
accessibility.
