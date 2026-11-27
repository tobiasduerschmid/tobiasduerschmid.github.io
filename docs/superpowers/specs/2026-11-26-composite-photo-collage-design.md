# Composite lesson: the photo-collage example

- **Date:** 2026-11-26
- **Status:** approved by the instructor on 2026-11-26; the build plan is
  `docs/superpowers/plans/2026-11-26-composite-photo-collage.md`
- **Branch:** `feature/composite-narration` (pull request #108)
- **Replaces:** the music-library example on that branch, described in
  `docs/composite-narration.md`

## Intent

The Composite chapter opens with a 12-minute narrated lesson on the shared
pattern player. Its running example, a music library, teaches the pattern but
does not show it: the tree is a list of indented rows, and what Play visibly
produces is a text queue. The instructor asked for a better, more visual
example. This design replaces the music library with a photo collage: a phone
story whose tiles are photos or splits of tiles.

The collage *is* the composite. Every tile's rectangle is computed by its
parent, so drawing the story paints the object tree. Here, "more visual" means
three things:

1. **The picture is the runtime object tree.** Wholes visibly contain their
   parts.
2. **One request visibly travels down the tree.** Drawing fills the canvas area
   by area.
3. **The first design fails in a way you can see.** A tile is left blank.

## Goals

- Teach Composite through Context, Problem, Solution, and Consequences at the
  quality bar of the shipped lessons (`.agents/skills/design-pattern-narration`).
- Show every role and collaboration in one live picture: the story canvas beside
  its layout tree, with a Share button and a photo count on every node.
- Keep everything the music-library lesson had:
  - code in four languages, checked against an oracle;
  - quizzes, notes, and study activities;
  - reader and print views;
  - the rendered audio and captions.
- Contrast Composite with its neighbors inside the same domain: a carousel post
  is a plain list, and a polaroid frame is a Decorator.

## Non-goals

- **No layout editing:** no drag and drop, free positioning, resizing, or uneven
  ratios. Every split divides its area equally, so the arithmetic stays out of
  the way.
- **No real photographs:** tiles show simple illustrations.
- **No changes to shared runtime code:** the narration player, transport, quiz
  adapter, and notes generator stay as they are.
- **No new lesson kind:** the lesson stays `kind: pattern`.

## Anti-goals

The lesson fails, even if it works, if it has:

- **Decorative art:** art that competes with the structure. The illustrations
  only identify tiles.
- **Pixel arithmetic:** arithmetic learners must do in their heads to follow
  along. Speech says "the left half" and "the top of the right half", never pixel
  numbers.
- **A strawman first design:** the first design must be code a reasonable
  developer writes for version 1.
- **Hard-to-read or inaccessible output:** text that needs leaning in to read,
  state shown only by color, or motion that cannot be turned off.

## Constraints

- **Accessibility:** WCAG 2.2 AA on the chapter, reader, print, and notes pages.
- **Themes:** light and dark mode, and print always uses the light palette.
- **Text size:** readable text is paragraph size. Sizes are inherited or set in
  `em`, never `rem`, because 1rem is 10 px on this site. Tile labels are at least
  0.9em, on a solid chip.
- **Styles:** no inline styles or `<style>` blocks in includes. Presentation
  lives in `css/composite-narration.css`. JavaScript may set positions it
  computes at runtime.
- **Dark-mode inversion:** the site inverts article SVGs in dark mode
  (`html.dark-mode .post-content svg`). The illustrations and icons opt out with
  `filter: none`.
- **Narration rules** (design-pattern-narration skill):
  - Sources go in the cue's `source` field and are never spoken.
  - Concrete code comes before the abstract roles.
  - Each section has one check, and the lesson ends with a summary quiz.
  - The last cue before every check has `pause_after` of 2.5 or more.
  - Prediction cues include a pause.
- **Code checks:** code ships in four languages.
  - C++ compiles with `-std=c++17 -Wall -Wextra -pedantic -Werror`.
  - TypeScript passes `tsc --strict` and runs with Node type stripping, so
    constructor parameter properties are not allowed.
- **Speech:** Fish Audio Drama 3, voice `drama3-female6`, speed 1.0, rendered
  through the remote speech server. Changed speech is re-rendered, and unchanged
  cues reuse the per-cue cache.
- **Motion:** nothing flashes, and the drawing animation is off under
  `prefers-reduced-motion`.

## Approaches considered

| | Picture is the tree | Request you can watch | Bug you can see | Pattern fit | Build cost |
|---|---|---|---|---|---|
| Photo collage | yes | canvas fills in | blank tile | strong | medium |
| Adventure backpack | partly | bags open, weights add up | wrong potion count | strong | low |
| Shared apartment | partly | lights dim | LED strip left on | weak | low |

- **Photo collage, picked by the instructor:** described in the rest of this
  document.
- **Adventure backpack:** bags in bags. It has the richest variants:
  - a quiver that takes only arrows (the liability);
  - a bag of holding that ignores its contents' weight (a composite doing its own
    work);
  - an enchantment as a Decorator.

  It is less spatial than the collage, and it would be a second game example
  after the State lesson's game companion.
