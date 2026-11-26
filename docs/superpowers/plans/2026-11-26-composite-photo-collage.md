# Composite Photo-Collage Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrated Composite lesson's music-library example with the approved photo collage on `feature/composite-narration` (pull request #108), at the quality bar of the shipped lessons.

**Architecture:** The lesson stays data plus topic files on the shared pattern player. One oracle, `_data/explainers/composite_ui.yml`, specifies the tree, the expected canvases, and every narrated picture. A test-side specification, `tests/helpers/composite-collage.js`, checks the oracle, the four-language code, the static panel, and the live script against it. The static panel draws each cue from the oracle; `js/composite-collage.js` makes it live with its own Tile, Photo, Split, and Caption classes.

**Tech Stack:** Jekyll and Liquid includes, the narration compiler (`scripts/narration.js`), `node:test`, Playwright, ArchUML, Python 3, Java, C++17, TypeScript, Drama 3 speech with Whisper review.

**Spec:** `docs/superpowers/specs/2026-11-26-composite-photo-collage-design.md`

## Changes since the design was approved

1. **Master moved.** Master now has the narration study tools (a3e02f12) and the MVC fix (#109). Task 1 merges master. From then on, every lesson load validates `composite_study.yml`, including the load inside every Jekyll build, so a study file that names a removed cue breaks the whole site build.
2. **The transfer shows no code.** The player shows one code block for a whole scene, so the `caption` block would show the answer during the `plan` prediction. No shipped lesson shows code in its transfer. Instead, the transfer shows the `solution` diagram beside the panel, and the `caption` cue switches to `solution_caption`. The `caption` block still appears in the reader's complete examples and in the node test. The design doc records this change.
3. **Answers after predictions are disclosed.** Master's reader puts each step after a prediction in a closed `<details class="np-reading-answer">`. The reader tests click each `summary`, which works without JavaScript.

## Global Constraints

- **Accessibility:** WCAG 2.2 AA on `/SEBook/designpatterns/composite.html` and its `read/`, `print/`, and notes pages, in light and dark mode. Print always uses the light palette.
- **Text size:** readable text inherits or uses `em`, never `rem` (1rem = 10 px on this site).
  - Tile name chips are at least `0.9em` on a solid chip, and tags at least `0.85em`.
  - Form controls use `font: inherit`.
- **Styles:**
  - No `style=""` attributes or `<style>` blocks in includes; presentation lives in `css/composite-narration.css`.
  - JavaScript sets only state classes and values it computes.
- **Dark-mode inversion:** `css/portfolio.css:1086` inverts `.post-content svg` and `.post-content img[src$=".svg"]` with specificity (0,3,2). Opt out with `filter: none` on:
  - `html.dark-mode .composite-animation img.composite-art[src$=".svg"]`, which outranks it;
  - `html.dark-mode .composite-animation .composite-share svg`.
- **Speech:**
  - No source names, no history, and no pixel numbers. Sources go only in a cue's `source` field.
  - Every scene's last cue has `pause_after` of at least 2.5, and the problem scene's has 3.
  - Predictions have `pause_after` of at least 5 and are never a scene's last cue.
- **Code:**
  - C++ compiles with `-std=c++17 -Wall -Wextra -pedantic -Werror`.
  - TypeScript passes `tsc --strict` and runs under `node --experimental-strip-types`, so it uses no constructor parameter properties.
- **Speech engine:** Drama 3, `voice: drama3-female6`, `speed: 1.0`. Never print `NARRATION_TTS_SSH`.
- **Motion:** nothing flashes, and the one-tile-at-a-time drawing is off under `prefers-reduced-motion: reduce`.
- **Quizzes:**
  - Stems name the pattern.
  - The key sits at each index at least 4 times.
  - The correct option has no feedback.
  - No positional references ("Option A").
  - Never use the word "misconception".
- **Notes:** 1–16 words per bullet, at most half as many words as the speech, and no run of eight words copied from it.
- **Git:**
  - Work only in this worktree.
  - Make small topic commits, staged by explicit path, and check `git diff --cached --name-only` and `git diff --cached --check` before each.
  - End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Never push without the instructor's yes.

## Review Focus

1. **Two Share presses in quick succession** (motion on): the canvas and status end as the second press's, and none of the first press's tiles remain. Task 12, test `a second Share press replaces the first one's drawing`.
2. **Seeking while a learner's press is still drawing:** the cue's narrated picture replaces the press completely, and the status clears. Task 12, test `the narration's picture replaces a press that is still drawing`.
3. **A focused Share button when a cue rebuilds the tree** (the caption joins at `every-change`): focus stays on the same tile's button. Narration never moves focus otherwise. Task 12, test `a focused Share button keeps focus when the caption joins the tree`.
4. **The narrowest tiles** (gig and taco, one grid column each) at 320 and 1280 px: their chips and tags stay at least 0.9 × the explanation text and are not clipped. Task 7, test `chips on the narrowest tiles stay readable at 320 and 1280 px`; Task 12 repeats the check in the player.
5. **Illustration URLs:** every `img.composite-art` loads in the player, reader, and print views. A wrong path or `relative_url` breaks only some views. Task 7 tests the reader and print views, and Task 12 tests the player.

## Shared names

Each task's Interfaces block points here. These names cross task boundaries, so do not change them inside a task.

### Scenes, cues, and panel states

Cue IDs are stable, and the `say` wording is the builder's. Every scene has `ui: true`. Starred cues are predictions.

| Scene (part) | Code / diagram | Cue → panel |
|---|---|---|
| `intro` | none | `photo-dump`→start, `try-it`→start, `pattern-parts`→start |
| `context` (Context) | none | `part-whole`→wholes, `alike`→alike, `trees`→alike |
| `problem` (Problem) | `problem` / none | `area`→first_areas, `first-design`→first_start, `branches`→first_start, `client-check`→first_start, `predict-captions`*→first_caption_pending, `every-change`→first_caption_blank, `demands`→first_caption_blank |
| `tile_role` (Solution) | `tile` / `solution` | `shared-type`→tiles, `canvas`→tiles |
| `photo_role` (Solution) | `photo` / `solution` | `direct`→photos, `shared`→photo_shared |
| `split_role` (Solution) | `split` / `solution` | `one-list`, `count`, `draw`, `safe-add`, `transparent-add` → splits |
| `collaborations` (Solution) | `split` / `trace` | `press`→trace_press, `first-tile`*→trace_press, `recursion`→trace_drawn, `loop`→trace_done |
| `solution` (Solution) | none / `roles` | `component`→role_component, `leaf`→role_leaf, `composite`→role_composite, `client`→role_client |
| `consequences` (Consequences) | none / none, 4 cards | `simple-clients`→no_checks, `new-kinds`→new_kinds, `overly-general`→overly_general, `safety`→safety |
| `applicability` (Context) | none / none, 3 cards | `fit`→fit, `plain-list`→carousel, `neighbors`→frame |
| `transfer` | none / `solution` (cue `caption` uses `solution_caption`) | `plan`*→caption_pending, `caption`→caption |
| `summary` | none / none, 4 cards | `recap`→final |

### The oracle: `_data/explainers/composite_ui.yml`

These values are exact:

```yaml
app: Summer story
canvas: {width: 1080, height: 1920, columns: 4, rows: 4}   # one cell is 270 × 480
rows:              # tree order; each row belongs to the closest earlier row one level up
  - {id: story, kind: split, direction: side by side, depth: 0}
  - {id: beach, kind: photo, art: beach.svg, depth: 1}
  - {id: right, kind: split, direction: stacked, depth: 1}
  - {id: cat, kind: photo, art: cat.svg, depth: 2}
  - {id: bottom, kind: split, direction: side by side, depth: 2}
  - {id: gig, kind: photo, art: gig.svg, depth: 3}
  - {id: taco, kind: photo, art: taco.svg, depth: 3}
captioned_rows:    # the caption change: left, holding beach and the caption, replaces beach
  - {id: story, kind: split, direction: side by side, depth: 0}
  - {id: left, kind: split, direction: stacked, depth: 1}
  - {id: beach, kind: photo, art: beach.svg, depth: 2}
  - {id: caption, kind: caption, text: core memories, depth: 2}
  - {id: right, kind: split, direction: stacked, depth: 1}
  - {id: cat, kind: photo, art: cat.svg, depth: 2}
  - {id: bottom, kind: split, direction: side by side, depth: 2}
  - {id: gig, kind: photo, art: gig.svg, depth: 3}
  - {id: taco, kind: photo, art: taco.svg, depth: 3}
positions:         # "x,y,w,h" in grid cells → words; covers every area any Share press makes
  "0,0,4,4": the whole story
  "0,0,2,4": left half
  "2,0,2,4": right half
  "0,0,4,2": top half
  "0,2,4,2": bottom half
  "0,0,2,2": top left quarter
  "2,0,2,2": top right quarter
  "0,2,2,2": bottom left quarter
  "2,2,2,2": bottom right quarter
  "2,2,1,2": left half of the bottom right quarter
  "3,2,1,2": right half of the bottom right quarter
neighbors: {carousel: [beach, cat, gig], frame: cat}
expected:          # area = [x, y, width, height] in story pixels, in drawing order
  start:
    photos: 4
    drawn:
      - {tile: beach, area: [0, 0, 540, 1920]}
      - {tile: cat, area: [540, 0, 540, 960]}
      - {tile: gig, area: [540, 960, 270, 960]}
      - {tile: taco, area: [810, 960, 270, 960]}
  caption:
    photos: 4
    drawn:
      - {tile: beach, area: [0, 0, 540, 960]}
      - {tile: caption, area: [0, 960, 540, 960]}
      - {tile: cat, area: [540, 0, 540, 960]}
      - {tile: gig, area: [540, 960, 270, 960]}
      - {tile: taco, area: [810, 960, 270, 960]}
  first_design_caption:   # Split.draw has no caption branch: the caption's area stays blank
    photos: 4
    drawn:
      - {tile: beach, area: [0, 0, 540, 960]}
      - {tile: cat, area: [540, 0, 540, 960]}
      - {tile: gig, area: [540, 960, 270, 960]}
      - {tile: taco, area: [810, 960, 270, 960]}
```

Panel fields:

- `design`: `composite` or `first`. Required.
- `caption`: `pending` or `added`.
- `marked` and `mark`: the marked tiles and the text of their mark.
- `share_mark`: a tag on every Share button.
- `flags`: a map from a tile to its tag text.
- `cuts: true`: dashed outlines on every split's area.
- `drawn` and `current`: in a trace, the leaves drawn so far, in order, and the split whose area is being cut.
- `neighbors`: `carousel`, `frame`, or both.
- `note`: one sentence of at most 20 words. Required.

| Panel | Design | Fields beyond the note |
|---|---|---|
| start | composite | none |
| wholes | composite | marked [story, right, bottom], mark `whole` |
| alike | composite | marked [beach, bottom], mark `same requests` |
| first_areas | first | cuts |
| first_start | first | none |
| first_caption_pending | first | caption pending |
| first_caption_blank | first | caption added, flags {caption: `not drawn`} |
| tiles | composite | marked all seven, mark `Tile` |
| photos | composite | marked the four photos, mark `Photo` |
| photo_shared | composite | as photos, plus flags {beach: `also in another story`} |
| splits | composite | marked the three splits, mark `Split`, cuts |
| trace_press | composite | drawn [], current story |
| trace_drawn, trace_done | composite | drawn [beach, cat, gig, taco] (the notes differ) |
| role_component, role_leaf, role_composite | composite | marked all / photos / splits, mark `Component` / `Leaf` / `Composite` |
| role_client | composite | share_mark `Client` |
| no_checks | composite | share_mark `no checks` |
| new_kinds, overly_general, safety, fit | composite | note only; `new_kinds` never mentions captions |
| carousel | composite | neighbors [carousel] |
| frame | composite | neighbors [carousel, frame] |
| caption_pending | composite | caption pending |
| caption | composite | caption added, flags {caption: `new`} |
| final | composite | caption added |

### Code API

Both designs use these names. The first design differs only where noted.

| | Python | Java | C++ | TypeScript |
|---|---|---|---|---|
| Direction | `Enum`: `Direction.SIDE_BY_SIDE`, `Direction.STACKED` | `enum Direction { SIDE_BY_SIDE, STACKED }` | `enum class Direction { SideBySide, Stacked }` | `type Direction = "side by side" \| "stacked"` |
| Area | frozen dataclass `Area(x, y, width, height)`, `part(index, count, direction)`, `__str__` | `record Area(int x, int y, int width, int height)`, `part`, `toString` | `struct Area { int x; int y; int width; int height; Area part(int, int, Direction) const; std::string str() const; }` | `class Area` with readonly fields, `part`, `toString` |
| Story area | `STORY` | `Area.STORY` | `constexpr Area kStory{0, 0, 1080, 1920};` | `const STORY` |
| Component | ABC `Tile`: `draw(area, canvas)`, `photo_count()` | `interface Tile`: `void draw(Area, List<String>)`, `int photoCount()` | abstract `Tile`: `draw(const Area&, std::vector<std::string>&) const`, `photoCount() const`, virtual destructor | `interface Tile`: `draw(area, canvas: string[])`, `photoCount()` |
| Leaf | `Photo(name)` (frozen dataclass) | `record Photo(String name)` | `Photo(std::string name)` | `Photo(name)` |
| Composite | `Split(direction)`, `add(tile)` | `final class Split`, `add(Tile)` | `Split(Direction)`, `add(std::shared_ptr<const Tile>)`, holds `std::vector<std::shared_ptr<const Tile>>` | `Split(direction)`, `add(tile)` |
| Client | `ShareButton(selection).press() -> list[str]` | `List<String> press()` | `ShareButton(std::shared_ptr<const Tile>)`, `press() const` | `press(): string[]` |
| Transfer leaf | `Caption(text)` | `record Caption(String text)` | `Caption(std::string text)` | `Caption(text)` |

- **Lines:** a photo draws `{name} {width}x{height} at {x},{y}`, and a caption draws `caption "{text}" {area}`.
- **`Area.part`:** cuts the width (side by side) or the height (stacked) into `count` equal parts and returns part `index`.
- **First design:** `Photo` and `Split` share no type.
  - The "photo or split" type: Python annotations `Photo | Split`; Java `Object` with `instanceof`; TypeScript declares `type Item = Photo | Split;` once; C++ declares `using Item = std::variant<Photo, std::shared_ptr<const Split>>;` once, with `struct Photo { std::string name; };`.
  - `Split.draw`, `Split.photo_count`, and `ShareButton.press` each use `if photo … elif split …` with no `else`, so `Split.draw` and `press` both know how to draw a photo.
- **The `wire` block** builds the captioned story, then prints `story: 4 photos` followed by one drawn line per tile.

### Focus keys

| Block | Keys | Cues that use them |
|---|---|---|
| `area` | `part` | none (reader only) |
| `problem` | `area`, `types`, `branches`, `client`, `changes` | area→area, first-design→types, branches→branches, client-check→client, predict-captions→types, every-change→changes, demands→changes |
| `tile` | `interface`, `draw` | shared-type→interface, canvas→draw |
| `photo` | `requests`, `fields` | direct→requests, shared→fields |
| `split` (holds `ShareButton`) | `tiles`, `count`, `draw`, `add`, `press`, `result` | one-list→tiles, count→count, draw→draw, safe-add→add, transparent-add→add; press→press, first-tile→draw, recursion→draw, loop→result |
| `caption` | `class` | none (reader only) |
| `wire` | `build`, `print` | none (reader only) |

`area` marks the first design's calls to `area.part`. `changes` marks all three type checks that need a caption branch. A prediction cue marks what is at stake, never the answer.

### Diagrams

- **`solution`:** `layout portrait` with the following, in members `+ draw(area, canvas)` and `+ photoCount(): int`:
  - `interface Tile`;
  - `class Photo { - name … }`;
  - `class Split { - direction; + add(tile: Tile) … }`;
  - `class ShareButton { - selection: Tile; + press(): canvas }`;
  - `ShareButton --> Tile : selection`, `Photo ..|> Tile`, `Split ..|> Tile`, `Split o--> "*" Tile : tiles`.
- **`solution_caption`:** `solution` plus `class Caption { - text … }` and `Caption ..|> Tile`.
- **`trace`:** the source declares `participant button: ShareButton`, `participant story: Split`, `participant beach: Photo`, and `participant right: Split`. Its steps are exact, and the tests read the message labels from them:
  1. `activate button\nbutton -> story: draw(whole story, canvas)\nactivate story\n`
  2. `story -> beach: draw(left half, canvas)\nactivate beach\ndeactivate beach\n`
  3. `story -> right: draw(right half, canvas)\nactivate right\ndeactivate right\ndeactivate story\ndeactivate button\n`
- **`roles`:** unchanged from the music lesson.
- **Cue settings:**
  - `diagram_focus`: Tile, Photo, and Split for the role scenes; `transparent-add` focuses Tile.
  - Collaborations: `press` has steps 1 and focus story; `first-tile` has steps 1; `recursion` has steps 3 and focus right; `loop` has steps 3.
  - Solution: Component, Leaf, Composite, and Client.
  - Transfer: `caption` has `diagram: solution_caption` and focus Caption.

### Visible strings

Tests assert these strings, so they are exact:

- **Lesson title:** `The Composite pattern in a photo collage`.
- **Window bars:**
  - static: `Summer story · illustrated, {design} design`;
  - live: `Summer story · {design} design · try it: press Share on any tile`, where `{design}` is `composite` or `first`.
- **The static panel's `role="img"` name:**
  `Summer story, drawn by the {design} design. {canvas description} Layout tree: {rows}.{ pending}{ neighbors} {note}`
- **Canvas description:**
  - With tiles drawn: `Canvas, in reading order: {entry}; {entry}.`
  - With nothing drawn: `Canvas: nothing drawn yet.`
  - Each entry is `{name}, {position}`, then:
    - `, drawn 1st` (`2nd`, …) in traces;
    - `, in a polaroid frame` on the cat when the frame shows;
    - `, tagged {flag}` for a drawn tile that has a panel flag;
    - `, tagged not drawn` for a tile the first design skipped. It is listed where it would have been drawn, at the area its split cut for it.
  - A caption's name is `caption "core memories"`.
  - After a learner's press, entries carry only their position and `, tagged not drawn`: no ordinals, flags, or frame.
  - The live canvas is `role="img"`, and its name is this description alone.
- **Rows:**
  - static phrase: `level {depth + 1}, {id}, {kind}, {count}`, followed by `, tagged {tag}` for each tag;
  - kind: `split, side by side`, `split, stacked`, `photo`, or `caption`;
  - count: `1 photo` or `{n} photos`;
  - row tags, in order: mark, share_mark, flag, `drawing` (on the `current` split), `drawn {ordinal}`;
  - a learner's press clears every row tag and hides the note; reset restores the cue's state.
- **Live controls:**
  - the tree list is named `Layout tree`;
  - Share buttons are named `Share {id}`;
  - the reset button reads `Back to the narration’s picture`;
  - the status reads `Shared {id}: {n} photo.` or `Shared {id}: {n} photos.`, and adds ` The caption’s area stays blank: Split.draw has no branch for captions.` when the first design skipped a caption;
  - after a reset, the status reads `The story is back to the narration’s picture.`
- **Neighbors and the pending caption:**
  - pending caption: `Waiting to be added: caption "core memories", under beach.`
  - carousel: `Carousel post: a flat list of three photos, beach, cat, and gig, showing 1 of 3.`
  - the cat's frame tag: `polaroid frame`.

## Commands

```sh
W=/Users/tobiasduerschmid/Projects/tobiasduerschmid.github.io/.claude/worktrees/composite-narration
M=/Users/tobiasduerschmid/Projects/tobiasduerschmid.github.io          # node_modules, .env.local
S=/private/tmp/claude-501/-Users-tobiasduerschmid--claude-spares-spare-LPLFGs/8976d45e-3251-4d86-a814-18b8dc43c4b1/scratchpad
export NODE_PATH=$M/node_modules LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```

- **Node tests:** run them in `$W`.
- **The site copy:** `$S/build` is a copy of the site. Its `node_modules` links to `$M`, and `js/ArchUML` is already in it. The range server (`node $S/range-server.js $S/build/_site 4180`) serves it.
- **Builds:**
  - Sync with `$S/sync-build.sh` (written in Task 1).
  - Then build with `cd $S/build && BUNDLE_GEMFILE=$PWD/Gemfile bundle exec jekyll build --incremental > $S/jekyll.log 2>&1`.
  - After shared includes change, drop `--incremental`.
- **Playwright:** `cd $S/build && PLAYWRIGHT_SERVE_BUILT_SITE=1 JEKYLL_PORT=4180 ./node_modules/.bin/playwright test <spec> --project=chromium --reporter=list`.
  - Add `A11Y_INTERACTIVE_CHECKS=1` for accessibility runs.
  - `$S/run-suites.sh` runs every suite of the final check.

---

### Task 1: Bring master into the branch

**Files:**
- Modify: `docs/narrated-pattern.md` (the merge conflict)
- Create, scratch only: `$S/sync-build.sh`

**Interfaces:**
- Produces a branch with master's study tools, on which `loadLesson('composite')` validates the music-library `composite_study.yml`.
- Produces `$S/sync-build.sh`, which every later build uses.

- [ ] **Step 1: Merge.** Run `git merge --no-ff --no-commit master`. Expected: `CONFLICT (content): Merge conflict in docs/narrated-pattern.md`, and nothing else.
- [ ] **Step 2: Resolve.** Keep master's new opening paragraph on the study tools, then the branch's line `Observer, State, Strategy, Model-View-Controller, and Composite share one player:`. Run `git diff --check` and expect no output.
- [ ] **Step 3: Check the lesson against master's study validator.** Run `node scripts/narration.js check composite`. Expected: `composite: valid script, visual references, and current speech`. While planning, master's `validateStudy` accepted the current `composite_study.yml` (12 review groups, 2 exercises, 2 comparisons), so no study fix is expected.
- [ ] **Step 4: Run the node tests.** Run `node --test scripts/tests/composite-narration.test.js scripts/tests/narration-study.test.js scripts/tests/narration-spec.test.js scripts/tests/narrated-pattern-sources.test.js scripts/tests/narration-notes.test.js`. Expected: all pass except the `uml_component_diagram` handout test, which also fails on master. Compare any other failure with master before going on.
- [ ] **Step 5: Commit.** Stage `docs/narrated-pattern.md`, plus the study file if Step 3 changed it, and run `git commit -m "Merge master into feature/composite-narration" -m "Brings in the narration study tools and the MVC dark-mode fix." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- [ ] **Step 6: Write `$S/sync-build.sh`.** It copies the worktree's changes since the commit in `$S/build/.synced-commit` (default `1270df62`, the branch base) into `$S/build`. It must:
  - delete files whose `git diff --name-status --no-renames` state is `D`;
  - copy files in every other state;
  - also copy uncommitted and untracked files (`git diff --name-only HEAD`, `git ls-files --others --exclude-standard`);
  - write `git rev-parse HEAD` to `.synced-commit`.
- [ ] **Step 7: Rebuild the site copy.** Run the sync, then a full (non-incremental) Jekyll build. Expected: exit 0, and `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4180/SEBook/designpatterns/composite.html` prints `200`.

### Task 2: The collage oracle and its specification

**Files:**
- Rewrite: `_data/explainers/composite_ui.yml`
- Create: `tests/helpers/composite-collage.js`
- Rewrite: `scripts/tests/composite-narration.test.js`. Replace the whole file; the music tests go. Later tasks add their own tests.

**Interfaces:**
- Consumes the oracle values in **Shared names**.
- Produces these exports from `tests/helpers/composite-collage.js`. The node test and the Playwright spec use them, and nothing in the shipped site does.
  - `load(): Collage`: the parsed YAML.
  - `tree(rows): Map<id, {row, tiles: Node[]}>`
  - `rowsFor(collage, panel): Row[]`: `captioned_rows` when `panel.caption === 'added'`, otherwise `rows`.
  - `part(area: [x, y, w, h], index, count, direction): [x, y, w, h]`
  - `draw(node, area, design): Event[]`: the events in call order:
    - `{type: 'cut', tile, area}` when a split is entered;
    - `{type: 'draw', tile, area}` when a leaf draws;
    - `{type: 'skip', tile, area}` when a first-design split skips a child that is neither a photo nor a split. The area is the part that child would have received.
    - Sharing a caption directly still draws it in the first design, because the lesson's version did add the Share button's branch.
  - `share(tree, id, design): {events, drawn: {tile, area}[], skipped: {tile, area}[], cuts: {tile, area}[], photos: number}`: draws into `[0, 0, 1080, 1920]`.
  - `photoCount(node): number`
  - `line(entry, rowsById): string`
  - `cell(area): [x, y, w, h]` in grid cells.
  - `position(collage, area): string`, which throws when the cell has no words.
  - `canvasDescription(collage, panel): string`: a narrated state, sharing `story`.
  - `pressDescription(collage, panel, id): string`: a learner's press on `id`, on that panel's tree and design.
  - `rowTags(collage, panel, row): string[]`

- [ ] **Step 1: Write the failing tests** in `scripts/tests/composite-narration.test.js`.
  - `the area helper cuts each split's area into equal parts that cover it exactly`:
    - `part([0,0,1080,1920], 1, 2, 'side by side')` deep-equals `[540,0,540,1920]`;
    - `part([540,0,540,1920], 1, 2, 'stacked')` deep-equals `[540,960,540,960]`;
    - for every `cut` event of every share in both trees, the parts of the next level have equal sizes, sum to the cut area, and do not overlap.
  - `the expected canvases follow from the rows in both designs`:
    - `share(tree(rows), 'story', d).drawn` deep-equals `expected.start.drawn` for both designs;
    - the captioned tree gives `expected.caption.drawn` (composite) and `expected.first_design_caption.drawn` (first);
    - every `photos` is 4;
    - `expected.first_design_caption.drawn` has no `caption` entry.
  - `every area a Share press can produce sits on the 4 × 4 grid and has position words`: for both trees, both designs, and every tile ID, each drawn and cut area is a multiple of 270 × 480, and `position()` does not throw.
  - `every illustrated panel names tiles, marks, and traces that its design and tree produce`:
    - `design` is in {composite, first}, and `caption` is absent, `pending`, or `added`;
    - every ID in `marked`, `flags`, `drawn`, and `current` is a row of `rowsFor(panel)`;
    - `marked` implies `mark`, and `note` is non-empty with at most 20 words;
    - `drawn` is a prefix of `share(…, 'story', panel.design).drawn` tiles;
    - `current` is a split;
    - `neighbors` ⊆ {carousel, frame};
    - a first-design panel with `caption: added` flags the caption `not drawn`;
    - `panels.new_kinds.note` does not match `/caption/i`.
- [ ] **Step 2: Run and see them fail.** Run `node --test scripts/tests/composite-narration.test.js`. Expected: FAIL, because the helper module and `captioned_rows` are missing.
- [ ] **Step 3: Write the helper and the oracle.** Implement the helper and write `composite_ui.yml` with the exact values and the 28 panels from **Shared names**, each with a note.
- [ ] **Step 4: Run.** Expected: 4 passing.
- [ ] **Step 5: Commit** `_data/explainers/composite_ui.yml`, `tests/helpers/composite-collage.js`, and `scripts/tests/composite-narration.test.js` with the message "Specify the Composite lesson's photo collage and both designs".

### Task 3: The Python code and the four-language harness

**Files:**
- Rewrite: the `python` entry of `_data/explainers/composite_code.yml`, with blocks `area`, `problem`, `tile`, `photo`, `split`, `caption`, and `wire`.
- Modify: `_data/narration_visuals/composite.json`, setting `resources.example_order` to `["area", "tile", "photo", "split", "caption", "wire"]`.
- Test: `scripts/tests/composite-narration.test.js`

**Interfaces:**
- Consumes the Task 2 helper and the **Code API**.
- Produces the harness protocol. Every harness line is `{name}|{photo count}|{line};{line};…`, and the expected text is computed from `share()` and `line()`, never typed in.
  - **Composite programs** are imports + area + tile + photo + split + caption + harness. The harness:
    1. Builds the photo story and shares each of its seven tiles.
    2. Builds `story2 = Split(side by side)` holding `left` (beach and `Caption("core memories")`) and `right`, which reuses the same beach and `right` objects, then shares `story2` and `left`.
    3. Shares `story` again, unchanged.
    4. Defines `Gif(name)`, a leaf the lesson never wrote, which draws `gif {name} {area}` and counts 0, and shares `party = Split(stacked)` holding `Gif("dance")` and taco.
  - **First-design programs** are imports + area + problem + harness. The harness shares `story`, `right`, `bottom`, and `beach`, then builds the captioned `story2` and shares `story2` and `left`.
    - In TypeScript and C++, the test first widens the one `Item` declaration to include `Caption`. For C++ it inserts `struct Caption { std::string text; };` before the declaration.
  - **The wire program** is imports + all example blocks. Its expected output is `story: 4 photos`, then the `expected.caption` lines.

- [ ] **Step 1: Write the failing tests.**
  - `code blocks exist in all four languages and their marks name real lines`: as in the music version, over `['problem', ...story.example_order]`, using the focus keys in **Focus keys**.
  - `${label}: both designs draw what the specification draws`: runs the three programs per language and compares them with the computed text.
- [ ] **Step 2: Run** `node --test --test-name-pattern "Python|marks" scripts/tests/composite-narration.test.js`. Expected: FAIL, because the old Python blocks are missing.
- [ ] **Step 3: Write the Python blocks.**
  - Imports: `from __future__ import annotations`, `ABC` and `abstractmethod`, `dataclass`, and `Enum`.
  - Follow the **Code API**. The first design's `Split.draw` has the shape `for index, item in enumerate(self.items): part = area.part(index, len(self.items), self.direction); if isinstance(item, Photo): canvas.append(...) elif isinstance(item, Split): item.draw(part, canvas)`.
  - Each block's `focus` uses the keys in **Focus keys**.
  - The Python `note` says the abstract base class makes the Tile role explicit, and that photos are frozen dataclasses, so two stories can share one.
- [ ] **Step 4: Run Step 2's command.** Expected: the Python and marks tests pass. The Java, C++, and TypeScript entries are still the old music code, so their marks fail until Task 4.
- [ ] **Step 5: Commit** `_data/explainers/composite_code.yml`, `_data/narration_visuals/composite.json`, and `scripts/tests/composite-narration.test.js` with the message "Write the collage's Python code and the four-language harness".

### Task 4: Java, C++, and TypeScript code

**Files:**
- Rewrite: the `java`, `cpp`, and `typescript` entries of `_data/explainers/composite_code.yml`.

**Interfaces:**
- Consumes the Task 3 harness and the **Code API**, with the same focus keys in every language.

- [ ] **Step 1: Java.** Write the blocks: `import java.util.ArrayList; import java.util.List;`, records, an enum, an interface, `final class Split`, and pattern-matching `instanceof` in the first design. Run `node --test --test-name-pattern "Java" scripts/tests/composite-narration.test.js`. Expected: PASS.
- [ ] **Step 2: C++.** Write the blocks:
  - includes `<iostream> <memory> <string> <utility> <variant> <vector>`;
  - `constexpr Area kStory`;
  - `std::size_t` loop indexes cast to `int` for `part`;
  - the first design's single `using Item = …;` and `std::get_if` branches.

  Run with the `C\+\+` pattern. Expected: PASS under `-Werror`.
- [ ] **Step 3: TypeScript.** Write the blocks: a `type Direction` union, readonly fields assigned in constructors, and the first design's single `type Item = Photo | Split;`. Run with the `TypeScript` pattern. Expected: PASS.
- [ ] **Step 4: Type-check.** Write each assembled TypeScript program (complete example, composite harness, first design with `Item` widened to include `Caption`) to its own file in `$S/ts/`. Run `$M/node_modules/.bin/tsc --strict --noEmit --target es2022 --lib es2022,dom` on each. Expected: no errors in any of the three.
- [ ] **Step 5: Run the whole node test.** Expected: every test passes, with no language skipped.
- [ ] **Step 6: Commit** `_data/explainers/composite_code.yml` with the message "Write the collage's Java, C++, and TypeScript code".

### Task 5: The storyboard (narration script and visual package)

**Files:**
- Rewrite: `_data/narrations/composite.yml` and `_data/narration_visuals/composite.json`.
- Delete: `_data/explainers/composite_study.yml`. Task 9 writes the new one; until then, the old file would name removed cues and break every lesson load.
- Test: `scripts/tests/composite-narration.test.js`

**Interfaces:**
- Consumes **Scenes, cues, and panel states**, **Focus keys**, **Diagrams**, and the panel names from Task 2.
- Produces the compiled story that Tasks 6–13 read (scene and cue IDs, `ui_state`, `focus`, `diagram*`, and cards).
- From here until Task 7, the Jekyll build fails, because `presentation.visuals.ui` names `composite-collage-panel.html`, which Task 7 creates. Tasks 5 and 6 verify with node only.

- [ ] **Step 1: Write the failing tests.**
  - `the storyboard follows the planned scenes, cues, parts, and predictions`:
    - `story.scenes.map(s => [s.id, s.part ?? null, s.cues.map(c => c.id)])` deep-equals the table in **Shared names**;
    - the title is `The Composite pattern in a photo collage`;
    - the predictions are exactly `problem/predict-captions`, `collaborations/first-tile`, and `transfer/plan`;
    - every scene has `ui`.
  - `every cue names real code, diagram, and panel targets`: the music version, with every cue in a `ui` scene requiring a `ui_state` in `panels` and the cue-level `diagram` existing.
  - `predictions leave thinking time, and every check follows a viewing pause`: the music version, plus the problem scene's last `pause_after` being at least 3.
  - `speech never asks for arithmetic`: no cue's `text` matches `/\d{3,}|px\b/`.
- [ ] **Step 2: Run.** Expected: FAIL on the music storyboard.
- [ ] **Step 3: Write the visual package.**
  - `presentation`: `{visuals: {ui: "composite-collage-panel.html"}, scripts: ["composite-collage.js"], styles: ["/css/composite-narration.css"]}`.
  - Resources: the diagrams from **Diagrams**, each with a `label`, a text-alternative `description`, and a `caption` that explains the notation once.
  - Scenes: their `state` (code, diagram, `ui: true`, cards) and every cue's `ui_state`, `focus`, `diagram_focus`, `diagram_steps`, and `diagram`.
  - Card titles:
    - consequences: `Benefit: simple clients`, `Benefit: new kinds fit in`, `Liability: overly general`, `Liability: safety or transparency`;
    - applicability: `A good fit`, `Simpler designs`, `Neighbors`;
    - summary: `Context`, `Problem`, `Solution`, `Consequences`. The problem card names type checks that silently miss new kinds.
- [ ] **Step 4: Write the script.**
  - `lesson.summary` follows a story-collage app from splits that ask "photo or split?" to one Tile interface for photos and splits.
  - `outline_labels`:
    - context: `Wholes made of parts`
    - problem: `Photo or split?`
    - tile_role: `Tile`
    - photo_role: `Photo`
    - split_role: `Split`
    - collaborations: `One request, every level`
    - solution: `Component, Leaf, Composite`
    - consequences: `Benefits and liabilities`
    - applicability: `When to use Composite`
  - `complete_examples` states:
    - areas are whole pixels and splits divide them equally;
    - a photo never changes and knows no parent, so one Photo can sit in two stories, and C++ shares tiles through `shared_ptr`;
    - a split must not contain itself, and `add` does not check this;
    - both designs draw the photo story identically, but with captions, the first design's `Split.draw` leaves the caption's area blank.
  - Keep the `speech` and `media` blocks.
  - Each cue is 40–50 words, with `step`, `note`, `visual` (describes the picture and marks, not the speech), and `source` where a cue draws on a book. The table below lists what each cue must establish; the wording is the builder's.

  | Cue | Must establish |
  |---|---|
  | photo-dump | Your summer photo dump as one phone story: beach on the left half; on the right, the cat on top, and below it the gig and the taco side by side. Four photos. |
  | try-it | A photo and a whole split both have a Share button and a photo count. Pause, press Share on any tile, and watch it fill the story. |
  | pattern-parts | Composite's four roles in plain words; the four parts of a pattern description; choose a code language above. |
  | part-whole | Context: part-whole hierarchies. The story is made of tiles; the right half is made of the cat and the bottom; the bottom is made of two photos. |
  | alike | Clients are the code that uses these objects. Share and the photo count ask a photo and a split the same questions; a split answers for everything inside it. |
  | trees | Folders, grouped shapes, submenus, nested page boxes. These are trees; a leaf has nothing inside, and a composite is a group. |
  | area | The helper both designs use: an area cuts itself into equal parts, side by side or stacked, and a split hands each tile one part, in order. |
  | first-design | A direct first design: Photo has a name; Split has a direction and one list whose items are photos or splits. The two share no type. |
  | branches | Every operation asks which one it holds: draw draws a photo itself or forwards to a split; photo count adds one or asks the split. |
  | client-check | The Share button asks too, so knowing how to draw a photo lives in two places. |
  | predict-captions | Captions arrive: "core memories" goes under the beach. Predict what changes, and what happens if one change is missed. |
  | every-change | All three checks need a caption branch: draw, photo count, and Share. Miss draw, and the caption's area stays blank, with no error, because the check has no else. |
  | demands | The four demands, in the design's words. |
  | shared-type | Solution, concretely: Tile declares draw and photo count; Photo and Split implement it. |
  | canvas | draw takes the canvas, one list passed down the whole tree; every tile adds its own line. |
  | direct | Photo answers both requests from its own data; it is a leaf. |
  | shared | A photo never changes and knows no parent, so one photo object can appear in two stories. |
  | one-list | Split keeps a direction and one ordered list of Tiles, so photos and splits mix and nest without checks. |
  | count | Its photo count sums its tiles' counts and never asks their kind. |
  | draw | draw cuts its area into equal parts and forwards them in list order, so list order is reading order. |
  | safe-add | add lives only in Split: adding to a photo is caught before the program runs, but code that adds must know it holds a split. |
  | transparent-add | The transparent choice declares add in Tile; then a photo must reject add at run time. The lesson's code is the safe choice. |
  | press | Trace one press: the button calls draw on the story with the whole story's area and an empty canvas. |
  | first-tile | The story holds beach, then right. Predict which tile is drawn first, and where. |
  | recursion | Beach gets the left half and draws first; right gets the right half and repeats the cut; cat is second, gig third, taco fourth. |
  | loop | The canvas returns with four lines in reading order. A composite forwards each request to its children, and a leaf answers directly. |
  | component | Solution, abstracted: remove the photos, and four roles remain. Component (Tile) declares the requests. |
  | leaf | Leaf (Photo) answers itself and has no children. |
  | composite | Composite (Split) holds Components and forwards, maybe adding work. Four classes in the diagram; a tree of any depth beside it. |
  | client | Client (ShareButton) uses only the Component; because a composite is a component, composites contain composites. |
  | simple-clients | Share treats one photo and a whole split alike, with no type checks. |
  | new-kinds | A new kind of tile is one new class implementing Tile; existing classes are unchanged. Do not name captions. |
  | overly-general | A photo-booth strip that may hold only photos still accepts any tile through add, so it needs a runtime check. |
  | safety | Safety (add in Split, checked early) or transparency (add in Tile, uniform, rejected at run time). |
  | fit | Use Composite when parts nest in wholes and clients should not care which they hold. |
  | plain-list | A carousel post is a flat list: nothing nests, so a list is better. With one kind of leaf, one Tile class with optional children can be simpler. |
  | neighbors | A polaroid frame wraps one tile and adds drawing: a Decorator. A split holds many tiles and arranges them. Composite also lives inside Model-View-Controller view trees and macro commands. |
  | plan | Captions arrive in the composite design. A caption draws its text and counts zero photos. Predict which class you add and what existing code changes. |
  | caption | One new class, Caption, implements Tile; no existing class changes. Compare the first design's three new branches. |
  | recap | The four parts in one sentence each, matching the summary cards. |
- [ ] **Step 5: Delete the study file.** Run `git rm _data/explainers/composite_study.yml`.
- [ ] **Step 6: Run.**
  - `node --test scripts/tests/composite-narration.test.js scripts/tests/narrated-pattern-sources.test.js scripts/tests/narration-spec.test.js`. Expected: PASS.
  - `node scripts/narration.js check composite`. Expected: only `speech changed; render audio, captions, and timing…`. The script and visual references load.
- [ ] **Step 7: Commit** the script, the visual package, the deleted study file, and the test, with the message "Narrate the Composite lesson with the photo collage".

### Task 6: Section checks and the summary quiz

**Files:**
- Rewrite: `_data/explainers/composite_quizzes.yml`
- Test: `scripts/tests/composite-narration.test.js`

**Interfaces:**
- Consumes the Task 5 scene IDs. Every key and every reason to reject a distractor must appear in that scene's speech.

- [ ] **Step 1: Add the test** `every section ends in a valid check, and the last one is a multi-question summary`, unchanged from the music version: keys equal the scene IDs; the summary has at least 6 questions; stems match `/Composite|pattern/`; at least 3 options; no feedback on the key; each index is the key at least 4 times.
- [ ] **Step 2: Run.** Expected: FAIL, because the keys are still the music scene IDs.
- [ ] **Step 3: Write one check per scene.**

  | Scene | Distinction the check tests |
  |---|---|
  | intro | The parts of a pattern description. Keep the music item. |
  | context | Composite's context against Strategy and Observer. Keep the music item. |
  | problem | Type checks: a new kind needs a branch in every check, and a missed one is skipped silently. |
  | tile_role | One shared type lets one ordered list hold both kinds, answering the same requests. |
  | photo_role | Why one Photo can appear in two stories: it never changes and knows no parent. |
  | split_role | Safe `add` in Split: adding to a photo is caught before the program runs. |
  | collaborations | How draw reaches taco: story → right → bottom → taco, each split forwarding its parts in order. |
  | solution | Which role ShareButton plays: Client. |
  | consequences | Simple clients, or new kinds, framed so it does not repeat the summary's exam-project item. |
  | applicability | A polaroid frame is a Decorator; a carousel post is a plain list. |
  | transfer | Captions in the composite: one new class, and no existing class changes. The distractors are the first design's three branches and a new method on Tile. |

  For the summary, keep the six study-planner items. Reframe item 2 to "one list of tasks and projects whose remainingHours() and Done button check each item's type". Change item 6's feedback example to "as a split holds photos and captions".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `_data/explainers/composite_quizzes.yml` and the test with the message "Check each Composite section against the collage narration".

### Task 7: The static collage panel, its styles, and its illustrations

**Files:**
- Rename and rewrite: run `git mv _includes/composite-library-panel.html _includes/composite-collage-panel.html`.
- Rewrite: `css/composite-narration.css`
- Create: `assets/narration/composite-art/beach.svg`, `cat.svg`, `gig.svg`, `taco.svg`
- Rewrite: `tests/composite-narration.spec.js`. Replace the whole file; Tasks 12 and 13 add their tests.

**Interfaces:**
- Consumes the oracle, the **Visible strings**, and the Task 2 helper (in the spec).
- Produces this markup, which Task 12 replaces with live controls:
  - the root `div.composite-collage`, carrying `data-composite-cue` (the panel as JSON), `data-composite-rows` (`{rows, captioned_rows}`), `data-composite-positions`, `data-composite-neighbors`, and `data-composite-art` (`{{ '/assets/narration/composite-art/' | relative_url }}`);
  - `role="img"` with the static name;
  - an `aria-hidden` body holding `.composite-canvas`, `ul.composite-tree`, `.composite-pending`, `.composite-neighbors`, and `.composite-collage-note`.
- Grid classes: `composite-cell--x{0-3}`, `--y{0-3}`, `--w{1-4}`, and `--h{1-4}`, computed from `cell(area)` with no inline coordinates.
- Illustrations: `<img class="composite-art" src="{art base}{row.art}" alt="">`.

- [ ] **Step 1: Load the skills.** Load `asset-creator` for the SVGs, and `light-dark-mode`, `print-light-mode`, and `wcag-aa-compliance` for the include and CSS.
- [ ] **Step 2: Write the failing Playwright tests.**
  - `reading and print views include every step, diagram, picture, and question without JavaScript`, for both `read` and `print`, in a context with `javaScriptEnabled: false`:
    - the steps after `predict-captions`, `first-tile`, and `plan` are hidden;
    - then click every `.np-reading-answer > summary`;
    - every cue's text is visible;
    - `.np-diagram svg` is visible in diagram scenes;
    - the step's `role="img"` name starts with `Summer story, drawn by the {design} design. ${canvasDescription(collage, panel)}`;
    - the counts of `.np-print-question` and `Summary quiz:` match the quizzes.
  - `every illustration loads in the reader and print views`, with JavaScript on: every `img.composite-art` has `naturalWidth > 0`.
  - `chips on the narrowest tiles stay readable at 320 and 1280 px`: in the reader, the font size of every `.composite-chip` and `.composite-tag` on gig and taco is at least 0.9 × that of the step's paragraph, and `scrollWidth <= clientWidth + 1`. The page's horizontal overflow is at most 1 px at 320 px.
  - `static tiles sit where their areas say`: for the `start` and `caption` panels, each tile's box, as a fraction of the canvas box, matches `area / [1080, 1920]` within 4 px.
  - `the reader is accessible in light and dark mode`: an `a11yCheckpoint` on `#main-content`, in both themes.
- [ ] **Step 3: Build and see the tests fail.** Sync and build: expect FAIL, because the include is missing.
- [ ] **Step 4: Draw the four SVGs.**
  - Use `viewBox="0 0 90 160"` (9:16) and flat shapes, with no text in the art.
  - Keep each subject inside the central 45 × 80 box, so the 9:32 and 9:8 crops of `object-fit: cover` keep it whole.
  - Each SVG needs its own `<title>`.
- [ ] **Step 5: Write the include.**
  - Everything comes from the oracle panel for `include.cue.ui_state`:
    - the canvas:
      - cells from `expected.{start|caption|first_design_caption}.drawn`;
      - a blank, dashed cell tagged `not drawn` at the caption's `expected.caption` area in the first design;
      - the caption tile's text on a solid background, with no art;
      - trace prefixes with ordinal badges;
      - `cuts` outlines;
      - the `current` outline, dashed and labeled with the split's name and direction;
    - the tree: rows with depth classes, the kind chip, a count computed from the photo rows below each split, a decorative Share chip with an SVG icon, and tags in the **Visible strings** order;
    - the pending caption, the carousel strip, the frame on the cat cell, and the note.
  - The name follows **Visible strings** exactly.
- [ ] **Step 6: Write the CSS.**
  - The canvas is a 4 × 4 grid with `aspect-ratio: 9 / 16`, and the illustrations use `object-fit: cover`.
  - Chips and tags use solid `--nja-*` tokens. Depth indents run 0–3.
  - Write the dark-mode opt-outs from **Global Constraints**.
  - In scenes with a diagram and the panel but no code, show them side by side at wide widths with `.composite-animation .np-lesson:not(.np-code-with-diagram):not(.np-code-with-visual):has(> .np-diagram-column):has(> .np-visual)`.
  - Print rules use the light palette.
- [ ] **Step 7: Run.** Sync, build, and run `tests/composite-narration.spec.js`. Expected: all 5 tests pass; the reader accessibility test passes with `A11Y_INTERACTIVE_CHECKS=1`.
- [ ] **Step 8: Commit** the include rename, the CSS, the four SVGs, and the spec with the message "Draw the Composite lesson's photo collage for every cue".

### Task 8: Handout notes

**Files:**
- Rewrite: `_data/explainers/composite_notes.yml`, keyed `{scene}-{cue}` for all 40 cues.

- [ ] **Step 1: Run** `node --test --test-name-pattern composite scripts/tests/narration-notes.test.js`. Expected: FAIL, because the keys are the music cues.
- [ ] **Step 2: Write the notes.** Give each cue 1–3 bullets that restate it in fresh words. **Bold** a term where it is defined.
- [ ] **Step 3: Run Step 1's command.** Expected: PASS.
- [ ] **Step 4: Commit** `_data/explainers/composite_notes.yml` with the message "Write the Composite lesson's handout notes".

### Task 9: The study companion

**Files:**
- Create: `_data/explainers/composite_study.yml`
- Modify: `scripts/tests/narration-study.test.js` and `tests/narration-study.spec.js`. Add `'composite'` to each eight-lesson list, and rename the node test to `all nine UML and pattern lessons ship practice, comparisons, and complete question review`.

**Interfaces:**
- Consumes the Task 5 cue IDs and the Task 6 questions. `loadLesson` validates the file; see `scripts/narration/study.js`.

- [ ] **Step 1: Add composite to both lists.** Run `node --test scripts/tests/narration-study.test.js`. Expected: FAIL with `composite has study material`.
- [ ] **Step 2: Write the file.**
  - `reviews`: one entry for each of the 17 questions, pointing to the cue that taught it, with a fresh single-choice retry and feedback on every distractor.
  - `exercises`:
    - `add-sticker` (`class`): the starter is the `solution` diagram, and the solution adds `class Sticker` and `Sticker ..|> Tile`;
    - `trace-right-half` (`sequence`): the starter has the lifelines `button: ShareButton`, `right: Split`, `cat: Photo`, and `bottom: Split`, and the solution adds their messages.
  - `comparisons`:
    - `type-checks-or-shared-type`: before `problem/every-change`, after `transfer/caption`;
    - `carousel-or-split`: before `applicability/plain-list`, after `split_role/one-list`.
  - Each comparison names both benefits and costs, including when the simpler design is enough.
- [ ] **Step 3: Run** `node --test scripts/tests/narration-study.test.js` and `node scripts/narration.js check composite`. Expected: the tests pass, and the check reports only `speech changed`.
- [ ] **Step 4: Commit** the study file and both test files with the message "Add the Composite lesson's study companion".

### Task 10: Pedagogy review before the audio

**Files:**
- Modify, as the review requires: the Task 5–9 files.

- [ ] **Step 1: Dispatch a fresh reviewer.**
  - It loads `pedagogical-advisor` and `design-pattern-narration`.
  - It reads the design, `composite.yml`, `composite.json`, the quizzes, the notes, and the study file.
  - It reports, ranked: unclear or jargon-heavy speech; any quiz key or distractor reason not said in the narration; leaks of a prediction's answer; `visual` text that describes speech instead of the picture; cues over 50 words; and anything in the anti-goals.
- [ ] **Step 2: Fix what the review confirms.** Fix each confirmed finding, and record any rejected finding with a one-line reason in the commit message.
- [ ] **Step 3: Re-run** the Task 5, 6, 8, and 9 commands. Expected: PASS.
- [ ] **Step 4: Commit** the changed files with the message "Sharpen the Composite narration after a pedagogy review".

### Task 11: Speech, captions, and timing

**Files:**
- Regenerate: `assets/audio/composite-pattern.mp3`, `assets/narration/composite-pattern.vtt` and `.txt`, and `_data/explainers/composite_timing.json`.
- Modify, if Whisper needs it: `speech.pronunciations` in `composite.yml`.
- Test: `scripts/tests/composite-narration.test.js`

- [ ] **Step 1: Add the timing test.** Add `speech, captions, and timing are generated from the published storyboard`, unchanged from the music version. Run it. Expected: FAIL, because the speech fingerprint changed.
- [ ] **Step 2: Reach a speech server.** Reuse a running server if `curl -s -m 3 http://127.0.0.1:8011/` or `:8000/` answers. Otherwise, forward a port in the background with `set -a; . $M/.env.local; set +a; ssh -N -L 8011:127.0.0.1:8000 "$NARRATION_TTS_SSH"`, and never echo the variable.
- [ ] **Step 3: Render in the background** with `uv run --no-project -p 3.12 --with numpy --with scipy --with soundfile --with pyloudnorm --with num2words --with mlx-whisper python scripts/render-explainer-narration.py --topic composite --server http://127.0.0.1:8011 > $S/render-composite.log 2>&1`.
- [ ] **Step 4: Review the slips.**
  - For every cue the renderer lists, decide between a homophone (fine) and a dropped or repeated word (a slip).
  - Retake slips with `--retake scene/cue`.
  - When every take drops the same word, add a `pronunciations` entry. A label before a colon, such as "Solution, concretely:", needs a speech-only lead-in.
- [ ] **Step 5: Run** the node test and `node scripts/narration.js check composite`. Expected: PASS, and `composite: valid script, visual references, and current speech`.
- [ ] **Step 6: Commit** the audio, captions, script text, timing, `composite.yml` if it changed, and the test, with the message "Render the Composite collage narration's speech and captions".

### Task 12: The live collage

**Files:**
- Rename and rewrite: run `git mv js/composite-library.js js/composite-collage.js`.
- Modify: `css/composite-narration.css`, for the live controls.
- Modify: `tests/helpers/narration-player.js`, moving `paintedColor(page, locator)` there from `tests/mvc-narration.spec.js`, and the MVC spec, which then imports it.
- Test: `tests/composite-narration.spec.js`

**Interfaces:**
- Consumes the Task 7 markup and data attributes, and the **Visible strings**.
- Produces:
  - the selector `.narrated-pattern .nja-stage [data-np-visual] .composite-collage`;
  - a `narrated-pattern:cue` handler that reads the settled copy's `data-composite-cue` and calls `event.preventDefault()`;
  - a `role="group"` named by its window bar;
  - `STEP_MS = 320`, or 0 under reduced motion;
  - a token that cancels every running draw on each cue or press.
- The script's own classes:
  - `Area`;
  - `Photo`, `Caption`, and `Split` for the composite;
  - `FirstSplit` and `firstShare(item)` for the first design. `FirstSplit.draw` skips captions; `firstShare` draws a caption.

- [ ] **Step 1: Write the failing tests** (reduced motion unless noted).
  - `each cue moves the live picture to its narrated state`: for every cue, seek to the cue's middle, then check:
    - the rows of the `Layout tree` list;
    - each row's `Share {id}` button and tag text, against `rowTags()`;
    - the canvas `img` name, against `canvasDescription()`;
    - the note;
    - the pending caption text, the carousel name, and the frame tag where the panel has them.
  - `learners press Share on any tile and see the design on screen draw it`:
    - intro `try-it`: Share bottom gives `Shared bottom: 2 photos.`, Share beach gives `Shared beach: 1 photo.`, and Share story gives `Shared story: 4 photos.`, each with the canvas named by `pressDescription()` and no row tags;
    - problem `every-change`: Share story adds the blank-caption sentence; Share caption gives `Shared caption: 0 photos.` with the caption drawn whole;
    - reset restores `first_caption_blank`'s canvas and the reset status;
    - transfer `caption`: Share left gives `Shared left: 1 photo.`
  - `a second Share press replaces the first one's drawing` (motion on): Share story, then Share beach at once. The final canvas is the beach's, and the status is the beach's.
  - `the narration's picture replaces a press that is still drawing` (motion on): Share story, then seek to the next cue before it finishes. The canvas is that cue's description, and the status is empty.
  - `a focused Share button keeps focus when the caption joins the tree`: focus `Share story` at `client-check`, then seek to `every-change`. `Share story` is still focused.
  - `the illustrations and the Share icon keep their painted colors in dark mode, in the player and the reader`:
    - the beach art's center pixel is the same in light and dark, within 6 per channel;
    - the Share icon's painted color matches its computed fill.
  - `live tiles sit where their areas say, every illustration loads, and narrow chips stay readable`:
    - the box fractions match within 4 px;
    - every illustration has `naturalWidth > 0`;
    - at 1280 and 320 px, the chips and tags on gig and taco are at least 0.9 × the `.nja-note` font size and not clipped.
- [ ] **Step 2: Run.** Sync, build, and run `-g "live|Share|focus|painted|areas say"`. Expected: FAIL, because the script is missing.
- [ ] **Step 3: Write `js/composite-collage.js`.**
  - Follow the structure of the music script (render, `applyCue`, `press`, `describe`). The carousel and the frame are pictures, with no buttons.
  - The canvas repaints from the draw events. A continuing trace (same structure, `drawn` growing) draws the new tiles one at a time, with `current` outlines.
  - A rebuild keeps focus on the same tile's button.
  - The status is a polite `role="status"`.
- [ ] **Step 4: Run** the Step 2 tests. Expected: PASS. Then run the MVC spec's `painted` test, to confirm the helper move did not break it.
- [ ] **Step 5: Commit** the script rename, the CSS, the helper, the MVC spec, and the composite spec with the message "Make the Composite lesson's collage live in the player".

### Task 13: The player specs and the shared specs

**Files:**
- Modify: `tests/composite-narration.spec.js` and `tests/narration-fullscreen.spec.js`. Change the fullscreen entry's title to `The Composite pattern in a photo collage` and its scene to `split_role`.

- [ ] **Step 1: Port the music tests.** Change their names only where the subject changed, and use `seekNarration` from the shared helper:
  - `code marks follow every cue in all four languages`;
  - `each scene names its part of the pattern description`;
  - `diagrams highlight the cue's class, role, or lifeline, and the trace reveals one step per cue`;
  - `narration stops inside the silence before each check and resumes only when asked`;
  - `player, live collage, and quiz are readable and accessible in {light|dark} mode, including mobile`. Its checkpoints are `[intro, try-it]`, `[problem, every-change]`, `[split_role, safe-add]`, `[collaborations, recursion]`, `[solution, composite]`, and `[transfer, caption]`; on mobile, `[problem, every-change]`, `[collaborations, loop]`, and `[applicability, neighbors]`.
  - `reading view keeps the chosen language and theme`.
- [ ] **Step 2: Run** each of these with `A11Y_INTERACTIVE_CHECKS=1`: the whole composite spec, `narration-fullscreen -g "Composite pattern"`, `narration-navigation -g composite`, `narration-player-controls -g composite`, `narration-notes`, and `narration-study -g composite`. Expected: all pass, except failures that `project-known-failing-tests` lists and master shares.
- [ ] **Step 3: Commit** both spec files with the message "Test the Composite collage narration in the player".

### Task 14: Docs, the skill, the pull request text, and the final check

**Files:**
- Rewrite: `docs/composite-narration.md`. Cover: the collage example; the sources (GoF consequences on tag-and-case code, collecting parameter, adding only the needed child operations, safe and transparent variants, Whole-Part); the type-check first design and its silent caption skip; the learning sequence; the files; and regeneration.
- Modify: `.agents/skills/design-pattern-narration/SKILL.md:110-112`. Replace the music-library clause with "a phone-story photo collage whose splits hold photos and other splits, refactored from photo-or-split type checks, with a live Share button on every tile (Composite)".
- Rewrite, scratch only: `$S/pr-composite.md`, the pull request description.

- [ ] **Step 1: Write the docs and the skill sentence.**
- [ ] **Step 2: Run the full check.**
  - Sync, then a full build.
  - Run all node tests: `node --test scripts/tests/`, comparing failures with master's.
  - Run `node scripts/narration.js check`. Expected: all lessons valid.
  - Run `$S/run-suites.sh`, which covers the composite, fullscreen, navigation, controls, notes, WCAG screen, and WCAG print suites.
  - Expected: no new failures, and 0 WCAG findings on the four composite pages.
- [ ] **Step 3: Check by hand in the browser.**
  - Play the lesson start to finish, and look for clipped words, highlights that miss their targets, and text you have to lean in to read.
  - Check fullscreen and 320 px in both themes.
  - Note in the pull request text that no person has listened to the audio yet.
- [ ] **Step 4: Rewrite the pull request description.** Write `$S/pr-composite.md` for the collage, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Step 5: Commit** the doc and the skill with the message "Document the Composite lesson's photo collage". Then tell the instructor the branch is ready, list the files touched outside the lesson, and wait for their yes before pushing and updating pull request #108.
