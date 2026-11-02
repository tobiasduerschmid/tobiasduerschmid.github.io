# Rover diagram specification

**Status: verified model facts; first browser renderer implemented.** This document defines three small reference views for the [rover model](examples/rover.aadl). The implementation record below distinguishes the shipped component behavior from the fuller editorial specification. It complements the [chapter](chapter-draft.md), [backend design](backend-design.md), and [native verification record](verification.md).

The three views answer separate questions: **What communicates? What is inside the process? Where do the threads execute?** Keeping them separate prevents communication, containment, and execution allocation from becoming indistinguishable arrows in one large figure.

## First implementation and validation

The browser component is [diagram.mjs](../../js/aadl/diagram.mjs); its pure, non-mutating scope projection is [diagram-projection.mjs](../../js/aadl/diagram-projection.mjs). [aadl-diagram.css](../../css/aadl-diagram.css) owns all static presentation, including dark, forced-color, and light-print palettes. No renderer module parses AADL source or calculates analysis results.

```js
const diagram = mountDiagram(element, { onSourceLocation });
await diagram.render(resolvedOsateModel);
diagram.markStale();
diagram.clear();
diagram.destroy();
```

`onSourceLocation` receives an official bridge location containing `file`, `line`, `column`, `endLine`, and `endColumn`. The workspace owns source/revision identity and calls `markStale()` when it changes. That cancels pending layout, labels retained information as previous, and disables navigation by outdated source positions. Layout requests are bounded and canceled on replacement, clearing, and destruction; a late result cannot restore a cleared or superseded figure.

The first component supplies native **View** and **Current scope** selectors, a scope path, caption, scrollable SVG, and **Model details** disclosure. Scope selection provides root/interior navigation; direct node clicking and a selected-node details panel remain future interaction refinements. Deployment uses separate component cards with explicit containment labels, without a misleading process enclosure around an externally allocated processor. Connection and binding tables use the same projection as the drawing.

Validation uses the [real OSATE rover fixture](../../scripts/tests/fixtures/aadl-rover-result.json), native budget/access fixtures, and the real local ELK worker. The [diagram tests](../../scripts/tests/aadl-diagram.test.js) cover semantic scope selection, boundary forwarding, actual bindings, shared-segment deduplication, valid access connections with component endpoints, unresolved endpoints, size limits, feature-group rejection, scope/table agreement, cancellation, stale source locations, label geometry, empty views, and responsive/theme/print behavior. Automated axe checks ran on the component in light and dark mode at 320 CSS pixels, with inherited 22-pixel controls. Root, process-interior, and deployment output were also visually inspected at paragraph-size type; those checks are component evidence, not a claim that every integrated tutorial page has been audited.

Narrow panes use a vertical layout with top/bottom ports and wrapped labels. The actual three-component tutorial model fits 600-pixel and 320-pixel viewports at 20-pixel type, with both connections visible without horizontal scrolling. A resize reflows the same model without requesting a new engine result. The two-thread interior retains readable external boundary labels at 600 pixels. More complex scopes may still need horizontal scrolling; equivalent text tables remain available. The directional layout descriptions below specify the wide-screen reference views and rotate with the narrow layout.

Current limits are explicit. Scopes above seven component nodes retain complete tables and request a smaller visual scope. Feature groups produce an unsupported-view message instead of a partial graph; this does not change official engine validation or analysis support. The first print path exposes all tables for the **selected scope**, even when the disclosure was closed, and omits the scrollable SVG. The fuller requirement below to print all three reference scopes remains a chapter/export task. Mode-specific display and complete standard AADL graphical notation are outside this initial renderer.

## Evidence and notation boundary

The source root is `Campus_Rover::Rover.single_cpu`. Its generated system instance is named `Rover_single_cpu_Instance`. The inspected instance was created in the fresh baseline described in the verification record:

- Source SHA-256: `67230c9d8f57b7bb3c87197fdcfb182fc29c8b37d2386871e196716b54614679`.
- Instance SHA-256: `0affd6b7753a66f0444d495b70d1f80253cb7b0e4bab0e21edd5ead468eff067`.
- Temporary instance: `/tmp/sebook-aadl-research/isolated-verification-lxf_cop7/baseline/instances/rover_Rover_single_cpu_Instance.aaxl2`.