- **Shared apartment:** smart-home rooms and zones. It is vivid: the LED strip
  stays on, and an "All lights" group accepts the fridge plug. But real
  smart-home groups rarely nest, so a set of device names per group would
  honestly do.
- **Dropped:**
  - **Fireworks shells bursting into shells:** they risk failing the WCAG
    flashing and motion rules, and the domain needs explaining.
  - **A split-pane code editor:** the text inside the panes gets too small.
  - **A storage treemap:** its cell labels get too small, and the chapter already
    uses files.
  - **A drawing editor:** it is the books' and the chapter's own example.
  - **A LEGO parts list:** every leaf answers the same way.
  - **Comment threads:** one class with optional replies is the better design.

The collage won because it is the only candidate whose picture is the runtime
object tree. The lesson can therefore set the four-class diagram beside a tree of
any depth, which shows the difference between the static class structure and
the runtime object structure. It also puts the plain list, the composite, and the
decorator in one domain, so learners compare them without switching contexts.

## The running example

### The story

The story is a summer photo dump on a 1080 × 1920 canvas.

| Tile | Kind | Holds | Area |
|---|---|---|---|
| story | split, side by side | beach, right | 1080×1920 at 0,0 |
| beach | photo | | 540×1920 at 0,0 |
| right | split, stacked | cat, bottom | 540×1920 at 540,0 |
| cat | photo | | 540×960 at 540,0 |
| bottom | split, side by side | gig, taco | 540×960 at 540,960 |
| gig | photo | | 270×960 at 540,960 |
| taco | photo | | 270×960 at 810,960 |

The photo count is 4. Drawing the story adds one line per photo, in reading
order:

```text
beach 540x1920 at 0,0
cat 540x960 at 540,0
gig 270x960 at 540,960
taco 270x960 at 810,960
```

The caption change appears twice: as the problem's prediction and as the
transfer task. The caption "core memories" goes under the beach photo, so
`left`, a stacked split holding beach and the caption, replaces beach in the
story:

```text
beach 540x960 at 0,0
caption "core memories" 540x960 at 0,960
cat 540x960 at 540,0
gig 270x960 at 540,960
taco 270x960 at 810,960
```

The photo count stays 4.

Every area in the lesson, including each subtree shared on its own, is a
multiple of 270 × 480. The static picture can therefore place tiles on a 4 × 4
grid of CSS classes, with no inline coordinates.

### Roles and classes

| Role | Class | Responsibility |
|---|---|---|
| Component | `Tile` | declares `draw(area, canvas)` and `photo_count()` |
| Leaf | `Photo` | draws itself into the area it is given; counts 1 |
| Composite | `Split` | a direction and one ordered list of tiles; `add(tile)`; `draw` cuts its area into equal parts and forwards each part in order; `photo_count` sums |
| Client | `ShareButton` | `press()` draws its selection into the full story area and returns the canvas |
| Leaf added in the transfer | `Caption` | draws its text into its area; counts 0 |
| Helper in both designs | `Area`, `Direction` | an area cuts itself into equal parts, side by side or stacked; it never changes in the lesson |

- **Naming:** names follow each language's conventions (`photo_count` in Python,
  `photoCount` in Java, C++, and TypeScript).
- **The canvas:** a list of strings passed down the tree. This is Kerievsky's
  collecting parameter.
- **The photo counts:** the layout tree shows each node's photo count, which
  makes it a second client of `photo_count`.

### The first design

Version 1 has `Photo` and `Split` with no shared type. A split's items are
photos or splits, and every operation asks which one it holds:

- `Split.draw` draws a photo itself, or forwards to a nested split.
- `Split.photo_count` adds one for a photo, or asks the nested split.
- `ShareButton.press` checks whether its selection is a photo or a split.

