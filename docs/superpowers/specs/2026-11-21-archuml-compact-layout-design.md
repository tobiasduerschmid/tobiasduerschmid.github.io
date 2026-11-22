# ArchUML compact layout — design

Status: draft for approval (2026-11-21). Scope: the `js/ArchUML` submodule (renderer bundle, reference, tests) and the site's diagram tests and docs.

Line numbers refer to `uml-bundle.js` at ArchUML `main` (`9a4e1fc`), the commit the site's `master` records.

An independent reviewer read this document against the code on 2026-11-21. Its corrections are applied. Its seven questions are settled in 6.2, 6.5, 6.7, 6.9, 6.11, section 8 and section 10, or passed to you in section 12.

## 1. Intent

`layout compact` should produce the drawing whose text is as large as possible when the diagram is shown in a given pane, with no wasted space, few line crossings, few corners and detours, and no overlapping elements.

The request names five things to optimize:

1. minimal whitespace;
2. the largest font size in the same pixel dimensions;
3. minimal line intersections;
4. minimal corners and detours;
5. never a direct overlap between relevant model elements.

Why, as far as the request and the project say (my reading, please correct): diagrams are shown in panes whose size the author cannot enlarge. Today's compact diagrams live mostly in narrated lessons (a diagram column about 600 px wide beside code), on song-video sheets (fixed boxes on a 960×540 stage), in tutorials, and on chapter pages where an overflowing diagram starts scaled down to the pane. In all of them a looser layout means smaller text.

## 2. How layout works today

### 2.1 One pipeline shape, repeated per renderer

Every graph-like renderer (class, state, component, deployment, use case, activity, freeform) runs the same stages in the same order:

1. parse the text, including the `layout …` directive (`parseLayoutDirective`, 904);
2. measure each box from its text;
3. place the boxes;
4. route every edge around the placed boxes;
5. place labels on the finished routes;
6. place notes, then grow the canvas to fit whatever ended up outside it.

Nothing flows backwards. A label that finds no free spot cannot ask for room, and a route that has to detour cannot ask for a wider channel. Gaps therefore have to be large enough everywhere for the worst case anywhere.

### 2.2 Placement: the shared layered engine

Class, state, activity, freeform and deployment diagrams place boxes with `UMLAdvancedLayout.compute` (6221–7559), a layered ("Sugiyama") layout:

- It lays out each connected group separately and packs the groups into rows, in input order, toward a fixed 1.5 aspect for compact (`packDisconnectedLayouts`, 6527; `targetAspectForPreference`, 6414).
- It assigns rows by longest path (6766). There is no bound on how wide a row may get and no wrapping, so the graph's own shape decides the drawing's shape.
- It orders each row by 16 barycenter and median sweeps (6894).
- It centres each box under its parents, then pushes boxes right until they stop overlapping (6991–7021). There is no step that pulls the drawing back together.
- Every box in a row starts at the same y, and the row is as tall as its tallest box (6972–6989). A short box beside a tall one leaves a hole.

In compact mode the engine tries at most six variants: the same layout with gaps scaled by 1, 0.9 and 0.78, in the given direction and, if allowed, the other one (`buildLayoutCandidates`, 6288). It scores them on the boxes' bounding area and aspect only (`scoreLayoutCandidate`, 6371): not on the finished drawing, and not on crossings, bends or labels. A class diagram with inheritance locks the direction to top-to-bottom (8420, 8492), which leaves three variants that differ only in gap size, so the smallest gap always wins.

Use case, ER and sequence diagrams do not use the engine's result. Use case overwrites it with one fixed column of use cases (22982–23322). ER places entities on a ring of fixed radius 240 (28112). Sequence is a lifeline grid.

### 2.3 What `layout compact` changes today

| Diagram | Effect of `layout compact` |
|---|---|
| Class | Gaps ×0.56 / ×0.53 (8446), box padding 14/6 → 9/3, outer margin 30 → 14, all fonts +3 or +4 px (8111–8168), hierarchy families shifted left (8957), two special cases for dependency arrows (9099, 9140) |
| State | Gaps ×0.45 (14424), nested gaps ×0.5 (14319) |
| Use case, activity, deployment | Gaps ×0.45 with a label-width floor |
| Sequence | Head padding ×0.55, head minimum width ×0.6, row pitch 40 → 20 (12794–12803). Lifeline gaps, frame paddings and margins unchanged |
| Component | Nothing except a smaller outer margin. The directive is dropped (16419) because uniformly smaller gaps made routes zigzag for a few percent of area (comment at 16386) |
| Freeform, ER | Nothing |

So compact is a set of fixed multipliers. The engine's compact score does aim at the pane's aspect ratio (6369–6378), but its candidates differ only in gap size and direction, so the pane can change little. In the baseline it changes 21 % of compact class layouts (2.7).

### 2.4 How a diagram's on-screen size is decided

- The renderer writes the SVG at its natural size (`svgOpen`, 2303).
- `sizeDiagramForReadability` (3590) then sets the CSS width to natural width ÷ smallest font size, in `em`. The whole drawing is scaled until its smallest label is as large as the page's paragraph text.
- If that overflows its pane, the fit view starts the diagram scaled down to the pane: at most the pane's width and at most the window height (`fitDiagramView`, 3364–3404).
- Narrated lessons reuse the SVG rendered at build time and scale it down to their column. Build-time rendering runs in a bare headless page about 1264 px wide, so those diagrams are laid out for a wide pane and then shown in a narrow one.
- Song sheets scale down to fixed boxes, never up.