The repository source and the source beside that generated instance were compared byte for byte. The instance confirms five root children, two threads inside `motion`, three complete external semantic connections, one complete internal thread connection, and two actual processor bindings resolving to `cpu`. The instance has `No Modes`; these figures must not invent manual/automatic mode selectors from the separate `modes.aadl` example.

Call the presentation **AADL architecture overview**, with a persistent note: “A simplified view of the resolved AADL model; shapes are explanatory, not a complete implementation of the standard graphical notation.” Use explicit category, port-kind, and relationship labels. Ordinary labeled boxes and directed connectors are sufficient for this reference design. Do not label a UML component/deployment diagram as standard AADL notation, or treat successful ArchUML rendering as AADL validation. The first renderer uses the repository's local ELK 0.12.0 worker for layout and native SVG for presentation.

All local names in the following tables are exact source names. Prefix data classifiers with `Campus_Rover::` in the details panel; the shorter `Speed` and `Drive_Command` are unambiguous within these figures. A displayed instance name is the primary label; its classifier is secondary information. Never replace instance names with classifier names and thereby merge distinct instances.

## View 1: Root connections

**Caption / takeaway:** “The speed controller receives two inputs and sends one command. These connections describe communication; they do not allocate execution to the processor.”

**Accessible name:** “Rover root communication view.”

**Scope:** the immediate children of `Campus_Rover::Rover.single_cpu`. Show **five component nodes**, or six shapes if the enclosing system boundary is counted. Show no thread nodes in this view.

### Component and feature inventory

| Instance | Category | Classifier | Visible features, with direction relative to this component |
| --- | --- | --- | --- |
| `encoder` | device | `Wheel_Encoder` | `measured_speed`: **out**, data port, `Speed` |
| `operator_console` | device | `Operator_Console` | `requested_speed`: **out**, data port, `Speed` |
| `motion` | process | `Motion_Control.two_tasks` | `raw_speed`: **in**, data port, `Speed`; `requested_speed`: **in**, data port, `Speed`; `command`: **out**, data port, `Drive_Command` |
| `motor` | device | `Motor_Drive` | `command`: **in**, data port, `Drive_Command` |
| `cpu` | processor | `Onboard_CPU` | No features declared in this model |

### Complete visible relationship table

| Connection name | Source feature | Destination feature | Kind / data classifier |
| --- | --- | --- | --- |
| `sensed_speed` | `encoder.measured_speed` | `motion.raw_speed` | Directed port connection / `Speed` |
| `target_speed` | `operator_console.requested_speed` | `motion.requested_speed` | Directed port connection / `Speed` |
| `motor_command` | `motion.command` | `motor.command` | Directed port connection / `Drive_Command` |

The enclosing system contains all five components. Those containment facts are conveyed by the boundary or an accompanying list, not by additional communication arrows. Root classifier `Rover` declares no external features; do not add synthetic input/output ports to its boundary.

**Layout intent:** place `encoder` and `operator_console` on the input side, `motion` centrally, and `motor` on the output side. Place `cpu` in a separate lower area of the same system boundary with the short label “Processor; see Deployment.” It must remain visibly part of the root inventory without suggesting an undeclared communication link. Keep the three connections uncrossed. Show port names beside their actual attachment points, with `in`/`out` text or an equivalent non-color cue. Use one solid directed style for all three port connections; color is unnecessary to distinguish them.

**Interaction:** `motion` offers **Open motion**, which replaces this scope with View 2. **Show deployment** opens View 3. The accessible component list supplies the same actions. Selecting a connection exposes its full endpoint names, kind, data classifier, source location, and instance-chain details. Merely hovering must not be required to read a port label.

**Source correspondence:** features and classifier declarations are in `examples/rover.aadl` lines 11–28 and 63–89; root instances and connections are in lines 94–104.

## View 2: Process interior and boundary forwarding

**Caption / takeaway:** “The process boundary forwards its inputs to two threads and forwards the controller's output back out. The threads remain separate runtime components inside one process.”

**Accessible name:** “Motion process interior with boundary forwarding.”

**Scope:** instance `motion`, classifier `Campus_Rover::Motion_Control.two_tasks`. Show **two thread nodes and one containing process boundary**. Boundary features are ports on that boundary, not fabricated device/component nodes. The figure remains at one level of decomposition.

### Complete component and feature inventory

