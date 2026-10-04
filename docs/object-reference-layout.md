# Object-reference lab layout rationale

Research and implementation review: 2026-10-03. This is an engineering note, not a published SEBook chapter.

## Current approach: compact ports, proximity, and temporal consistency

The original fixed, full-width rows made routes unnecessarily long. The current
renderer uses ELK Layered 0.12.0, served from local pinned assets, with measured
card dimensions and fixed member ports. Each Python identity gets one node,
including primitive objects. Aliases sit immediately above their target card;
this avoids an extra global-names column. Cards size to their text, without
scaling text down. Container slots keep their Python order.

Layout first tries left-to-right layers, then a narrower top-to-bottom variant.
When neither fits, a deterministic vertical channel layout retains all arrows
and readable text. Two bounded insertion sweeps place new fallback nodes near their uses while
preserving the order of surviving nodes. Shared targets use one landing port and may share stems;
independent crossings receive bridge marks. These are optimization heuristics,
not a promise of globally minimal length or zero crossings.

Incremental placement uses previous coordinates for layer assignment, ordering,
and node placement, with new nodes seeded near their uses. Compare this result
with compact, order-preserving placement and select the fitting candidate with
lower displacement plus a small size penalty. Translate a whole scene (including
routes) back toward its previous anchor where padding and available width permit;
never move individual cards after routing. Keep the existing horizontal/vertical
orientation while it fits. Geometry-equivalent states reuse their layout even if
values changed; a per-lab geometry cache restores Back/Forward positions exactly.
Object-card coordinates, rather than row origins, are the position anchors: a new
name can occupy space above an existing card without pushing that object down.
New layers, larger cards, and narrower viewports can still require movement.

This uses ELK's [interactive node placer](https://github.com/eclipse-elk/elk/blob/master/plugins/org.eclipse.elk.alg.layered/src/org/eclipse/elk/alg/layered/p4nodes/InteractiveNodePlacer.java),
which retains previous vertical positions subject to overlap removal, alongside
interactive layering and ordering. Position stability is a preference subject to
readability and correct routing, not a promise that coordinates never change.

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

## What the research supports

**Stability depends on the task.** Archambault and Purchase's orientation experiment found a benefit when participants located targets and followed paths through changing graphs. Their broader review cautions that earlier comprehension experiments did not establish a general benefit from minimizing movement. Following the same Python object across assignment and mutation resembles an orientation task, but applying that result to novice programmers is an inference, not a demonstrated learning effect. Preserve identities and relative order; permit enough movement to accommodate changed content and readable routes. [Orientation study, GD 2012](https://cronfa.swan.ac.uk/Record/cronfa13913), [review, IJHCS 2013](https://www.sciencedirect.com/science/article/pii/S107158191300102X).

