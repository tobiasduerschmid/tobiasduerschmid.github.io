# AADL Browser Tutorial Implementation Plan

> **For agentic workers:** Use Superpowers subagent-driven development for independent engine, diagram, and lesson tasks. Review each boundary and perform a separate integration review before completion.

**Goal:** A working SEBook tutorial where ordinary AADL source produces an architecture view and real OSATE latency analysis entirely in the browser.

**Architecture:** OSATE owns parsing, validation, instantiation, properties, and analysis. A Java bridge serializes resolved models through an isolated browser JVM with disposable model workspaces. The tutorial adapter owns integration, a controller owns request freshness, and the diagram module owns layout and accessible presentation.

**Tech stack:** OSATE's Java 21 bytecode dependency closure, CheerpJ 5 / Java 25, ES modules, locally pinned ELK, existing Monaco/tutorial infrastructure, Node tests, native Java contract fixtures, and Playwright.

**Spec:** [Backend design](../../aadl/backend-design.md), [tutorial design](../../aadl/tutorial-design.md), [diagram design](../../aadl/diagram-design.md). The full nine-lesson design remains the roadmap; this implementation delivers four introductory lessons.

## Global constraints

- Use ordinary AADL; do not introduce a replacement subset parser or infer semantics from source substrings.
- Source remains in the browser; runtime downloads are disclosed. A native helper is a verification reference, not a hidden fallback.
- Diagrams are projections of the same resolved instance used for analysis; identify their notation as an architecture overview.
- Missing assumptions, failed instantiation, canceled work, resource limits, and stale reports never earn successful analysis or exercise claims.
- Static presentation belongs in CSS modules. Both themes, paragraph-sized labels, keyboard operation, equivalent text views, 320 px reflow, and light print are required.
- Preserve unrelated workspace files. Leave changes reviewable in the working tree; no deployment or publishing is part of this task.

## Review focus

1. Same-root source changes must never reuse a previous instance or report; test pass → violation → invalid → repair.
2. A missing controller delay must remain visibly incomplete despite OSATE's native 10 ms satisfied result.
3. Connection segments crossing process boundaries must retain the process features in a scoped diagram.
4. Navigation, source edits, Stop, and late responses must settle the operation without awarding stale credit.
5. Diagram labels, keyboard alternatives, and print remain readable without shrinking to fit the pane.

## Task 1: Native bridge and browser runtime

Files: `aadl/` Java sources/build/contract tests; `js/aadl/frame.js`, `js/aadl/runtime-manifest.mjs`; pinned artifacts and provenance under `js/vendor/aadl/`.

Interface: `Bridge.execute(JSON request) -> JSON result`; request `{version:1, operation:'validate'|'analyze', files, root}`. Result contains typed diagnostics, resolved model projection, and structured native analysis evidence. Each instance/report belongs to its producing request.

- [x] Write native contract assertions for the original models, invalid port, wrong root, 21/22/23 ms bounds, equivalent units, and absent controller delay; observe missing bridge failure.
- [x] Implement official standalone initialization, validation, instantiation, source locations, model serialization, and latency report adaptation.
- [x] Run the native contract cases successfully, including repeated source changes in the chosen lifecycle.
- [x] Verify actual CheerpJ parsing, instantiation, and latency in a browser; record startup and failure limits before claiming browser support.
- [x] Review bridge isolation, missing-property handling, reproducible dependencies, and licenses.

## Task 2: Diagram projection and rendering

Files: `js/aadl/diagram.mjs`, optional focused projection/layout module, `css/aadl-diagram.css`, `scripts/tests/aadl-diagram.test.js`.

Interface: `mountDiagram(root, options) -> {render(model), markStale(), clear(), destroy()}`. Model contains components with parent/feature ids, logical connection segments with their context ids, and actual bindings.

- [x] Write failing tests for root/process scope, boundary forwarding, bindings, and layout supersession.
- [x] Implement one-level scoped logical views and a separate deployment view, using ELK only for placement.
- [x] Generate equivalent component/feature/connection tables from the same projection; use native controls for navigation.
- [x] Verify no lost ports, crossing labels, unreadable scaling, or stale late layouts; review both themes and print.

## Task 3: Host lifecycle and tutorial integration

