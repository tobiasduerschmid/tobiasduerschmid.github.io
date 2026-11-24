# C4 layout and routing redesign: the component-diagram approach, rebuilt for C4

Date: 2026-11-09, revision 2 (after review round 1). The review findings and their dispositions, revision 1, and the design inputs named below were session notes and are not kept in the repository; the decisions they led to are recorded in this document.

Inputs: `component-engine.md` (how the UML component renderer lays out and routes), `c4-diagnosis.md` (what is wrong with `c4/c4-render.js` today, with baseline metrics), spec `docs/superpowers/specs/2026-11-08-c4-model-design.md` §6.4 and §6.5 (binding), and the instructor's direction: "the routing has to fundamentally change" and "use the same kind of approach we use for component diagrams".

Nothing in the repository was changed while writing this design. The diagnosis, metrics, seed and A/B tools it names now live in `scripts/tools/c4-routing/` (its README says what each does and how to run it); their images, metrics and snapshots are outputs, not tracked files. Task numbers (8b-1 to 8e, R) refer to `docs/superpowers/plans/2026-11-08-c4-rendering.md` and the finalization run.

---

## 0. Decision in one paragraph

Option **(c), a hybrid.** Port the component renderer's *ideas* into two new axis-generic C4 modules:

- `js/ArchUML/c4/c4-place.js` (`ArchUMLC4Place`) does placement. It takes the existing `UMLAdvancedLayout` seed, re-ranks the rows, orders each rank to minimise crossings, and assigns coordinates so that edges run straight first, with room for every label on both axes.
- `js/ArchUML/c4/c4-route.js` (`ArchUMLC4Route`) does routing and labels. It generates candidate routes per edge, rejects the illegal ones (including routes with too many bends or any avoidable detour), picks a combination by deterministic global selection, spreads ports, and places each label on or beside its own route.

Both modules reuse exported `UMLShared` primitives and leave the component module (bundle lines 15824–21609), `UMLShared` and `UMLAdvancedLayout` byte-for-byte unchanged. The only bundle change is two new entries in the C4 stub's `CORE_SCRIPTS` list, which lies outside every UML renderer. Component diagrams therefore stay byte-identical by construction, and an A/B render over all 88 component diagrams on the site, in live and static mode and at three widths, checks that (§10). Options (a) and (b) are rejected in §2.

---

## 1. What has to change (baseline)

Baseline from `c4-diagnosis.md` §2 (12 views, 70 edges), extended in review round 1 with the five views the gates were missing (§9). The extension was measured with the same tool on the same snapshot (the diagnosis version of `scripts/tools/c4-routing/render-views.js`; its images and metrics were session outputs).

| Defect | Before (12 views) | Before (5 added views) | Main root cause |
|---|---|---|---|
| Crossings | 16 (10 in booking-components) | 3 (pinned booking-components) | R2: a crossing is either forbidden or ignored, with no cost in between; greedy routing in document order |
| Bends | 128; 32 of the 56 bent edges could be straight at their current positions | 62; 19 straight-possible | R1: every edge leaves bottom and enters top at fixed fractional ports; R4: no alignment pass |
| Detached or ambiguous labels | 4 / 3 (up to 174 px from their edge) | 2 / 2 | R7: label search has no distance cap; R6: gaps budgeted for one label |
| Heads piled on top sides | 100 % of edges end on a top side; 3 heads on one side; approach lanes 14 px apart | same; 3 heads on one side in the pinned view | R1, R3 |
| Along a boundary line (≤ 12 px / ≤ 32 px) | 6 / 9 segments | 3 / 3 | R3: the A* corridor bias puts jogs 12 px inside the boundary line; boundaries are not penalised |
| Detour | 1137 px (536 in booking-components) | 468 px (pinned view) | R2, R5 |
| People below systems in a landscape | landscape8 | – | R5: people go on top only when the view has a scope |

The component engine's lessons (component-engine.md §10) are adopted, and its known weaknesses are fixed rather than copied:

- greedy order dependence, patched there by six repair passes;
- a label score that rewards distance from the edge;
- left/right-only lanes;
- container-width-dependent orientation;
- DOM `getBBox` nudging.

---

## 2. Options

| | (a) Extract the component router into `UMLShared.routeGraph`, used by both | (b) Translate each C4 view into component-engine input | **(c) Hybrid: port the generic ideas into new C4 modules on shared primitives** |
|---|---|---|---|
| Component byte identity | At risk. The router is one 2,900-line closure (`generateSVG`) with about 15 pieces of mutable shared state, routing and drawing interleaved, about 60 magic numbers, and strict-`<` ties whose result depends on evaluation order (component-engine.md §8). Any reordering changes bytes. | Safe (component code untouched). | **Safe**: no line of a UML renderer changes. |
| Nesting (scope, groups, enterprise) | Absent. The component parser drops wrappers, so it would have to be added to shared code. | Impossible: the input model has no containment. | **Built for it**: boundaries are compound blocks, passable for their own members and obstacles for everyone else, with forbidden bands along their lines. |
| TB flow (the C4 default) | Back-edge lanes, same-row lanes, port sides, column reorder and the crossing swap are LR-only. All would need rewriting in shared code, under byte identity. | LR-only, so C4 would have to be drawn sideways. | **Axis-generic** from the start (§4.1); `direction: right` is a transform. |
| Width independence | The engine reads `containerAspect` (DOM width). | Same. | **No container input at all.** |
| Labels at 20 units, on their edge | `CFG.fontSize` is 14; the score rewards clearance; DOM nudging ignores routes. | Same. | **Own placer**: on or beside the own segment, size 20, no DOM. |
| Effort | Highest: refactor plus proof of identity. | Medium, with a poor result. | Medium: about 2,000 lines of new code with pure, testable interfaces, delivered in five checkpoints (§13). |
| Future reuse | Immediate. | None. | Later: once the C4 engine proves out, component diagrams can opt in behind a flag (out of scope). |

**Why not (a).** It requires the riskiest refactor in the bundle to obtain an engine that still lacks nesting, TB and width independence. Byte identity would have to be shown for every tie-break, not just the code paths C4 uses.

**Why not (b).** The component engine cannot represent a boundary, so C4's defining feature would be lost, and its output depends on container width.

**What (c) takes from the component engine.** The *approach* the instructor named, idea by idea:

| Component idea (component-engine.md) | Where it lives in C4 |
|---|---|
| Layered seed, then a post-pass reorder | `UMLAdvancedLayout` seed is kept as spec step 1; exhaustive per-rank order search (§2.4 there) moves to `c4-place` (§4.4) |
| Per-gap widths from labels | Corridor and gap budgeting on both axes (§4.6) |
| Alignment scored by routing (§2.8 there) | Replaced by a structural straight-edge solver (§4.5) that makes an edge straight by construction, with its corridor kept clear, so no routing call is needed to discover it |
| Side-group anchor ordering, pre-routing swap, slot spreading | `c4-route` ends (§5.2) |
| Endpoint candidates with move penalties, escape sides | §5.2 |
| Route variants: router, same-row lane, outer lanes, nested back-edge lanes | §5.3 |
| Scoring by length, bends and crossings with a finite exchange rate | §5.4–§5.5: bends and detour become hard limits per edge, so the lexicographic order ranks only acceptable routes and a crossing is taken when the only alternative is a long detour |
| Repair passes | Replaced by global selection (§5.6) |
| Label placement after routing | §6, with the distance reward inverted and label room reserved by placement |
| Deployment border-run penalty | A hard filter on every boundary line (§5.4) |

---

## 3. Architecture

### 3.1 Modules and data flow

```
layoutView(viewModel, measure, options)                      c4-render.js (orchestration only)
  ├─ layoutContext(viewModel, measure)          sizes, nesting, label sizes (unchanged)
  ├─ seed = seedPositions(graph, measure)       spec steps 1–3 as today (UMLAdvancedLayout per boundary), exported
  ├─ placement = ArchUMLC4Place.place(graph, {seed, direction, pins, corridorExtra})      c4-place.js
  │     ranks → order → straight-edge coordinates → corridor and gap budget → pins/settle
  │     (parts, loaded before c4-place.js: c4-place-frame.js frame and constants, c4-place-ranks.js ranks and
  │      order, c4-place-corridors.js corridors and label slots, c4-place-cross.js cross positions,
  │      c4-place-settle.js final boxes, pins, settle, measured corridors)
  ├─ scene = {boxes, boundaries, boundaryLabels, parentOf, edges, direction, corridors}
  ├─ routed = ArchUMLC4Route.route(scene, {shared: UMLShared})                            c4-route.js
  │     ends → candidates → filters → global selection → labels
  │     (parts, loaded before c4-route.js: c4-route-frame.js frame, constants and edge classes, c4-route-shapes.js
  │      tracks, ends and route shapes, c4-route-labels.js label places and label choice, c4-route-candidates.js
  │      hard filters and the fallback ladder, c4-route-costs.js the objective, c4-route-state.js the selection
  │      state, c4-route-pricing.js move pricing, c4-route-separate.js the separation of close parallels,
  │      c4-route-select.js global selection, c4-route-growth.js growth, c4-route-evidence.js evidence mode)
  ├─ if routed.growth is not empty: corridorExtra += growth; place and route again (≤ 2 rounds)
  ├─ boundaryLabels = placeBoundaryLabels(…)   after routing, clear of the routes and edge labels (below)
  └─ returns {nodes, boundaries, edges, boundaryLabels, routeStats, x, y, width, height}
```

The drawing writes its markup as text through `c4-markup.js` (shared with the interface card, `c4-card.js`), so the static prerender and the live page write the same SVG.