The knowledge of how to draw a photo therefore lives in two places: the split
and the Share button.

For the photo-only story, the first design and the composite design produce
identical output, and the oracle checks both.

When captions arrive, all three places need a new branch. The lesson's version
misses the branch in `Split.draw`, so the caption's area stays blank and nothing
reports an error. The oracle records this broken variant as
`first_design_caption`. The count is unaffected, because a caption has no photos.
That shows that a missed branch can be harmless in one place and visible in
another.

### Design decisions the lesson teaches

- **Safety over transparency:** `add` is declared only in `Split`, so adding to a
  photo fails before the program runs. The price is that code that adds must know
  it holds a split. One cue presents the transparent alternative.
- **Child order:** the list order is the reading order, so it decides where each
  tile lands. The trace tags each tile with the order in which it was drawn. No
  cue reorders tiles.
- **Sharing:** a photo never changes and knows no parent, so one `Photo` object
  can appear in two stories. The C++ version shares tiles through
  `std::shared_ptr<const Tile>`.
- **Only the child operations the program needs:** there are no parent
  references and no `remove`.
- **Liability:** a photo-booth strip that may hold only photos still accepts any
  tile through `add`, so it needs a runtime check.
- **No cycle check:** a split must not contain itself, and `add` does not check
  for it. This is stated in `lesson.complete_examples`.

### Neighbors

- **A carousel post:** a flat list of photos. Nothing nests, and nothing treats
  one photo and the carousel alike, so a list is the right design.
- **One `Tile` class with optional children:** simpler while there is only one
  kind of leaf.
- **A polaroid frame around one tile:** a Decorator. It has the same interface
  and one child, and adds drawing. A split holds many tiles and arranges them.
- **Composite inside other patterns:** view trees in Model-View-Controller,
  and macro commands. The MVC lesson is named in speech and on the card. Cards
  are plain text, so there is no link.

