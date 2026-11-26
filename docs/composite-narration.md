# Composite narrated lesson

The Composite chapter opens with a 12-minute narration built on
the shared player in `docs/narrated-pattern.md`. Its example is a music
library: a Road Trip playlist holds a song, the whole Throwbacks playlist, and
another song, and every row, song or playlist, has a length and a Play button.
Playlists inside playlists are a real part-whole hierarchy that nests, and
music apps keep adding new kinds of playable items (podcast episodes,
audiobook chapters, albums), so adding a kind of component is the realistic
change the pattern is chosen for.

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
  composition and a single object), the participants and collaborations
  (a composite forwards requests to its children, possibly doing work before or
  after), the four consequences (primitive and composite objects compose
  recursively, simple clients without tag-and-case code, easy new kinds of
  components, an overly general design whose restrictions need runtime
  checks), and three implementation issues: sharing components (a song that
  never changes and knows no parent can sit in several playlists), declaring
  the child-management operations (safety versus transparency), and child
  ordering. The related-patterns section and the discussion of Composite versus
  Decorator supply the applicability scene's neighbors.
- **Refactoring to Patterns (Kerievsky):** *Replace One/Many Distinctions with
  Composite* gives the first design its shape (separate lists and loops for
  single items and collections, like his product's single parts and part
  sets); *Replace Implicit Tree with Composite* supports adding only the child
  operations the program needs (the lesson has `add`, but no `remove`); and
  *Move Accumulation to Collecting Parameter*, which he notes works nicely with
  Composite, gives `play(queue)` its queue parameter.
- **Head First Design Patterns:** the safe and transparent variants, and the
  observation that the transparent version trades single responsibility for
  uniform clients, while the safe one makes adding code check types.
- **Pattern-Oriented Software Architecture, Vol. 1, Whole-Part:** Composite as
  the variant of a whole-part structure whose wholes and parts share one
  interface, which frames the context scene's "wholes made of parts".

## The first design loses order on purpose

The skill asks for a before design that behaves exactly like the pattern. Here
the two designs agree on every length, but not on the queue: the first design
keeps a playlist's songs and its nested playlists in separate lists, so Play
queues the songs first and Throwbacks after them, and Last Exit, meant to end
the trip, plays second. That lost order is the concrete, visible cost of the
one/many distinction, and it is the reason the redesign needs one ordered list
of one shared type. `_data/explainers/composite_ui.yml` records the first
design's order as `first_design_road_trip`, and the node test checks both
designs against it, so the difference is specified, not accidental.

## Learning sequence

Each scene shows its part of the pattern description (Context, Problem,
Solution, Consequences):

1. Introduction: the Road Trip playlist plays in the order it was built; every
   row has a live Play button to try.
2. Context: part-whole hierarchies that nest, clients that treat one item and a
   group alike, and trees elsewhere (folders, grouped shapes, submenus, nested
   page boxes); leaf and composite are defined.
3. Problem: the first design with two lists and two add methods, two loops in
   every operation, the lost order, the Play button's type check, a prediction
   about podcast episodes, and the cost (a third list, loop, and branch
   everywhere; a forgotten loop silently drops episodes from the total), ending
   with four demands on a solution.
4. to 6. The concrete redesign, one class per scene: `Playable` (one shared
   type; `play` collects titles in a queue passed down), `Song` (answers
   directly; never changes, so it can be shared), and `Playlist` (one ordered
   list; duration sums, play forwards in order; `add` only here is the safe
   choice, checked before the program runs, and a separate cue gives the
   transparent one).
7. Collaborations: one press of Play traced on a sequence diagram and in the
   live library, with a prediction before the nested call. The code panel
   shows `Playlist.play` and `PlayButton.press` together: the `playlist` block
   holds both classes, so the trace can mark either.
8. The abstraction: Component, Leaf, Composite, and Client on a role diagram,
   each mapped to the class that played it, ending on the loop that lets
   composites contain composites.
9. Consequences (simple clients, new kinds fit in, overly general, safety or
   transparency), then applicability (real nesting; a plain list or one class
   with optional children when simpler; Composite inside MVC and macro
   commands; Composite versus Decorator), then a transfer task: a podcast
   episode is one new leaf class.
10. A summary of all four parts, then a six-question quiz on a study planner
    whose projects hold tasks and other projects.

## Files

- `_data/narrations/composite.yml`: speech, scenes, parts, and teaching text.
- `_data/narration_visuals/composite.json`: diagrams and renderer state.
- `_data/explainers/composite_code.yml`: the four-language examples. The
  first design uses the same class names, so the node test runs it as its own
  program.
- `_data/explainers/composite_quizzes.yml`: section checks and the summary quiz.
- `_data/explainers/composite_notes.yml`: key points for the editable handout.
- `_data/explainers/composite_ui.yml`: the library's rows, the expected lengths
  and queues of both designs, and one panel per illustrated state. It is the
  test oracle.
- `_includes/composite-library-panel.html` and `css/composite-narration.css`:
  the static library (reader, print, notes), drawn from the panels; a
  playlist's length is the sum of the songs and episodes inside it.
- The site inverts article SVGs in dark mode (`html.dark-mode .post-content svg`).
  The library's Play icons take the theme's colors, so they opt out with
  `filter: none`, as the player's own control icons do.
- `js/composite-library.js`: the live library in the player, built with the
  pattern it teaches. Each cue's state comes from the static panel's
  `data-composite-cue`; a trace that continues the previous cue's trace steps
  through the newly visited rows. Students can press Play on any row, in the
  first design or the composite, and watch play visit the rows and fill the
  queue; a polite status reports each press. Reduced motion skips the steps.

## Regeneration and checks

Render with a Drama 3 server, as described in
[Speech engines](narration-format.md#speech-engines):

```sh
python scripts/render-explainer-narration.py --topic composite
```

`node --test scripts/tests/composite-narration.test.js` checks the oracle
against both designs, every illustrated panel, the storyboard's targets and
marks, pauses, timing, and quizzes, and runs both designs in every language:
the complete example, the first design's order, a podcast episode added as a
leaf class the lesson never wrote, and one song shared by two playlists.
Python 3, a JDK, clang++ (C++17, `-Werror`), and Node.js with type stripping
are needed for the language checks; missing tools are skipped. Run
`tsc --strict` on the TypeScript examples separately.
`tests/composite-narration.spec.js` covers the player, the live library, the
reader and print views, themes, mobile layout, and accessibility.