Two consequences shape this design:

- The size of the smallest label on screen is `smallest font × min(pane width ÷ drawing width, pane height ÷ drawing height)`, capped at paragraph size. A drawing that is smaller in units of its own smallest font, and shaped like its pane, has larger text. That one number captures goals 1 and 2.
- One small font anywhere (12 px fragment labels, 13 px stereotypes and notes beside 14 px text) scales the whole drawing up. Text that is already larger than the smallest label takes space without making anything more readable.

### 2.5 Where space is lost

- Gaps are sized to the widest label anywhere. In class diagrams one long label widens every column (`effectiveGapX`, 8401–8413). In component diagrams any interface adds 66 px to every gap (16370).
- Minimum box sizes: state 120 wide, deployment 180×70, component 130×50 with 40 px per port, activity 120, swimlane 180, use case text + 60, class 100.
- Row height equals the tallest box in the row.
- Edges that run backwards get lanes outside the whole drawing (state 14682, activity 25050, component 17597).
- Notes are placed last and grow the canvas (11303).
- Outer margin of 30 px, added again on each side a note or boundary overflows.
- Sequence: a 60 px floor per lifeline gap, a long label's need split equally over the gaps it spans (12850–12868), about 80 px to close a frame, 70 px below the last message, and one actor making every head 74 px tall.

### 2.6 Where overlap can happen today

- Class multiplicities return the least-bad of a fixed candidate list (9644); the fallback that would search for a free spot is unreachable.
- Shared interface labels in component diagrams use their first candidate when none fits (18844).
- Use case labels sit at the edge midpoint with no collision check (23663). ER has no checks at all.
- Notes use a soft penalty and take the least-bad spot (`placeNoteRect`, 3809).
- Two activity nodes in the same swimlane and row get the same x (24739; from reading the code, not reproduced).
- When the grid router finds no path, it draws an L-shaped route that ignores boxes (`buildSimpleOrthogonalFallback`, 4919).
- Sequence self-message labels do not widen their gap (12852).

### 2.7 Corpus and baseline

The repository holds about 750 diagram specs: class 266, sequence 147, component 97, state 77, use case 25, deployment 19, freeform 19, ER 10, activity 10, plus non-graph types. About 45 use `layout compact` today (state 17, class 10, sequence 7 and the tutorials), nearly all in narrated lessons.

Baseline, measured on ArchUML `main`: 399 distinct specs from `test-uml.html`, the SEBook chapters and the narration visuals, each rendered without a layout preference ("default") and with `layout compact`, in a 1200×675 and in a 600×750 container (2,394 renders). "Not empty" is the share of the picture covered by anything drawn, with box interiors counted as covered. "Label size" is the predicted on-screen size of the smallest label when the drawing is scaled to fit the pane, uncapped.

| Type | Specs | Not empty, default → compact | Area in font units, compact ÷ default | Label size in 600×750, px: median (10th percentile), default → compact | Label size in 1200×675, px: median, default → compact |
|---|---|---|---|---|---|
| Class | 146 | 38 % → 43 % | 0.75 | 14.3 (8.7) → 16.3 (9.3) | 19.7 → 26.3 |
| Sequence | 87 | 28 % → 34 % | 0.70 | 10.1 (6.7) → 10.9 (7.2) | 17.2 → 20.2 |
| State | 48 | 29 % → 28 % | 0.95 | 15.8 (9.6) → 17.1 (6.1) | 19.4 → 28.4 |
| Component | 77 | 38 % → 45 % | 0.85 | 15.1 (9.5) → 15.9 (9.7) | 19.4 → 20.1 |
| Deployment | 9 | 46 % → 43 % | 0.99 | 18.9 (14.7) → 21.0 (14.7) | 28.5 → 28.7 |
| Use case | 15 | 29 % → 31 % | 0.83 | 10.9 (8.7) → 11.9 (9.4) | 18.7 → 21.4 |
| Activity | 4 | 28 % → 30 % | 0.86 | 15.4 (13.3) → 16.8 (15.4) | 15.7 → 20.3 |
| Freeform | 5 | 40 % → 43 % | 0.93 | 11.4 (10.8) → 12.2 (11.7) | 22.7 → 24.5 |
| ER | 6 | 15 % → 15 % | 1.00 | 10.5 (10.0) → 10.5 (10.0) | 20.0 → 20.0 |

What the numbers show:

- A compact drawing is still more than half empty in every type.
- In the 600×750 pane, compact gives smaller text than the default layout for 43 of 146 class diagrams (15 of them by more than 10 %) and for 10 of 48 state diagrams. The 10th-percentile state diagram drops from 9.6 px to 6.1 px.
- Compact makes class diagram edges worse: 11 crossings instead of 3 over the corpus, 204 bends instead of 181, and the 90th-percentile detour rises from 1.10 to 1.37. Twenty-five class diagrams gain bends and six gain crossings.
- Compact puts a label on top of a line in four class diagrams. The default layout does so in none. In the narrow container, component diagrams have ten such overlaps in either mode.
- Compact pushes labels away from their edges. In the largest test class diagram, association labels float above unrelated boxes. The harness does not count this; the judge in 6.4 does.
- The worst state diagram detour grows from 1.19 to 4.28 times the direct distance.
- The opening diagram of `SEBook/uml_state_diagram.md` uses `layout compact` and comes out about 2,200 units wide and 280 tall: six states in one row, every column gap sized to the longest label. In the 600×750 pane its labels would be about 4 px; the default layout gives about 6 px. Top to bottom, the same six states need roughly a quarter of that width.
- In the worst class cases the shape is wrong for the pane. A two-class diagram in `SEBook/uml_class_diagram.md` renders 391×252 by default in the tall pane and 562×204 in compact, in both panes. I have not traced why compact keeps the wide arrangement there.
- In 81 of 146 compact class diagrams the smallest text is 14 px beside class text raised to 17 or 18 px; in the three I inspected it is a callout or note. State diagrams with a note mix 13 px with 20 px. Because the page scales a drawing by its smallest text (2.4), these drawings are shown 20 to 50 % larger than readability needs.
- The pane's shape changes the compact layout of only 21 % of class and 23 % of state diagrams. For state diagrams the default layout follows the pane far more often (94 %).
- One compact render of the largest test diagram takes 8.4 s on `main` (2.3 to 3.8 s without compact).

Limits of these numbers: two of the 399 specs are fragments that render nothing. Inheritance lines in class diagrams and all ER lines carry no route metadata, so bends and detours exclude them (counting those strokes for crossings gives 5 → 15 for class instead of 3 → 11). Sequence heads and ER shapes carry no box metadata, so box overlaps cannot be seen there. Overlap between two texts inside the same box is not checked.

The harness and its raw results are throwaway reconnaissance. Phase 1 rebuilds the measurement as a kept benchmark (section 8).

## 3. Goals, non-goals, anti-goals

Goals:

- G1. In compact mode, maximize the on-screen size of the smallest label for the pane the diagram will be shown in. Among equally readable layouts, prefer the smaller drawing.
- G2. Never overlap relevant elements (defined in 6.4).
- G3. Prefer fewer crossings, then fewer bends, then shorter detours. Squeezing never adds a crossing or a bend.
- G4. Keep what the notation means: inheritance points up, time runs down a sequence diagram, lifelines keep their order, nested elements stay inside their parents. An authored direction is honoured wherever the renderer honours it today; in a class diagram inheritance stays vertical even then (8416–8420), as now. A spec with an authored `@layout` block (positions or routes from the visual editor) renders exactly as it does today, compact or not.
- G5. Never do worse than the same drawing left unsqueezed (guaranteed at render time, 6.7), and not worse than today's compact for the same diagram and pane (checked on the corpus, section 7).
- G6. The same spec, pane and text measurements give the same SVG. Nothing in the search depends on time or on chance. Two machines with different fonts still measure text differently, as today.
- G7. Cover every graph-like diagram type, delivered in phases (section 7).
- G8. Work where the renderer has no DOM: the bundle also runs in a web worker with a stub document (`js/uml-worker.js`).

Non-goals:

- Changing any output outside `layout compact`.
- Wrapping long names, members or message labels onto several lines. It would help narrow panes a lot, but it changes how every box looks; a separate decision.
- Re-laying a diagram out when its pane is resized. Layout uses the pane at render time, as today.
- Replacing the renderers' routing or label code.
- Stretching a drawing to fill the pane's unused axis.

Anti-goals (a result with any of these is a failure even if the numbers improve):

- Text made smaller to gain space.
- Overlap accepted in exchange for density.
- Inheritance turned sideways or downward, or message order changed.
- Output that differs between two runs.
- A hand-arranged diagram rearranged.

## 4. Quality scenarios

| ID | Stimulus and environment | Response | Measure |
|---|---|---|---|
| QUA-1 fit | A corpus diagram is rendered with `layout compact` for a 600×750 pane and for a 1200×675 pane | The smallest label is as large as the layout search can make it | Per-type median and 10th-percentile on-screen label size against the baseline (targets in section 7); no diagram below today's compact |
| QUA-2 overlap | Any corpus diagram, and generated random diagrams, in compact mode | No overlapping pair among relevant elements | Zero pairs, measured from the rendered SVG, independently of the optimizer's own model |
| QUA-3 edges | Same | Crossings, bends and detours no worse than the unsqueezed layout of the same shape | Never more crossings or bends than that reference; no route longer than 2.5× its direct distance unless the reference's was |
| QUA-4 cost | A diagram is rendered in compact mode in the editor or a tutorial pane | The search stays within a fixed amount of work | At most 8 full routing passes per render, fewer for large diagrams (6.8); median compact render under 4× the non-compact render on the corpus |
| QUA-5 determinism | The same spec and pane rendered twice with the same text measurements | Identical SVG text | Byte equality |
| QUA-6 compatibility | Any spec without `layout compact` | Output unchanged by this work | Corpus renders with the old and new bundle are byte-identical |
| QUA-7 change | A new diagram type is added, or a renderer changes its routing | Compact works after writing one adapter; the search and the quality rules need no edit | The adapter interface in 6.9 is the only contact point |

## 5. Approaches