The applicability scene draws the carousel and the frame (see
[The live picture](#the-live-picture)). Neither one is part of the story's tree.

## Lesson sequence

The lesson has 12 scenes and 40 cues. At about 145 words per minute, it runs
about 12 minutes. The cue IDs below are the planned IDs; the wording is the
builder's.

| Scene | Part | Cues | Code and diagram | The panel, cue by cue |
|---|---|---|---|---|
| intro | | `photo-dump`, `try-it`, `pattern-parts` | none | The story is drawn, and every node of the layout tree has a Share button and a photo count. Learners may press any Share button. |
| context | Context | `part-whole`, `alike`, `trees` | none | `part-whole` marks the three splits as wholes. `alike` marks `beach` and `bottom` "same requests". `trees` keeps that state. |
| problem | Problem | `area`, `first-design`, `branches`, `client-check`, `predict-captions` (prediction, about 6 s), `every-change`, `demands` | the `problem` block; the `area` cue marks its calls to `area.part` | The first design's story through `client-check`. From `predict-captions`, the caption is pending under the beach. From `every-change`, its area is blank and tagged "not drawn". |
| tile_role | Solution | `shared-type`, `canvas` | the `tile` block; the `solution` diagram on `Tile` | Every node is tagged "Tile". |
| photo_role | Solution | `direct`, `shared` | the `photo` block; the `solution` diagram on `Photo` | `direct` tags the photo rows. `shared` adds the text tag "also in another story" to `beach`. No second story is drawn. |
| split_role | Solution | `one-list`, `count`, `draw`, `safe-add`, `transparent-add` | the `split` block; the `solution` diagram on `Split` | The split rows are tagged, with their cut lines on the canvas. |
| collaborations | Solution | `press`, `first-tile` (prediction, about 5 s), `recursion`, `loop` | the `split` block, focused on `press` and `draw`; the `trace` diagram, one message group per cue | `press` outlines the story's area. `first-tile` is unchanged, because it marks what is at stake, not the answer. `recursion` draws beach 1st, cat 2nd, gig 3rd, and taco 4th. `loop` shows the finished story. |
| solution | Solution | `component`, `leaf`, `composite`, `client` | the `roles` diagram | Each cue tags the nodes playing its role: every node, then the photos, then the splits, then the Share buttons. The `composite` cue contrasts the four-class diagram with the tree beside it. |
| consequences | Consequences | `simple-clients`, `new-kinds`, `overly-general`, `safety` | none; one card per consequence | `simple-clients` tags the Share buttons "no checks". The other cues keep the story, with the note line naming the point. The photo-booth strip is described, not drawn. |
| applicability | Context | `fit`, `plain-list`, `neighbors` | none; cards | `fit` shows the story. `plain-list` adds a carousel strip of three photos below the canvas. `neighbors` shows the cat tile in a polaroid frame. |
| transfer | | `plan` (prediction, about 6 s), `caption` | no code; the `solution` diagram, switching to its variant with `Caption` at `caption` | `plan` shows the caption pending. `caption` draws the caption under the beach and tags it "new". |
| summary | | `recap`, then the summary quiz | none; cards | The finished story with its caption. |

`new-kinds` stays general: a new kind of tile is one new class that implements
`Tile`, and no existing class changes. It does not name captions, so the
transfer's prediction is not answered in advance.

The problem's four demands are:

1. One shared type for photos and splits.
2. A split holds an ordered list of that type, so splits nest without checks.
3. The Share button works on any tile without checks.
4. A new kind of tile needs no edits to existing classes.

The last cue of each section has `pause_after` of 2.5 or more, and the
problem's has 3. The final picture stays complete during that pause.

## The live picture

`presentation.visuals.ui` shows a static, accessible picture in the reader,
print, and notes views. `js/composite-collage.js` makes it live in the player,
as `js/mvc-dashboard.js` and the current library script do.

- **Layout:**
  - On the left, the story canvas at 9:16, with each tile showing its
    illustration and a name chip.
  - On the right, the layout tree: one row per node, indented by depth, with the
    node's name, its kind ("split, side by side", "split, stacked", "photo",
    "caption"), its photo count, and a Share button.
  - Below both, a note line and a polite status line.
  - On narrow screens, the canvas stacks above the tree.
  - In scenes with code and a diagram, the shared layout gives the panel its own
    full-width row below them.
- **Panel states:** every cue in a scene that shows the panel has its own panel
  state, as listed in the lesson-sequence table.
- **Narrated states:** each cue's state comes from the static panel's
  `data-composite-cue`.
  - **Marks:** whole, same requests, and role marks.
  - **Tags:** drawing, drawn, new, and not drawn.
  - **The pending caption.**
  - **The canvas contents and area outlines:** the outline of the split whose
    area is being cut is dashed and labeled with its direction.
  - **Continuing traces:** a trace that continues the previous cue's trace steps
    through the newly drawn tiles.
- **Learner actions:**
  - **Share:** pressing Share on any node redraws the canvas with that node
    filling the whole story area, drawing its tiles one at a time. A status
    message names what was shared and its photo count.
  - **First design:** in the problem section, the same buttons run the first
    design, and the caption stays blank.
  - **Reset:** a "Back to the narration's picture" button restores the narrated
    state.
  - **Not interactive:** the carousel strip and the polaroid frame are pictures
    of the neighbors, not nodes of the tree, so they have no Share buttons.
- **Built with the pattern:** the script implements `Tile`, `Photo`, `Split`,
  `Caption`, and the first design. Areas come from `Split.draw` and map onto the
  4 × 4 grid at runtime.
- **Accessibility:**
  - The canvas is `role="img"`, and its label lists the tiles in reading order
    with their positions ("beach, left half; cat, top of the right half; …").
  - Each Share button's name includes its node ("Share bottom").
  - Tags carry text, never color alone, and focus never moves during narration.
  - Reduced motion skips the one-at-a-time drawing.
  - The illustrations and icons opt out of the dark-mode inversion.
  - Print uses the light palette.

## Illustrations

- **Content:** four photo illustrations (beach, cat, gig, and taco) and the
  caption tile.
- **Style:** flat shapes with a few paths each, recognizable at tile size and in
  tall or square tiles (`preserveAspectRatio` slice). Each illustration has a
  fixed palette chosen so its name chip keeps at least 4.5:1 contrast.
- **Themes:** the same art in dark mode, because photos do not invert, opted out
  of the inversion. Print uses the same light palette.
- **The neighbors:**
  - The carousel strip reuses three of the photo illustrations at thumbnail
    size, with a text position ("1 of 3").
  - The polaroid frame is CSS decoration inside the cat's grid cell, so the
    4 × 4 grid holds.
  - Each has its own text alternative.
- **Process:** drawn under the `asset-creator` skill, and checked in both themes
  and in print.

## Diagrams

All three diagrams are ArchUML, rendered at build time (`static_uml: true`).

- **`solution`:** `Tile`, `Photo`, `Split`, and `ShareButton` in portrait
  layout. `diagram_focus` follows the role scenes. A variant adds `Caption` for
  the transfer.
- **`trace`:** a sequence diagram with the lifelines `button: ShareButton`,
  `story: Split`, `beach: Photo`, and `right: Split`. It has three message
  groups:
  1. `press` calls `draw` on the story's area. This group appears from `press`
     and stays through the `first-tile` prediction.
  2. `draw` of the left half goes to beach. This group appears at `recursion`.
  3. `draw` of the right half goes to right. This group also appears at
     `recursion`.

  The canvas shows the rest of the recursion (cat, then gig and taco), so the
  diagram stays at four lifelines.
- **`roles`:**
  - Client uses Component.
  - Leaf and Composite implement Component.
  - `Composite o--> "*" Component : children`.

## Code

`_data/explainers/composite_code.yml` has these blocks:

- `area`: the helper.
- `problem`: the first design.
- `tile`.
- `photo`.
- `split`: also holds `ShareButton`, so the trace can mark either class.
- `caption`.
- `wire`: builds the story with the caption, then prints the photo count and the
  drawn lines.

`resources.example_order` is `area`, `tile`, `photo`, `split`, `caption`, `wire`.

The player shows one code block per scene (`scene.code`), and a cue cannot
switch blocks. So the `area` block never appears on the stage:

- The problem's `area` cue marks the first design's calls to `area.part` and
  explains the helper in words.
- The helper's code appears in the reader's complete examples.
- The node test prepends the `area` block when it assembles each program.

Each language uses its own idioms:

| Language | Idioms |
|---|---|
| Python | dataclass, ABC, and Enum |
| Java | records, an enum, and an interface |
| C++ | `struct Area`, `enum class Direction`, `std::shared_ptr<const Tile>`, and const methods |
| TypeScript | a union type for the direction, and explicit readonly fields |

The first design uses:

| Language | Type for "photo or split" |
|---|---|
| Python | `Photo \| Split` |
| Java | `Object` with `instanceof` |
| C++ | `std::variant<Photo, std::shared_ptr<const Split>>` with `std::get_if` |
| TypeScript | `Photo \| Split` |

It uses explicit branches with no `else`, so an unknown kind is skipped
silently. That silent skip is the bug.

## Oracle and data

`_data/explainers/composite_ui.yml` holds:

- the tree: tiles, kinds, children, and the story size;
- the expected lines and counts for `start`, `first_design_caption`, and
  `caption`;
- one panel per illustrated state: marks, tags, drawn tiles, pending and blank
  flags, and notes.

The node test runs both designs in all four languages against this data. The
static panel and the live script render from it.

## Checks, notes, and study activities

- **Section checks:** rewritten for the new problem (type checks, and a missed
  branch that fails silently).
  - Stems name the pattern.
  - Correct answers rotate positions.
  - Every key and every reason to reject a distractor comes from the narration's
    own words.
- **Summary quiz:** it keeps its study-planner scenario (tasks and projects),
  which tests transfer to a new surface. It is reviewed so its problem and
  consequence items match the type-check framing.
- **Notes:** rewritten for the 40 cues, within the limits: at most 16 words per
  bullet, at most half the speech, and no run of eight words copied from it.
- **Study companion:**
  - one review item with a retry per question;
  - two exercises: "add a sticker tile" (class diagram) and "trace sharing the
    right half" (sequence diagram);
  - two comparisons: "type checks or one shared type" and "carousel list or
    split".

  The study tools are on master (a3e02f12), and the lesson loader validates
  this file whenever the lesson loads, including in every site build.

## Verification

- **Node tests:**
  - `node --test scripts/tests/composite-narration.test.js`, rewritten. It covers
    the `Area` arithmetic, both designs against the oracle, the panels, the
    quizzes, the cue targets, the code marks, the pauses, and the timing.
  - It runs the wire program in all four languages.
  - It uses a harness that adds a leaf the lesson never wrote (a GIF tile), a
    shared photo in two stories, and the broken first design.
- **`node scripts/narration.js check`.**
- **Playwright specs:**
  - `tests/composite-narration.spec.js`, rewritten. It covers code marks,
    diagrams, narrated picture states, learner Share presses, reset, stops before
    checks with at least 2 s after speech, accessibility in light, dark, and
    mobile, reader and print without JavaScript, and a dark-mode check that a
    tile's illustration and the Share icon keep their painted colors.
  - The fullscreen, navigation, controls, and notes specs, with
    `A11Y_INTERACTIVE_CHECKS=1`.
- **WCAG 2.2 audits:** screen and print, on the chapter, reader, print, and
  notes pages.
- **Pedagogy review:** a separate reviewer reads the script before the audio is
  rendered.
- **Audio:**
  - Render all cues, and review the Whisper transcript for slips.
  - Add `pronunciations` where needed.
  - Report that no person has listened yet.
- **Final check:** play the lesson in the browser and look for clipped words,
  highlights that miss their targets, and text that needs leaning in to read.

## Files

- **Rewritten:**
  - `_data/narrations/composite.yml`
  - `_data/narration_visuals/composite.json`
  - `_data/explainers/composite_{code,ui,quizzes,notes,study}.yml`
  - `css/composite-narration.css`
  - `scripts/tests/composite-narration.test.js`
  - `tests/composite-narration.spec.js`
  - `docs/composite-narration.md`
- **Renamed and rewritten:**
  - `_includes/composite-library-panel.html` becomes `composite-collage-panel.html`.
  - `js/composite-library.js` becomes `composite-collage.js`.
- **Regenerated:**
  - `assets/audio/composite-pattern.mp3`
  - `assets/narration/composite-pattern.{vtt,txt}`
  - `_data/explainers/composite_timing.json`
- **Updated:**
  - the shipped-example sentence in
    `.agents/skills/design-pattern-narration/SKILL.md`;
  - `tests/narration-fullscreen.spec.js`, which hard-codes the lesson title and
    the `playlist_role` scene. They become the new title and `split_role`.
  - the pull request description.
- **Unchanged:** the chapter page, `read.html` and `print.html`, the lists of
  narrated lessons, and the navigation spec entry. They name the topic, not the
  example.

## Delivery

- **Branch:** same branch, in small topic commits.
- **Pull request:** #108 changes from the music library to the collage when the
  branch is pushed.
- **Pushing:** nothing is pushed until the instructor says so.

## Decided

- **By the instructor:** replace the music library with the photo collage,
  chosen from three candidates.
- **The designer's calls, open to correction:**
  - **Photos and caption:** beach, cat, gig, and taco, with the caption "core
    memories". They are distinct silhouettes, everyday photo-dump subjects, and
    names short enough for narrow tiles.
  - **Captions as the new kind:** captions arrive as the new kind in both the
    problem and the transfer, as podcast episodes did in the music lesson. The
    cost of the first design and the one-class change in the composite are shown
    on the same change.
  - **Photo count as the second request:** a whole number every learner reads
    instantly. A caption counting zero makes the transfer concrete.
  - **The first design uses type checks, not two lists:** order obviously
    matters in a layout, so two lists would be a strawman.
  - **Equal splits only, on a 4 × 4 grid:** no inline coordinates, and no
    arithmetic in speech.
  - **Illustrations, not photographs:** no licensing, lighter pages, and art
    that cannot become decoration.
  - **The study-planner summary quiz stays:** it tests transfer to a different
    surface.
  - **What the panel draws:** the per-cue panel column in the lesson-sequence
    table is the full list.
    - The shared photo is a tag, not a second story.
    - The photo-booth strip is described, not drawn.
    - The carousel and the polaroid frame are drawn, because the neighbor
      contrast is one of the reasons the collage won.
  - **`new-kinds` stays general:** the transfer remains a real prediction.
  - **The `area` helper stays off the stage:** the player can show only one
    block per scene, and the helper is not what the lesson teaches.
  - **The trace shows the leaf case and the first recursive call:** this keeps
    it at four lifelines, and the canvas carries the deeper calls.
  - **The transfer shows no code:** the player shows one code block for a whole
    scene, so the `caption` block would answer the `plan` prediction before it
    is asked. No shipped lesson shows code in its transfer. The diagram switches
    to its `Caption` variant at the answer instead, and the `caption` block
    appears in the reader's complete examples. This was settled while planning,
    after approval.
- **Left to the builder:**
  - the exact cue wording within the outline;
  - the illustration details;
  - the CSS;
  - the panel data schema;
  - the code formatting and focus line numbers;
  - the test structure;
  - the diagram layout.