**Stable structure need not mean frozen coordinates.** Dwyer, Marriott, and Wybrow describe constrained layout that improves an initial drawing while preserving its topology and preventing overlaps. Their discussion distinguishes preserving node order, preserving route topology, and merely penalizing movement. For this lab, stable row order and consistent route sides are practical constraints; absolute pixel positions cannot remain fixed when object members, local variables, fonts, or viewport width change. [Topology Preserving Constrained Graph Layout, GD 2008](https://users.monash.edu/~mwybrow/papers/dwyer-gd-2008-1.pdf).

**An obstacle-free path is only part of a readable drawing.** Wybrow, Marriott, and Stuckey separate visibility-graph construction, route search, and final route placement. Their route search optimizes a connector's length/bend cost; subsequent ordering and separation of shared segments improve legibility. This is not a theorem that the whole drawing has the minimum number of crossings. The lesson for the lab is to handle overlaps, shared paths, and crossings explicitly after producing routes. [Orthogonal Connector Routing, GD 2009 proceedings](https://users.monash.edu/~mwybrow/papers/wybrow-gd-2009.pdf).

**Ports belong in the model.** A reference originates at a particular slot or attribute, not at an arbitrary point on the containing box. ELK exposes fixed-side, fixed-order, and fixed-position port constraints. Libavoid supports connection pins that follow their shapes when moved or resized and can constrain departure direction. These are the appropriate concepts for preserving a list's index order and connecting the correct member. [ELK port constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html), [libavoid connection pins](https://www.adaptagrams.org/documentation/classAvoid_1_1ShapeConnectionPin.html).

## Hard invariants and heuristic goals

The hard contract applies to every visible reference in the compact diagram; the complete Reference details view retains the trace's full recorded graph.

| Hard invariant | Why it matters |
| --- | --- |
| Every visible reference has a route with its own source and target identity. | An object-ID button alone does not visualize the relationship. |
| Each route starts at its actual member port and ends at the correct object boundary. | A nearby card or another list slot is a different Python relationship. |
| Routes, arrowheads, and crossing decorations stay outside unrelated cards and readable labels. | A technically connected path can still be unreadable. |
| Only references with the same target may share an intentional target bus. | Geometric intersection must not invent sharing between different objects. |
| Self-references and cycles retain their real direction. | Python object graphs are not trees or DAGs. |
| Rendered geometry comes from one current, nonzero measurement of the displayed state. | Old or hidden DOM measurements must not silently remove arrows. |
| Keyboard following, visible focus, text alternatives, both themes, and reduced-motion behavior remain available. | Geometry and color cannot be the only way to understand a reference. |

Crossing count, total length, bends, gutter width, and movement between steps are optimization goals after correctness. They can conflict: a smaller gutter can produce more overlap; less movement can retain a longer route. Evaluate candidate improvements against these separate measures instead of treating a single attractive screenshot as proof.

Zero crossings is not a valid universal invariant. Three source lists, each referencing the same three distinct target objects, contain a `K3,3` graph. For a simple planar bipartite graph, `e ≤ 2v − 4`; here `9 > 8`. Fixed card order and fixed ports can impose further restrictions even for graphs that are planar under unconstrained placement. Bridges or gaps clarify independent crossings; they do not eliminate them mathematically.

## Layout pipeline and failure behavior

1. Build one node per visible trace identity, including strings, numbers, Boolean
   values, and None. Never merge equal values; use actual Python identity.
2. Measure the actual card, aliases, and each slot's button. Supply fixed outgoing
   ports and a shared incoming port to ELK. Runtime functions/modules remain in
   Reference details but are omitted from the compact data diagram.
3. Use previous positions as ordering hints; position newcomers near neighbors.
   Route around whole measured nodes, including their alias labels.
4. Select a layout that fits the available width. Narrow fallback cards use
   external channels; shared targets alone share a bus.
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

The reproduced `shared_slots` failure at **Step 4 / 8, Next line 3** showed local alias arrows but no member arrows or reserved gutter. The local page on port 4000 had stale generated HTML that did not load the new routing script, while the graph renderer was already updated. Thus the missing routing global prevented member routing; this was not evidence that the planner had failed to find a geometric path.

Ship the planner with `object-reference-graph.js` as one browser asset, retaining a pure CommonJS `plan` export for tests. This removes the independently loaded planner dependency from the chapter, tutorial, print, and instructions-popup surfaces. Browser smoke tests must exercise the actual built pages and their loaded assets; pure route tests cannot detect an omitted script tag. Conversely, fixing asset loading alone does not establish that every layout is readable.

## Printed snapshots

PrintHistory uses the same renderer in static mode and starts layout preparation
when a small trace is installed, before printing. Histories totaling more than
300 object snapshots defer that work until the print view is visible to avoid
thousands of hidden cards. Cards are measured in an inert
container at the print text metrics, even if the history is hidden. Every static
snapshot immediately has a complete channel layout; compact layouts replace it
as they become ready. This synchronous fallback also covers immediate native
Print, whose beforeprint event cannot await promises. Programmatic autoprint
awaits ObjectReferencePrint.prepareAll().

Print diagrams cap at 160mm and use the light palette. Each graph watches measured
text sizes to handle font/spacing changes and releases its observer on history
replacement or unmount. Static graphs have no motion. Accessible image descriptions
retain the full recorded state, including omitted incidental objects. Validate
actual A4/Letter PDFs as well as print-media geometry.

## Regression and evaluation contract

- **Shared rows before mutation:** at `shared_slots` Step 4 / 8, before line 3, both `board` member ports must visibly connect to the same row object; each source remains identifiable even when its route joins a target bus.
- **Replacement:** after `board[1] = [2]`, slot 1 must visibly reach the separate replacement list, while slot 0 and `row` still refer to the original list. Check endpoints and actual SVG paths, not just the button text.
- **Graph structure:** include empty graphs, one edge, several aliases, self-loops, mutual cycles, `K3,3`, many targets, and deterministic randomized stacked-card fixtures. Assert edge coverage, identity, orthogonal geometry, obstacle clearance, and crossing treatment without pinning an arbitrary exact lane order.
- **Lifecycle and responsive geometry:** advance/backtrack rapidly, reveal a previously hidden embed, resize after drawing, change text size, use long labels, restore a page from browser history, and test the popup and print surfaces. Check that the final displayed state owns the routes, that no arrow is clipped, and that both themes preserve visible line/focus contrast.
- **Human evaluation:** ask learners to follow one alias through a mutation and a rebinding, identify sharing, and trace a returned member through nested calls. Compare errors and completion time alongside movement/crossing metrics. A visually stable diagram or a passing geometric test does not by itself demonstrate improved learning.