**A. Tighter dials.** Keep the pipeline and strengthen the constants: smaller paddings and minimum sizes, gaps sized per column, compact switched on for component, use case and ER. Cheap and low-risk. It still ignores the pane's shape, and nothing checks the result, so overlaps and detours appear exactly when the dials get aggressive. That is the failure recorded at 16386.

**B. Measure, search, squeeze (chosen).** Add a shared model that scores a finished drawing for a pane. Compact mode proposes a few differently shaped placements, lets the existing renderer route each one with its normal roomy gaps, removes the space that is measurably empty, routes again, and keeps a candidate only if nothing overlaps and its edges are no worse. The unsqueezed drawing is always a candidate. It costs two new shared modules, a thin adapter per renderer, and several routing passes per compact render.

**C. A new engine.** Replace placement and routing with one orthogonal layout engine, written here or taken from the ELK library. It has the highest ceiling. It also rewrites routing that each renderer has tuned case by case, invalidates most of the 5,000-line renderer regression suite, changes non-compact output, and (with ELK) adds about 1.5 MB and asynchronous rendering.

**D. Compacting the finished SVG in the page.** Move drawn elements closer after rendering, which keeps every route's shape by construction. It needs a DOM, so it cannot run in the worker, and it needs every drawn primitive tagged, which no renderer does today.

B is chosen because it optimizes the thing the request asks for (the finished drawing in its pane), cannot do worse than the drawing it started from, reuses the routers as they are, and can land one diagram type at a time. A is contained in B as its first step (6.5). C and D are rejected for the reasons above.

## 6. Design

### 6.1 The objective

For a finished drawing with size `w × h`, smallest font size `f`, and a pane `Bw × Bh`:

- `fit = f × min(Bw / w, Bh / h)` is the predicted on-screen size of the smallest label, uncapped.
- `score = ln(fit) − 0.05 × crossings − 0.015 × bends − 0.03 × excess detour`, where excess detour sums, over routes, the amount by which route length ÷ direct distance exceeds 1.5.
- Overlaps are not scored. A drawing with any overlap is invalid.
- Ties within 0.005 go to the smaller `w × h / f²`, then to the earlier candidate.

The weights say: a crossing must buy about 5 % larger text, a bend about 1.5 %. They live in one place and are tuned against the benchmark (section 8).

### 6.2 The pane

One function decides the pane, and both the layout and the fit view use it:

1. An explicit size in the spec: `layout compact 600x700` (CSS pixels). This is the only way a build-time render or a song sheet can know its pane.
2. Otherwise the live container: its content width, and the height the fit view would allow (window height less paddings, limited by a scrolling ancestor).
3. Otherwise 900×600, today's compact default shape.

Three surfaces cannot measure their pane today, and phase 1 gives them one:

- Narrated lessons reuse the build-time SVG. The include that assembles their spec (`_includes/narrated-pattern-diagram.html`) adds the lesson column's size to a `layout compact` line that has none.
- Song sheets know their box (`fit: { w, h }` in the song's choreography). `js/song-video/model-kit.js` passes it the same way.
- The tutorial's live diagram pane renders in a worker that receives a staging element's width and no usable height (`js/uml-live.js` 166–200). It passes the real pane's box instead.

### 6.3 The scene

A scene is a plain record of what a renderer drew:

- the final width, height and smallest font size;
- nodes: id, rectangle, kind, and whether it is a container, with its parent;
- routes: id, points, source, target, and a bundle id for edges that are meant to share segments (an inheritance fan);
- labels: rectangle, owner (a route or node), and kind.

Each renderer fills it while it generates the SVG, at the points where it already computes these numbers. The scene needs no DOM. It is complete when it holds every box, note, edge and outside-the-box label; the phase that brings a renderer in also completes its scene.

Teaching callouts are drawn after the SVG text exists. In compact (class, state, sequence) they are placed from that text without a DOM (`UMLCallouts.drawCompact`) and recorded in the scene as labels of kind `callout`, so the judge sees them (6.11). Authored routes (`applyLayoutRoutes`) are drawn in the page and are not in the scene; specs that have them keep today's path. A scene also records its `origin`, where its 0,0 lies in the SVG's root units, so overlays measured in SVG units can be recorded in it.

### 6.4 The quality judge

`UMLLayoutQuality.evaluate(scene, pane)` returns `fit`, crossings, bends, detours, and the list of violations. It is pure.

`UMLLayoutCore` already has `detectOverlaps` and `repairOverlaps` (5691, 5752). They see boxes only, and the engine keeps using them for box placement. The judge is the one definition of overlap for a finished compact drawing, because it also sees labels and routes.

Relevant elements and what counts as overlap (tolerance 0.5 units):

- two nodes, unless one contains the other as its parent;
- a label and a node other than its owner or an enclosing container;
- two labels;
- a route passing through a node that is neither its end nor an enclosing container of its end;
- a route passing through a label, except a label kind drawn on its own line by design (an ER cardinality pill);
- two routes of different bundles running on top of each other for more than 6 units.

A label must also stay with the thing it names. A label that is more than one line height away from its own edge, or nearer to another edge than to its own, is a violation of the same rank as an overlap. Today's compact already breaks this: in the Observer example of `test-uml.html` the gap between `Observer` and `Subject` is shrunk below the width of the label `notifies`, and the label ends up floating above both boxes.

Not relevant: shadows, a container's frame against its own contents, lifelines against frames, and two edges crossing (counted, not forbidden).

### 6.5 Compact metrics

Each renderer gets one table of compact sizes, stated relative to its font size, replacing the scattered multipliers:

- no text smaller than the diagram's base font, so no single small label scales the whole drawing up;
- box padding about 0.6 em horizontally and 0.25 em vertically;
- minimum box sizes reduced to what the text needs;
- outer margin about 0.7 em, applied once;
- no fixed gap constants: gaps come from the squeeze (6.7).

Callout text follows the same rule and uses the diagram's base size in compact (class 17, state 20), never below the usual 14 px (sequence keeps 14 beside its 13 px messages). Box padding, line height and wrap widths scale with it.

One constraint: in the worker, class text is measured on the main thread for the base font sizes plus 0 to 4 px only (`js/uml-live.js` 340–384). The compact class metrics stay within those sizes, or the measuring protocol is extended in the same change.

### 6.6 Shape candidates

A candidate is a placement of the boxes. Compact mode considers:

- the renderer's normal placement (always);
- the other direction, where the spec does not lock it and the notation allows it;
- independent groups (connected groups, class hierarchy families) packed into rows to match the pane's shape instead of the fixed 1.5;
- from phase 2, engine placements with a bounded row capacity derived from the pane's shape, and long chains wrapped into two or three columns.

Candidates are ranked by a cheap estimate (boxes only) and the best few are realized, within the work budget (6.8).

Packages (class and component diagrams). The layered engine places elements without regard to packages, so its placement can put an element inside a package it is not in, or two packages on each other. Widening gaps keeps the order of the boxes and cannot undo that, so such a placement is invalid however it is repaired or squeezed. Each adapter therefore checks every candidate from its boxes alone (`UMLShared.packagesCollide`, the frames `layoutPackageFrames` would draw). An engine placement that collides is placed again from the same engine input with every package as one block (`UMLShared.packageBlockPlacements`): each package's direct members and inner packages are one level, laid out by the engine; the package, padded and with its tab, is one node of the level around it; edges join the outermost blocks they lie in. Three variants are proposed: every level in the engine's direction, with and without two anchor nodes standing for the outside a package's edges come from and go to, and (when no inheritance locks the direction) the levels inside packages turned across it. When the normal placement collides, the best of these for the pane becomes the reference and the other candidates are derived from it; candidates that still collide are dropped. Diagrams without packages, and diagrams whose engine placements do not collide, get the same candidates as before.

### 6.7 The squeeze

The squeeze starts from a candidate realized with the renderer's normal gaps, where routes and labels had room to sit properly. It does not start from today's pre-shrunk compact gaps. Given that drawing and its scene:

1. For each pair of boxes that face each other across a gap, measure what occupies the gap in the scene: route tracks, labels, and the stubs where edges leave the facing sides, each with the renderer's own clearance. The rest of the gap is empty.
2. Build one constraint per pair: the boxes keep their order and stay apart by at least the occupied width. A pair whose elements lie in different packages also keeps the frames between them (`separation`), and counts as facing on an axis while it is nearer on the other axis than the frames between them reach there, so a squeeze never slides two packages diagonally onto each other. Boxes joined by a straight edge keep their alignment, so the edge stays straight. Subclasses of one parent keep a common top edge. Boxes with authored positions do not move. A container moves with its contents.
3. Solve for the smallest positions that satisfy all constraints, once from each side, and take the midpoint so the drawing stays balanced. Do this for both axes.
4. Let the renderer route and label the squeezed placement, and evaluate the new scene.
5. Accept it only if it is valid and has no more crossings and no more bends than before. Otherwise widen the gaps next to the routes that got worse by one lane and repeat, at most twice. If that fails, keep the unsqueezed drawing.

In phase 1 a composite state moves as one body. Its inside keeps today's nested layout, because the state renderer sizes a composite and places its children inside `computeLayout` (14294–14402, 14474–14496), before any position can be injected. Squeezing inside composites comes with phase 2.

If the unsqueezed drawing itself has an overlap, the same loop runs in the other direction: widen the gap around the overlapping pair and realize again, at most three times. If an overlap remains, the least-overlapping valid attempt is used and the SVG is marked so tests and authors can see it (6.10).

### 6.8 Work budget

The cost is counted in routing passes, not milliseconds, so results do not depend on the machine: at most 8 passes for a diagram with up to 12 boxes and edges together, 5 up to 30, and 3 beyond that. One pass is always spent on the current placement.

Teaching callouts cost more than routing in most diagrams that have them: their placement is a search of its own (`UMLCallouts.drawCompact`, a beam search). A pass therefore routes first and judges the bare drawing against what would reject it; a squeeze that is invalid or has more crossings or bends than its base is rejected without placing callouts, since callouts only add labels and never remove a crossing, bend or overlap. Every other drawing gets its callouts before it is judged, so every choice is made on the picture the reader gets. On the benchmark corpus every drawing stays byte-identical, and on the five slowest diagrams with callouts they are placed on 3 to 5 of 5 to 8 passes (the warm render of class-096 went from 624 to 131 ms).

Without callouts, a pass is almost all grid routing (`findOrthogonalGridPath`), and so is the drawing without a layout line that sets the crossing and bend limits (97 to 99 % of `defaultDrawingCounts`). That drawing uses other metrics and routing options than any pass, so it cannot be reused, and stopping it after routing would save at most 3 %. The router itself was made cheaper without changing any route: each obstacle test of the grid search looks only at the boxes and reserved segments that touch its grid line (`createOrthogonalGridLineIndex`), the A* queue keeps its exact sift rules in typed arrays, a search whose endpoint lies inside a box returns before building its grid, and the class and component nudge passes no longer route a clamped shift twice (`distinctNudgeDeltas`). Routing time fell by about a third (class-030, class-005, component-005); what remains is the search itself, whose order among equally cheap routes decides the drawing and may not change.

Finalist schemes (judge the passes bare, add callouts to the best few only) were measured and rejected. Callouts grow some candidates' frames far more than others, so the bare ranking picks the wrong drawings, and a bare squeeze closes the gaps callouts need: with callouts on the leading 1 to 4 bare drawings, 18 to 39 of the 286 compact renders with callouts got text more than 2 % smaller (up to 29 %), some with more bends. Squeezing the leading bare candidates with their callouts left 2 or 3 such renders at any finalist count (class-040 27 % smaller with two more bends), because drawing every candidate before squeezing spends the pass budget before the squeeze that wins.

### 6.9 Responsibilities

| Participant | Knows or decides | Asks |
|---|---|---|
| Pane resolver (`UMLLayoutCore`) | The pane the drawing will be shown in | the container |
| Scene (record) | What was drawn | — |
| Quality judge (`UMLLayoutQuality`) | How good a scene is for a pane; what counts as overlap | — |
| Shape proposer (`UMLAdvancedLayout`, plus per-renderer packing) | Which differently shaped placements exist | the pane |
| Squeezer (`UMLCompactLayout`) | The tightest positions that keep order, alignment and occupied space | the scene |
| Compact coordinator (`UMLCompactLayout.optimize`) | The sequence propose → realize → squeeze → verify → select, the weights, the budget, the fallbacks | proposer, adapter, judge, squeezer |
| Renderer adapter (one per diagram type, inside its renderer) | How to turn a placement into SVG and a scene; which boxes may move, which are pinned or nested; its direction rules; its routing clearances; what it draws over a finished drawing (callouts) | its own renderer |
| Compact memo (`UMLCompactMemo`) | The finished compact drawings of this page or worker, by everything they depend on | the text measurer, for its fingerprint |

The coordinator knows renderers only through the adapter: it does not know what a callout is, only that `annotate` adds labels. The judge and the squeezer know only scenes and placements. The two new modules sit in the bundle after `UMLAdvancedLayout` and before the first renderer; the bundle is one hand-maintained file with no build step.

The adapter contract:

- `placement()`: the renderer's current boxes with sizes and positions;
- `movable`: which boxes may move, which are pinned, and which move together;
- `realize(placement)`: SVG text and scene, with no side effects that outlive the call;
- `annotate({svg, scene})`, optional: what is drawn over a finished drawing (the teaching callouts), returned as new SVG text and a new scene. It may only add labels, lower the smallest font and grow the size, and leaves the drawing it is given unchanged. An adapter whose spec has no callouts has none and pays nothing (`UMLCallouts.compactAnnotator`);
- `clearances`: lane pitch, box clearance and stub length the renderer's router needs;
- `shapes(pane)`: optional extra candidates only this renderer can propose.

What `realize` has to respect in today's code:

- `applyLayoutPositions` changes the layout object in place (1239–1243), so each candidate works on its own copy.
- The class renderer changes its global size table for the duration of one render and restores it afterwards (`withAdaptiveClassTypography`, 8122–8189). Every candidate is generated inside that one wrapper.
- Moving a box with its contents is the renderer's job. `applyLayoutPositions` moves an entry and its ports, not its children.

### 6.10 What authors see

- `layout compact` keeps its name and gains an optional pane: `layout compact 600x700`.
- A compact SVG that could not be made overlap-free carries `data-uml-layout-issues` with the count, and the renderer logs one warning.
- `REFERENCE.md` and `_includes/archuml-reference.md` describe the new behaviour.

### 6.11 What compact leaves alone

- **Authored layouts.** A spec with an `@layout` block was arranged by hand in the visual editor, against the box sizes of the mode it was authored in. Its routes are stored as absolute points. Such a spec renders through today's code path, unchanged. Today's compact multipliers therefore stay in the bundle for these specs.
- **Callouts.** They are teaching overlays, not model elements, but they are part of the compact picture. Each realized candidate (class, state, component; through the adapter's `annotate`, skipped for a squeeze already rejected bare, 6.8) and the single sequence pass draws its callouts with `UMLCallouts.drawCompact`: the placement rules are the page pass's own (`arrange`, one place), run against the drawing read from its markup instead of the live SVG, so they also run in the worker and in hidden containers. The callout boxes enter the scene as labels owned by the node their target lies in, so the judge counts their overlaps, the squeeze keeps the gap a callout sits in, and the scene's size is the grown frame (the drawing's compact margin around the callouts, not the page pass's 24 px refit). The page pass (`UMLCallouts.render`) is skipped for these drawings. The page shows a compact drawing scaled to its pane, so in the adapters' `annotate` the placer also knows the pane (`frameSizing`): a placement costs, besides its pointer, 300 units per factor e by which the frame it grows makes the drawing smaller there. Growth along the side the pane has to spare is free until that side limits the scale too. Each candidate placement is priced alone, and a partial layout of the beam search for what its callouts together cost, so two callouts may share one strip beside the drawing but not each use up the same spare room. A callout that would sit beside a tight drawing therefore takes room inside it or beyond its free side when the pointer gets only a little longer (in a 600×700 pane the callout of SEBook's components-only diagram moves from beside OrderService, 14.95 px, to below it, 24.42 px). The page pass and the compact sequence drawing, which has no pane, price pointers only. Pointers are not in the scene: the placer keeps them clear of labels and only grazes a stroke when nothing clear exists, as outside compact.

### 6.12 Remembered drawings

The site renders the same diagram often with the same inputs: tutorials infer the diagram again on every edit, panes are drawn again on layout changes, and the fullscreen view renders on the main thread what the worker already drew. `UMLCompactMemo` keeps the finished compact drawings of the page (or worker) so such a render costs no search.

- **Key.** `keyOf(kind, inputs)` writes down the renderer kind, the parsed spec (as the renderer holds it, layout metadata and container aspect included), the colours, the pane, and a text-measurement fingerprint: the widths of a probe text in the regular, bold, italic and code fonts. A drawing measured before a web font finished loading is therefore not shown after it. The worker, which measures with widths sent from the page, adds that table to the fingerprint. An input JSON cannot write down faithfully (a function, a non-finite number, a non-plain object) gives no key, and that render is not remembered.
- **Values.** Frozen markup: the class drawing as markup (already marked with `data-uml-layout-issues`), the state, component and sequence drawings as `{svg, issues}`; the renderer marks the issues on the SVG it inserts, on a remembered drawing as on a new one. The console warning is given once per drawing made, not again when it is reused.
- **Bounds.** 32 entries, least recently used dropped first; in memory only, never persisted. A render that throws is not remembered.
- **Where.** `renderOptimizedCompact` (class), the state and component `renderCompact`, and the compact sequence drawing. Tests load a fresh bundle per file (or per test), and `forget()` drops everything.

Upstream, `js/uml-live.js` already returns its last render for an identical request without asking the worker, so in tutorials the memo serves the requests that alternate (class and sequence views, an edit undone) and the fullscreen view.

## 7. Phases

Each phase lands on its own and is measured with the benchmark from phase 1.

1. **Foundations, class and state.** Pane resolver and directive size, with the three surfaces of 6.2 wired to their panes; scene and judge; benchmark and corpus checks; compact metrics, squeeze and selection for class and state diagrams, with direction and group packing as candidates.
2. **Shapes.** Bounded row capacity and chain wrapping in the engine; squeezing inside composite states; activity, freeform and deployment adapters.
3. **Sequence.** Lifeline gaps solved from the labels that span them; tighter frames, rows and margins; no reordering.
4. **Component.** Channel-aware squeeze that keeps port sides and column order.
5. **Use case and ER.** A pane-aware arrangement for each; collision-aware labels.

Acceptance for phase 1, on the class and state specs of the baseline corpus, in both panes:

- No violation (6.4) in any compact render, measured from the rendered SVG.
- Compact has no more crossings and no more bends than the default layout, per diagram and in total.
- No diagram's label size falls more than 2 % below today's compact or below the default layout.
- Label size in the 600×750 pane: class median at least 18 px (16.3 today) and 10th percentile at least 11 px (9.3 today); state median at least 20 px (17.1 today) and 10th percentile at least 10 px (6.1 today; the default layout reaches 9.6). Direction-locked chains stay wide until phase 2 adds wrapping.
- Output without `layout compact` is byte-identical to `main` for the whole corpus.
- At most the routing passes of 6.8 per render, with timings reported.
- A before-and-after sheet of every diagram that uses `layout compact` today, for your review.

The label-size targets are estimates from the baseline's headroom, not measurements. If the first working version shows that one cannot be reached without breaking G2 to G4, the measured ceiling and the reason are reported; no rule is loosened to hit a number. Each later phase gets its targets the same way before it starts.

## 8. Testing

- **Judge and squeezer: unit tests in Node**, loading the bundle the way `tests/uml-route-geometry.test.js` does. Hand-built scenes with known answers: each overlap kind at just-touching, just-overlapping and contained; crossings at a proper cross, a T-junction, a shared endpoint and a collinear run; a squeeze that removes an empty gap, keeps an occupied one, keeps a straight edge straight, leaves a pinned box alone, and changes nothing when run a second time.
- **Generated diagrams: seeded property tests in Node** for class and state: compact output has no violation, is not worse than the reference on `fit`, and is identical across two runs.
- **Corpus: Playwright**, over `test-uml.html`, the SEBook chapters and the narration visuals. Overlap is measured from the rendered SVG (text and element bounding boxes), not from the scene, so a gap in the scene cannot hide an overlap from the test.
- **Unchanged output outside compact**: a script renders the corpus with the old and the new bundle and compares the SVG text. It is a development gate for this work, not a permanent test, because any later renderer change would break it.
- **Existing suites** stay green. Tests that state requirements of compact (no overlap, smaller than default, authored coordinates win, labels nearest their own edge) stay as they are. A test that pins incidental compact geometry is changed only after it has been shown to you. One known candidate: `tests/uml-renderer.spec.js` 4698–4735 requires compact to be at least 10 % smaller than default in raw SVG units. This design measures size in font units, because that is what decides the size on the page (2.4). If raising small text makes a raw area larger while the drawing gets smaller on the page, that assertion is brought to you with both numbers.
- **Cost** is asserted as a count of routing passes. Timings are reported by the benchmark, not asserted.

## 9. Risks

- RSK-1. Routers may take a different path in a narrower channel. Mitigation: the clearances come from each renderer; the verify step rejects worse edges; the fallback is the unsqueezed drawing.
- RSK-2. Compact renders cost several routing passes. On `main` the slowest test diagram takes about 11 s for one pass; a local, unpublished commit (`939e129`) brings that under 1 s. The budget in 6.8 assumes that commit.
- RSK-3. Build-time renders do not know their pane. Narration diagrams need the pane size written in their spec to benefit fully.
- RSK-4. Another session is changing the same bundle file. New code goes into new modules with small hooks in the renderers, to keep merges small.
- RSK-5. A hard guarantee of no overlap depends on each renderer's label fallbacks. The repair loop handles what more room can fix; fallbacks that ignore room (use case and ER labels) are fixed in their phase. Until a type's phase lands, its compact behaviour is unchanged.
- RSK-6. Callouts are placed against text widths from `UMLShared.textWidth` and glyph boxes estimated from the font size, not the page's glyph geometry; a target inside a longer label can be off by a few units. The placer's clearances (6 to 8 units) absorb this. The placer prices how much its callouts shrink the drawing in the pane (6.11); a heavier price draws callouts into gaps between boxes that the squeeze must then keep open, and at 1000 units per factor e two benchmark drawings (state-016, class-030) came out 7 to 8 % smaller than before, so the weight is 300. Callouts placed inside the drawing crowd each other's approaches more often, so the wider search rounds run more: warm renders of class-096 and class-098 (compact 600×750) take about 1.5 and 2 times as long, the callout diagrams of the benchmark about 12 % longer in all.
- RSK-7. Two compact paths exist for good: the new one, and today's for specs with authored layouts. The old one is frozen, not maintained in parallel.

## 10. Calls made for this design (please check)

1. `layout compact` is reworked in place. The roughly 45 diagrams that use it change, except those with an authored `@layout` block, which render exactly as today (6.11).
2. The target is the on-screen size of the smallest label in the pane, with the pane taken from the spec, then the container, then 900×600.
3. A crossing is worth about 5 % of text size and a bend about 1.5 %; squeezing never adds either.
4. Compact raises small fonts to the base size, callouts included, and never shrinks text. Text is not wrapped.
5. Notation rules in G4 outrank compactness. In class diagrams inheritance stays vertical even against an authored direction, as today.
6. The search is bounded by routing passes, not time. "The same SVG" means for the same text measurements.
7. Phase order: class and state, shapes, sequence, component, use case and ER.
8. Phase 1 also edits three site files so today's compact diagrams learn their pane: the narration diagram include, the song sheet kit, and the live tutorial pane (6.2).
9. Callouts are drawn with each compact candidate and judged with it (6.11); originally deferred to phase 2, brought forward because they caused half the regressions against today's compact.
10. A composite state moves as one body in phase 1.
11. "Smaller than default" is judged in font units; the existing raw-area test is shown to you if it stops passing.
12. The work happens in a separate worktree, with ArchUML on a new branch from `main`.
13. Nothing is committed or pushed until you ask.

## 11. Left to the builder

- The exact compact metric tables per renderer, tuned on the benchmark.
- Data structures and the constraint solver's implementation.
- How the scene reaches the coordinator (return value or a field on the layout object).
- How notes are steered into free space inside the drawing.
- Whether chosen placements are cached across theme re-renders. (Decided: finished drawings are remembered per input set, colours included, 6.12; a theme switch draws anew and switching back reuses the drawing.)
- Which of today's compact special cases survive (the dependency-lane tweaks at 9099 and 9140, the forced bottom exit at 10368, family packing at 8868). Keep those whose tests state a requirement; remove the ones the new mechanism makes redundant once the benchmark shows no loss. The engine's own compact branches stay while any renderer still uses the old path.

## 12. Decisions (2026-11-21)

Tobias answered questions 2 and 3 below with yes: the feature branch includes the routing speed-up `939e129`, and the build happens in a separate worktree. He raised no objection to the design; I read that as approval to proceed. Question 1 was not answered, so my proposal there stands until corrected. Coding is done by Opus sub-agents (his instruction).

The questions as asked:

1. Which panes should today's compact diagrams be laid out for? My proposal: 600×700 for lesson diagrams (the column documented in `docs/uml-class-diagram-narration.md`), each song sheet's own `fit` box, and the real pane in tutorials. The acceptance numbers use 600×750 and 1200×675 unless you name others.
2. May the feature branch include your unpublished routing speed-up (`939e129`, on `fix/uml-routing-and-theme-rerender`)? Without it one routing pass on the slowest diagram takes seconds, and the budget in 6.8 does not hold.
3. Another session is editing `uml-bundle.js` in the main checkout right now. Is a separate worktree off `master` fine for this work?
