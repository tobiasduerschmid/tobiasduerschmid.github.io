# Object-reference lab layout rationale

Research and implementation review: 2026-10-03. This is an engineering note, not a published SEBook chapter.

## Recommendation

Keep the inline lab's object cards in stable identity order, with a measured source port for each list slot or attribute and a reserved routing channel outside the cards. Treat placement, routing, rendering, and asset loading as separate responsibilities. This restricted layout is a useful fit for narrow teaching pages: labels remain readable, object identities stay easy to find, and routes can be checked against simple geometric invariants. A general force-directed layout would give up those properties without solving fixed-port routing by itself.

This is a constrained one-dimensional placement problem followed by orthogonal channel routing. It is not an implementation of the optimal visibility-graph/A* algorithm in the routing literature, and it cannot promise zero crossings for arbitrary Python graphs.

## What the research supports

**Stability depends on the task.** Archambault and Purchase's orientation experiment found a benefit when participants located targets and followed paths through changing graphs. Their broader review cautions that earlier comprehension experiments did not establish a general benefit from minimizing movement. Following the same Python object across assignment and mutation resembles an orientation task, but applying that result to novice programmers is an inference, not a demonstrated learning effect. Preserve identities and relative order; permit enough movement to accommodate changed content and readable routes. [Orientation study, GD 2012](https://cronfa.swan.ac.uk/Record/cronfa13913), [review, IJHCS 2013](https://www.sciencedirect.com/science/article/pii/S107158191300102X).

