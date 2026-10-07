# Object-reference lab layout rationale

Research and implementation review: 2026-10-06. This is an engineering note, not a published SEBook chapter.

## Current approach: bounded lookahead and compact routed states

The original fixed, full-width rows made routes unnecessarily long. The current
renderer uses ELK Layered 0.12.0, served from local pinned assets, with measured
card dimensions and fixed member ports. Each Python identity gets one node,
including primitive objects. Aliases sit immediately above their target card;
this avoids an extra global-names column. Cards size to their text, without
scaling text down. Container slots keep their Python order.

The source highlight identifies the operation represented by the displayed
snapshot. The tracer supplies `visualizedLine` separately from its raw event
`line`: ordinary states highlight the previously executed line in that frame,
entry states highlight the call site that bound the arguments, and a resumed
caller highlights its call or assignment. Return and error events keep their
own source line. Initial states have no highlight; the final state retains the
last represented operation or error. Passive declaration bookkeeping does not
become a highlight. The editor, status label, and printed source excerpt use
this same metadata, including during backward playback.

The lab supplies its filtered playback steps through `graph.setTimeline(steps)`.
A bounded window reserves space for objects that will appear or grow, using each
identity's largest measured card and alias area. Distinct reference targets and
member-port positions are retained as route variants. ELK can therefore place a
current object with its upcoming neighbors already represented in the layout.
Rendering projects that reservation onto the requested state: future objects,
names, values, and references remain hidden. Unused outer space is trimmed, and
empty internal bands can be compacted when the space saving outweighs movement.

The planner compares three ELK worker candidates: left-to-right with network
simplex placement, left-to-right with balanced Brandes–Köpf placement, and
top-to-bottom with network simplex placement. Two deterministic channel layouts
provide alternatives: neighbor order and birth order. The neighbor heuristic uses
two bounded insertion sweeps. Shared targets may share stems; independent
crossings receive bridge marks.

Each candidate is evaluated on projected visible states, where references
actually coexist. The footprint cost uses
`max(availableWidth, scene.width) * scene.height`: available horizontal space is
already paid for, so a broad, short arrangement is preferable to a narrow tower
that leaves most of the panel empty. Candidates that fit the available width rank
ahead of those that overflow. Clearing cards remains a correctness requirement.
These are bounded optimization heuristics, not a promise of globally minimal
area or zero crossings.

Arrow painting retains an exact logical endpoint on the object boundary. The
9px head uses SVG user-space units so selection and change highlighting cannot
enlarge it. The shaft stops underneath the head's wide section; a butt cap cannot
poke through the pointed tip. Remove redundant collinear vertices before rounding
elbows, which otherwise creates tiny steps in apparently straight connectors.
At rest, name connectors use measured model ports, including in hidden print
snapshots; during interpolation their origins follow the displayed names.