`layoutView` keeps its signature. Its return value, every coordinate in real diagram units (the frame the SVG draws in, before the drawing's padding and title offset):

```js
layout = {
  nodes: { [id]: {x, y, width, height, pinAdjusted, madeRoom} }, // placement.boxes
  boundaries: { [id]: {x, y, width, height} },                    // placement.boundaries
  edges: [{ id, points: [{x, y}], labelBox | null, bends, fallbackRoute, labelFallback }],   // view-model order
  boundaryLabels: [{ id, x, y, width, height, labelFallback }],   // view-model order of viewModel.boundaries
  routeStats,                                                      // routed.stats of the last round
  x, y, width, height,                                             // bounds of everything drawn
}
```

- **Boundary labels** are placed after routing (routing sees `boundaryLabels: []`; placement keeps no room for a label where edges leave a boundary). Each label takes the start of the widest span of its label line, the line along the boundary's bottom padding, that no route segment comes within `labelForeignClear` of and no edge label within `labelBoxClear` of. When that line has no span as wide as the label, the label takes the widest such span of the line in the boundary's top padding. When neither has room, it sits at the top-left corner inside the boundary, in the top padding, with `labelFallback: true`: a route or an edge label then reaches it. The layout gates (§9.2) fail on an unmarked label that a route reaches and on any edge label over a boundary label; a fallback is allowed only where a gated view lists it.
- **Derived edges.** The placement graph's edges carry `derived` (from `viewModel.edges[].derived`): alignment requests of declared edges come before those of derived ones (§4.5). The SVG marks each edge `data-c4-derived`.

### 3.2 Interfaces (all plain data; units are diagram units; every coordinate is an integer)

```js
// c4-place.js — pure, DOM-free, no bundle dependency (Node-testable without a browser)
ArchUMLC4Place.place(graph, options) → placement
graph = {
  items: [{ id, width, height, parent /* boundary id | null */, role: 'person' | 'element', external: bool }],
  boundaries: [{ id, parent, kind: 'scope' | 'group' | 'enterprise' | 'element', labelWidth, labelHeight }],
  edges: [{ id, source, target, labelWidth, labelHeight, derived }],   // view-model order; 0 × 0 = unlabelled;
                                                                         // derived: implied by a lower-level relationship
  scopeId,                                                          // null for a landscape
}
options = {
  direction: 'down' | 'right',
  seed: { [id]: {x, y} } | null,       // always in the real TB frame (§4.2)
  pins: Map<id, [x, y]> | null,        // absolute top-left corners
  corridorExtra: Map<corridorId, units> | null,   // growth requested by route (§6.4)
  cfg,                                 // optional override of CFG, for tests only
}
placement = {
  boxes: { [id]: {x, y, width, height, pinAdjusted, madeRoom} },
  boundaries: { [id]: {x, y, width, height} },
  ranks: { [id]: integer },            // flow-axis rank inside its own level
  order: { [levelId]: [[itemId | laneId, …] per rank] },
  centreAligned: [edgeId],             // edges whose accepted request was a centre-line request
  straightCapable: [edgeId],           // final boxes overlap by ≥ 2·cornerMargin + slotPitch AND the straight band is clear (§5.0)
  corridors: [{ id, kind: 'rank' | 'gap', level, axis: 'main' | 'cross', from, to, between: [idBefore, idAfter] | null }],
  pinnedCorridors: [corridorId],       // the corridors a pin keeps from growing (§6.4); [] without pins
  labelSlots: { [edgeId]: { corridorId, position: 'on' | 'before' | 'after', cross, main } },   // the planned slot (§4.6)
  stats: { layerCrossings, requestsAccepted, requestsRejected },
}

// c4-route.js — DOM-free. Loads without the bundle; resolves UMLShared only when route() is called
// (options.shared, else root.UMLShared), and never writes to it.
ArchUMLC4Route.route(scene, options) → routed
scene = { boxes, boundaries, boundaryLabels: [{id, x, y, width, height}], parentOf: {id: parent},
          edges: [{ id, source, target, labelWidth, labelHeight }], direction, corridors }
options = { shared, cfg,
            noGrowth: [corridorId],        // placement.pinnedCorridors: growing them would move a pinned box
            exhaustivePairs: [edgeId] }    // tests and threshold evidence only (§5.6)
routed = {
  edges: [{ id, points: [{x, y}], labelBox: {x, y, width, height} | null, bends,
            sides: [srcSide, tgtSide], labelFallback: bool, fallbackRoute: bool }],
  growth: [{ corridorId, axis: 'main' | 'cross', by }],   // room the labels or ends still need
  stats: { crossings, bends, rounds, candidates, fallbackRoutes, labelFallbacks },
}
ArchUMLC4Route.classify(scene, edgeId) → { upward, sameRank, blocked, boundaryEntry, exempt, detourCap, maxBends }   // §5.0
```

**Frames.** `boxes` and `boundaries` are in real coordinates. `corridors` and `labelSlots` are in the **flow frame** (§4.1): `main` is the flow axis (real y for `down`, real x for `right`) and `cross` the other. A rank corridor's `from`/`to` are main coordinates, a gap corridor's cross coordinates; a label slot's `cross` and `main` are its planned line and its main start. A consumer that draws a corridor over the SVG (an editor overlay) maps `main`/`cross` to x/y by the view's direction, exactly as `frameAxes` does; nothing else in the placement needs the direction.

**Corridors are measured from the final boxes.** Pins and the settle step (§4.7) can move boxes and grow boundaries after the ranks are stacked. `place` therefore reports each rank corridor from the far end of its rank's boxes (the boundary's start for r = −1) to the near end of the next rank's boxes (the boundary's end after the last rank), and each gap corridor from the box before it to the box after it. A corridor that a moved box closed has no extent (`to` = `from`); a rank of lane channels only keeps its stacked end. Without pins, and with pins where the boxes already were, these equal the stacked corridors. A label slot's `main` follows its settled corridor; its `cross` stays the planned line.

**Pinned corridors.** `pinnedCorridors` names every corridor that a pinned box starts at or after along the corridor's own axis (main for a rank corridor, cross for a gap corridor), compared in the flow frame from the final boxes. Growing one would move that box, so `layoutView` passes the list to `route` as `noGrowth` unchanged; the renderer does not re-derive the frame.

