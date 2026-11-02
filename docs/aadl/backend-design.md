# AADL tutorial backend design

**Status:** design baseline, 1 November 2026. The browser parser/instance/latency path is now implemented and verified through the production transport; see the [implementation and browser evidence](runtime.md). Wider analyses and interface details below remain design proposals where not explicitly covered by that record.

## Decision and alternatives

Use **real OSATE parsing, linking, property resolution, and instantiation** as the semantic authority. Derive diagrams and analysis inputs from that same instance model. The implemented deployment is a small headless Java bridge loaded through **CheerpJ 5 / Java 25**, with the existing tutorial host owning editing, drafts, progression, and cancellation. The initial Java 21 candidate encountered a vendor JIT failure; Java 25 requires the precise reflection compatibility adapter described in the runtime record.

The first feasibility gate passed for the concrete parser/instance/latency sequence recorded in [runtime evidence](runtime.md). OSATE's official tooling has a headless language server and selected analysis entry points. CheerpJ 5 added Java 21 support on 30 October 2026; the site's TLA+ backend uses an older runtime. General compatibility still requires evidence for each added path. [OSATE tooling overview](https://osate.org/tooling/about-tooling.html), [CheerpJ changelog](https://cheerpj.com/docs/changelog), local `docs/tla-backend.md`

| Approach | Benefit | Material cost or limitation | Decision |
| --- | --- | --- | --- |
| Real OSATE in a browser JVM | Existing language semantics; local source processing; no learner installation | Dependency initialization, payload, memory, startup, isolation, and cancellation need a real experiment | Preferred; first engineering milestone |
| Hosted OSATE service | Released native tools provide a direct foundation | Source leaves the browser; service operation and availability; conflicts with the preferred deployment | Documented fallback only; not silently activated |
| Local CLI/desktop helper | Good semantic reference and export destination | Installation and integration friction | Instructor verification and optional advanced workflow |
| New JavaScript subset parser | Small initial payload and easy UI integration | Recreates name resolution, units, inheritance, modes, prototypes, and connection/flow semantics; cannot honestly promise full AADL | Not the proposed backend |
| Ocarina/Wasm or Java-to-Wasm port | Potentially fully local engine | No ready official browser build verified; substantial porting uncertainty | Research alternative if the JVM route fails |

A narrower teaching profile can restrict what exercises use without replacing the engine. Unsupported features should be identified as unsupported by a particular analysis, not silently dropped from the architecture. Awas provides precedent for browser visualization of exported instances, but its archived implementation is not an editable-AADL frontend. [Awas guide](https://awas.sireum.org/doc/01-getting-started/index.html), [archive](https://github.com/sireum/v3-awas), [Ocarina installation](https://ocarina.readthedocs.io/en/latest/installation.html)

## Product contract

The learner edits ordinary `.aadl` files. A labeled **Root implementation** selector identifies the architecture to instantiate. Editing automatically schedules bounded validation and visualization after a short quiet interval. Explicit **Analyze model** runs the selected analyses. **Test My Work** assesses the exercise against instructor requirements. None of those actions executes arbitrary controller application code.

The workspace offers three coordinated surfaces:

- **Source:** existing Monaco files, real diagnostics, and navigation to model declarations.
- **Architecture:** one selected hierarchy scope, ports and connections; optional deployment and flow views.
- **Analysis:** readable result summaries, assumptions, missing inputs, and contributor tables linked to source and diagram elements.

Before the first engine download, explain that an additional runtime is needed and show progress/cancellation. Source remains local in the preferred design; fetching a runtime is still a network dependency. Do not claim offline operation until assets and a supported offline lifecycle are verified.

### Actions and result meaning

| Action | Result | Does it award exercise credit? |
| --- | --- | --- |
| Edit source / automatic validation | Diagnostics and current model if validation/instantiation succeeds | No |
| Inspect hierarchy, binding, or flow | A projection of the current model | No |
| Analyze model | Selected engine reports under visible configuration | No, unless separately assessed by Test My Work |
| Test My Work | Individually reported instructor criteria against one frozen snapshot | Only completed, current, relevant evidence |
| Stop | Canceled operation; previous view is identified by its revision | No |

Retain the last valid diagram during incomplete typing, explicitly labeled **Previous valid model—source has changed**. Disable analysis claims for that stale view. Do not move the cursor, replace source, select a different root, or award credit automatically when an asynchronous result arrives.

## Engine boundary

Do not run the native CLI's process manager or TCP loopback protocol in a browser. Load the required semantic classes in one browser JVM and invoke a narrow library bridge. Reuse headless initialization and built-in resource registrations from the official language server. [CLI architecture](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/osate-cli/README.md)

The proposed bridge operations are:

| Operation | Inputs | Outputs |
| --- | --- | --- |
| `initialize` | Exact engine manifest and bundled standard/contributed property resources | Engine identity, capability list, initialization diagnostics |
| `validate` | Complete workspace snapshot | Source-linked diagnostics and available root implementations |
| `instantiate` | Valid snapshot and explicit root | Resolved instance projection, effective properties, diagnostics |
| `analyze` | Frozen instance, analysis id, explicit options, mode scope | Structured engine results and completeness evidence |
| `dispose` | Owned request/session identity | Released model, JVM/frame/worker resources and settled requests |

OSATE's tagged `InstantiateCommand` calls `InstantiateModel.instantiate(ci, errorManager)`. Its latency adapter calls `FlowLatencyAnalysisSwitch.invokeAndSaveResult`. A new serializer should expose their results as JSON; the renderer must never parse the AADL text to invent another model. [Instantiation source](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/InstantiateCommand.java), [latency source](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/AnalyzeLatencyCommand.java)

Built-in libraries are pinned and read-only. Imports resolve only within supplied workspace files and those libraries; no arbitrary URL fetching. Normalize paths below the virtual workspace; reject traversal, duplicate normalized names, and unapproved resource schemes. Render names, diagnostics, and source as text, never executable HTML. Do not embed engine-generated HTML reports into the host page.

Prefer a terminable worker if the chosen runtime supports the complete bridge there. Otherwise test an isolated runtime frame and a host-owned lifecycle with a private message channel, following the TLA+ boundary. **Hard cancellation remains an acceptance criterion**, not an assumption that deleting an iframe always stops a blocked computation. If browser scheduling prevents reliable Stop, the gate fails for interactive deployment until an enforceable execution boundary exists.

### Snapshot and resource lifecycle

Native boundary validation exposed a concrete stale-artifact hazard in the tested CLI release. The first instantiation of `Rover_Budget::Loop.budget` succeeded and its latency report showed 22 ms. After source updates, repeated instantiation of the same root reported that a different resource with the generated `.aaxl2` URI was already registered, **while returning exit zero**. A subsequent latency command still completed against the previous instance and repeated the old 22 ms result. This is evidence about that CLI session lifecycle, not proof that OSATE's core cannot be reused safely. See the [native verification record](verification.md).

The proposed bridge must give each source snapshot an isolated model scope: a fresh EMF `ResourceSet`, a unique virtual workspace/instance/report namespace, and explicit ownership of every loaded source and generated resource. Reuse immutable engine code and metamodel registrations; do not carry mutable workspace models into a changed snapshot. A fresh `ResourceSet` alone is not an established fix for registrations outside that set. The spike must verify unloading and registry/cache cleanup; if those cannot be made reliable, dispose the JVM session between snapshots and measure the startup cost.

Only successful validation and instantiation may publish an instance handle bound to the exact snapshot, selected root, and engine identity. `analyze` must require that handle, rather than reopen a familiar output filename or use whichever instance was last available. Any registration collision, instantiation diagnostic error, or missing expected artifact ends the dependent pipeline with no current analysis evidence. Generated reports inherit the producing handle's identity; attaching a new request id or source hash to an older report must never make it current. Prior results may remain visible only under their original snapshot and stale label.

### Provenance

Pin the exact semantic engine and its whole dependency closure, not just a version string in a README. As researched, documented stable OSATE is 2.20.0, while the downloaded official `osate-cli` 0.3.0 identifies its bundled engine as **OSATE 2.21.0-SNAPSHOT (b8308b7)** and its language server as **0.3.0 (895e0b9)**. These are different baselines. Select and reproduce one tested closure for the browser spike; any change to it requires rerunning native/browser comparisons. [Release record](https://github.com/osate/aadl-tooling/releases/tag/osate-cli-v0.3.0)

OSATE/server code uses EPL-2.0; the CLI and extension have separate BSD-style terms. Dependencies retain their licenses. CheerpJ has its own education/community, attribution, hosting, and commercial terms; confirm the actual deployment arrangement before distributing or self-hosting runtime assets. Record every executable URL, hash, license, version, and provenance in a vendor manifest. The native archive size is not a browser download estimate. [Tooling licenses](https://github.com/osate/aadl-tooling/blob/main/LICENSE.md), [CheerpJ licensing](https://cheerpj.com/docs/licensing)

## Canonical model and automatic visualization

The JSON projection is a **view of an OSATE instance**, not a second semantic intermediate language. Preserve:

- Stable ids scoped by root and instance path; parent/child relationships and classifier identity.
- Component category, features, feature directions/kinds, and resolved data classifiers.
- Logical connection endpoints and hierarchical connection segments, distinct from bus-access relationships.
- Effective processor/memory/connection bindings and their targets.
- Effective property values, normalized units, original spelling, declaration/override/default provenance, and unavailable values.
- Flow specifications and expanded routes, component/system modes and activation conditions.
- Source URI/range for declarations and relevant association origins, plus snapshot identity. Where the engine API does not expose an origin, represent it as unavailable; do not guess. Complete inheritance/default provenance is additional bridge work to verify.

Use a projection separate from layout. ELK is already locally available in the project and is a plausible layout engine for hierarchical port graphs. It decides placement/routing only. Reuse theme/accessibility conventions, but do not force AADL through ArchUML's UML parser or label UML component notation as standard AADL notation. Until SAE graphical conventions are fully checked, label the view **AADL architecture overview** and use explicit category/kind labels. Standard-compliant graphical notation is a separate acceptance item.

The default view shows one hierarchy level; **Expand component**, **Go to parent**, and a breadcrumb reveal detail. Always show names at paragraph size. Distinguish logical connections, hardware access, and bindings using labels and line styles as well as color. Ports expose direction/kind/data type in accessible text. A selected flow highlights the exact resolved segments and opens its ordered segment table. Switching views never changes source or the grading model.

No drag-to-edit or automatic source generation is required for the first release. Source-to-view navigation uses declaration ids/ranges. View-to-source navigation uses native buttons in a parallel model tree or details table. A diagram click is a convenience, never the only available action.

## Analysis scope and honesty

First integrate the analyses already exposed by the official headless tooling: **validation, instantiation, latency, bus load, and mode reachability**. Start UI implementation with validation/instantiation and one latency example; add bus load and modes only after their own fixtures pass. The chapter explains broader capabilities without promising all of them in the tutorial. [Official tooling capabilities](https://osate.org/tooling/about-tooling.html)

| Analysis | Required evidence | Must not be reported as a successful check |
| --- | --- | --- |
| Latency | Selected, continuous end-to-end flow; relevant modes; engine options and contributor results; trusted bound when grading | No flow, disconnected path, missing required contribution, unsupported timing semantics, absent comparison bound |
| Bus load | Bound communication path, traffic/rate and payload assumptions, protocol/overhead behavior, capacity and mode | No bound traffic, missing capacity, treating budget as measured load, ignored multicast/broadcast semantics |
| Mode reachability | Actual combined states/transitions under routed triggers | Merely drawing declared modes, partial search, equating reachability with whole-system safety |
| Educational CPU-demand display | Nonempty set of active bound periodic tasks, resolved positive periods, WCET and processor assumptions | Unbound/omitted tasks, missing values treated as zero, claiming schedulability from utilization |

**Completeness must be checked independently of engine warnings.** In a fresh native workspace, removing `Latency => 8 ms .. 12 ms` from the `control` flow path of `Rover_Budget::Controller` left the model valid. For root `Rover_Budget::Loop.budget`, OSATE assigned that contributor 0..0 ms, computed a 10..10 ms end-to-end total, and reported the unchanged 25 ms requirement met with only informational diagnostics. The sensor and actuator still contributed 4 ms and 6 ms, and the two connections retained explicit zero allocations. This was a fresh-instance calculation, distinct from the stale-instance failure above. See the [isolated verification cases](verification.md).

Before publishing a `satisfied` finding or awarding credit, the proposed adapter must check a trusted completeness fixture for the lesson: required contributors in each assessed mode, required effective properties and units, and an allowed origin for each value (an explicit declaration, permitted inheritance, or an approved default). Accept equivalent legal placement and units rather than matching source text. A computed zero does not establish that an allocation was supplied. If a required value or its permitted provenance cannot be established, retain the raw engine calculation for inspection but set `coverage.complete: false`, identify the missing input, and report the tutorial finding as `inconclusive`. The missing-controller-allocation case must not earn a pass even when the native report says the bound is met.

The CPU-demand display is an explicitly labeled educational calculation over official resolved properties, not a claim to run OSATE's scheduling analyzer. Full schedulability requires a separately integrated engine and a documented supported profile. OSATE's existing scheduling handler is coupled to desktop infrastructure and is not currently a CLI command. Keep the chapter's low-utilization/missed-deadline counterexample as reasoning practice until that integration is verified. [Scheduling handler](https://github.com/osate/osate2/blob/2.20.0-RELEASE/analyses/org.osate.analysis.resource.management/src/org/osate/analysis/resource/management/handlers/Schedule.java)

EMV2 syntax support does not establish browser support for fault-tree or failure-mode analyses. AGREE and Resolute remain advanced extensions with separate solver/function restrictions, licensing, runtime, and analysis verification. Code generation and physical simulation are outside the first release.

### Normalize outcomes explicitly

The upstream analysis result's `info`, `warning`, or `error` is diagnostic severity, not a complete proof or satisfaction status. CLI exit zero can accompany model errors. The host must inspect actual result records and own cancellation/completeness. [Result type](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/aadl-language-server/org.osate.aadl.ls/src/org/osate/aadl/ls/commands/AnalysisCommandResult.java), [CLI manual](https://github.com/osate/aadl-tooling/blob/osate-cli-v0.3.0/osate-cli/OSATE-CLI.md)

Proposed result envelope:

```json
{
  "snapshotId": "hash-of-files-root-options-engine",
  "execution": "completed",
  "model": "valid",
  "analysis": "latency",
  "finding": "violated",
  "root": "Example::System.impl",
  "modeScope": ["automatic"],
  "coverage": {"complete": true, "missingInputs": []},
  "engine": {"version": "exact-pin", "commit": "exact-commit"},
  "assumptions": [],
  "diagnostics": [],
  "results": []
}
```

`execution` also admits `canceled`, `timed_out`, `resource_limit`, `engine_error`, and `unavailable`. Model status distinguishes invalid source, instantiation failure, and unsupported features. Findings include `satisfied`, `violated`, `inconclusive`, `not_applicable`, and `not_run`. The host determines **current/stale** by comparing the complete snapshot identity, including library/engine versions. A completed calculation without a bound can display values while its requirement finding remains `not_applicable`.

Each numerical result retains units, scope, actual value/range, required bound, contributor ids, effective assumptions, and source references. An expected violation can pass a diagnostic exercise; show **Exercise criterion met; modeled requirement violated** rather than recoloring the architectural finding as compliant.

## Tutorial integration and proposed schema

Reuse `TutorialCode` through a thin `js/tutorial-aadl.js` adapter. Put domain-specific work under `js/aadl/`: `model.mjs`, `client.mjs`, `controller.mjs`, `projection.mjs`, `view.mjs`, and `assessment.mjs`, plus the minimal Java bridge source. These are proposed ownership boundaries, not files created by this design.

| Existing owner | AADL integration |
| --- | --- |
| `js/tutorial-code.js` | Backend selection, accessible editor label/language, ordinary transaction hooks and disposal; avoid spreading semantic logic here. |
| `_layouts/tutorial.html` | Load adapter/view/CSS only when needed; preserve print-light stylesheet order. |
| Existing file/progress owner | Source files, lesson-local drafts, Reset, Solution, autosave preference; no duplicate persistence. |
| Shared test panel and TutorChat | Small criterion results and condition-driven hints; preserve real pass records. |
| Print layout | Authored source, analysis question/assumptions, static model tables/figures and solutions under existing instructor visibility. |
| Existing popout shells | Source/instructions first; an interactive result view needs typed projection transport, not the text-output channel. |

Candidate YAML—**proposal only, unsupported by the current runtime**:

```yaml
backend: aadl
progress_version: 1
autosave_type: files
require_tests: false
require_quiz: false
allow_skip_steps: true
aadl:
  root: Campus_Rover::Rover.single_cpu
  analyses: [latency]
steps:
  - key: deployment
    title: Processor Bindings
    run_file: rover.aadl
    files:
      - path: rover.aadl
        language: aadl
        reseed: true
        content: "...complete authored model..."
    tests:
      - description: The required control tasks have a valid deployment
        aadl:
          criterion: required-task-bindings
          fixture: rover-deployment-v1
```

The fixture is repository-owned assessment data defining the task's essential components and permitted alternatives. It must not rely on private implementation details or pretend to be secret from developer tools. Add explicit declarative criterion types only when the corresponding lessons require them: topology, effective property, binding, flow continuity, and analysis-bound result. No arbitrary learner-supplied Java/JavaScript assertions in the host.

`run_file` identifies the source context; `aadl.root` selects the semantic architecture independently of the active editor tab. A step may override root/options. Use stable keys and `reseed: true` for separate lesson versions of one filename. All files in a snapshot participate in name resolution; validate imports across files. Do not add mixed-backend or debugger support in the first release.

Checks use **trusted requirements**, not only the learner's editable latency or capacity bound. Require a relevant nonempty path/task set, so deleting the flow, disabling every component, choosing another root, or removing a requirement cannot produce a pass. Accept equivalent legal syntax, units, declaration order, helper decomposition, and unspecified names. Fix the physical inputs where their derivation is not the task; lowering a WCET estimate without evidence is not an architectural repair.

Freeze source/root/options once per check batch. Edits invalidate credit immediately, cancel running work, and reject late results. Navigation, Reset, applying a solution, popout edits, and destruction follow the same revision ownership. Only one transaction owns an engine session; background validation coalesces to the latest edit. Stop settles every pending callback and releases the operation before another starts.

## Accessibility, persistence, and print

The design must meet all project WCAG 2.2 AA requirements. Practical acceptance includes:

- Native labeled controls, meaningful focus order, keyboard access to every graph/table operation, Escape leaving Monaco, and no pointer-only or dragging-only task.
- A synchronized hierarchical text view and complete connection/binding/flow tables; summaries alone do not replace graph information.
- Paragraph-sized labels and fields, text/background contrast in both themes, distinct non-color result labels, and visible focus unoccluded by sticky chrome.
- Reflow at 320 CSS px and high zoom, with keyboard-scrollable wide diagrams rather than shrinking labels.
- Short live announcements for completed validation and status changes, without announcing every keystroke or taking focus.
- Light-palette static print/export, including source revision, selected root/modes, assumptions, and result completeness; stale pending source must not print an older diagram as current.
- No new shortcuts or site-owned persistence by default. Reuse ordinary tutorial file drafts and delete/export flows. Verify CheerpJ 5's virtual-filesystem and vendor-origin cache behavior: absence of a site-owned cache does not mean the runtime stores nothing. Document that boundary and update the storage inventory/settings when it changes.

Any standalone frame needs the training opt-out metadata. New CSS belongs in named modules, with print-light loaded last. Implementation must update `tutorial-authoring/SKILL.md` in the same change—backend list, capability matrix, schema, checklist, lifecycle, and test semantics. The present design does not change runtime behavior, so it does not advertise these fields in that live authoring contract.

## Feasibility and delivery gates

The first milestone is a deliberately small engineering experiment, not the complete tutorial:

1. Pin a reproducible engine closure and run valid/invalid, multi-file, unit-conversion, inheritance, flow, and binding fixtures on its native JVM.
2. Load that exact closure and required property sets through CheerpJ 5/Java 21. Obtain actual parser diagnostics and a resolved instance in Chromium, Firefox, and WebKit.
3. Serialize the hierarchy, effective properties, source locations, and continuous flow; compare against the native reference independent of incidental object ids/layout coordinates.
4. Run a latency pass and violation with identical configuration, then missing-property and wrong-root cases. Compare numerical contributors and diagnostics, not only headline status. Include the fresh missing-controller-allocation case: preserve OSATE's observed 10..10 ms calculation while the trusted completeness check returns `inconclusive` and awards no credit. Verify permitted inherited allocations and equivalent units still satisfy the same completeness contract. Repeat independently for bus load and modes before enabling them.
5. Exercise repeated instantiation of the **same root and authored filenames** across a valid passing revision, a changed violation, missing required input, invalid source, and a repaired revision. Compare each successful result against a fresh native reference; failed instantiation must prevent analysis even when an older successful instance/report exists. Verify snapshot resource isolation and cleanup in the actual browser bridge, including any shared registrations; a unique response id alone is insufficient. Also prove Stop, deadlines, edits during computation, navigation, and destruction do not freeze the page or publish stale success. Record peak memory, cold/warm startup, compressed download bytes, and computation time.
6. Decide measured model-size and execution limits. Initial experiment targets: at most 20 source files/256 KiB, 200 instances, 500 connections, 200 combined modes; 30-second analysis watchdog. These are proposed product bounds, not AADL limits or established performance results. Bound memory/graph growth during instantiation and mode expansion, before serialization: a small source with large arrays or mode products can exhaust memory before an output-size cap applies. If the engine cannot enforce an internal cap, verify the enclosing memory/cancellation boundary against such cases.

If the browser gate fails, retain the native evidence and name the blocker. Investigate a smaller official dependency closure before considering a port, local helper, or hosted alternative. A change to remote processing or a subset language is an explicit product decision; it must not masquerade as the preferred implementation.

After the gate, implement the accessible source→instance→diagram→analysis vertical slice, then the [nine-lesson tutorial](tutorial-design.md), then chapter/print integration. Run real-engine contract fixtures and targeted Playwright coverage for editing, diagnostics, stale results, Stop, keyboard interaction, both themes, narrow viewports, print, and anti-vacuity grading. Include two correct alternatives and plausible wrong/partial submissions per assessed criterion. Automated accessibility checks complement manual screen-reader, keyboard, zoom, and print review; they do not certify all 55 criteria by themselves.