**Stable structure need not mean frozen coordinates.** Dwyer, Marriott, and Wybrow describe constrained layout that improves an initial drawing while preserving its topology and preventing overlaps. Their discussion distinguishes preserving node order, preserving route topology, and merely penalizing movement. For this lab, stable row order and consistent route sides are practical constraints; absolute pixel positions cannot remain fixed when object members, local variables, fonts, or viewport width change. [Topology Preserving Constrained Graph Layout, GD 2008](https://users.monash.edu/~mwybrow/papers/dwyer-gd-2008-1.pdf).

**An obstacle-free path is only part of a readable drawing.** Wybrow, Marriott, and Stuckey separate visibility-graph construction, route search, and final route placement. Their route search optimizes a connector's length/bend cost; subsequent ordering and separation of shared segments improve legibility. This is not a theorem that the whole drawing has the minimum number of crossings. The lesson for the lab is to handle overlaps, shared paths, and crossings explicitly after producing routes. [Orthogonal Connector Routing, GD 2009 proceedings](https://users.monash.edu/~mwybrow/papers/wybrow-gd-2009.pdf).

**Ports belong in the model.** A reference originates at a particular slot or attribute, not at an arbitrary point on the containing box. ELK exposes fixed-side, fixed-order, and fixed-position port constraints. Libavoid supports connection pins that follow their shapes when moved or resized and can constrain departure direction. These are the appropriate concepts for preserving a list's index order and connecting the correct member. [ELK port constraints](https://eclipse.dev/elk/reference/options/org-eclipse-elk-portConstraints.html), [libavoid connection pins](https://www.adaptagrams.org/documentation/classAvoid_1_1ShapeConnectionPin.html).

## Hard invariants and heuristic goals

The hard contract applies to every reference presented as a nonprimitive reference in the compact diagram; the complete Reference details view retains the trace's full recorded graph.

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

## Concrete layout and update pipeline

1. **Build the semantic scene.** Keep object IDs separate from displayed values. Order surviving cards by identity, retain source entry order, and give each member reference a stable key such as object ID plus entry label. Rebinding changes a target; it does not rename or recreate the old target object.
2. **Measure boxes and ports.** Cards occupy disjoint vertical rows with aligned right boundaries. A reference row spans the card so its source port can exit directly through that boundary. Measure text-driven dimensions; do not infer height from an assumed number of characters or a fixed font size.
3. **Allocate external channels.** Group references by target. A group's vertical interval covers its source ports and its target landing. Intervals that overlap require distinct lanes; disjoint intervals may reuse a lane. Route source → lane → target landing with horizontal/vertical segments. This construction handles self-loops and mutual cycles without traversing a card.
4. **Resolve visual ambiguity.** Separate independent overlapping routes and mark independent intersections with crossing bridges. Merge only genuine same-target paths, retaining every source branch and reference key. Focusing a member should identify its complete route and destination. Crossing decorations need their own clearance and bounds checks.
5. **Commit a complete scene.** Batch resize and step changes, reserve the computed gutter, then remeasure if that reservation changes the card geometry. Replace the SVG paths together only for the latest state. A zero-sized hidden host should defer drawing until it is measurable. If drawing is asynchronous, discard results from obsolete state versions. Libavoid's explicit batch transactions provide a relevant architectural precedent, though this lab uses its own smaller planner. [Router transaction documentation](https://www.adaptagrams.org/documentation/classAvoid_1_1Router.html).

The existing interval-based lane assignment is deterministic for a given geometry, but deterministic recomputation is not the same as temporal stability: inserting one interval can change later lane assignments. A future refinement should prefer an existing target's lane when still legal, then use deterministic placement for conflicts. Reclaiming every spare lane on each step may save width while making unchanged references jump. Likewise, keeping the gutter from shrinking during a run can reduce horizontal movement at the expense of some whitespace. These are design options to evaluate, not claims that the current planner implements a general incremental optimizer.

## Alternatives and the point at which to use them

| Approach | Appropriate use | Trade-off for this lab |
| --- | --- | --- |
| Stable stacked cards + external channels | Responsive inline labs with readable member rows | Small, testable geometry; long upward/downward references and unavoidable channel crossings remain possible. |
| ELK Layered with fixed ports and prior positions/order | A future wider, freely arranged heap view | Handles placement as well as routing. Requires explicit stability choices across several phases and careful treatment of cycles. |
| Libavoid with connection pins | Free placement, dragging, or many independently positioned obstacles | Designed for obstacle-aware orthogonal routing, but still needs node placement, runtime integration, route styling, and validation. |
| Constrained stress layout with ports | Larger diagrams where global structure and compactness outweigh a simple reading order | A more substantial layout system. Port-aware research reports compactness and structural advantages over layering, not Python-learning or universal usability superiority. |
| Graphviz `splines=ortho` | Diagrams without required member ports | Its official documentation says this routing mode does not handle ports, making it a poor match for slot-level references. |

ELK separates cycle breaking, layer assignment, crossing minimization, placement, and routing; interactive strategies can reuse previous positions. Its cycle-breaking reversals are layout machinery: the displayed reference direction must remain the original Python direction. Supplying prior positions or model order is not automatically a guarantee that every phase preserves them. [ELK layered overview](https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html), [constraining the model](https://eclipse.dev/elk/blog/posts/2023/23-01-09-constraining-the-model.html).

The alternative comparison also draws on the primary [port-aware constrained-stress paper](https://arxiv.org/abs/1408.4626) and [Graphviz orthogonal-routing documentation](https://graphviz.org/docs/attrs/splines/). None of these sources establishes a single best engine for this teaching task. The recommendation is an engineering judgment based on this component's fixed rows, semantic ports, and limited page width.

## The missing-arrow incident is a separate failure

The reproduced `shared_slots` failure at **Step 4 / 8, Next line 3** showed local alias arrows but no member arrows or reserved gutter. The local page on port 4000 had stale generated HTML that did not load the new routing script, while the graph renderer was already updated. Thus the missing routing global prevented member routing; this was not evidence that the planner had failed to find a geometric path.

Ship the planner with `object-reference-graph.js` as one browser asset, retaining a pure CommonJS `plan` export for tests. This removes the independently loaded planner dependency from the chapter, tutorial, print, and instructions-popup surfaces. Browser smoke tests must exercise the actual built pages and their loaded assets; pure route tests cannot detect an omitted script tag. Conversely, fixing asset loading alone does not establish that every layout is readable.

## Printed snapshots

`object-reference-print.js` reuses `ReferenceGraph` in static mode for every
visible playback step. Static graphs have no interaction handlers, animation,
or per-graph observers; synchronous layout reserves the gutter and remeasures
before the renderer is released. The history owns one shared resize observer
for its width and height changes. Its accessible image description retains the
full recorded state, including the identities abbreviated in the visual view.

Actual PDF pagination can narrow a document after `beforeprint` without giving
JavaScript another layout event. A print-media screenshot alone missed this:
cards fitted the page while the measured global SVG routes remained beyond its
right edge. Printable diagrams now use a consistent 160mm maximum layout width
in the print page, preparation state, and paper output. This keeps wrapping
stable on A4 and Letter with ordinary margins, without shrinking paragraph-size
text. Narrow screen previews still use their available width. Static member
routes occupy a small SVG anchored at the graph's right edge; live graph
coordinates are unchanged. Verify actual A4 and Letter PDFs as well as DOM
geometry whenever changing this pipeline.

## Regression and evaluation contract

- **Shared rows before mutation:** at `shared_slots` Step 4 / 8, before line 3, both `board` member ports must visibly connect to the same row object; each source remains identifiable even when its route joins a target bus.
- **Replacement:** after `board[1] = [2]`, slot 1 must visibly reach the separate replacement list, while slot 0 and `row` still refer to the original list. Check endpoints and actual SVG paths, not just the button text.
- **Graph structure:** include empty graphs, one edge, several aliases, self-loops, mutual cycles, `K3,3`, many targets, and deterministic randomized stacked-card fixtures. Assert edge coverage, identity, orthogonal geometry, obstacle clearance, and crossing treatment without pinning an arbitrary exact lane order.
- **Lifecycle and responsive geometry:** advance/backtrack rapidly, reveal a previously hidden embed, resize after drawing, change text size, use long labels, restore a page from browser history, and test the popup and print surfaces. Check that the final displayed state owns the routes, that no arrow is clipped, and that both themes preserve visible line/focus contrast.
- **Human evaluation:** ask learners to follow one alias through a mutation and a rebinding, identify sharing, and trace a returned member through nested calls. Compare errors and completion time alongside movement/crossing metrics. A visually stable diagram or a passing geometric test does not by itself demonstrate improved learning.