| Owner | Category / role | Classifier | Features |
| --- | --- | --- | --- |
| `motion` | containing process boundary | `Motion_Control.two_tasks` | `raw_speed`: **in** data port `Speed`; `requested_speed`: **in** data port `Speed`; `command`: **out** data port `Drive_Command` |
| `motion.filter_task` | thread | `Speed_Filter.basic` | `raw_speed`: **in** data port `Speed`; `filtered_speed`: **out** data port `Speed` |
| `motion.controller_task` | thread | `Speed_Controller.basic` | `measured_speed`: **in** data port `Speed`; `requested_speed`: **in** data port `Speed`; `command`: **out** data port `Drive_Command` |

Inside this scope, the graphical node titles may use the local names `filter_task` and `controller_task`. The breadcrumb and textual alternative preserve their full paths. The local spelling is a display abbreviation, not a new identity.

### Complete visible relationship table

| Local connection | Source | Destination | Relationship meaning |
| --- | --- | --- | --- |
| `sample_in` | Boundary `motion.raw_speed` | `motion.filter_task.raw_speed` | Incoming `Speed` data forwarded from the process boundary to the filter thread |
| `filtered` | `motion.filter_task.filtered_speed` | `motion.controller_task.measured_speed` | `Speed` data connection between sibling threads |
| `target_in` | Boundary `motion.requested_speed` | `motion.controller_task.requested_speed` | Incoming `Speed` data forwarded from the process boundary to the controller thread |
| `command_out` | `motion.controller_task.command` | Boundary `motion.command` | `Drive_Command` data forwarded from the controller thread to the process output |

**Boundary direction matters:** `sample_in` and `target_in` connect an **input on the enclosing process** to an **input on an internal thread**. `command_out` connects an internal output to the enclosing output. These are boundary-forwarding connections, not invalid peer-to-peer input/input or output/output connections. Do not reverse a drawn arrow to make every displayed edge look like a connection between sibling components. Port direction is relative to its owning component.

**Layout intent:** put `raw_speed` and `requested_speed` on the process's left boundary and `command` on its right boundary. Place the filter to the left of the controller. Route the requested-speed connection in its own lower lane to the controller, so it does not pass through the filter or imply that the filter consumes it. Draw `sample_in`, `filtered`, and `command_out` as the upper chain. Arrows terminate on the intended port, never on a node's center. Keep labels beside their own path, leaving room for readable type at normal zoom.

**Interaction:** the breadcrumb reads **Rover / motion** with **Go to Rover** as a native button or link. The details panel may expose the two thread classifiers and their properties; do not show every timing property inside each node by default. **Show deployment** opens View 3 while keeping the selected thread identity, if one is selected. No drag action is needed to explore the hierarchy.

**Source correspondence:** thread features are in `examples/rover.aadl` lines 30–61, process features in lines 63–70, and these four connection declarations in lines 72–84.

## Connection chains across the first two views

The native instance does not simply contain the three root declaration arrows as three leaf-to-leaf edges with unchanged endpoint names. It resolves forwarding through process boundaries into complete semantic connections. The two scopes above must be projections of those resolved chains and their `connectionReference` records.

| Native complete connection | Ordered declared segments | What the two views show |
| --- | --- | --- |
| `encoder.measured_speed` → `motion.filter_task.raw_speed` | `sensed_speed`, then `motion.sample_in` | Root view ends at `motion.raw_speed`; interior view continues from that same boundary feature to the filter input. |
| `operator_console.requested_speed` → `motion.controller_task.requested_speed` | `target_speed`, then `motion.target_in` | Root view ends at `motion.requested_speed`; interior view continues to the controller input. |
| `motion.controller_task.command` → `motor.command` | `motion.command_out`, then `motor_command` | Interior view reaches boundary `motion.command`; root view continues from it to the motor input. |
| `motion.filter_task.filtered_speed` → `motion.controller_task.measured_speed` | `motion.filtered` | This complete connection is wholly inside `motion`, so it appears only in the interior view. |

All four instance connections are marked `complete="true"` in the inspected artifact. That is evidence of resolved model connectivity, not a measurement of delivery or latency. A renderer that only reads root `connectionInstance.source` and `.destination` would incorrectly expose hidden threads or miss the boundary endpoints. A renderer that shows both the full chain and its constituent segments as parallel edges would double-count the same communication.

For the static reference, the tables are the explicit correspondence. For the future dynamic renderer, use the resolved instance's segment references and their contexts, not a regex over AADL source. Retain one logical connection identity and its ordered segment identities so switching scopes changes only the projection.