Reserve 20px between routes and cards and 16px between routing lanes; the 56px
minimum layer gap accommodates two lanes without later moving existing columns.
Crossing bridges use two cubic curves with horizontal entry/exit tangents and a
background clearance mask along both the replaced straight section and the arch.
Their stroke and highlight state follow the owning reference, including keyboard
selection. This separates independent paths without a thickness jump or a bridge
colliding with a nearby arrowhead. These choices follow the [SVG marker and stroke
model](https://www.w3.org/TR/SVG2/painting.html#MarkerElement) and ELK's
[edge-to-node](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-spacing-edgeNodeBetweenLayers.html)
and [edge-to-edge](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-spacing-edgeEdgeBetweenLayers.html)
spacing constraints.

Projection initially aligns object-card tops across a window, reserving the
largest alias area above each card. `compactTimelineScene` then offers a second
version of each state. It compresses empty horizontal and vertical coordinate
bands while preserving their order, keeps every current node interval at its
measured size, retains the future alias area above each surviving card, protects
10px around route points, and caps unoccupied bands at
24px. Nodes and route points move together, so this pass does not reroute edges,
change their crossing order, or scale text. It costs `O(k log k)` time and `O(k)`
space for `k` node intervals and route points.

Narrow interactive embeds compact the chosen scene once more before painting,
without reserving space for future aliases. This removes empty leading space
and unused internal bands on mobile, at the cost of some extra movement when
names appear. The inset is 8px; card padding and minimum widths are smaller,
while text sizes, reference targets, route clearances, and relative object order
are preserved. Crossing marks move with the routes. The cached plan remains
unchanged, so Back/Forward reproduces the same compact scene. Desktop and static
print layouts retain the future-alias reservation policy.

The planner processes states in forward order and chooses the projected or
compacted version using footprint plus `80 * placementCost`. Placement cost is
surviving-card displacement plus `0.15 * (width + height)`; displacement anchors
card tops, not enclosing alias rows. Candidate scores also include `30,000` per
independent crossing and `20` per unit of wire length, averaged across the unique
measured states. These weights are engineering choices, not published constants.
Movement can therefore occur inside a window when it buys sufficient space.
While the plan remains cached and measured geometry and width are unchanged,
Back/Forward restores its prepared coordinates and routes. Equivalent geometry
shares a completed scene.

Reservations stop at 24 playback steps, 32 identities, or 96 reference variants.
This prevents one long edited program from reserving the union of every object it
ever creates. An individual state or a measured union of port-position variants
that exceeds the planning budget uses the existing incremental path. That path
seeds newcomers near their uses, compares
interactive and compact placement, and anchors the whole routed scene toward its
previous position. It uses ELK's [interactive node placer](https://github.com/eclipse-elk/elk/blob/master/plugins/org.eclipse.elk.alg.layered/src/org/eclipse/elk/alg/layered/p4nodes/InteractiveNodePlacer.java),
which retains previous vertical positions subject to overlap removal. Correct
ports and obstacle clearance take priority over movement. A new window or changed
viewport or text metrics may require a new arrangement; continuity is not a
promise of fixed coordinates across all environments.

Advance preparation yields between measurements and between scored states when
its 4 ms work slice is spent; one measurement or scoring operation can exceed
that scheduling budget. Each window preparation submits at most three layered
candidates to the existing ELK worker and prepares its chosen frames ahead of
playback. Stepping within a prepared window retrieves cached geometry. A timeline
caches plans for at most eight windows with three width/text-metric configurations each; the
renderer separately caches up to 512 completed geometry scenes. Replacing the
trace or disposing its owner invalidates pending preparation; stale results
cannot change the displayed state.
Invalidation or eviction can require another preparation of the same window.
An initial empty state remains immediately available while preparation proceeds.
One shared `ReferenceTimeline` serves a print history so each snapshot does not
independently plan the same future states.

Candidates are measured in an inert, invisible container. The current diagram
stays on screen until the replacement is ready; generation numbers discard
stale asynchronous layouts. Unchanged graphs (including output-only steps) do
not replace nodes, paths, or restart animation. Surviving DOM cards stay mounted;
only changed content is replaced. Movement lasts 420 ms with attached endpoints,
without fading the existing graph. Names have stable identities `(scope, name)`
independent of their current targets. Their DOM labels and SVG paths survive
rebinding; animate labels separately from cards and move pointer origins with
them. A stationary card gets no transform animation. Newly added elements enter;
interrupted transitions resume from the actual displayed frame. Route morphing
matches polyline bends by normalized arc length, retaining the old and new shapes
when their bend counts differ.

Screen states show Added/Changed object badges in a reserved annotation line so
cues never change card size. Glow marks changed data, new objects, and new or
redirected references separately. Adding a name does not mark its target object
as mutated. Cues persist for that step, clear on a subsequent unchanged state,
and remain static under reduced motion. Printed snapshots omit these transient
comparison cues. Either the OS preference or the SEBook reduced-motion setting disables the
transition. Enabling either during motion immediately settles the complete frame;
no card interpolation, SVG interpolation, fades, or smooth scrolling remain.

This applies the port-aware layered approach described by [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
and its [semi-interactive ordering constraint](https://eclipse.dev/elk/reference/options/org-eclipse-elk-layered-crossingMinimization-semiInteractive.html).
Choosing proximity plus stable order for this teaching task is an engineering
judgment, not evidence of improved learning outcomes by itself.

## Research basis and limits

SciSpace and Sider Scholar searches covered offline dynamic drawing, orthogonal
layouts with rectangular nodes and ports, constrained compaction, and aspect
ratio. The selection below follows primary papers through their methods and
evaluations, including limitations. It is a targeted engineering review, not a
systematic review or a claim that one method dominates every graph.

1. **Use future states without freezing their union.** Diehl and Görg's
   [Graphs, They Are Changing (GD 2002)](https://www.st.uni-trier.de/diehl/pubs/GD02_LNCS.pdf)
   lays out a supergraph before adjusting individual frames within a movement
   tolerance. The paper explains why a union may be nonplanar even when each
   frame is planar, and why disjoint lifetimes can reuse space. This supports
   looking ahead while scoring actual simultaneous states, rather than treating
   every future relationship as permanently visible.
2. **Let persistent structure guide temporary additions.** Görg, Birke, Pohl,
   and Diehl's [Dynamic Graph Drawing of Sequences of Orthogonal and Hierarchical Graphs (GD 2004)](https://www.st.uni-trier.de/diehl/pubs/gd04.pdf)
   uses an importance-based backbone and separates stable ranks from flexible
   ordering and compaction. Its demonstrations do not establish a browser latency
   budget. Our bounded union is a simpler reservation mechanism; it does not
   implement the paper's backbone extraction or full-sequence optimization.
3. **Continuity is a tradeoff.** Brandes and Mader's
   [quantitative comparison of offline stress minimization (GD 2011 proceedings, 2012)](https://kim246.wwwdns.kim.uni-konstanz.de/publications/bm-qcsma-12.pdf)
   compares aggregation, anchoring, and links between temporal copies. Linking
   gives the strongest stress/movement tradeoff in their experiments; a small
   stress concession can substantially reduce motion. This motivates a movement
   penalty, but their general graph stress objective does not solve fixed ports,
   rectangular obstacles, or our panel-width objective.
4. **Move nodes and paths together.** Dwyer, Marriott, and Wybrow's
   [Topology Preserving Constrained Graph Layout (GD 2008)](https://users.monash.edu/~mwybrow/papers/dwyer-gd-2008-1.pdf)
   uses separation and topology constraints while improving a drawing. Its
   topology optimization took 1.89 seconds for a 343-node example; initial routing
   alone took 13.94 seconds on the reported legacy hardware. These are distinct
   phases, not an interactive end-to-end guarantee. Our ordered gap removal
   follows the joint-movement principle without implementing that optimizer.
5. **Port-aware stress layout has costs.** Rüegg and colleagues'
   [Stress-Minimizing Orthogonal Layout of Data Flow Diagrams with Ports (GD 2014)](https://arxiv.org/pdf/1408.4626)
   combines port constraints, flow constraints, alignment, and obstacle routing.
   Its evaluation did not consistently beat layered layout on area or crossings;
   it reports about half a second for 60 nodes. This supports retaining measured
   ports, but does not justify replacing ELK with a full stress solver for fast
   stepping.
6. **Compact an already routed layered drawing.** Hegemann and Wolff's
   [A Simple Pipeline for Orthogonal Graph Drawing (2023)](https://arxiv.org/pdf/2309.01671v2)
   uses constrained nudging to move boxes and edge segments. Its Hybrid2 variant
   preserves the layered drawing's crossing count and roughly halves area on its
   benchmarks. Nudging averaged under 10 ms in its 5–150-node runtime experiment;
   that is a compiled solver result, not JavaScript performance evidence. Our
   coordinate-band compaction is a smaller adaptation, without the paper's linear
   program or the same claimed improvement.
7. **Include display shape in the objective.**
   [ARCOL: Aspect Ratio Constrained Orthogonal Layout (2026 preprint, version 1)](https://arxiv.org/html/2603.29618v1)
   adds aspect-ratio preferences during stress minimization and tree attachment.
   Its results motivate width-aware selection, but do not establish temporal
   coherence or our interactive budget. Our panel-footprint cost is an engineering
   alternative, not ARCOL's normalization or a reason to stretch cards.
8. **Evaluate the user's orientation task.** Archambault and Purchase's
   [Mental Map Preservation Helps User Orientation in Dynamic Graphs (GD 2012)](https://www.researchgate.net/publication/232747172_Mental_Map_Preservation_Helps_User_Orientation_in_Dynamic_Graphs)
   reports benefits for locating targets and following paths through changing
   graphs. That supports preserving recognizable objects while allowing movement;
   it does not establish that fixed coordinates maximize every task's performance.
   Applying the result to novice Python learners remains an inference, not a
   demonstrated learning effect.
9. **Keep programming objects recognizable during rearrangement.** Oka,
   Masuhara, and Aotani's
   [Live, Synchronized, and Mental Map Preserving Visualization for Data Structure Programming (Onward! 2018)](https://prg.is.titech.ac.jp/papers/pdf/onward2018.pdf)
   describes Kanon, which retains object identities and uses animated,
   structure-aware rearrangement for live data structures. This is the closest
   application domain in the review. Its supported list/tree structures and
   exploratory study with 13 programmers do not establish a general layout
   algorithm for arbitrary cyclic Python heaps, an offline lookahead method, or
   a demonstrated learning benefit.

The resulting design combines future reservations, port-aware ELK routing,
width-aware candidate selection, and a soft motion cost with cheap joint
compaction. It is an engineering synthesis of these principles. It does not
implement a published algorithm verbatim, claim optimal crossings, or inherit a
paper's performance measurements. The budgets and weights above need the lab's
own geometry and latency evidence. The compaction pass cannot repair a poor
crossing topology; choosing among routed candidates remains necessary.

A reference must originate at its actual slot or attribute. ELK's
[fixed-position port constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html)
preserve those attachment points. Routing and subsequent compaction must preserve
their correspondence with the displayed card geometry.

## Local verification and performance observations

The 2026-10-06 comparison used headless Chromium on this development machine,
the real chapter, reduced motion, loaded fonts, and viewport widths of 1280 and
320 CSS pixels. It visited all steps of the shared-slot and shallow-copy labs,
then traversed Back. Timings ran from the control's captured click to the graph
clearing `aria-busy`, excluding Playwright's action overhead. Future preparation
had already started at the empty first step. Newly visited populated states took
2.6–3.7 ms in the final run; revisited states took 0.5–3.5 ms. The original
renderer needed roughly 20–37 ms for new layouts in this comparison.

These are observations, not latency guarantees. A separate isolated fixture
timed cold `ReferenceTimeline.prepare`, including worker/module startup, three
times per case. The shared-slot, shallow-copy, and loop examples took 110–136 ms.
A deliberately dense boundary case of 24 states, 32 objects, and 96 references
took 1.63–1.64 seconds. No main-thread long task (over 50 ms) was observed during
either preparation experiment; the longest individual DOM measurement was
4.8 ms. Dense first preparation is still noticeably slower, even though the
worker and yielding passes leave the interface responsive. These measurements
exclude Python execution, network delivery outside localhost, and the cost of
preparing every lab on a whole chapter simultaneously.

Geometry outcomes are deliberately reported separately. Movement is the sum of
surviving card-top distances over forward steps; crossings are the maximum
visible bridge count in a state. Rounded values use CSS pixels.

| Example / viewport | Peak height, before → after | Maximum crossings | Total movement |
| --- | --- | --- | --- |
| Shared slots / 1280 | 526 → 423 | 1 → 0 | 496 → 357 |
| Shallow copy / 1280 | 644 → 645 | 1 → 1 | 407 → 994 |
| Shared slots / 320 | 945 → 945 | 2 → 3 | 464 → 75 |
| Shallow copy / 320 | 1409 → 1409 | 8 → 5 | 1883 → 1591 |

All four comparisons had no overlapping cards, paths through unrelated cards,
or page errors. The user's loop example at a 2048-pixel viewport fits a
430-pixel-tall drawing across multiple columns. These results show the tradeoffs:
lookahead plus compaction does not improve every metric on every trace. In
particular, the desktop copy example moves more, and the narrow shared-slot
example retains one additional crossing to preserve a much steadier order.
Independent rendered checks also covered 72 synthetic states with cycles,
rebinding, alias/card-size changes, and 400/900-pixel widths.

Behavioral regression coverage includes future names without target movement,
hidden future objects, changing reference targets/port positions, gap removal
without distorted cards or detached routes, wide-panel utilization, reversible
playback, print, both themes, keyboard following, and reduced motion. A required
crossing-style test uses a real `K3,3` fixture, rather than requiring an avoidable
crossing in a planar teaching example.

## Hard invariants and heuristic goals

The hard contract applies to every visible reference in the compact diagram; the complete Reference details view retains the trace's full recorded graph.

| Hard invariant | Why it matters |
| --- | --- |
| Every visible reference has a route with its own source and target identity. | An object-ID button alone does not visualize the relationship. |
| Each route starts at its actual member port and ends at the correct object boundary. | A nearby card or another list slot is a different Python relationship. |
| Routes, arrowheads, and crossing decorations stay outside unrelated cards and readable labels. | A technically connected path can still be unreadable. |
| Only references with the same target may share an intentional target bus. | Geometric intersection must not invent sharing between different objects. |
| Self-references and cycles retain their real direction. | Python object graphs are not trees or DAGs. |
| Current routes use nonzero measurements at the current text metrics, including each actual displayed port. | Future envelopes and cached plans must not replace current endpoint geometry or silently remove arrows. |
| Keyboard following, visible focus, text alternatives, both themes, and reduced-motion behavior remain available. | Geometry and color cannot be the only way to understand a reference. |

Crossing count, total length, bends, gutter width, and movement between steps are optimization goals after correctness. They can conflict: a smaller gutter can produce more overlap; less movement can retain a longer route. Evaluate candidate improvements against these separate measures instead of treating a single attractive screenshot as proof.

Zero crossings is not a valid universal invariant. Three source lists, each referencing the same three distinct target objects, contain a `K3,3` graph. For a simple planar bipartite graph, `e ≤ 2v − 4`; here `9 > 8`. Fixed card order and fixed ports can impose further restrictions even for graphs that are planar under unconstrained placement. Bridges or gaps clarify independent crossings; they do not eliminate them mathematically.

## Layout pipeline and failure behavior

1. Build one node per visible trace identity, including strings, numbers, Boolean
   values, and None. Never merge equal values; use actual Python identity.
2. Measure the actual card, aliases, and each slot's button. Supply fixed outgoing
   ports and a shared incoming port to ELK. Runtime functions/modules remain in
   Reference details but are omitted from the compact data diagram.
3. Measure the bounded future window in yielding slices. Build a union of measured
   envelopes and actual reference variants, then route around the entire reserved
   nodes, including their alias areas. Future content stays out of the displayed
   graph and its accessible state.
4. For each routed candidate, project unique states in forward order. Compare
   the projected and jointly compacted versions using panel footprint and
   surviving-card movement, then score visible crossings and wire length. Cache
   the chosen candidate's prepared scenes. Over-budget states use
   previous-position hints. Narrow fallback cards use external channels; shared
   targets alone share a bus.
5. Commit cards and routes together, rejecting obsolete results. Cache completed
   snapshots for reversible playback. Interpolate movement with source/target
   endpoints attached to the moving cards.

The renderer loads its pinned ELK API and worker relative to its own script URL.
A lexical CommonJS-to-ESM adapter prevents Monaco’s AMD loader from capturing the
anonymous API module, without modifying the upstream API body or global loader.
The documented embedding still needs no extra script tag. A load/layout failure
keeps the synchronous channel planner available, so an unavailable optimizer
cannot silently remove reference arrows. The pure fallback planner's Node
export remains tested independently of rendering.

## The missing-arrow incident is a separate failure

The reproduced `shared_slots` failure, then labeled **Step 4 / 8, Next line 3**, showed local alias arrows but no member arrows or reserved gutter. The local page on port 4000 had stale generated HTML that did not load the new routing script, while the graph renderer was already updated. Thus the missing routing global prevented member routing; this was not evidence that the planner had failed to find a geometric path.

Ship the planner with `object-reference-graph.js` as one browser asset, retaining a pure CommonJS `plan` export for tests. This removes the independently loaded planner dependency from the chapter, tutorial, print, and instructions-popup surfaces. Browser smoke tests must exercise the actual built pages and their loaded assets; pure route tests cannot detect an omitted script tag. Conversely, fixing asset loading alone does not establish that every layout is readable.

## Printed snapshots

PrintHistory uses the same renderer in static mode and starts layout preparation
when a small trace is installed, before printing. Histories totaling more than
300 object snapshots defer that work until the print view is visible to avoid
thousands of hidden cards. Its static graphs share one `ReferenceTimeline` so
measuring and optimizing a window is reused across snapshots. Cards are measured
in an inert container at the print text metrics, even if the history is hidden.
Every static snapshot immediately has a complete channel layout; compact layouts
replace it as they become ready. This synchronous fallback also covers immediate native
Print, whose beforeprint event cannot await promises. Programmatic autoprint
awaits ObjectReferencePrint.prepareAll().

Print diagrams cap at 160mm and use the light palette. Each graph watches measured
text sizes to handle font/spacing changes and releases its observer on history
replacement or unmount. Static graphs have no motion. Accessible image descriptions
retain the full recorded state, including omitted incidental objects. Validate
actual A4/Letter PDFs as well as print-media geometry.

## Regression and evaluation contract

- **Source/state alignment:** the highlighted line must explain the displayed state after assignment, mutation, loop binding, call entry, return, and error. Check the initial and final states, backward playback, and printed source excerpts; skipped declaration events must not misattribute an operation.
- **Shared rows before mutation:** after `board = [row, row]` in `shared_slots`, both `board` member ports must visibly connect to the same row object; each source remains identifiable even when its route joins a target bus.
- **Replacement:** after `board[1] = [2]`, slot 1 must visibly reach the separate replacement list, while slot 0 and `row` still refer to the original list. Check endpoints and actual SVG paths, not just the button text.
- **Graph structure:** include empty graphs, one edge, several aliases, self-loops, mutual cycles, `K3,3`, many targets, and deterministic randomized stacked-card fixtures. Assert edge coverage, identity, orthogonal geometry, obstacle clearance, and crossing treatment without pinning an arbitrary exact lane order.
- **Advance planning:** exercise later card growth, added aliases, future objects, and a member that changes target. Future content never appears early; preparation accounts for its geometry. Permit useful movement inside a window, and verify cached revisits restore the chosen scene. Check both sides of a window boundary and an individual state beyond the planning budget.
- **Compactness and continuity:** measure visible-state crossing count, panel footprint, wire length, and surviving-card displacement separately. On wide panels, verify that a fitting wider arrangement avoids an unnecessarily tall single column. Include references that never coexist so a union's fictitious simultaneous edges do not dictate the score. Check full geometry after projection, including actual current port positions.
- **Joint compaction:** preserve node sizes, port offsets, orthogonal paths, obstacle clearance, and independent crossing order when removing vacant bands. Include interleaved node and bend coordinates, self-loops, shared targets, and large future reservations. Verify useful whitespace is removed without text scaling or detached endpoints.
- **Responsiveness:** measure cold preparation separately from warm Forward/Back latency, main-thread work slices, and optimizer submissions. Include long traces, repeated equivalent states, rapid direction changes, replacement during preparation, and width/font changes. A worker's completion time alone does not establish an interactive foreground.
- **Lifecycle and responsive geometry:** advance/backtrack rapidly, reveal a previously hidden embed, resize after drawing, change text size, use long labels, restore a page from browser history, and test the popup and print surfaces. Check that the final displayed state owns the routes, that no arrow is clipped, and that both themes preserve visible line/focus contrast.
- **Painted arrow geometry:** inspect shared-string copy/mutation crossings in both themes. The head tip meets the target border, the shaft remains inside its head, highlighting preserves head size, and bridges have tangent joins, matching stroke weights, and clearance from arrowheads. Verify the final rendered SVG geometry, not only the abstract route points.
- **Human evaluation:** ask learners to follow one alias through a mutation and a rebinding, identify sharing, and trace a returned member through nested calls. Compare errors and completion time alongside movement/crossing metrics. A visually stable diagram or a passing geometric test does not by itself demonstrate improved learning.