Files: `js/aadl/model.mjs`, `client.mjs`, `controller.mjs`, `view.mjs`, `assessment.mjs`; `js/tutorial-aadl.js`; `aadl-runtime-frame.html`; narrow backend hooks in `js/tutorial-code.js` and `_layouts/tutorial.html`; `css/aadl-workspace.css`.

Interfaces: `snapshot(files, step, defaults)` validates the complete request; `sameSnapshot(a,b)` compares source/root; `AADLClient.execute(request)` resolves a typed result and supports `cancel()/destroy()`; `createAADLController(...)` manages automatic validation and explicit analysis.

- [x] Write failing request/lifecycle tests for source limits, invalid paths, changed roots, canceled/late results, and missing-input assessment.
- [x] Implement request validation and verified artifact loading into an isolated runtime; keep transport separate from model semantics.
- [x] Implement automatic validation after edits, explicit Analyze, Stop, stale results, and semantic exercise checks with trusted requirements.
- [x] Add the smallest tutorial backend hooks, including step changes, Reset, solutions, file edits, and destruction.
- [x] Run unit and integration tests; review absence of source parsing or duplicate state ownership in the UI.

## Task 4: Lessons, chapter, and publication contracts

Files: `_data/tutorials/aadl.yml`, `SEBook/architecture/aadl.md`, tutorial/print pair, bibliography/glossary entries, tutorial-authoring skill, storage inventory if runtime behavior requires it.

- [x] Author a complete-model orientation, port repair, missing timing evidence, and tight supported bound lesson, with predictions, explanations, hints, and solutions.
- [x] Use real semantic criteria; require a relevant complete path and fixed contributor evidence. Accept equivalent legal units/case/formatting.
- [x] Publish the researched chapter through the existing layout and include mechanisms; link the working tutorial.
- [x] Update authoring/runtime documentation to describe only implemented capabilities.
- [x] Verify native starter/solution models, built tutorial/print pages, links, and consistent terminology.

## Task 5: Integrated verification and review

- [x] Run relevant Node, bridge, and Playwright suites with actual browser execution evidence.
- [x] Exercise edit → diagram → analysis, syntax errors, missing inputs, Stop, same-root reruns, navigation, solution application, and keyboard source navigation.
- [x] Check light/dark, 320 px reflow, readable diagrams, print, and automated accessibility; report manual coverage accurately.
- [x] Obtain independent specification/maintainability review and resolve material findings.
- [x] Start the local built tutorial server and send the verified port and URL.

## Execution record

- Research, original source models, and isolated native CLI verification completed before implementation.
- Ruling: continue in the existing shared workspace because the research deliverables and parallel work already live here; preserve the pre-existing untracked files and do not stage broadly.
- Ruling: implementation was explicitly authorized after the design preview. The browser compatibility gate remains a real engineering check, not permission to substitute a mock engine.

- Production engine verified in Chromium: cold request 68 s, warm requests about 2 s. Native bridge 9/9 and annotation-parity 1/1. Initial 51 AADL Node/component checks pass.
- Real tutorial journeys passed source edits, 21/22 ms bounds, missing evidence, invalid syntax, repair, all graded solutions, and credit invalidation. Light/dark 1440/320 px and print accessibility checks passed (5 tests).
- Full unit run with Ruby 3.3: 3,111 passing, 2 unrelated failures due to missing `_data/songs/always_code.yml`.
- Independent review identified and verified fixes for payload/role preservation, fixed lesson bounds, extra unused flows, access endpoints, and mode-scoped inconclusive timing.
- User requested syntax highlighting after seeing the live tutorial. Lexical Monaco coloring and responsive diagram refinement are now part of the implementation; final visual and Stop checks passed.

- Final requested additions: case-insensitive Monaco coloring shared with both popout types; responsive vertical diagrams at 600/320 px with full ports and access endpoints. Real in-app browser inspection confirmed highlighted source, derived diagram, and 18–22 ms result.
- Final checks: actual-engine tutorial journeys and Stop/navigation passed; result-state axe audit passed; five layout/theme/print tests passed; all focused AADL/popout contracts passed. Independent review findings are resolved. Full repository unit suite retains only the two documented unrelated missing-song failures.
- Local preview is served at `http://127.0.0.1:4000/SEBook/architecture/aadl-tutorial/`; chapter at `/SEBook/architecture/aadl`. Port 8765 is the earlier design-only preview. No commits or deployment were performed.