## View 3: Actual processor bindings

**Caption / takeaway:** “Both threads execute on `cpu`. Their processor bindings are allocation facts, separate from the ports that carry data.”

**Accessible name:** “Rover thread allocation to the onboard processor.”

**Scope:** deployment of the two `motion` threads. Show **three component nodes**: the two threads and `cpu`. An optional `motion` containment boundary plus enclosing Rover boundary brings the shape count to five. The processor remains a sibling of `motion` in the root; never draw it inside `motion` or draw the process itself as a third scheduled thread.

### Complete visible node and relationship tables

| Instance | Category | Classifier | Containment |
| --- | --- | --- | --- |
| `motion.filter_task` | thread | `Speed_Filter.basic` | Inside process `motion` |
| `motion.controller_task` | thread | `Speed_Controller.basic` | Inside process `motion` |
| `cpu` | processor | `Onboard_CPU` | Direct child of the root system, alongside `motion` |

| Property | Applies to instance | Resolved referenced instance | Source association |
| --- | --- | --- | --- |
| `Actual_Processor_Binding` | `motion.filter_task` | `cpu` | `reference (cpu)`, applied to `motion.filter_task` |
| `Actual_Processor_Binding` | `motion.controller_task` | `cpu` | `reference (cpu)`, applied to `motion.controller_task` |

The native effective-property association on each thread references `/0/@componentInstance.4`, which is `cpu`. Those serialized index paths confirm this inspected artifact; they are not durable UI identifiers. Use root-scoped instance paths or semantic ids in the view contract, because adding/reordering a source component may change XMI indices.

**Layout intent:** place both thread nodes within a lightly outlined `motion` boundary on the left and `cpu` on the right, outside that process boundary. Use dashed directed connectors from each thread to `cpu`, each visibly labeled **actual processor binding**. Place the full AADL property spelling in the details/table. This relationship must differ from the solid port-connection style in the other views by stroke pattern and explicit label, not color alone. Show no port glyphs or communication arrows here. Two allocation arrows do not imply two cores, mutual exclusion, or a thread execution order.

### Optional timing details, outside the default drawing

| Owner | Dispatch / scheduling | Period | Deadline | Execution-time assumption |
| --- | --- | --- | --- | --- |
| `motion.filter_task` | `Periodic` | 20 ms | 20 ms | 1–2 ms |
| `motion.controller_task` | `Periodic` | 20 ms | 20 ms | 2–3 ms |
| `cpu` | `Scheduling_Protocol => (RMS)` | Not specified | Not specified | Not specified |

The source declares both thread ranges as assumptions. An optional contributor table may calculate upper periodic demand as `2/20 + 3/20 = 25%` under those declared assumptions. Label this **educational CPU-demand calculation**, not an observed scheduling result. This figure must not claim that the schedule is feasible or that the end-to-end flow meets a latency requirement. No sensor-to-motor latency result was verified for this rover model.

**Interaction:** selecting a binding opens its source association and resolved target, distinct from selecting a port connection. A native **Open motion** action returns to the process view. Changing the view never changes binding declarations, files, the selected analysis root, or assessment results.

**Source correspondence:** actual binding declarations are in `examples/rover.aadl` lines 108–112. Thread timing assumptions are in lines 36–40 and 53–57; the processor's scheduling property is in lines 86–89.

## Reading order, details, and accessible alternatives

The default reading sequence is **Root connections → Process interior → Actual processor bindings**. On the static chapter page, each figure follows the question it answers and its caption states the takeaway first. A small **Model details** disclosure can contain the relevant tables. On a narrow screen or at large zoom, tables may replace the drawing as the primary presentation; they must remain sufficient to answer the same questions.

The interactive viewer's persistent controls are **View**, **Current scope**, and **Model details**. Use native controls with visible labels. Root connections and deployment are view choices; opening `motion` changes the hierarchy scope. Keep that distinction visible so readers do not mistake a new drawing for a changed architecture.

Required behavior:

- **Graph and text agree.** Generate the SVG's accessible name and the full component/connection/binding tables from the same view projection and snapshot. The caption explains why; the text alternative states what exists. Avoid reading the entire table as one unmanageable image label.
- **Details are optional, meaning is visible.** Names, categories, port direction, and relationship kind remain available without hover. Full classifiers, source navigation, timing properties, and complete instance chains can live in details.
- **Focus remains stable.** Selecting **Open motion** deliberately focuses the new scope heading or model tree; automatic validation never does. A changed source cannot send focus into a removed node. Restore focus to the initiating control when closing details.
- **Keyboard access is complete.** Provide native list/table actions for Open, Parent, Source, and the view selector. Canvas clicking is an additional route, not the only one. A scrollable drawing has a named keyboard-focusable region; do not make every decorative SVG path a tab stop.
- **Readable geometry is preserved.** Labels and controls use surrounding paragraph-size text. At 320 CSS pixels, reflow simple architectures vertically; permit accessible horizontal scrolling for complex scopes instead of shrinking labels. Keep focus outlines outside clipping paths. The figure never needs to show more than seven nodes/shapes under the counts specified above.
- **Color is supplementary.** Category words, port directions, and line patterns remain meaningful in grayscale and forced-colors mode. Verify base, dark, and light-print palettes. Reduced motion disables layout transitions; no animation is required for these reference figures.
- **Currentness is explicit.** Show root and model revision near the viewer. On edits, retain a previous figure only under “Previous valid model; source changed.” Disable any action that would misrepresent its properties as current. Announce that transition once, not on every keystroke.
- **Print is self-contained.** Print all three scopes in light mode at readable size, with their captions and text alternatives. Details must not remain unavailable merely because a disclosure was closed on screen. Each printed result identifies the source/root; pending edits cannot silently print with an earlier diagram.

## Maintainable renderer contract

The visual model is a projection of official semantic data. It must not become another AADL parser or an independently maintained copy of the architecture. The table values above are a verified reference specification; they are not a second runtime model to keep synchronized by hand.

Keep four responsibilities distinct, reusing the owners proposed in the backend design:

| Responsibility | Owns | Must not own |
| --- | --- | --- |
| Semantic model/bridge | Resolved categories, instances, feature kinds, connection chains, property targets, source origins, snapshot identity | SVG geometry, lesson prose, UI state |
| Pure view projection | Scope filtering, boundary endpoints, exact visible nodes/edges, text-table records, selection identity | Source parsing, engine invocation, DOM mutation, layout coordinates |
| Layout and rendering | Measured readable labels, component/port placement, connector routing, SVG and semantic table presentation | Binding inference, validation conclusions, grading, source rewriting |
| Workspace controller | Current view/scope/selection, explicit navigation, cancellation and stale-result acceptance | AADL semantics, manual duplicate relationship lists, CSS strings |

Use named CSS modules for line styles, typography, state emphasis, themes, reflow, and print. JavaScript may supply measured geometry; the content document should not embed static presentation rules. Prefer these few clear ownership boundaries to a class hierarchy for every component category or view.

A view's stable identity consists of the producing snapshot, root implementation, view kind, and scope path. Model identities stay independent of layout and source line numbers. Source locations are navigation evidence, not entity identities; a moved declaration should not become a new component solely because its line changed.

### Acceptance examples

Before a renderer is accepted, inspect the real output and verify these behavior contracts:

1. **Root inventory:** exactly `encoder`, `operator_console`, `motor`, `motion`, and `cpu` appear at the root, with the three stated directed port connections. No hidden thread is invented as a root child.
2. **Interior forwarding:** opening `motion` shows exactly two threads and three process-boundary features. `requested_speed` bypasses the filter. Incoming boundary arrows point inward; `command_out` points toward the output boundary.
3. **Cross-scope consistency:** the three flattened external connections expand into the exact ordered segments in the connection-chain table. Neither view duplicates the full chain as an extra edge.
4. **Allocation separation:** the deployment view shows two actual bindings to the same `cpu`, with no third process binding and no invented bus or memory. Changing to this view does not create a communication edge.
5. **Meaningful variation:** renaming a local instance or adding a second instance of one classifier preserves distinct identity and correct endpoints. Equivalent declaration order or source formatting does not change semantics or assessment results.
6. **Freshness:** edits, root changes, and destruction reject late layout/analysis completions. Returning to an earlier view uses that view's current projection rather than an old filename's model.
7. **Human verification:** at normal zoom, both themes, 320-pixel width, 200% text size, keyboard-only interaction, and actual light-mode print/PDF, labels, endpoints, captions, and table rows remain readable. Automated DOM assertions alone cannot establish those visual facts.

The component checks and visual inspections completed so far are recorded above. The fuller three-scope print/export presentation and direct node navigation remain separate acceptance work.