**Corridor ids** are stable strings: a rank corridor is `${levelId}|main|${r}` (the band between rank r and r + 1 of a level; r = −1 is the band between the boundary's top line and rank 0, and r = last is the band to its bottom line); a gap corridor is `${levelId}|cross|${r}|${idBefore}|${idAfter}` (the gap between two consecutive items of rank r). The outer level's id is `'root'`.

**Loading.** `c4-place.js` has no dependencies outside its parts. `c4-route.js` and `c4-render.js` resolve `UMLShared`, `ArchUMLC4Place` and `ArchUMLC4Route` only inside functions, never at script load, so `scripts/tests/c4-render.test.js` (which loads `core + render` in a bare `vm` context) and `js/ArchUML/tests/c4/palette.test.js` (which `require`s `c4-render.js` in Node) keep working. In the Node branch of its UMD wrapper, `c4-render.js` `require`s `./c4-place.js` and `./c4-route.js`, and each of those `require`s its parts (§3.1). As classic scripts, the parts load before their module in the manifest's `render` list and hand themselves over through `ArchUMLC4PlaceParts` and `ArchUMLC4RouteParts`.

`cfg` holds every constant in one frozen object in each module (§3.3): the placement constants in `c4-place-frame.js` and the routing constants in `c4-route-frame.js`, each published as its module's `CFG`. There are no magic numbers inside functions; this is the component engine's maintainability problem, which is not copied.

### 3.3 Constants (diagram units; font size 20, line height 26; existing render CFG: `boxWidth` 300, `levelGapX` 90, `levelGapY` 110, `boundaryPad` 30)

| Name | Value | Meaning |
|---|---|---|
| `slotPitch` | 40 | slot granularity on a side; the spare room a straight-capable pair keeps (overlap ≥ 2·`cornerMargin` + `slotPitch` = 88) |
| `cornerMargin` | 24 | no end closer than this to a box corner |
| `minEndGap` | 60 | two ends on one side are never closer than `max(minEndGap, side/(n+1) − endSpreadTolerance)` |
| `endSpreadTolerance` | 10 | allowed deviation from even spreading |
| `maxEndsPerSide` | 4 | tails and heads together |
| `maxHeadsPerSide` | 2 | a third head on one side costs a crowding term (§5.5) |
| `tailStub`, `headStub` | 18, 30 | minimum first segment; minimum last segment (arrowhead 12 + 18) |
| `trackPitch` | 24 | minimum distance between parallel segments of different routes |
| `approachGap` | 48 (= 2·`trackPitch`) | minimum distance between parallel segments of two routes that end on the same side, within their last two segments |
| `boundaryBand` | 30 (= `boundaryPad`) | no segment may run parallel to any boundary line closer than this |
| `boxClearance` | 20 | route-to-unrelated-box clearance |
| `laneClearance` | 32 (= `boxClearance` + `trackPitch`/2) | a reserved straight corridor's distance from boxes |
| `labelBesideGap` | 6 | gap between a beside-label and its segment; also the maximum label-to-own-route distance |
| `labelForeignClear` | 12 | label to any other route |
| `labelBoxClear` | 8 | label to boxes, other labels, and boundary labels |
| `labelOutlineClear` | 4 | label to boundary outlines |
| `maxBends`, `maxBendsExempt` | 2, 4 | hard per-edge limits (§5.4) |
| `exhaustiveOrderMax` | 7 | per-rank exhaustive permutation limit (5040 orders) |
| `maxSelectionRounds` | 8 | local-search rounds (§5.6) |
| `maxGrowthRounds` | 2 | place-and-route repetitions for growth (§6.4) |

---

## 4. Placement (`c4-place.js`, Tasks 8b-1 and 8b-2)

### 4.1 Frame and `direction: right`

All placement runs in a *flow frame*: `main` is the flow axis (y for `down`, x for `right`) and `cross` is the other one. A box's main extent is its height for `down` and its width for `right`.

The algorithms of §4.3–§4.6 run in the flow frame and never test the direction. **Exactly one helper does:** `frameExtents(inner, labelWidth, labelHeight, direction) → {mainBefore, mainAfter, crossBefore, crossAfter}`. Boundary label lines stay at the boundary's bottom-left in real coordinates. For `down`, the label adds `labelHeight` to the main extent after the last rank and `labelWidth` bounds the cross extent from below. For `right`, it adds `labelHeight` to the *cross* extent after the members, and `labelWidth` bounds the *main* extent from below. Framing (§4.7) calls only this helper, and a unit test covers both directions.

The engine transforms in once and out once. That is how `direction: right` "rotates" spec step 3 (people on the left, scope in the middle, dependencies on the right). Today `layoutView` ignores `viewModel.direction` entirely; this fixes it.

### 4.2 Seed (spec step 1, unchanged)

`seedPositions` (today's `arrangeLevel`/`assignPositions`, extracted and exported from `c4-render.js`) keeps running exactly as now (`UMLAdvancedLayout.compute` per boundary with virtual top and bottom anchors, no container aspect, always TB). From the seed, `place` reads only two things per level, **in real TB terms for both directions**:

- the **rank** of each item: the index of its y-band, where items whose y ranges overlap share a band;
- the **order** within each rank: by x.

The seed is never rotated; for `direction: right` the seed's ranks become main-axis ranks and its x-order becomes cross-axis order. The seed is also the deterministic tie-break for everything below. With `seed: null` (pure Node tests), ranks come from longest path and order from view-model order.

### 4.3 Ranks: the C4 conventions, then shorter spans (fixes R5)

Rank assignment works per level: the outer level, then each boundary's children, with nested boundaries as single items.

1. **People rank 0, at every level that holds people, always.** Rank 0 of such a level holds only people and blocks that contain people; every other item ranks ≥ 1. This holds whether or not the view has a scope, so a landscape also puts people on top, and inside the enterprise boundary people take the boundary's rank 0. An edge from a system *to* a person (`mail → student`) is an **upward edge**. It does not lift the system above the person. Consequence: in every view, every person's bottom lies above every non-person's top (asserted on every view, §9).
2. **The scope pivot** (as today's `rankedAroundPivot`): callers of the scope rank above it, and everything the scope calls ranks below it.
3. **Span minimisation.** Starting from the seed ranks, repeat sweeps in seed order. Each sweep moves every non-person item to the integer rank in its feasible interval `[max(rank(pred)) + 1, min(rank(succ)) − 1]` (and ≥ 1 by rule 1) that minimises the weighted span Σ w·|Δrank|. The sum runs over the item's edges and over its *outside pulls*: an edge to an element outside the level and above it pulls toward rank −1, and one below it pulls toward `maxRank + 1`. The weight w is the number of edges between the pair, so merged and parallel relationships count once per edge. Stop when a sweep moves nothing, after at most |items| sweeps. Ties keep the current rank.

   This replaces `topAnchorRowEdges`, which forced every source item into rank 0 (the "Notifier beside Sales Desk" effect). An item with no incoming edge now sits as low as its successors allow.
4. **Long edges get lane items.** An edge spanning more than one rank inside a level gets one *lane item* per intermediate rank. A lane item is a zero-height, `trackPitch`-wide block in the order (Sugiyama dummies), kept `laneClearance` from boxes. It reserves a vertical channel, so the router finds the edge's monotone corridor already free. Straight requests add further, cross-level lane items in §4.5.

### 4.4 Order inside a rank: crossings first, then stability (component §2.4 idea, transposed)

- **Compound blocks.** A boundary is a single item in its parent's rank, so its members can never interleave with outsiders. Its inner order is solved inside it.
- **Outside partners are fixed ports.** When a level's inner order is solved, the cross coordinate of every outside partner is known from the enclosing level's current solution. Each partner acts as a fixed port above the boundary (rank −1) or below it (rank max + 1).
  - The solve runs outer level first, then inner levels, then outer again: 2 rounds, deterministic.
  - This fixes R4's "virtual anchors placed by the layout, not at the real neighbour's x".
- **Crossing count** between consecutive ranks (with lane items and ports): the standard bilayer inversion count. The final total is reported as `stats.layerCrossings`.
- **Score** of an order, compared lexicographically: (crossings, Σ|position − barycentre of partners' positions| over items with partners, Σ|position − seed position| (stability: an addition elsewhere should not reshuffle a rank), seed-order inversions).
- **Search.**
  - Ranks with ≤ `exhaustiveOrderMax` movable items: **exhaustive permutation**, as the component engine does for ≤ 7 columns.
  - Larger ranks: barycentre sweeps down and up (≤ 12), followed by adjacent swaps until no swap lowers the score.
- **Lane chains move whole** (final review I3, 2026-11-11). After the sweeps, the lane items of an edge that leaves the level (its outer end a port) are tried together at the start and at the end of every row they pass, and kept there when that removes a crossing with an edge inside the level and leaves the level with no crossings at all (`moveLaneChains`). A row search moves one lane item while its neighbours stay, so such a chain stays where the seed put it: the chapter's university landscape kept Student → Learning Management System right of Course Registration, across Course Registration → Student Records. Moves that merely lowered the bilayer count gave the generated landscapes no better routes and some worse (the count only estimates the routed drawing, Ruling 21), so only a crossing-free level is kept.
- **Pins do not take part in ranking or ordering** (final review I1, 2026-11-11): `place` ranks and orders the view as it is without pins, and §4.7 puts each pinned box on its pin. Since 2026-11-12 neither `rankAndOrder` nor the cross-axis solver of §4.5 takes pins at all: the paths that ordered a pinned item by its pin and fixed it across the flow, which only tests still reached, are removed.

### 4.5 Coordinates: straight edges first (spec §6.4 step 4a)

This is the step the old Task 8b described ("alignment before routing"). Here it is a solver, not a shift heuristic.

**Variables.** One cross-axis coordinate per item (box, lane item, or boundary), plus a before and after border for every boundary.

**Separation constraints (a DAG, built once, then extended by accepted requests):**

- consecutive items in a rank: `x[i+1] ≥ x[i] + w[i] + gap(i, i+1)`, where `gap` is `levelGapX` for two boxes, `laneClearance` next to a lane item, plus any `corridorExtra` for that gap corridor, plus the side-head and label room below;
- a boundary contains its members: `L_b + pad_b,before ≤ x[m]` and `x[m] + w[m] + pad_b,after ≤ R_b`, with `pad` = `boundaryPad`, raised to `boundaryBand + headStub + (k − 1)·trackPitch` on a side next to a member predicted to take k ≥ 1 side ends (see *side ends* below), so an escape stub and the segment after it stay out of the boundary band;
- a boundary is ordered against its siblings in **every** parent rank its block spans;
- **pins** never enter the solver (final review I1, 2026-11-11). A former pinned pass fixed each pinned item as a variable and let alignment requests pull its partners toward it, so a pin moved whole chains of unpinned boxes with it and a drop often showed no change relative to the drawing. Pins are applied to the final boxes instead (§4.7).

**Side ends (predicted).** A box whose fan-in from one adjacent rank is f ≥ 3 is predicted to take `max(0, f − maxHeadsPerSide)` heads on its perpendicular sides, alternating after-side and before-side in partner order. The gap on such a side becomes `max(levelGapX, headStub + (k − 1)·trackPitch + boxClearance)`; the route's approach segment then runs mid-gap, and its label is planned in the rank corridor above (§4.6), never in the gap.

**Alignment requests**, each one an equality or an overlap constraint between two items:

- **Dominant neighbour.** For an item u and an adjacent rank R (counting outside partners as ports in R), v is u's dominant neighbour in R only when *more than half* of u's edges toward R go to v **and** v has no other partner in u's rank.
- **Centre-line requests (spec 4a, verbatim):** for an item with a dominant neighbour, `centre(u) = centre(v)`. The two items join one *block* (union-find). A rejected centre-line request is retried once, at the end of its priority class, as a port-overlap request.
- **Port-overlap requests:** for an item with k ≥ 2 partners in an adjacent rank, one request per partner: the two boxes' cross ranges overlap by at least `2·cornerMargin + slotPitch` (88). That leaves room for a straight route with a slot to spare. The item also gets a **soft target**: its centre over the centre of its partners' span (used by balancing, never a constraint).
- **Clear corridor (every request).** A request plans its straight segment at the centre of the overlap window (the two cross ranges intersected and shrunk by `cornerMargin`). For every intermediate rank the segment passes, *in every level it crosses* — including the inner ranks of a boundary the segment enters from an outside port, and the outer ranks it passes after leaving a boundary — the request adds a lane item at the planned coordinate, `trackPitch` wide, separated from boxes by `laneClearance`, and joins it to the request's block. These lane items enter the separation graph **before** the feasibility test, so a request whose corridor is blocked is either rejected or pushes the blocker aside.
- **Label clearance (every request whose edge carries a label).** Within one rank corridor, the planned straight segments of labelled edges are sorted by cross coordinate. The outermost two plan *beside* labels on their outer side (`labelWidth + labelBesideGap + labelForeignClear` of free cross room outward, checked against the other planned segments and the corridor's lane items). Every other one plans an *on* label and needs `labelWidth/2 + labelForeignClear` to each neighbouring planned segment. These become separation constraints between the planned segments' lane items, added with the request; a request that makes them infeasible is rejected.
- People and external elements outside the scope boundary may join a block with a member inside it. Boundaries move as units because a member's block constrains `L_b`/`R_b` through containment.

**Priority order of requests** (deterministic):

1. person → element and element → external, across the scope boundary;
2. declared before derived;
3. centre-line requests before port-overlap requests;
4. edges whose two ends have no other edge toward that rank (true 1:1);
5. fewer competing requests on either end;
6. view-model edge order.

**Acceptance.** A request is accepted only if the constraint graph with it (its equality or overlap constraint, its lane items and its label-clearance constraints) still has a solution. The test is no positive cycle in the longest-path relaxation of the block graph, O(V·E), with V < 200. A request that would stretch the drawing's cross extent by more than `maxStretch = 3·boxWidth` is also rejected; this keeps alignment from blowing up the drawing, and it is a size guard only — it does **not** bound the Task 2 stability gate (that is checked by measurement, §9 and Task 8b-1 Step 0).

**Compaction and balance:**

- Longest-path left-justification gives each block's minimum position; the leftmost block of the first rank is the anchor at cross 0.
- **Balancing, top-down, one pass** in rank order. A block with partners in the rank above moves within its slack toward the median of those partners' centres. Siblings that share their only upper partner are moved *as a group* toward centring the group under that partner, so a parent never moves for its children. A block with no partner above moves toward its soft target (centre over its lower partners' span). This is the median idea of Brandes–Köpf in one direction, so the result is deterministic, and an added child moves its siblings, not its parent.
- Coordinates are rounded to integers after each pass.

**Result.** `centreAligned` lists edges with an accepted centre-line request. `straightCapable` lists every edge whose *final* boxes overlap by ≥ 88 and whose straight band is clear (the §5.0 predicate, the same one the avoidable-bend metric uses). The router (§5.3) always offers a straight candidate for these, and selection prefers 0 bends when nothing of higher priority is violated. "A relationship gets a bend only when no overlap-free alignment exists", as the spec requires.

Worked example (reference container view): `api` has two lower partners, `db` (inner rank 2) and `billing` (outside, below the scope), so it gets two port-overlap requests and no centre request. `api → billing` (priority 1) is accepted first: its planned segment at about ¾ of `api` gets a lane item in the scope's inner rank 2. `api → db` is accepted next with its segment at about ¼ of `api`; `db` sits left of the lane item, at least `laneClearance` (32) away. Both labels plan *beside*, outward. Both edges are straight, and the `api → billing` line passes ≥ 32 units from `db`.

### 4.6 Corridor and gap budgeting: room for every label on both axes (fixes R6)

After the cross coordinates are fixed, every edge that crosses a rank corridor has a *planned label slot* (reported in `labelSlots`):

- a straight-capable edge: on its planned straight segment, *beside* (outward) or *on* as decided in §4.5;
- any other edge: on its target-side segment in the corridor next to the target (the vertical of a Z route at the target's end slot, or the source-side vertical of an L route into a side end), beside, on the side away from the target's other ends;
- a Z route's jog needs a track; jogs whose cross ranges overlap need separate tracks (interval colouring, sorted by cross position then edge id).

The planned slots in one corridor are packed into levels by greedy interval colouring along the cross axis (sorted by cross position, then edge id). A rank corridor's main extent becomes:

```
max(levelGapY, Σ_levels (max label main extent in the level + labelBoxClear) + jogTracks·trackPitch + tailStub + headStub)
  + boundaryBand on each side that touches a boundary line
  + corridorExtra(corridorId)
```

For `direction: right` the main extent of a label is its width, which reproduces the component engine's per-gap widths ("label width + 64"). Gap corridors (cross axis) get their extent from §4.5's separation constraints plus `corridorExtra`.

Today's gaps are sized for one label (R6), and edges that cross a boundary get none (`anchorEdge` size {0,0}). Both stop here.

### 4.7 Main-axis positions, pins, settle (spec step 5)

- Ranks are stacked using the corridor extents.
- Boundaries are framed inside out with `frameExtents` (§4.1; `frameAround` semantics unchanged for `down`).
- Pins overwrite pinned boxes' top-left corners. Then `settleLevel` separates overlapping siblings, inside out, and marks `pinAdjusted`.
- A pin moves its own box and nothing else (spec §9.2: a drop re-routes and never re-ranks): every other box keeps the place the placement without pins gives it, unless the settle step separates it from a box a pin made it overlap, or a corridor grows for a label (§6.4, which never grows a corridor that would move a pinned box). Gated by `scripts/tests/c4-layout.test.js` ("pinning … moves only …") and `js/ArchUML/tests/c4/place.test.js` ("a box pinned clear of the drawing moves alone"), and in the editor by the drawn positions after a drag and after M (`tests/c4-editor-editing.spec.js`).
- **A drop lands where it is dropped** (polish round, 2026-11-11). At each level, a sibling that holds a pinned box (the box itself, or a boundary around it) keeps its place, and the other box of an overlapping pair makes room: it moves up when its top is the higher one (the drop covers its lower part) and down otherwise, and then holds its new place too, so what it pushes makes room for it in turn. Only when two siblings that both hold a pin overlap does the lower leave its pin (`pinAdjusted`); without pins, and between two boxes that hold none, the lower moves down as before. A box without a pin that the settle step moved is marked `madeRoom`, and `layoutView` keeps the mark when the settle step of any growth round moved it (a later round can give it that place by growing a corridor for a label the move crowded). The editor announces where the element is drawn and names the elements that moved to make room: those marked `madeRoom` and drawn elsewhere than before the drop, so elements that only follow a newly added element into the layout are not named. Before this, a box dropped onto the lower part of another was pushed below it (212 units off the drop in the review's probe) while the status said it was pinned where it was dropped. Gated by `c4-layout.test.js` ("dropping … onto the … half of …"), `place.test.js` ("… stays on its pin, and the other makes room …"), and `c4-editor-editing.spec.js` ("a drop onto another element …").

---

## 5. Routing (`c4-route.js`, Tasks 8c-1 and 8c-2)

Routing is **geometry-based**: it reads boxes, boundaries, boundary labels and corridors, not ranks. Pinned and hand-moved layouts are therefore routed by the same code.

### 5.0 Geometric edge classes (defined once)

These definitions are normative. `c4-route.js` implements them in `ArchUMLC4Route.classify`; `scripts/tests/c4-route-metrics.js` re-implements them independently from the view model and final layout (never importing the router), and `c4-route-metrics.test.js` asserts the two agree on every edge of every gated view. All are in the flow frame (`main`, `cross`) of the final layout; "s" is the source box, "t" the target box.

- **Straight band** of two boxes: the intersection of their cross ranges, shrunk by `cornerMargin` at each end. A straight route exists geometrically when it is non-empty and the band, between the boxes' facing sides, is clear of every other element box inflated by `boxClearance`, every boundary label, and every boundary's forbidden band (except crossing a line perpendicularly).
- **upward**: t's main end ≤ s's main start (the target lies entirely before the source on the flow axis).
- **sameRank**: the main ranges of s and t overlap.
- **span**: the main-axis distance between the facing sides of s and t (0 when sameRank).
- **blocked**: the *monotone region* — the rectangle from s's facing side to t's facing side on the main axis, over the union of their cross ranges — intersects another element box inflated by `boxClearance` (the *blocker*; the one with the largest cross half-extent if several).
- **boundaryEntry**: some boundary holds exactly one endpoint, and the edge is blocked.
- **exempt** = upward ∨ boundaryEntry ∨ (sameRank ∧ blocked).
- **maxBends** = `maxBendsExempt` (4) if exempt, else `maxBends` (2).
- **detourCap** = 0 if not exempt; else `2·(boundaryBand + trackPitch + boxClearance) + h`, where h is the cross half-extent of the widest *cap blocker* (0 when there is none). Detour = route length − Manhattan distance of its two end points.
- **Cap blockers** (Ruling 21, Task 8e): the blockers above, and every boundary that holds neither end of the edge (and is not the box it lands on) whose rectangle, inflated by `boundaryBand`, intersects the monotone region. Such a boundary is an obstacle the edge may not cross (§5.1, spec §6.4), so a route past it must go around the whole boundary. Only element boxes make an edge `blocked`; boundaries size its cap and nothing else. Router and metrics module apply the same rule.

None of these is a property of a chosen route, so the router cannot exempt itself by choosing a lane.

### 5.1 Geometry model

- **Obstacles** are named with `name: id`, so they can be skipped by id (the diagnosis found unnamed obstacles):
  - every element box, inflated by `boxClearance`;
  - every boundary that contains neither endpoint, as a whole rectangle **inflated by `boundaryBand`**, so no route runs along its outline;
  - every boundary label box.
- **Passable boundaries** are those containing exactly one or both endpoints. Their *outline* is not an obstacle, but each one carries a **crossing allowance**: 1 if it holds exactly one endpoint, 0 if it holds both.
- **Forbidden parallel bands** lie along *every* boundary line, `boundaryBand` wide on both sides. No segment may run parallel inside one (filter 2). For non-passable boundaries this is implied by the inflation; for passable ones it is checked explicitly.
- **Tracks** are the coordinates where a candidate may place a run perpendicular to the flow. In each corridor they sit at the midline and at ±k·`trackPitch` from it, while staying ≥ `tailStub` from boxes and outside forbidden bands.
  - Tracks are also placed in the free bands beside boxes, at the gap midlines between rank neighbours, and on the lane items placement reserved.
  - Outer lanes sit at bounding box ± (`boundaryBand` + k·`trackPitch`).
  - Jogs therefore land mid-gap (fixes R3) and never inside a boundary band.

### 5.2 Ends: sides, slots, order, spreading (component §3.1, §3.2 ideas)

- **Sides per end** are generated in this order (the first is the preferred one):
  - **Flow sides**: for a non-upward edge, source end-side and target start-side (bottom and top for `down`; right and left for `right`). For an **upward** edge, the reversed pair (source start-side, target end-side), so the route is monotone against the flow instead of looping around.
  - **Facing sides**: the two sides that face each other when the boxes overlap on the main axis (same rank, sideways edge).
  - **Escape sides**: the perpendicular sides, with move penalty 40 + 0.1·|offset| (the component engine uses 34/42). They let fan-ins use left and right sides instead of piling onto the top.
- **Slot coordinates on a side**, at `slotPitch` granularity, between `cornerMargin` from each corner:
  - the straight slots, i.e. the straight band (centre, then nearest to each box centre, at most 3), and the planned straight coordinate from `labelSlots`;
  - the partner-aligned coordinate;
  - the side centre;
  - the *spread slot*: the end's position in the side-group order, evenly spread at `side/(n+1)`. Ends on one side are sorted by partner cross coordinate, then by edge id (component `buildComponentSideAnchors`).
- **Pre-routing crossing swap** (component §3.1): within each side group, adjacent ends whose partners are in the opposite order are swapped when the swap lowers the bilayer crossings of their straight candidates.
- **Spreading guarantee.** Two ends on one side closer than `max(minEndGap, side/(n+1) − endSpreadTolerance)`, or more than `maxEndsPerSide` ends on a side, are a *conflict*, the selection's first objective term (§5.5), so spreading cannot be traded away. On a 300-unit side that allows at most 4 ends, at least 60 apart.
- **Bundles.** Edges that remain between the same two boxes, in either direction, after the projection's merging (spec §5.2 step 5) form a bundle. At most two members run inside the shared straight band, with beside labels on their outer sides. Each further member takes an escape-side lane outside both boxes, at a pitch of `max(slotPitch, labelWidth + labelBesideGap + labelForeignClear)` from the previous member's route on that side, with its label beside it on the outer side. No bundle member carries an *on* label, and members never share a track.

### 5.3 Candidate routes per edge (component §3.2 variants, axis-generic)

For every (source end, target end) pair from §5.2, at most 9 × 9 but in practice ≤ 30 pairs, the following variants are generated:

| Variant | Bends | When |
|---|---|---|
| **straight** | 0 | the two slots share a coordinate on facing or flow sides |
| **L** | 1 | flow side at one end, facing or escape side at the other |
| **Z** | 2 | flow sides at both ends; the jog is on every free track of the corridors between them (mid-corridor first) |
| **side lane (same rank)** | 2 | sameRank and blocked: a U through the corridor before or after the rank |
| **back-edge lane** | 2–4 | exempt edges only: lanes outside the blocker between the ends, on either side. They are assigned by **span nesting** (shortest span innermost, component §2.9), and the two sides are balanced to differ by at most 2. |
| **boundary entry lane** | 2–4 | boundaryEntry edges: run outside the boundary, then cross its line once, perpendicular, beside the blocker (booking-components app → catalog) |
| **outer lanes** | 2–4 | four lanes outside the bounding box of all obstacles (survive the filters only for exempt edges with a large enough cap) |
| **grid fallback** | any | `UMLShared.routeOrthogonalConnector(src, tgt, obstacles, {skipNames, stub, clearance: boxClearance, extraXs/extraYs: all tracks, bendPenalty 38})` *without* `occupied`, so it never takes the hard-or-blind behaviour of R2. Generated only when no other variant survives the filters. |

The routes are simplified with `UMLShared.simplifyOrthogonalPath` and deduplicated by point list. The candidate list per edge is capped at 40, keeping the lowest (bends, length) first.

### 5.4 Hard filters (a candidate that fails any is dropped)

1. It passes through an obstacle (`UMLShared.routeHitsObstacle`) or through the interior of its own source or target box.
2. A segment runs parallel to **any** boundary line inside its forbidden band (`boundaryBand`) over more than 2 units. This rule is the deployment engine's border-run penalty turned into a rule.
3. It crosses a passable boundary's outline more often than the allowance (at most once per edge, never twice).
4. The first segment is shorter than `tailStub` or the last shorter than `headStub`.
5. It passes within 8 units of a box corner on its own end side (no grazing).
6. It has no segment that can carry its label against boxes, boundary labels and outlines: none long enough for an on-line label, and none with free room beside it. (Conflicts with other routes and labels are judged during selection, §5.5.)
7. It has more bends than `maxBends(e)` (§5.0).
8. Its detour exceeds `detourCap(e)` (§5.0). Non-exempt edges therefore only get monotone routes (straight, L, Z).

**Fallback ladder** (`ladderOf`) when no candidate of an edge passes every filter. Every step keeps filters 1 and 7:

1. the candidates that fail only filter 6 (a label without room): they stay legal routes, and growth (§6.4) makes the room instead of a detour;
2. for an exempt edge that is not a bundle member beyond the first two (§5.2), the **corridor routes**: three or four bends whose turns lie on corridor middles, the first turn in a corridor between the two ends, a lane in any corridor across the other axis within half the detour cap of the two ends, and for four bends a last turn between the ends (`corridorTurnChoices`), from each side's preferred slot. Those passing every filter are the edge's candidates;
3. the filter-8 failures with the smallest detour, with the detouring shapes of exempt edges tried for a non-exempt edge too; the edge is flagged `fallbackRoute`;
4. the grid fallback with filters 2, 7 and 8 relaxed; the edge is flagged `fallbackRoute`.

`stats.fallbackRoutes` counts the flagged edges and must be 0 on every gated view (§9).

### 5.5 Objective (lexicographic, per edge and summed per view)

```
cost(edge, candidate | other edges' current choices) =
  ( conflicts           // ends closer than the minimum end gap or over maxEndsPerSide (§5.2);
                        // this edge's label has no legal position against the other current choices (§6.1)
  , crossings           // intersections and touches with other routes (§9 definition), via UMLShared.countRoutePairCrossings plus a touch test
  , overEnds            // passing within 8 units of another edge's arrow tip or tail
  , closeParallels      // parallel overlap ≥ 40 with another route closer than trackPitch (incl. shared track);
                        // approach segments into the same side closer than approachGap
  , bends
  , crowding            // heads beyond maxHeadsPerSide on one side
  , length + movePenalty(src) + movePenalty(tgt) )
```

- Tuples compare lexicographically, and a view's objective is the element-wise sum.
- Equal tuples break ties by candidate generation order: variant order in §5.3, then slot order.
- **Why lexicographic is safe now.** In revision 1, crossings outranked bends and length with nothing bounding them, so any detour beat one crossing — R2's "crossing forbidden, A* takes any detour" moved into the objective. Now filters 7 and 8 remove every route over the bend limit and every non-monotone route of a non-exempt edge *before* ranking. The order ranks only acceptable routes, so when avoiding a crossing would need a long detour, the crossing is chosen. This matches the component engine's finite exchange rate (`length + 36·bends + 5000·crossings`), stated as limits instead of weights.
- `crowding` ranks below `bends`: a third head on a top side is accepted only when every side alternative costs an extra bend; usually it does not, because a third top head is a Z (2 bends) and a side head an L (1 bend).
- **One-sided fan-in is a conflict.** Term 1 also counts, once per box, a box whose heads number at least `fanInSides` (3) and all arrive on one side (`oneSidedFanIn`). It ranks with the other conflicts, above crossings, which is how the "sides used" gate (§9.2) is met: such a box takes a head on a second side even at the cost of a bend. Pricing adds the change in this count when picked heads join the fixed ones (`sidePricer`).

### 5.6 Global selection instead of repair passes (fixes R2 order dependence)

1. **Order:** straight-capable edges first (4a: "straight edges first"), then by fewest surviving candidates, then by view-model order.
2. **Greedy start:** each edge in that order takes its best candidate against the choices already made.
3. **Local search:**
   - Each round visits the edges in the same order and re-chooses each edge's candidate against all the others' current choices.
   - A change is kept only if the **view objective strictly decreases** lexicographically. The process therefore terminates.
   - At most `maxSelectionRounds` rounds.
4. **Pair moves:** for every pair of edges that still cross each other or still have a conflict, try every combination of their two best 6 candidates, scored by the view objective. This is the exchange the greedy component engine cannot make: it fixes "an early edge took the corridor a later one needed".
5. **Parallel separation (post-pass, `separateParallels`).** After the local search and pair moves, for every pair of chosen routes that still run close beside each other (closer than `approachGap`, overlapping by at least `parallelOverlap`), each route in turn offers variants that move its close run clear of the other (`separatedCandidates`). The cheapest variant is kept only when the view objective strictly drops; if any is kept, one more local-search round runs. Variants join their edge's candidate list, so later pricing treats them like generated candidates.
6. **Evidence mode** (tests only, `options.exhaustivePairs: [edgeIds]`): evaluate every combination of the named edges' full candidate sets, with every other edge on its chosen route, and report the minimum crossings found. This is the evidence the threshold policy (§9) requires. Since Task 8e (Ruling 21) a combination counts only when it breaks no gate the chosen routes keep: the view's conflicts (term 1, which ranks above crossings) and its over-ends and close parallels (zero gates of §9.2) do not rise above the chosen routes'. Without this, the search reported crossing-free combinations that run two routes 9 units apart (seed 8), which no gated drawing may use. The filter is `keepsGates` in `exhaustiveCrossings`: a combination is a candidate minimum only if its gated-pair total (over-ends and close parallels between its routes and against the fixed routes) and its view conflicts are at most the chosen routes'.

This replaces the component engine's six post-selection repair passes (safety, prior-crossing, hard, notch, slide, concise), which exist because its greedy order is final.

### 5.7 Route clean-up

- Doglegs shorter than `trackPitch` cannot occur, because every jog is on a track.
- After selection, `slideEnds` moves each end along its side toward the partner-aligned slot while the objective does not increase. This is the component engine's `refineRouteEndpoints` without its port mutations.

---

## 6. Labels (fixes R7)

### 6.1 Positions and rules

- **Positions**, all of them on or beside the edge's own route:
  1. **On** a segment: the label box centred on the segment, so its background interrupts its own line. Only segments that are not the stubs qualify. The segment must leave `labelBoxClear` free at both ends of the label, and `headStub` before the arrow tip.
  2. **Beside** a segment: `labelBesideGap` from it, on either side.

  Along a segment, positions are tried at fraction 0.5, then in 8-unit steps outward.
- **Hard rules:**
  - no overlap with element boxes, boundary labels or other labels (pad `labelBoxClear`), or with boundary outlines (pad `labelOutlineClear`);
  - distance ≥ `labelForeignClear` to every *other* route, so no label is ambiguous;
  - distance ≤ `labelBesideGap` to its own route.
- **Fan-outs and fan-ins.** Edges whose label segments are neighbours across the flow (the planned slots of §4.6) take *beside* positions on alternating outer sides; the outermost two always face outward, and a middle one is *on* its segment, with the cross room §4.5 reserved. Bundles follow §5.2.
- During selection (§5.5), a candidate whose label has no legal position against the boxes and the other edges' current routes and labels counts as a conflict. Filter 6 checks only the static geometry.

### 6.2 Choice

- Each label has a small position list. They are solved jointly: greedy by fewest positions, then a local search that swaps positions while label overlaps decrease. Ties go to the planned slot's position, then the on-line position, then fraction nearest 0.5, then the side away from the flow (right of a vertical segment, above a horizontal one).
- The component score's clearance reward is **inverted**: nearer to its own segment is always better.

### 6.3 Text

Every label line is drawn at `CFG.fontSize` 20 by the existing `drawEdgeLabel`. There is no DOM measuring after layout and no `getBBox` nudging, so static and live renders stay identical.

### 6.4 Growth instead of drift

- If some label still has no legal position, or some side still has a conflict that more room would fix, `route` returns `growth`: `{corridorId, axis, by}`, naming either a rank corridor (main axis) or a gap corridor (cross axis) and the missing extent.
- `layoutView` adds `by` to `corridorExtra(corridorId)`, re-runs placement and routes again, at most `maxGrowthRounds` (2) times. Pinned boxes never move, and a corridor whose growth would move a pinned box is not grown.
- If growth is blocked or exhausted, the label takes a position on or beside its **own** route (distance ≤ `labelBesideGap`), and the edge is flagged `labelFallback`. A fallback label is therefore never detached; it may be ambiguous, which the gates catch. `labelFallback` must be absent on every gated view.
- **Deviation from the design above (as built, `fallbackPlace`).** The design relaxed only the foreign-route clearance and the label-to-label rule. When every position on the route also breaks a fixed obstacle, that rule has no answer, so the implementation scores each position by a tuple and takes the least, in walk order for ties: (1) the number of fixed obstacles it breaks, that is element boxes and boundary labels within `labelBoxClear`, boundary outlines within `labelOutlineClear`, and the route's other segments within `labelBesideGap` (`FIXED_LABEL_RULES`); (2) the labels it overlaps; (3) the foreign routes within `labelForeignClear`. A fallback label therefore overlaps as few boxes as it can, but it may overlap one. The gates catch that as a label overlap (§9.2), and the editor should show such a label as a fallback.
- There is no unbounded `findClearLabelPlacement` search, so a label never drifts 174 units away.

---

## 7. Determinism, width independence, pins

- Neither module reads the DOM or the container. `measure` is the only browser input, and widths are rounded up to integers before placement.
- Every collection is an array or a `Map` in view-model order. No `Object.keys` iteration decides any order, because integer-like ids would sort first.
- Every sort comparator ends with a total tie-break: view-model index, then id. Ids never break ties lexically before view-model index (a metamorphic test renames ids to check it).
- Neither module mutates its input (tests pass recursively frozen graphs and scenes).
- There is no `Math.random`. Floating-point values are rounded to integers after every coordinate pass, so comparisons are exact.
- Pins are absolute top-left corners (spec step 5), applied after placement; overlaps they cause go to the settle step, never thrown.
- Neither module writes to `UMLShared` (a test compares its keys and function identities before and after).

---

## 8. Performance (40-element view)

Sizes: N ≤ 40 boxes, E ≤ 60 edges, ≤ 40 candidates per edge, ≤ 6 segments per route.

| Stage | Work | Estimate |
|---|---|---|
| Ranks | ≤ N sweeps × N × deg | < 1 ms |
| Order | exhaustive only for ranks ≤ 7 (5040 × bilayer count); larger ranks use sweeps | < 30 ms worst case |
| Coordinates | ≤ 120 alignment requests × feasibility O(V·E), V ≈ 200 with corridor lane items | < 25 ms |
| Candidates | E × 40 | < 5 ms |
| Selection | rounds (≤ 8) × E × 40 × E × 36 segment pairs ≈ 4·10⁷ cheap comparisons; edge bounding boxes are pre-rejected first, which cuts this by about 10; label feasibility only for candidates that reach the first term | < 80 ms |
| Labels | E × ≤ 40 positions × (boxes + routes) | < 10 ms |
| Growth | at most 2 more place-and-route rounds, only when needed | ≤ 2 × the above |

**Design budget:** `layoutView` ≤ 250 ms for the generated 40-element view and ≤ 60 ms for the reference container view in Chromium, which fits the editor's live redraw. The component engine needs 269 ms for 9 edges. The test asserts a generous 1500 ms ceiling (median of 3, in its own isolated test), to stay deterministic on CI, and prints the measured time.

**Measured in Task 8c-3 (Ruling 20):** the median was 67 s for the 40-element view, 45 times the ceiling. Most of the time goes to `c4-route.js` `select` → `pairMoves`, which recomputes every side cost and label mask for each candidate pair. Task 8d fixed it.

**The timing gates today** (`scripts/tests/timing/c4-route-timing.test.js`, run by `npm run test:timing`, a serial lane outside `npm run test:unit` because wall-clock gates fail under a parallel run): the 40-element view against the 1500 ms ceiling (median of 5), and every §9.3 view, the pinned booking components view among them, against the 250 ms design budget. Measured on 2026-11-10 in that lane: the 40-element view 1453 ms median; booking components 85 ms and booking components pinned 90 ms; every other gated view ≤ 70 ms.

**Editor drag budget (Milestone 3).** A drop recomputes the layout with pins: `place` runs once, as without pins, and puts the pinned boxes on their pins, plus up to two growth rounds. Budget: a layout with pins stays within the 250 ms design budget for every learner-sized view (gated by the pinned booking components row, 90 ms measured in Chromium); the 40-element view keeps its 1500 ms ceiling and is not a drag case. The budget assumes the editor lays out on drop, not on every pointer move. Live re-routing during a drag would need its own budget, to be agreed with the user. Fixed in Task R: on the 42-box timing graph, a pin where the box already was moved 32 of 42 boxes (down) or 29 (right). The order and ranks were the same; the alignment requests were not. `acceptRequests` turns a request down when it stretches the drawing by more than `maxStretch` measured from the current solution, and the pin had already widened that solution, so the pinned pass accepted requests the pass without pins had turned down for their stretch (and turned down one it had accepted), and later requests became infeasible. The pinned pass kept the earlier pass's stretch verdicts for a while; since the final review (I1) pins no longer enter placement at all, so a pin where the box already was changes nothing by construction. The test in `js/ArchUML/tests/c4/place.test.js` still runs on that graph in both directions.

**Task 8e (Ruling 22):** the cap blockers of §5.0 gave the 40-element view's long edges real routes, and its first round left one label without a legal place, so the view needs a growth round: two place-and-route rounds, a median of 1760 ms. The ceiling stays at 1500 ms.

- *Option (c), no growth round, is out of the router's reach on this placement.* In round 1, `s13→s18`'s label is blocked by `s12→x1` (21 units away) and `s12→s18` (56 units away). No candidate of `s13→s18` lowers the view's conflicts. No combination of two of these three edges lowers the cost either: `s13→s18` with `s12→x1` (200 × 3 candidates), `s13→s18` with `s12→s18` (200 × 1; `s12→s18` is a fallback edge with one candidate), and `s12→x1` with `s12→s18` (3 × 1). Making room there means growing the gap between `s17` and `s18`, which is the growth round. Pair moves that also try the routes blocking a label changed nothing. A placement change was excluded by Ruling 21.
- *Option (b), cheaper pricing, behaviour unchanged.* Every cost term is a multiple of ½ (coordinates are integers or corridor middles), so sums are exact in any order. The changes:
  - Each edge's candidates carry their joint bounds (an envelope), so a pair-sum update passes over edges whose candidates all lie out of reach. Pair costs are measured only within their exact reach (`pairReach`).
  - Each candidate keeps its own cost and its pair costs against the chosen routes in one vector (`withChosen`). A price starts from one vector of the fixed edges' terms. One end's or one head's side change is worked out once per pricer.
  - A pair move ranks both edges' candidates once and reuses that order for the leads.
  - Cost vectors are array literals, not copies of the frozen `ZERO`. Those copies were the largest single cost.
  - Each shape group in `capped` gives up its cheapest routes from a heap instead of a full sort. Obstacle checks and pair measuring allocate nothing per segment.
- *Result:* a median of 1266 ms (1417, 1272, 1266, 1224, 1216 ms) in `npm run test:timing`, with both rounds still run. The 17 gated views, the pinned view, the ten generated seeds and the 40-element view lay out byte-identically before and after.


**The bundle's orthogonal connector router (Ruling RR-11, 2026-11-15).** The UML renderers route their connectors with the bundle's own grid router (`buildOrthogonalGraph` and `findOrthogonalGridPath` in `uml-bundle.js`), which C4-notation views reach only as the grid fallback of §5.3, and which draws every C4 view in UML notation. One drawing of the reference model's `deployment production` with pins routed 672 connectors and took about 230 ms, so the drop path that dropped a stale bend (two drawings, UML-view editing spec §6 rule 5) measured 544 ms against the 250 ms budget of `scripts/tests/timing/c4-delegated-view-timing.test.js`. The budget was kept (RR-11), and two changes made it hold:

- *One drawing instead of two.* The bundle's opt-in `UMLShared.renderSkippingDetachedRoutes(draw)` leaves out each stored route whose ends no longer lie on their boxes while `draw` runs, and returns their ids; `renderDelegatedView` draws once inside it. Outside the opt-in, `applyLayoutRoutes` is unchanged.
- *A faster router with the same output.* `buildOrthogonalGraph` tests each grid point and segment only against the rectangles its own lane passes through (`rectsAcrossVerticalLanes`, `rectsAcrossHorizontalLanes`); with strict comparisons this gives the answers of the test against every rectangle. The string-keyed node map is an `Int32Array` grid read through `graph.nodeIndexAt(xi, yi)`, with rows and columns still walked and sorted in ascending order, so every adjacency list keeps the order that breaks ties between equally short paths. The A* search of `findOrthogonalGridPath` numbers its states `nodeIndex * 3 + direction` and keeps `dist`, `prev`, and `reached` in typed arrays; arithmetic, push order, and tie rules are unchanged.
- *Result:* the dropped-bend path 544 → 148 ms median, one drawing of `deployment production` 230 → 126 ms; the A/B guard showed 0 differences over the component (267 live, 89 static), deployment (48, 16), and C4 (216, 72) corpora, and 32 recorded drawings stayed byte-identical (`rr11-report.md` in the session notes).

---

## 9. Acceptance metrics

### 9.1 The metrics module and its own tests

All metrics are computed on `layoutView` output by `scripts/tests/c4-route-metrics.js`, created in Task 8b-2 from the diagnosis metrics tool with the definitions below. It reads only the view model (nodes, boundaries, edges) and the final layout (`nodes`, `boundaries`, `edges[].points`, `edges[].labelBox`). It never imports `c4-route.js` or `c4-place.js`, and every threshold is a literal in the metrics module and in the tests, never read from `ArchUMLC4Route.CFG` or `ArchUMLC4Place.CFG`. Points are simplified first (collinear points dropped). Router-reported fields (`bends`, `stats.*`, `labelFallback`, `fallbackRoute`) appear in assertions only to check that they agree with the computed values.

`scripts/tests/c4-route-metrics.test.js` pins the module with known-answer fixtures at each boundary (§Task 8b-2): one proper crossing counts 1; a route passing through another's bend, a T-touch, and a collinear overlap shorter than 40 are each counted (as crossing or as touch); a label at 6 units from its route is attached and at 7 detached; a foreign route at 11 makes a label ambiguous and at 12 does not; two ends at the minimum end gap − 1 are stacked and at the gap are not; a boundary run at 29 units with overlap 3 hugs, at 30 or with overlap 2 does not; the §5.0 classes on hand-built boxes; and agreement with `ArchUMLC4Route.classify` on every gated view.

### 9.2 Definitions and thresholds (every gated view)

| Metric | Definition | Threshold |
|---|---|---|
| crossings | every intersection of two route polylines, with **zero tolerance**, except points on the outline of a box that is an endpoint of both routes; proper crossings, a route through another's bend, and collinear overlaps of any length all count | per-view table |
| touches | a route end or bend lying on another route (T-junction), counted separately | **0** |
| bends | interior points of the simplified route | per-view table, and per edge ≤ `maxBends(e)` from §5.0 (2, or 4 for exempt edges) |
| avoidable bends | an edge with ≥ 1 bend whose straight band (§5.0) at the final positions is non-empty and clear, and whose straight replacement, judged against every other edge's final route and label, adds no crossing, touch, conflict (§5.5), over-end or close parallel, and has a legal label position (§6.1) | **0** |
| detached labels | label box farther than 6 from its own route (axis-aligned rect-to-segment distance) | **0** |
| ambiguous labels | label box nearer than 12 to another route | **0** |
| label overlaps | label on a box, label or boundary label (pad 8), or on a boundary outline (pad 4) | **0** |
| label fallbacks / fallback routes | router flags, checked against the computed metrics | **0** |
| end spacing | two route ends (heads or tails) on one box side closer than `max(60, side/(n+1) − 10)`, n = ends on that side | **0** |
| ends per side | heads and tails on one box side | **≤ 4** |
| heads per side | arrow tips on one box side | **≤ 2** (generated views: ≤ 3) |
| sides used | every box with fan-in ≥ 3 receives heads on ≥ 2 sides; pinned on Booking Ledger and Room Catalog (booking components) and Campus Identity and Course Registration (campus landscape) | yes |
| crowded approaches | two routes ending on the same side whose last two segments run parallel closer than 48 over ≥ 40 | **0** |
| over ends | a route passing within 8 of another edge's arrow tip **or** tail end | **0** |
| short approach | last segment < 30 | **0** |
| boundary-hugging | a segment parallel to **any** boundary line within 30, overlap > 2 (crossing points excluded) | **0** |
| excess boundary crossings | outline crossings beyond 1 per boundary holding exactly one endpoint (0 otherwise) | **0** |
| close parallels | parallel segments of two routes closer than 24, overlap ≥ 40 (includes shared tracks) | **0** |
| detour | route length − Manhattan distance of its ends | per edge ≤ `detourCap(e)` (§5.0: 0 for non-exempt edges); per view ≤ the table's total |
| size | drawing width and height (`layout.width`, `layout.height`) | ≤ the table's caps |
| people on top | every person's bottom < every non-person's top | every view |
| SVG hygiene | no `style` attribute and no `<style>` element; every `<text>` has `font-size="20"`; every label `<rect>` fill is a baked palette value | every view |
| determinism | two layouts deep-equal; the complete SVG `outerHTML` at 320 px and at 1400 px containers is equal; static (`uml_to_svg.js`) == live for every C4 figure on the reference and chapter pages | yes |

### 9.3 Per-view budgets

"Before" is the diagnosis baseline (the metrics of the snapshot taken before Task 8b-1; the numbers are in the table). Bend targets are structural lower bounds plus a small allowance, derived from each view's fan-outs (for example, components: a coordinator with 3 children in one rank can have at most one of them straight below it, so 2 bends). Size caps follow one rule: height ≤ ⌈1.25·H₀⌉ (label levels and jog tracks); width ≤ min(W₀ + 652, P) when W₀ ≤ P, where 652 = 2·(308 + 6 + 12) is room for one outward beside-label on each side and P is the widest drawing that still prints its labels at ≥ 9 pt on A4 portrait (1133 if the print column is 680 CSS px; re-measured in Task 8b-1 Step 0); width ≤ W₀ for wider views that are printed on a page (no print regression), and ≤ ⌈1.15·W₀⌉ for wider test-only views.

| View (model → selector) | Edges | Before: crossings / bends / detour / W × H | **Crossings** | **Bends ≤** | **Detour total ≤** | **W × H ≤** |
|---|---|---|---|---|---|---|
| context (course-registration → `context of registration`) | 2 | 0 / 0 / 0 / 360 × 798 | 0 | 0 | 0 | 1012 × 998 |
| containers (→ `containers of registration`) | 4 | 0 / 6 / 0 / 555 × 1407 | 0 | 0 | 0 | 1133 × 1759 |
| components (→ `components of api`) | 6 | 0 / 8 / 0 / 1140 × 1198 | 0 | 2 | 0 | 1311 × 1498 ¹ |
| landscape (→ `landscape`) | 2 | 0 / 0 / 0 / 360 × 798 | 0 | 0 | 0 | 1012 × 998 |
| **campus landscape** (`campus-landscape.yml` → `landscape`) | 12 | 0 / 26 / 386 / 1232 × 1792 | 0 | 10 | 150 | 1417 × 2240 |
| shop (Task 2 12-element fixture) | 11 | 2 / 20 / 0 / 1530 × 1237 | 0 | 6 | 0 | 1760 × 1547 |
| two groups | 6 | 2 / 12 / 28 / 1200 × 1178 | 0 | 4 | 0 | 1380 × 1473 |
| boundary landing | 2 | 0 / 0 / 0 / 360 × 782 | 0 | 0 | 0 | 1012 × 978 |
| booking containers (`campus-booking-suggested.yml`) | 6 | 2 / 14 / 187 / 885 × 1606 | 0 | 4 | 150 | 1133 × 2008 |
| booking components | 12 | 10 / 30 / 536 / 1420 × 1678 | 1 ³ | 10 | 200 | 1598 × 2098 ⁴ |
| booking landscape | 4 | 0 / 8 / 0 / 945 × 858 | 0 | 2 | 0 | 1133 × 1073 |
| database-as-system context (`flaws/database-as-system.yml`) | 3 | 0 / 4 / 0 / 750 × 841 | 0 | 0 | 0 | 1133 × 1052 |
| containers, `direction: right` (custom view) | 4 | – (direction ignored today) | 0 | 0 | 0 | 2770 × 1133 ² |
| flaws/unlabeled-uses → `containers of registration` (chapter line 774) | 4 | 0 / 6 / 0 / 555 × 1373 | 0 | 0 | 0 | 1133 × 1717 |
| flaws/backend-box → `containers of registration` (chapter line 783) | 4 | 0 / 6 / 0 / 555 × 1381 | 0 | 0 | 0 | 1133 × 1727 |
| starter (`campus-booking-starter.yml`) → `context of booking` | 4 | 0 / 8 / 0 / 945 × 858 | 0 | 2 | 0 | 1133 × 1073 |
| starter → `landscape` | 4 | 0 / 8 / 0 / 945 × 858 | 0 | 2 | 0 | 1133 × 1073 |
| **total of the 17 rows** | 90 | 16 / 156 / 1137 (right-flow row excluded) | **≤ 1** ³ | **≤ 42** | – | – |
| booking components, **pinned** (`finder` at [1000, 373], `catalog` at [30, 1129]) | 12 | 3 / 34 / 468 / 1330 × 1678 | ≤ 3 | ≤ 34 | 300 | no width cap × 2098 |

¹ If Task 8b-1 Step 0 finds this view printed on the reference page, the width cap becomes 1140 by the rule. ² The first structural estimate counted 4 main-axis ranks × 300 + 3 corridors × (308 + 18 + 30 + 8 + 2·30) ≈ 2470 and set the cap at 2600; it measured 2770. Flowing right, each of the view's five elements takes a rank of its own (Student, Planner Web App, Registration API, Registration Database, Billing System), so the estimate is 5 × 300 + 4 × 424 = 3196. Task R corrected the count and pins the measured 2770 as the cap. The right-flow view is a test fixture, not printed. ⁴ Printed on a landscape page ("Print" below), so the rule gives min(W₀ + 652, P) = min(2072, 1598) = 1598 with P for the Letter landscape column; it measures 1521.

³ Raised from 0 by Ruling 18 (Task 8c-1) with §9.4 evidence, a planarity argument: every member–member edge lies inside the boundary (excess boundary crossings 0), and outside it lie only the stars of Booking Web App and Booking Database and the arc of Campus Calendar. In a crossing-free drawing, the star of Booking Web App splits the outside into regions that all touch it, so a virtual edge app–db can be added without a crossing. The graph then holds a subdivision of K3,3 with parts {app, ledger, catalog} and {coordinator, finder, db} (catalog–coordinator via permissions), so every drawing that passes the boundary gates has at least one crossing. The router's `exhaustivePairs` search agrees (minimum 1 over coordinator→permissions × finder→ledger, and over those two plus app→catalog and catalog→db).

The pinned row is the editor's case: the learner's pins decide the geometry, so it carries no-regression budgets for crossings and bends and the full set of zero gates for labels, ends, boundaries and parallels. **A pinned view has no width cap** (Ruling 20): the learner placed the boxes, so the drawing is as wide as the pins make it. Its height cap stays.

**Generated views.** `generatedLandscape(seed, size)` (an LCG, never `Math.random`) builds 10 learner-sized views (seeds 1–10, 10–15 elements) and one 40-element view (seed 7: 4 people; 26 systems inside the enterprise in 3 groups of internal systems; 6 externals; 60 edges). Each generated model's shape (counts per kind) and a SHA-256 of its sorted edge list are asserted, so a generator change is visible. Every zero-threshold metric above applies (heads per side ≤ 3). `placement.stats.layerCrossings` is re-counted independently from `placement.ranks` and `placement.order`. Total bends ≤ Σ over edges of (0 if the edge is straight-capable at its final positions, else 2) + 2 + one per box with fan-in ≥ 3 (Ruling 21: the "sides used" gate makes such a box take a head on a second side, which can cost a bend over the straight or Z route onto its top; seed 1 is the case).

**Crossing gate of generated views (Ruling 21).** The bilayer layer crossings are a lower estimate on fixed layers, not a bound for orthogonal drawings with side ports, lanes and boundary entries, so they are not the gate:

- *Learner-sized views (seeds 1–10):* for every pair of edges whose routes cross, the router's evidence mode (§5.6) re-routes the scene the layout was routed on and searches every combination of the pair's candidate sets, with every other edge on its route. The pair's crossings (with each other and with every other route, counted by the metrics module) must not exceed those of the combination the search reports. An exhaustive search over all crossing edges at once is not feasible: it did not finish within 90 s for seeds 1, 3, 4, 5 and 9 (7.5·10⁶ combinations for the three crossing edges of seed 7 alone).
- *The 40-element view:* crossings ≤ layer crossings + port-induced crossings, the crossings the metrics module finds on the first or last segment of a route whose end attaches to a side along the flow (left or right flowing down, top or bottom flowing right), which the layer count models as flow-side ends.

**Print (Task R; instructor decision: printed C4 labels at 9 pt or larger, which supersedes min(9 pt, before)).** Every C4 figure on `/SEBook/tools/uml-reference.html`, `/SEBook/architecture/c4.html` with its quiz, and the two tutorials' print views prints every text of its drawing at 9 pt or more, on A4 and on US Letter, except the one figure named below. A drawing scales to its printed column, so its smallest text (font size f, in drawing units) reaches 9 pt (12 CSS px) only when the column is at least `width × 12 / f` px wide.

- *Measured before Task R* (print emulation; portrait columns 642 px on A4 and 665 px on Letter with the site's 2 cm margins; 550 px inside a quiz card): these figures printed below 9 pt: the chapter's Step 4 and Design B component views (1188 units, 7.6 pt), the illustrative university landscape (1342, 6.73 pt), the suggested Booking API component view (1569, 5.76 pt), the quiz's Review API component view (1188, 6.94 pt), the code view (a UML class diagram with 13-unit text, 6.06 pt) and both dynamic views (UML sequence diagrams with 12- and 13-unit text: 3.58 pt on the chapter, 6.01 pt on the reference), and the deployment view (7.65 pt).
- *Choice: a landscape page, by evidence.* Landscape gives a column about 1.5 times wider (959 px on Letter, 1026 px on A4, with 0.75 cm margins), which brings every C4-notation drawing on the site to 9 pt (the widest, 1569 units, to 9.2 pt on Letter; 1 cm margins would leave it at 8.99 pt), and the code and reference dynamic views too, without changing any drawing on screen. Wrapping labels narrower changes every C4 layout on screen and every gate of this section. The one delegated view landscape alone cannot bring to 9 pt, the UML sequence diagram of a dynamic view, wraps instead (below). Splitting a figure into side-by-side tiles makes the reader assemble it. A drawing taller than a landscape page continues on the next one, as a tall drawing already did on portrait pages.
- *Mechanism.* `c4-render.js` (`markPrintOrientation`) marks a drawing `data-c4-print="landscape"` when its readable width exceeds 550 px, the narrowest portrait column (a quiz card on A4). Live and static figures carry the mark, because the static driver keeps the drawn SVG; the exported `svgText` does not. `css/uml-diagram.css` gives the marked figure (a quiz question card whole, so its box leaves no empty page) the named page `c4-landscape` (`size: landscape`, so the print keeps its paper; 0.75 cm margins). The figure is a flex column with no top margin in print, because Chromium otherwise prints an empty landscape page before it and the text after a drawing that continues across pages on a landscape page.
- *After Task R:* the 2026-11-10 build measured every figure at 9 pt or more on both papers (the Booking API component view at 9.2 pt on Letter and 9.8 pt on A4, the code view at 9.7 pt, the deployment view at 9.3 pt, the reference's dynamic view at 9.6 pt), except the chapter's dynamic view of the enroll scenario: 5.7 pt on Letter and 6.1 pt on A4 across a landscape page. Its UML sequence diagram was 1514 units wide with 12- to 14-unit text; its five lifeline heads and their messages, each name and label on one line, filled that width, so no page geometry reached 9 pt.
- *Dynamic views wrap (Task R fix round 1).* The UML sequence renderer gained `layout wrap <width>` (REFERENCE.md "Wrapped Names and Labels"): lifeline names and message labels break between words into lines at most `<width>` units wide, and the default lifeline gap shrinks to 0.8 of its width, because stacked labels need less room between the heads. Without the directive nothing changes (52 sequence diagrams on the site render byte-identical). `c4-uml.js` writes `layout wrap 120` into every dynamic view, so the chapter's enroll view is 923 units wide (inside the 959 px a figure gets of the Letter landscape column, with the 12-unit fragment guards as its smallest text); 130 would widen it to 1006. The A/B over the C4 corpus differs only in the two dynamic views (the chapter's and the reference's), on screen and in the static prerender. The notation stays UML; drawing dynamic views in C4 notation (numbered relationships) remains open as a separate decision.
- *Gates* (`tests/c4-display.spec.js`): per page and paper, every figure's smallest text in the column of its orientation (≥ 9 pt, no exceptions); and for the PDF of every printed page that draws C4 views (the reference, the chapter, the C4 tutorial's print view) on Letter and A4, every marked figure on a landscape page (found by its caption, or by its longest drawn line where it has none, as the reference's dynamic view), the first page portrait, and no empty landscape page.
- *Editor canvases (polish round, 2026-11-11).* The chapter's two "Try it" editors printed their drawing at 7.6 pt. The editor's canvas now marks its drawing as `render` marks a figure's (`ArchUMLC4Render.markPrintOrientation`), so a drawing too wide for a portrait column prints on a `c4-landscape` page through the same rule. Gated in `tests/c4-display.spec.js` ("every editor drawing prints its labels at 9 pt or larger").


**Findings of Task 8c-3 and where they went (Ruling 20).** These findings are recorded here, not loosened. Each deferred gate ran as a `node:test` `todo` or a Playwright `test.fail` naming the task that owned it; Task R (the finalization run) removed every marker: the gates now pass, or hold an explicit ratchet whose test name states its structural reason.

- Size and print, owned by Task R: resolved by the landscape print layout ("Print" above). The booking components cap follows the rule with the landscape P (note ⁴); the right-flow view's cap corrects its structural estimate (note ²). The chapter's suggested Booking API component view prints at 9.2 pt; its `test.fail` is gone.
- Pinned booking components: width 2110 against the old cap of 1530. This is no longer a finding, because pinned views have no width cap (above).
- Generated views (Tasks 8e and R): seeds 1, 2, 5, 7 and 9 meet every gate. The others are no-regression ratchets (Ruling F1) in `scripts/tests/c4-route-quality.test.js`: the listed violations may not grow, no other violation may appear, and every other gate holds. Each ratchet is exact (polish round, 2026-11-11; `ratchetDrift` in `scripts/tests/c4-route-gates.js`): a listed violation that shrinks or disappears, or bends that fall below the pinned number, fail the test until the pin is lowered or removed, so the pins stay a true record. The test name states the structural reason:
  - seed 3: s6 (fan-in 3) takes every head on its top; within 2 bends only s5→s6 reaches another side, and that adds a conflict (1 one-sided fan-in).
  - seed 4: p1→s4 and s2→s5 both run in the strip between System 4 and group 1's right edge, 10 units apart. The placement budgets that strip, between the box and the boundary padding, for one track; a second track needs a wider group padding or a placement that budgets tracks along a boundary, not a router change (1 close parallel).
  - seed 6: s6→s7's label has no legal place: every place beside its route lies nearer than 12 to another route (1 ambiguous label, 1 label fallback).
  - seed 8: s4→x2 runs 9 units beside s3→x2; the only way apart crosses once, and §5.5 ranks crossings above close parallels (Ruling 23; 1 close parallel, 1 crowded approach).
  - seed 10: p1→s7 must pass group g1; its only route detours 878 against its cap of 752 (fallback route) and runs 17 units beside s2→x1.
  - the 40-element view: two long edges around the groups exceed their detour caps (s8→x1 detours 4044 against 2621.5) and fall back, and the crowding costs 2 one-sided fan-ins, 2 close parallels, 1 ambiguous label, 3 label or route fallbacks, 1 avoidable bend, 1 stacked end and 2 bends above the budget (76 against 74).
  - Task R's attempt for each was a diagnosis from the rendered view and the router's own numbers (`scripts/tools/c4-routing/render-views.js` now renders the generated views as `generated seed <n>` and `generated 40 elements`). Seed 4's cause lies in placement corridor budgeting; the others confirm Task 8e's analysis, and none has a local fix in the router that keeps the §5.5 objective order.
  - Growth that leaves the placement unchanged (a corridor already wider than it needs absorbs it) ends the growth rounds, since the deterministic router would only repeat its answer (`placeAndRoute`).
- Chapter-page display and readability gates waited for rendering Task 12 (interface figures). Task 12 removed the exclusion from `tests/c4-display.spec.js`, and the final fix round removed it from `tests/uml-readable-sizing.spec.js`: both measure every drawing on the chapter, the prerendered interfaces view of the Registration API among them. The three interface cards are HTML text, not images, so the drawing gates do not select them; the card gates in `tests/c4-display.spec.js` cover them.

**Learner figures (final review I3, 2026-11-11).** The 17 rows above are shared models and fixtures. `scripts/tests/c4-route-pages.test.js` reads every C4-notation figure the learner pages draw from its source (`scripts/tests/c4-page-figures.js`: the SEBook fences and `c4-view.html` includes, the quiz figures, the tutorial fences, and the ArchUML reference's `language-c4` blocks) and holds each to every zero gate of §9.2, at most two arrow tips on a side, and no crossing, unless its `CROSSINGS` table names the drawing with its §9.4 evidence (today only the chapter's suggested Booking API component view, note ³). The chapter's university landscape had one avoidable crossing; it has none since the lane chains move whole (§4.4).

**How the checks compare and count (Ruling 20).**

- Static == live: both drawings are compared after removing the four accessibility attributes of the SVG root (`role`, `aria-label`, `aria-hidden`, `focusable`). A page names the figure on its container and hides the SVG, while the static driver names the SVG itself. C4-notation views must then match byte for byte. Delegated UML views (class, sequence, deployment) compare node coordinates and route points only, because the bundle's renderers bake different fills and viewBox margins in the static driver and on a page.
- Layer crossings: the re-count from `placement.ranks` and `placement.order` gives a lower and an upper bound, and the test checks that `stats.layerCrossings` lies between them. It cannot be exact, because ports whose elements lie in different rows are placed at packed geometric centres, which ranks and order alone do not decide.

### 9.4 Threshold policy

The thresholds are design targets set from structural bounds, not measured results; the engine does not exist yet.

- If an implementer shows that one is unattainable, they stop and bring the evidence to the user. Acceptable evidence:
  - for crossings: the router's own exhaustive check (`exhaustivePairs`, §5.6) over every combination of the involved edges' candidate sets, saved with those candidate sets and a rendered, annotated image; or a planarity argument on the view graph including the boundary cycle and the outside top and bottom sides. A positive bilayer minimum from the order search is **not** evidence: it is a count on fixed layers, not a lower bound for orthogonal drawings with side ports and lanes.
  - for alignment and bends: the infeasible request set from the solver, with the constraint cycle;
  - for size and stability: the measured values and the rendered images.
- A threshold is never loosened silently.
- Tightening one after measurement is encouraged.

---

## 10. Component diagrams stay byte-identical

1. **Baseline snapshot per task.** Every task that can affect a rendered page (8b-1, 8b-2, 8c-1, 8c-2, 8c-3) starts with Step 0: `node scripts/tools/c4-routing/ab-compare.js snapshot <new folder>` copies `uml-bundle.js`, `uml_to_svg.js`, `c4/`, `css/`, `vendor/` and `js/git-graph.js` from the working tree into a folder outside the repository and records SHA-256 sums. The snapshot is taken immediately before the task's first edit, so other milestones' uncommitted changes (24 hunks in `uml-bundle.js` today) are part of the baseline, not of the diff.
2. **Static guard.** `diff -U0 <snapshot>/js/ArchUML/uml-bundle.js js/ArchUML/uml-bundle.js` shows **zero hunks** in tasks that do not touch the bundle (8b-2, 8c-2, 8c-3) and **exactly one hunk** in 8b-1 and 8c-1, whose removed and added lines are only lines of the stub's `CORE_SCRIPTS` array: 8b-1 adds `'c4/c4-place.js',` before `'c4/c4-render.js'`, 8c-1 adds `'c4/c4-route.js',` after `'c4/c4-place.js',`. Any other hunk fails the task.
3. **Render A/B** with `node scripts/tools/c4-routing/ab-compare.js compare <snapshot> <snapshot of the working tree after the change>` (written and self-tested in review round 1; `--corpus deployment` and `--corpus c4` compare the deployment diagrams and every C4 figure the same way):
   - **Corpus**, each form with its own decoder, deduplicated by real path (`_includes/REFERENCE.md` is a symlink to `js/ArchUML/REFERENCE.md`):
     - JSON: `_data/**/*.json` objects with `type: "component"` and a string `source` (`_data/narration_visuals/{cloudflare2019,huggingface2026,therac25,uml_component_diagram}.json`): **45**;
     - `data-uml-type="component"` elements with an entity-encoded `data-uml-spec` (either quote style) in `SEBook/**`, `_data/**/*.yml`, `_includes/**`, `test-uml.html`: **20** (SEBook 15: `uml_component_diagram.md` 11, `solid.md`, `aadl.md`, `architectural_styles/pubsub.md`, `architectural_styles/layers.md`; `_data/quizzes/uml_component_diagram_examples.yml` 5);
     - `<code class="language-uml-component">` bodies, HTML-decoded, in `SEBook/**`, `_includes/**` (including `archuml-reference.md`), `js/ArchUML/REFERENCE.md`, `test-uml.html`: **23** (security.md 1, archuml-reference.md 3, REFERENCE.md 3, test-uml.html 16);
     - total **88** (counted 2026-11-09). The script prints the count per form and per file, compares each form with an independent substring count, and fails unless both equal the pinned numbers. The task re-counts at its start and updates the pinned numbers only if content changed.
   - **Validity:** every A-side SVG must start with `<svg`, contain a component node, and contain no error text, so two identical error outputs cannot pass.
   - **A/A control:** A is rendered twice per mode and must match itself exactly before B is judged.
   - **Modes**, each byte-compared on the SVG `outerHTML`:
     - *live*: the bundle inlined, then the C4 manifest scripts loaded and one C4 view rendered (what a page with a C4 figure does after the stub's lazy load), then every component source at container widths 320, the SEBook content width (740 by default; Task 8b-1 Step 0 measures the column on `/SEBook/uml_component_diagram.html` at a 1280 px viewport and passes it with `--widths`), and 1200, after `document.fonts.ready`, A and B in the same browser;
     - *static*: the snapshot's own `uml_to_svg.js` in batch mode (C4 scripts before the bundle, as the prerender does), with its cache inside the snapshot, cleared before each run.
   - **Expected:** `[live] … invalid A outputs: 0; A/A differences: 0; A/B differences: 0`, the same for `[static]`, and `PASS`. Self-test on 2026-11-09: A = B = the current tree passed; a mutant bundle (one component `bendPenalty` 38 → 3) produced 12 A/B differences and FAIL.
4. The existing suites `scripts/tests/uml-structural-regressions.test.js`, `scripts/tests/uml-behavioral-regressions.test.js`, `tests/uml-renderer.spec.js` and `tests/uml-visual-layout-editor.spec.js` stay green.

---

## 11. Spec deltas that need the user's sign-off before Task 8b-1 starts

§6.4 is binding. This design keeps every *rule* in it but changes the *mechanisms* it names and makes one ordering explicit; §17 of the spec records such changes. Proposed text:

- **Step 1**, appended: "… then refine ranks (people alone on the first rank of every level that has people, shortest spans) and order within ranks (fewest crossings, outside partners at their real positions, then least movement from the seed)."
- **Step 4**, replacing it: "Route edges by choosing, for all edges together, among candidate routes (straight, one bend, two bends through mid-corridor tracks, lanes outside obstacles and boundaries, and `UMLShared.routeOrthogonalConnector` as fallback). A route has at most two bends and no detour, except upward edges, edges between elements of the same rank with an element between them, and edges entering a boundary past a blocking element, which may use up to four bends and a bounded detour. Among such routes, the choice minimises, in this order: conflicts (route ends too close on one side, labels without a legal position), crossings, routes over arrowheads or tails, close parallel routes, bends, more than two arrowheads on one side, then length. Edges never run within the boundary padding along any boundary line; a boundary is passable for edges whose endpoints it contains, and such an edge crosses each boundary line at most once. Place each label on or directly beside its own route; widen the gap rather than move a label away."
- **Step 4a**, last sentence replaced: "A relationship gets a bend only when no overlap-free alignment exists. The layout minimizes, in order, conflicting ends, crossings, routes over arrowheads, close parallels, bends, then length." The rule "shares that neighbour's centre line" stays for one dominant neighbour (now defined: more than half of the element's edges toward that row go to it, and it has no other partner in the element's row), and "or overlaps each of several neighbours enough for a straight route" is added for fan-outs and fan-ins. This is a change in substance (bends are no longer minimised first), and it is why the user's sign-off is needed.
- **§6.5** (accessibility), added: "Printed C4 figures keep edge labels at 9 pt or larger on A4 portrait where they already do, and never smaller than before a layout change." (Proposed minimum; the user may choose another value.)
- **§17 entry**: "2026-11-09 (user direction 'use the same kind of approach we use for component diagrams'): §6.4 steps 1 and 4 mechanisms replaced by the C4 placement and route engines; step 4a objective order made explicit (conflicts and crossings before bends, within per-edge bend and detour limits); print label minimum added to §6.5."

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Milestone 2 (Task 8) is editing `c4-render.js` now | Tasks 8b-1 to 8c-3 start only after Task 8 is green. They re-read `c4-render.js` first and touch only the `layoutView` orchestration, the extracted seed function, and the routing and label functions they delete. |
| Rendering-plan Task 11 changes the component renderer on purpose | The five tasks run after Task 8 and **before Task 11**, never in parallel with it. Each takes its own A/B baseline immediately before its first edit, so another task's intended component changes can never be reported as this task's regression. |
| Thresholds turn out unattainable for a real view | Threshold policy (§9.4): stop with evidence, never loosen silently. |
| Alignment and reordering break the stability gate (≤ 200 units) | Order score penalises movement from the seed; top-down balancing moves children, never their parent; the leftmost block anchors. **Measured before any repository change** (Task 8b-1 Step 0, a scratchpad prototype on the gate's before/after models). If 200 cannot be met, the evidence goes to the user; the gate is not loosened. |
| Pins make the constraint system infeasible | Pins never enter the solver; they are applied to the final boxes and overlaps go to the settle step (§4.5, §4.7). |
| Label growth loops | At most 2 growth rounds, then `labelFallback`, which stays attached to its own route and must be absent on gated views. |
| The seed's ranks differ between static and live Chromium because of text measurement | Unchanged from today: the same measure function runs in both. Widths are rounded up, which absorbs sub-pixel jitter. The full SVG is now compared static vs live, not only node positions. |
| New files are missed by the prerender fingerprints or the lazy loader | They are added to `manifest.json` `render`, which `uml_to_svg.js`, `_includes/c4-scripts.html` and the bundle stub all read. `bundle-stub.test.js` checks the stub list equals the manifest; a new case in `uml-static-plugin.test.js` reads the **real** manifest and checks the new files are among the fingerprinted inputs (the existing case uses a synthetic manifest and proves only the mechanism). |
| Loading `c4-route.js` changes `UMLShared` and so component output on mixed pages | `c4-route.js` never writes to `UMLShared` (a test compares keys and function identities); the live A/B mode renders components after the C4 modules ran. |
| Performance on large views | Exhaustive order search capped at 7 items; bounding-box pre-rejection; ceiling test. |
| Wider drawings print smaller | Size caps per view (§9.3) and the print check on the chapter and reference pages. |

---

## 13. Rollout

Five tasks, each with its own failing tests, its own A/B baseline, and its own checkpoint. They go under a new heading after Task 8 in `docs/superpowers/plans/2026-11-08-c4-rendering.md` ("Milestone 2b: C4 layout and routing engines"), run after Task 8 and before Task 11, and replace the current Task 8b ("Straight edges — alignment before routing").

- **8b-1, ranks and order** (`c4-place.js` created, manifest and stub entry, not yet wired into `layoutView`): Step 0 includes the stability prototype and the print/size measurements.
- **8b-2, coordinates, corridors and direction** (`place` complete and wired into `layoutView`, metrics module moved into the repository): the old router still draws, so only placement gates run on the new views.
- **8c-1, ends, candidates, filters and selection** (`c4-route.js` created, manifest and stub entry, wired for routes; the old `placeLabels` stays): route gates run on every view.
- **8c-2, labels and growth** (old label code deleted): label gates run on every view.
- **8c-3, quality gates, generated views, performance, display and print, A/B**: the full §9 table, the generated views, full-SVG determinism, the chapter page in the display tests.

The plan text for all five is in `task-8b.md` beside this file.
