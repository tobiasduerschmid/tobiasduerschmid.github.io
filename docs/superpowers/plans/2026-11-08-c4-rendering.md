# C4 Rendering Implementation Plan (Milestone 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render C4 views from `design.yml` in ArchUML exactly like other ArchUML diagrams: C4 notation for landscape, context, container, and component views; UML class, sequence, and deployment diagrams for code, dynamic, and deployment views; embedded in SEBook pages, statically prerendered, described for screen readers, and correct in light, dark, and print.

**Architecture:** `js/ArchUML/c4/c4-render.js` (lazy-loadable, publishes `ArchUMLC4Render`) draws C4-notation views from the core's `ViewModel` and delegates UML views to the bundle's existing renderers. A small `UMLC4Diagram` stub inside `uml-bundle.js` registers type `c4` everywhere and renders synchronously when the C4 scripts are present, otherwise through the lazy completion contract (spec §3.3). Site files register the type, preload the scripts on C4 pages, prerender figures statically, and describe them.

**Tech Stack:** Plain JavaScript (UMD in `c4/`, ES5-style IIFE inside the bundle), ArchUML `UMLShared`/`UMLAdvancedLayout`, Jekyll + Ruby plugin, Node `node:test` with Playwright Chromium, Playwright test runner.

**Spec:** `docs/superpowers/specs/2026-11-08-c4-model-design.md` (sections 3.2, 3.3, 5, 6, 7.3, 10, 13 are normative for this plan; for Tasks 9–12 also 5.3, 6.6, and decisions J8, J11, J14).

**Depends on:** Milestone 1 (`docs/superpowers/plans/2026-11-08-c4-core.md`): the facade `ArchUMLC4` (`load`, `project`, `describe`, `toUml`, `extractEmbed`, `listViews`, `defaultView`) and `js/ArchUML/c4/manifest.json`. Tasks 9–12 also depend on Milestone 1b (`docs/superpowers/plans/2026-11-08-c4-interfaces.md`): `interfacesOf`, `toUml` for `uml-component` views with `ids`, `describe(viewModel, {panels})`, and the `interface-card` view model.

## Global Constraints

- Repository rules: never commit; no temporary files in the repo; WCAG 2.2 AA on every touched page; no inline `style` attributes or page-local `<style>` in authored files (computed values via CSSOM only); readable text at paragraph size (never `rem` below paragraph size; this site's `1rem` is 10 px); light, dark, and print must all work; print is always light.
- Diagram colours come only from the palette object in `c4-render.js` (or a host `palette` option); never from the CSS cascade. Dark mode uses the site's existing `filter: invert(1) hue-rotate(180deg)` on `.uml-c4-diagram-container svg`.
- Contrast targets after compositing on `#fdfdfd` (light page), `#121212` (dark page, after the invert filter), and white paper: text ≥ 4.5:1 (design target 7:1), marks (borders, arrows, dashes) ≥ 3:1.
- All SVG text is escaped with an escaper that also escapes `'`; the C4 renderer writes presentation attributes and classes only (no `style=`).
- Every C4 text line renders at the same font size (`CFG.fontSize = 20`, the size ArchUML uses for CRC, state, and deployment); type lines are italic, names bold.
- SVG hooks: nodes `data-layout-id`, `data-c4-kind`, `data-c4-type`, `data-c4-drill`; edges `data-layout-route-id`, `data-c4-source`, `data-c4-target`, `data-c4-derived`.
- Layout is deterministic and ignores the container's aspect ratio (static prerender and live output must match).
- The ordered C4 script list is read from `js/ArchUML/c4/manifest.json` everywhere; the bundle stub embeds a copy that a test keeps equal.

## Review Focus

1. A page without preloaded C4 scripts (SE Gym card, quiz on another chapter, instruction popout) must render, describe, size, and make scrollable a C4 figure after lazy loading → test in Task 5.
2. Toggling dark mode re-renders fenced figures (`createAutoInit`); the baked fills must stay identical, and the invert filter must not apply twice to delegated UML views nested in the C4 container → test in Task 8.
3. Untrusted text in names, descriptions, and technologies (`<img onerror>`, quotes, apostrophes, `-->`, `}`, newlines) must never inject markup or ArchUML statements → tests in Tasks 1 and 3.
4. Very long names and descriptions must wrap inside boxes without overlapping neighbours or clipping at 320 px → test in Task 2.
5. A static build after a change to any C4 core file must not serve a stale cached SVG (both prerender caches) → test in Task 7.

---

### Task 1: `c4-render.js` foundation — palette, shapes, box text, legend, title, hooks

**Files:**
- Create: `js/ArchUML/c4/c4-render.js`; Modify: `js/ArchUML/c4/manifest.json` (`"render": ["c4/c4-render.js"]`)
- Test: `js/ArchUML/tests/c4/palette.test.js` (Node, pure), `scripts/tests/c4-render.test.js` (node:test + Playwright Chromium, pattern of `scripts/tests/crc-diagram.test.js`)

**Interfaces:**
- Consumes: `ArchUMLC4.load/project` (Milestone 1), `UMLShared.textMetrics`, `UMLShared.svgOpen/svgClose`, `UMLShared.prepareDiagramContainer`, `UMLShared.autoFitSVG`, `UMLShared.applySvgAccessibility`.
- Produces (`ArchUMLC4Render`): `PALETTE` (object of named colours), `contrastReport(palette) → [{pair, backdrop, ratio, required, pass}]` (pure, Node-loadable), `renderView(container, viewModel, options) → { svgText }` (C4 notation; `options = { palette, interactive }`), `render(container, text, options)` (load → extractEmbed → project → renderView or delegation), `escapeSvgText(text)`.
- Temporary layout for this task: elements placed row by row inside their boundary (Task 2 replaces it); edges as straight polylines between box centres.

- [ ] **Step 1: Write the failing tests**
  - `palette.test.js`: `every palette text pair reaches 4.5:1 on the light page, the inverted dark page, and paper`; `every palette mark reaches 3:1 against its backdrops`; the invert model is `invert(1)` followed by `hue-rotate(180deg)` applied with the CSS filter matrices, composited on `#121212`.
  - `c4-render.test.js`:
    - `the container view of the reference model draws one group per element with hooks` — groups with `data-layout-id` for `student`, `web`, `api`, `db`, `billing`; `api` has `data-c4-drill="components of api"`; `web` has `data-c4-kind="browser_app"`.
    - `edges carry source, target, and derived flags` — `web→api` edge has `data-c4-derived="true"`.
    - `box text shows name, type line, and description at one font size` — every `<text>` in the SVG has the same `font-size`; the type line text equals `[Container: Python, FastAPI]` and is italic.
    - `the legend and title are inside the SVG` — `svg` contains text `Container view: Course Registration` and one legend entry per `ViewModel.legend` key.
    - `user text cannot inject markup` — a name `<img src=x onerror=alert(1)>` and a description with `'` render as text; `svg.querySelector('img')` is null.
    - `rendering the same view twice produces identical SVG`.
    - `no style attributes are emitted by the C4 renderer`.
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/palette.test.js scripts/tests/c4-render.test.js` → FAIL.
- [ ] **Step 3: Implement** the palette (light ArchUML tints, dark text `#1f2328`-range, strokes ≥ 3:1), shape drawers (person: head circle over a rounded body box; database: cylinder; queue/topic: horizontal pipe; browser_app: rounded box with a three-dot title bar; mobile_app: rounded phone outline with speaker slot; file_store: folder tab; default: rounded box), measured wrapping of name/type/description lines at a fixed box width (`CFG.boxWidth = 300`), legend (sample + text per entry), title, hooks, escaping.
- [ ] **Step 4: Run** → PASS. **Step 5: Checkpoint** (no commit; `git -C js/ArchUML status --short`).

---

### Task 2: C4 layout — boundaries, routing, labels, pins

**Files:** Modify `js/ArchUML/c4/c4-render.js`; Test `scripts/tests/c4-layout.test.js`

**Interfaces:** `layoutView(viewModel, measure, options) → { nodes: {id: {x, y, width, height}}, boundaries: {id: {x, y, width, height}}, edges: [{id, points, labelBox}], width, height }` implementing spec §6.4 with `UMLAdvancedLayout.compute` per boundary level, virtual top/bottom anchors, `UMLShared.routeOrthogonalConnector` routing (boundaries passable for edges whose endpoints they contain), existing label placement helpers, and pins from `options.pins` (`Map<elementId, [x, y]>`) applied before boundary refit and rerouting. `renderView` uses it.

- [ ] **Step 1: Write the failing tests** (golden fixtures: reference context, container, component views; a generated 12-element container view; a view with two groups; a view with a boundary landing; a view with a pinned element):
  - `element boxes never overlap` (pairwise rectangle intersection is empty).
  - `every element of a boundary lies inside the boundary box` (and groups inside the scope boundary).
  - `people are above the scope boundary and dependencies below it` in the reference container view (`student.y + height < boundary.y`; `billing.y > boundary.y + boundary.height` or beside it — assert vertical order).
  - `no route passes through a box that is not one of its endpoints or their ancestors` (segment–rectangle test).
  - `edge labels do not overlap boxes or other labels`.
  - `a pinned element keeps its coordinates and its boundary grows to contain it`.
  - `layout ignores container width` (render into 320 px and 1400 px containers → identical node coordinates).
  - `one added element moves unrelated elements by at most 200 units` (layout stability bound on the reference container view plus one extra container).
  - Review Focus 4: `a 300-character description wraps inside its box at 320 px without overlapping neighbours`.
- [ ] **Step 2–5:** run → FAIL, implement, run → PASS, checkpoint.

---

### Task 3: UML delegation and C4 states

**Files:** Modify `js/ArchUML/c4/c4-render.js`; Test `scripts/tests/c4-delegation.test.js`

**Interfaces:** `render(container, text)` for `uml-class`, `uml-sequence`, `uml-deployment` views: `ArchUMLC4.toUml(view)` → render into an inner `<div class="c4-uml-view">` with `UMLClassDiagram`/`UMLSequenceDiagram`/`UMLDeploymentDiagram.render(inner, text)`; the outer container keeps `uml-c4-diagram-container`, its label, and its states. States (accessible, styled for both themes via existing `uml-empty-msg`/`uml-error-msg` classes): YAML syntax error ("This diagram's source has a YAML error on line N."), unknown or wrong selector (names the selector and lists valid views), empty model ("This model has no people or systems yet."). Diagnostics are never shown in embeds unless the embed opts in (`diagnostics: true` comment directive `# diagnostics: true`).

- [ ] **Step 1: Write the failing tests**
  - `the code view renders a UML class diagram with the C4 container kept outside` — outer element has class `uml-c4-diagram-container`; inner SVG contains `EnrollmentRule` and a realization arrow.
  - `the dynamic view renders a UML sequence diagram with organization boxes and an alt fragment`.
  - `the deployment view renders nested nodes with container instances`.
  - `YAML errors, unknown selectors, and empty models render accessible states` (text content and `role="img"` + `aria-label` on the container).
  - Review Focus 3: `names containing --> and } cannot inject UML statements` (sequence view participant count unchanged; label text preserved).
- [ ] **Step 2–5:** run → FAIL, implement, run → PASS, checkpoint.

---

### Task 4: Nested deployment nodes in the UML deployment renderer, describer, and visual editor

**Files:**
- Modify: `js/ArchUML/uml-bundle.js` (deployment renderer section, around lines 21604–22622: verify and fix nested `node { node { … } }` measurement, link projection, and routing; nested node 3D depth per level)
- Modify: `js/uml-auto-describe.js` (deployment parser near lines 583–593: a parent stack instead of a single parent)
- Modify: `js/ArchUML/REFERENCE.md` (lines 7 and 1592–1597: document nested nodes; remove the "outside the supported subset" note)
- Modify: `_includes/uml-editor.html` (visual editor: preserve nested nodes when round-tripping source; refuse to drag an element out of or into a nested node with an explanatory status message)
- Test: `scripts/tests/uml-deployment-nesting.test.js`, existing `scripts/tests/uml-structural-regressions.test.js`, `scripts/tests/uml-behavioral-regressions.test.js`, `tests/uml-renderer.spec.js`, `tests/uml-visual-layout-editor.spec.js`

- [ ] **Step 1: Write the failing tests**
  - `three-level nested nodes parse with correct parents and render each node inside its parent` (`environment > node > node` with a component in the innermost).
  - `links between components in different nested nodes are routed outside unrelated nodes`.
  - `the describer reports containment for every nesting level` (verbose text names `API pod` inside `Campus cloud`).
  - `the visual editor keeps nested node source intact after moving a top-level node`.
  - `C4 deployment text from ArchUMLC4.toUml parses and nests` (the Milestone 1 Task 15 deployment text for the reference model).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run the new test plus `node --test scripts/tests/uml-structural-regressions.test.js scripts/tests/uml-behavioral-regressions.test.js` and `npx playwright test tests/uml-renderer.spec.js tests/uml-visual-layout-editor.spec.js` → all PASS (existing deployment diagrams unchanged). **Step 5:** checkpoint.

---

### Task 5: Bundle stub, registrations, and the lazy completion contract

**Files:**
- Modify: `js/ArchUML/uml-bundle.js`: new `UMLC4Diagram` IIFE after the CRC section; add `c4` to `DIAGRAM_CONTAINER_CLASSES` (~2543), `ARCHUML_FALLBACK_CAPTIONS` (~2574; caption `C4 model diagram`), `DIAGRAM_CONTAINER_SELECTOR` (~2709), `renderAll` `RENDERERS` (~5307) and `DIAGRAM_SELECTORS` (~5349: `pre > code.diagram-c4, pre > code.language-c4`); `createAutoInit('pre > code.diagram-c4, pre > code.language-c4', …, {type: 'c4'})`.
- Test: `js/ArchUML/tests/c4/bundle-stub.test.js` (Node `vm`, pattern of `scripts/tests/uml-homework-grading.test.js`), `scripts/tests/c4-lazy-render.test.js` (Playwright)

**Interfaces:** `UMLC4Diagram = { render(container, text), parse(text), CORE_SCRIPTS }`. `CORE_SCRIPTS` = `manifest.core.concat(manifest.render)`. `parse(text)` returns `ArchUMLC4.load(...)` or `null` when the core is absent (DOM-free). Lazy path per spec §3.3: one memoized promise; scripts injected in order relative to the bundle's `document.currentScript.src` captured at load; accessible loading placeholder; on success re-render pending connected containers whose text is unchanged, then `UMLShared.applySvgAccessibility(container, 'c4', text, brief)`, the nested-SVG accessibility hide, and `UMLShared.autoFitSVG(container)`; on failure an error state with matching `aria-label`.

- [ ] **Step 1: Write the failing tests**
  - `the stub's embedded script list equals manifest.json` (core + render).
  - `parse returns null without the core and a design with it` (vm without and with the manifest scripts).
  - Lazy (Playwright page with only `uml-bundle.js` + `uml-auto-describe.js`): `a C4 fence renders after the scripts load lazily`, `the container gets the described aria-label and the verbose block`, `labels reach paragraph size`, `an overflowing figure becomes keyboard-scrollable (tabindex 0)`, `a failed script load shows an accessible error state` (route the core URL to 404).
- [ ] **Step 2–5:** run → FAIL, implement, run → PASS, checkpoint.

---

### Task 6: Site registrations, loading, includes, and reference documentation

**Files:**
- Modify: `css/uml-diagram.css` (add `.uml-c4-diagram-container` to the four type lists near lines 47–63, 66–92, 99–112, 149–170), `css/print-light.css` (two lists near lines 20–34 and 383–397)
- Create: `_includes/c4-scripts.html` (deferred script tags for `site.data.archuml_c4_manifest.core` + `.render`, emitted before the bundle), `_data/archuml_c4_manifest.json` (symlink → `../js/ArchUML/c4/manifest.json`), `_includes/c4-view.html` (parameters `model`, `view`, `caption`, `description`: emits a ```` ```c4 ```` block with `# caption: …`, `view: …`, then the included `_includes/c4-models/<model>.yml`)
- Modify: `_layouts/sebook.html` and `_layouts/sebook-combined.html` (include `c4-scripts.html` before the bundle when `page.c4` or any combined entry sets it), `_includes/sebook-combined-entry.html` (mirror the flag), `js/se-gym-workout-loader.js` (~114, add `c4` to the type list), `SEBook/tools/uml-reference.md` (type map; set `c4: true`), `js/ArchUML/REFERENCE.md` (new "C4 Model Diagrams" section: embedding, selectors, the minimal schema subset, one example per view type)
- Test: `scripts/tests/c4-site-registration.test.js` (Node: every CSS list containing `uml-crc-diagram-container` also contains `uml-c4-diagram-container`; the `_data` symlink resolves to the manifest; `c4-view.html` output for a model contains exactly one `view:` line)

- [ ] **Step 1: Write the failing test.** **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, then build the site (`bundle exec jekyll build`) and confirm `/SEBook/tools/uml-reference.html` contains C4 figures. **Step 5: Checkpoint.**

---

### Task 7: Static prerender, caches, describer, and content checks

**Files:**
- Modify: `_plugins/uml_static.rb` (add `c4` to `FALLBACK_CAPTIONS` and `DIAGRAM_TYPES`; append the manifest files to the renderer fingerprint inputs and replace `RENDERER_INPUT_PATHS[1]` with a named constant `DRIVER_PATH`; emit `<script type="application/json" data-c4-source>` with the JSON-encoded source, every `<` written as the six-character JSON escape `\u003c` (backslash, `u`, `0`, `0`, `3`, `c`; Ruby `JSON.generate(text).gsub('<') { '\u003c' }`, single-quoted), inside C4 figures)
- Modify: `js/ArchUML/uml_to_svg.js` (inline the manifest scripts in `PAGE_HTML` before the bundle; include them in `RENDERER_HASH`; add `c4` to the renderer map), `js/ArchUML/uml_render.js` (preload the manifest scripts; add `c4`), `js/uml-auto-describe.js` (`fallbackCaption`, `describeModel`, `describeModelVerbose`, `DIAGRAM_SELECTORS` gain `c4`; the c4 branch reads `window.ArchUMLC4` at call time, skips `stripDecorations`/`extractNotationExplanations`, and maps `ArchUMLC4.describe` to `{summary, sections}`), `js/uml-describe-cli.js` (require the core in Node)
- Create: `scripts/tests/c4-description.test.js`, `scripts/tests/c4-content.test.js` (validates every `_includes/c4-models/*.yml` and every ```` ```c4 ```` fence under `SEBook/`: no errors, selectors resolve; passes vacuously only when there are no C4 sources yet and says so in its output)
- Modify: `scripts/tests/uml-static-plugin.test.js` (C4 fenced and data blocks recognized; every manifest file changes both fingerprints; the source element is emitted and decodes to the original text, including a description containing `</script>`)

- [ ] **Step 1: Write the failing tests** (as listed, plus `the describer CLI describes a C4 container view with the brief label from the core`).
- [ ] **Step 2–5:** run → FAIL, implement, run → PASS (`node --test scripts/tests/uml-static-plugin.test.js scripts/tests/c4-description.test.js scripts/tests/c4-content.test.js`), checkpoint.

---

### Task 8: Display, theme, print, and audit verification

**Files:**
- Create: `tests/c4-display.spec.js` (Playwright; pattern of `tests/crc-display.spec.js`)
- Modify: `tests/uml-readable-sizing.spec.js` (add `/SEBook/tools/uml-reference.html#c4-model-diagrams` to its URL list), `tests/diagram-accessibility.spec.js` (C4 type in the describer and `uml_to_svg.js` batch checks), `test-uml.html` (one C4 fence, so the lazy path is exercised on a page without `c4: true`)

- [ ] **Step 1: Write the failing tests** — `C4 figures expose an image role with the described label`, `the verbose description lists elements and relationship sentences`, `labels are at least paragraph size at 320 and 1440 px`, `dark mode inverts the C4 SVG once and keeps baked fills identical` (Review Focus 2: compare `fill` attributes before and after toggling `html.dark-mode`; computed `filter` on nested delegated SVGs is a single invert), `print uses the light palette and fits the page width`, `an overflowing C4 figure is keyboard scrollable`, `the static build and live render produce the same node coordinates`.
- [ ] **Step 2:** run → FAIL. **Step 3:** fix what the tests expose. **Step 4:** run `npx playwright test tests/c4-display.spec.js tests/uml-readable-sizing.spec.js tests/diagram-accessibility.spec.js tests/crc-display.spec.js`, then the WCAG audit on touched routes (`WCAG_AUDIT_URL_FILTER='uml-reference|test-uml' npx playwright test tests/wcag22-complete-audit.spec.js`), then a full sweep (`WCAG_AUDIT_FULL_SWEEP=1 npx playwright test tests/wcag22-complete-audit.spec.js`) and the print audit (`npx playwright test tests/wcag22-print-audit.spec.js`) → all PASS. **Step 5:** checkpoint.

---

## Interface tasks (after Milestone 1b)

Tasks 9–12 render interface descriptions (spec §5.3, §6.1, §6.4 step 5, §6.6, J8, J11, J14). They start once Milestone 1b (`docs/superpowers/plans/2026-11-08-c4-interfaces.md`) is green, and their fixtures are the core's: `course-registration-interfaces.yml` (the spec §4.2 block) and the 1b fixtures `interfaces-shop.yml`, `interfaces-events.yml`, and `interfaces-endpoint.yml`. The Global Constraints above apply (palette-only colours in SVG, one font size, no `style=`, escaping, deterministic layout, hooks). Milestone 2 owns `uml-bundle.js`; per CLAUDE.md, bundle bugs are fixed in the submodule's working tree and reported in the summary.

## Milestone 2b: C4 layout and routing engines (after Task 8, before Task 11)

Five tasks replace the old Task 8b. Each has its own failing tests, its own A/B baseline and its own checkpoint, and none commits.

**Sequencing.** Run 8b-1, 8b-2, 8c-1, 8c-2 and 8c-3 in that order, after Task 8 is green and **before Task 11**. Never run any of them in parallel with Task 11 or with another task that edits `js/ArchUML/uml-bundle.js`: Task 11 changes the component renderer on purpose, and the A/B guard would report its intended changes as regressions.

**Routing tools.** The tools these tasks ran began as session artifacts; the finalization run (Task R) moved them into the repository, and the steps below name them by their repository paths:

- `scripts/tools/c4-routing/ab-compare.js` (first written as `ab-components.js`) — the A/B guard (`snapshot`, `count`, `compare`, with `--corpus component|deployment|c4`); design §10.
- `scripts/tools/c4-routing/render-views.js` — renders the gated C4 views (and the generated landscapes) with a snapshot and writes PNGs and metrics.
- `scripts/tests/c4-route-metrics.js` — the metrics, moved into the repository in Task 8b-2 from the diagnosis tool.
- `scripts/tools/c4-routing/record-place-seeds.js` — records the placement test seeds (Task 8b-2 Step 1).

`scripts/tools/c4-routing/README.md` says how to run each one. In the steps below, `$RR/tools/ab-components.js` and `$RR/tools/render-views.js` stand for those repository tools, and `$RR/baselines/…`, `$RR/img/…` and `$RR/prototype/…` for folders outside the repository; their outputs are not tracked.

**Common Step 0 (every task).** Immediately before the task's first edit:

1. `node $RR/tools/ab-components.js snapshot $RR/baselines/pre-<task>` (for example `pre-8b-1`). Record the printed SHA-256 of `uml-bundle.js` and `manifest.json` in the checkpoint.
2. `node $RR/tools/ab-components.js count`. Expected: `json 45, dataSpec 20, codeBlock 23` (88 in all, counted 2026-11-09), matching the independent count. If content changed since, update `EXPECTED` in the script and these numbers in the task text, and say so in the checkpoint; never lower them to make a run pass.

**Common A/B step (every task).**

- `diff -U0 $RR/baselines/pre-<task>/js/ArchUML/uml-bundle.js js/ArchUML/uml-bundle.js`: zero hunks in 8b-2, 8c-2 and 8c-3; in 8b-1 and 8c-1 exactly one hunk, whose `-` and `+` lines are only lines of the C4 stub's `CORE_SCRIPTS` array.
- `node $RR/tools/ab-components.js snapshot $RR/baselines/post-<task>`, then `node $RR/tools/ab-components.js compare $RR/baselines/pre-<task> $RR/baselines/post-<task> --widths 320,<content width>,1200`, with the content width measured in 8b-1 Step 0.
- Expected output: for both `[live]` and `[static]`, `renders per side` = 88 × widths (live) or 88 (static), `invalid A outputs: 0`, `A/A differences: 0`, `A/B differences: 0`, then `PASS`.

---

### Task 8b-1: C4 placement, part 1 — ranks and order

**Precondition:** Task 8 is green; Task 11 has not started. The user has signed off the spec texts of `design.md` §11 (steps 1, 4, 4a, the §6.5 print sentence with its minimum, and the §17 entry). Read `js/ArchUML/c4/c4-render.js` again, because Task 8 may have changed it.

**Files:**
- Create: `js/ArchUML/c4/c4-place.js` (UMD, publishes `ArchUMLC4Place`, pure and DOM-free, no dependency at all). In this task it exports `CFG`, `rankAndOrder(graph, options)` and the test helpers it needs; `place` follows in 8b-2.
- Create: `js/ArchUML/tests/c4/place-graphs.js` (the test graphs as plain data, shared by `place.test.js` and the seed recorder of 8b-2).
- Modify:
  - `js/ArchUML/c4/manifest.json`: `"render": ["c4/c4-place.js", "c4/c4-render.js"]`.
  - `js/ArchUML/uml-bundle.js`: the C4 stub's `CORE_SCRIPTS` array only; insert `'c4/c4-place.js',` before `'c4/c4-render.js'`.
  - `scripts/tests/c4-render.test.js`: the manifest assertion at line 47 becomes `assert.deepEqual(MANIFEST.render, ['c4/c4-place.js', 'c4/c4-render.js'])`.
  - `scripts/tests/uml-static-plugin.test.js`: add one case that reads the **real** `js/ArchUML/c4/manifest.json` through `readC4Scripts(path.join(REPO, 'js/ArchUML'))` and asserts that `c4/c4-place.js` is listed, before `c4/c4-render.js`. (The existing fingerprint cases use a synthetic manifest and prove only the mechanism.)
  - `docs/superpowers/specs/2026-11-08-c4-model-design.md`: §6.4 steps 1, 4 and 4a, §6.5 and §17, exactly as signed off.
- Test: `js/ArchUML/tests/c4/place.test.js` (node:test, pure, no browser); `js/ArchUML/tests/c4/bundle-stub.test.js` (unchanged; it must stay green with the new stub entry).

**Interfaces:**
- `ArchUMLC4Place.rankAndOrder(graph, options) → { ranks: {id: integer}, order: {levelId: [[id, …] per rank]}, lanes: [{id, edgeId, level, rank}], stats: { layerCrossings } }`, with `graph` and `options` as in `design.md` §3.2. Lane item ids are `lane:<edgeId>:<levelId>:<rank>`.
- Algorithm: `design.md` §4.2–§4.4 (seed reading in TB terms for both directions; people alone on rank 0 of every level that has people; scope pivot; weighted-span sweeps with outside pulls; lane items for long edges; compound order with outside partners as fixed ports, outer–inner–outer; score (crossings, barycentre displacement, displacement from the seed, seed inversions); exhaustive for ≤ 7 movable items, sweeps plus adjacent swaps otherwise; pinned items ordered by their pin's cross coordinate).
- `layoutView` is **not** changed in this task.

- [ ] **Step 0: Baselines and measurements.**
  - Common Step 0 with `pre-8b-1`.
  - `node $RR/tools/render-views.js $RR/baselines/pre-8b-1/js/ArchUML $RR/img/pre-8b-1-`. Compare `$RR/img/pre-8b-1-metrics.json` with `$RR/img/before-metrics.json` and `$RR/img/before-extra-metrics.json`; if Task 8 changed any number, put the new "Before" values into the checkpoint and use them as the baseline.
  - Measure, with Playwright against the served site at a 1280 × 900 viewport: the content column width of `/SEBook/uml_component_diagram.html` (the A/B middle width); and, under `page.emulateMedia({ media: 'print' })` at A4 portrait, the rendered size in pt of the smallest edge-label line of every C4 figure on `/SEBook/tools/uml-reference.html` and `/SEBook/architecture/c4.html`, plus the drawing width P (in diagram units) at which a label would print at 9 pt. Record them in the checkpoint; recompute the width caps of `design.md` §9.3 by its rule with the measured P (only the rule decides; no cap is chosen by hand).
  - **Stability prototype (before any repository edit).** In `$RR/prototype/place-proto.js`, prototype `design.md` §4.3–§4.5 far enough to place the two models of the Task 2 gate `one added element moves unrelated elements by at most 200 units` (the reference model, and the same model with `cache` added under `api`, as built in `scripts/tests/c4-layout.test.js` lines 325–343), using box sizes from `layoutView` on the snapshot. Record the movement of every unrelated element in `$RR/prototype/stability.md`. If any moves more than 200, **stop** and bring the numbers and the two rendered placements to the user; do not loosen the gate.
- [ ] **Step 1: Write the failing tests** in `place.test.js`. Every graph lives in `place-graphs.js`. Boxes are 300 × 120 and edges unlabelled (0 × 0) unless stated; `seed: null` unless stated. Every call receives a recursively `Object.freeze`d graph.
  - `people take rank 0 even in a view without a scope`: person `p`; elements `a`, `m`; edges `p→a`, `m→p`; `scopeId: null`. Assert `ranks.p === 0`, `ranks.a >= 1`, `ranks.m >= 1`.
  - `an item with no incoming edge ranks as low as its successors allow`: edges `a→b`, `b→c`, `d→c`. Assert `ranks.d === ranks.b` (today's top-anchor row would give 0).
  - `a long edge gets one lane item per intermediate rank`: edges `a→b`, `b→c`, `a→c`. Assert exactly one lane `lane:a→c:root:1` (edge id as declared), placed in `order.root[1]`.
  - `the order with no crossings is found when one exists`: items declared `a, b, c, x, y, z` (view-model order); edges `a→z`, `b→y`, `c→x`. Assert, for every pair of edges (s1→t1, s2→t2), `Math.sign(idx(s1) − idx(s2)) === Math.sign(idx(t1) − idx(t2))`, where `idx` is the position in `order.root`. Assert `stats.layerCrossings === 0`, and that a crossing count the test computes itself from `order` is 0.
  - `among equally good orders the one nearest the seed wins`: `p` above `x`, `y`, `z`; edges `p→x`, `p→y`, `p→z`; seed `{p: {x: 390, y: 0}, z: {x: 0, y: 300}, x: {x: 390, y: 300}, y: {x: 780, y: 300}}`. Assert `order.root[1]` deep-equals `['z', 'x', 'y']`.
  - `outside partners order a boundary's members`: scope `s` holding `m1`, `m2` (declared in that order, one inner rank); outside people `u1`, `u2` declared in that order; edges `u1→m2`, `u2→m1`. Assert `order.s[0]` deep-equals `['m2', 'm1']`, and `order.root` holds `s` as one item.
  - `a pinned item is ordered by its pin`: `a`, `b` in one rank (declared in that order); `pins: new Map([['b', [-400, 0]]])`. Assert `order.root[0]` deep-equals `['b', 'a']`.
  - `ranking and order ignore object key order and id spelling`:
    - Items declared `'10'` then `'2'` in one rank, no edges. Assert `order.root[0]` deep-equals `['10', '2']`.
    - Metamorphic: take the crossing graph above, rename every id through a bijection that reverses lexical order (`a→'z9'`, `b→'y8'`, `c→'x7'`, `x→'3'`, `y→'20'`, `z→'100'`), keep view-model order, run, map the result back, and assert it deep-equals the unrenamed result.
    - Two calls on the same frozen graph deep-equal.
  - `c4-place.js loads without the bundle`: run only `c4-place.js` in a fresh `vm` context; assert `typeof ArchUMLC4Place.rankAndOrder === 'function'`.
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/place.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement** `rankAndOrder` per `design.md` §4.2–§4.4; add the manifest and stub entries; update `c4-render.test.js` and `uml-static-plugin.test.js`; apply the signed-off spec text.
  - No `Math.random`; arrays and `Map`s only; every comparator ends in view-model index, then id; never mutate the input.
- [ ] **Step 4: Run** → all PASS: `node --test js/ArchUML/tests/c4/*.test.js scripts/tests/c4-render.test.js scripts/tests/c4-lazy-render.test.js scripts/tests/uml-static-plugin.test.js scripts/tests/c4-layout.test.js`, then `npx playwright test tests/c4-display.spec.js`.
- [ ] **Step 5: Common A/B step** (one `CORE_SCRIPTS` hunk).
- [ ] **Step 6: Checkpoint.** Baseline hashes, measured content width and print sizes, recomputed caps, the stability prototype's numbers; note that the `js/ArchUML` submodule changed (new `c4/c4-place.js`, manifest, stub list), so there are two repositories to commit. No commit.

---

### Task 8b-2: C4 placement, part 2 — straight-edge coordinates, corridors, direction, wiring

**Precondition:** Task 8b-1 is green and the stability prototype stayed within 200.

**Files:**
- Modify: `js/ArchUML/c4/c4-place.js` (`place`, `frameExtents`, the coordinate solver, corridor and gap budget, pins and settle).
- Modify: `js/ArchUML/c4/c4-render.js`:
  - extract today's `arrangeLevel`/`assignPositions` seeding into an exported `seedPositions(graph)` with unchanged behaviour;
  - `layoutView` places through `ArchUMLC4Place.place` (resolved at call time, never at script load), passes `viewModel.direction` and `options.pins`, and still routes with the current `routeEdges`/`placeLabels`;
  - move `separateSiblings`/`settleLevel`/`applyPins` into `c4-place.js` with unchanged behaviour;
  - in the Node branch of the UMD wrapper, `require('./c4-place.js')`.
- Create fixtures:
  - `js/ArchUML/tests/c4/fixtures/campus-landscape.yml`, with exactly this content:

    ```yaml
    schema: c4-design/1
    name: Campus Landscape
    description: A generated landscape with eight systems and twelve relationships.
    enterprise: UCLA

    people:
      student:
        name: Student
        description: Plans a term and pays tuition.
        collaborators:
          registration: plans a schedule using
          lms: submits coursework to
      advisor:
        name: Academic Advisor
        description: Approves exceptions to enrollment rules.
        collaborators:
          registration: approves petitions in

    systems:
      registration:
        name: Course Registration
        description: Plans term schedules and enrolls students in their sections.
        collaborators:
          billing: requests tuition charges from
          sis: reads academic records from
          identity: signs students in through
          scheduling: reads section times from
      billing:
        name: Billing System
        description: Charges tuition and fees for the university.
        external: true
        collaborators:
          payments: settles card payments through
      sis:
        name: Student Information System
        description: Keeps every student's academic record.
        collaborators:
          identity: checks staff sign-ins with
      lms:
        name: Learning Management System
        description: Hosts course sites and coursework.
        collaborators:
          registration: reads class rosters from
          identity: signs users in through
      identity:
        name: Campus Identity
        description: Signs students and staff in.
      scheduling:
        name: Room Scheduling
        description: Assigns rooms and times to sections.
      payments:
        name: Payment Provider
        description: Processes card payments.
        external: true
        in_enterprise: false
      mail:
        name: Campus Mail
        description: Delivers notifications by email.
        external: true
        collaborators:
          student: sends enrollment notices to
    ```
  - `shop.yml`, `two-groups.yml` and `boundary-landing.yml`: the three inline models moved out of `scripts/tests/c4-layout.test.js` verbatim, which now reads them with `fs`.
  - `js/ArchUML/tests/c4/fixtures/place-seeds.json`: recorded in Step 1 (below), never edited by hand.
- Create: `scripts/tests/c4-route-metrics.js`, moved from `$RR/tools/metrics.js` and rewritten to the definitions of `design.md` §5.0 and §9.2. It reads only the view model and the layout, never imports `c4-route.js` or `c4-place.js`, and writes every threshold as a literal.
- Create: `scripts/tests/c4-route-metrics.test.js` (node:test, pure).
- Test: `js/ArchUML/tests/c4/place.test.js`; `scripts/tests/c4-layout.test.js`.

**Interfaces:** `ArchUMLC4Place.place(graph, options) → placement` exactly as `design.md` §3.2 (including `corridorExtra`, corridor ids, `centreAligned`, `straightCapable`, `labelSlots`, `stats`). `ArchUMLC4Place.frameExtents(inner, labelWidth, labelHeight, direction)`. All coordinates are integers; `CFG` is frozen and holds every placement constant of `design.md` §3.3.

- [ ] **Step 0:** Common Step 0 with `pre-8b-2`.
- [ ] **Step 1: Record seeds.** After extracting `seedPositions` (a pure refactor; `c4-layout.test.js` must still pass unchanged), write `$RR/tools/record-place-seeds.js`: it loads the working tree's bundle and C4 scripts in Chromium, calls `ArchUMLC4Render.seedPositions(graph)` for every graph in `place-graphs.js`, and writes `place-seeds.json`. Run it once.
- [ ] **Step 2: Write the failing tests.**
  - `place.test.js` (frozen inputs; every graph runs twice, with `seed: null` and with its recorded seed, and the assertions must hold for both, except where a test names one):
    - `people sit above every other box`: the 8b-1 person graph. Assert `boxes.p.y + boxes.p.height < Math.min(boxes.a.y, boxes.m.y)`.
    - `a one-to-one edge shares a centre line`: `a` 300 wide, `b` 180 wide; edge `a→b`; recorded seed and also the explicit seed `{a: {x: 0, y: 0}, b: {x: 400, y: 300}}`. Assert `a.x + a.width/2 === b.x + b.width/2`, `b.x !== a.x` (b moved off its left-justified position), and the edge is in both `centreAligned` and `straightCapable`.
    - `a fan-out centres its children under the parent and keeps both straight`: edges `p→c1`, `p→c2`. For each child, assert the x-overlap with `p` is `>= 88`; assert `p.x + 150 === (c1.x + c2.x + 300) / 2`; assert both edges in `straightCapable` and `centreAligned` empty.
    - `two parents share a child: both straight when the gap allows, exactly one when it does not`: `a`, `b` in one rank (declared in that order), `c` below; edges `a→c`, `b→c`.
      - First call: assert `boxes.c.x - boxes.a.x` lies in `[178, 212]`, both edges in `straightCapable`, `centreAligned` empty, no overlap between `a` and `b`.
      - Find the corridor with `kind === 'gap'` and `between` deep-equal `['a', 'b']` in the first placement; call again with `corridorExtra: new Map([[thatId, 300]])`. Assert `boxes.b.x - (boxes.a.x + 300) === 390`; exactly one of the two edges in `straightCapable`; the other edge's x-overlap `< 88`; no overlap between any two boxes.
    - `a member aligns with an outside person across its boundary, and the line stays clear`: person `u` 200 wide outside; scope `s` holding `m1`, `m2` (300 wide); edges `u→m2`, `m1→m2`; `m2` ranks below `m1`; `scopeId: 's'`; explicit seed with `m1` and `m2` both at x 0 (left-justified `m2` would sit under `m1`) and `u` at x 0. Assert: centres of `u` and `m2` equal; `u→m2` in `centreAligned`; the vertical line at `x = centre(u)` from `u`'s bottom to `m2`'s top does not intersect `m1` inflated by 20 on every side; `m1→m2` in `straightCapable`; `m1`, `m2` inside `boundaries.s` with at least 30 on every side; no two boxes overlap.
    - `the container-view shape keeps both lower edges straight and clear`: person `student`; scope `reg` holding `web`, `api`, `db` (one per inner rank); external `billing` outside below; edges `student→web`, `web→api`, `api→db`, `api→billing`, every label 308 × 86. Assert `api→db` and `api→billing` both in `straightCapable`; the planned straight coordinate `labelSlots['api→billing'].cross` lies at least 20 outside `db`'s x-range; the vertical line at that coordinate from `api`'s bottom to `billing`'s top does not intersect `db` inflated by 20.
    - `a fan-out plans its labels on opposite sides and budgets one level`: edges `p→c1`, `p→c2` with labels 308 × 86. Assert `{labelSlots['p→c1'].position, labelSlots['p→c2'].position}` equals `{'before', 'after'}` with the left edge's label `before`; assert the gap between `p`'s bottom and the children's top lies in `[142, 166]` (86 + 8 + 18 + 30, one level, no jog track, plus at most one trackPitch).
    - `extra room in a corridor moves only the ranks after it`: chain `a→b→c`; `pins: new Map([['c', <c's position from a first call>]])`. Second call with `corridorExtra: new Map([['root|main|0', 100]])`. Assert `a` did not move, `b.y` grew by exactly 100, and `c` kept its pin with `pinAdjusted === false` unless it now overlaps (then `true`). *(Superseded 2026-11-11, polish round: `c` keeps its pin with `pinAdjusted === false`; `b` grows by 100 unless that brings it within the box clearance of `c`, and then it makes room and stops just above `c`.)*
    - `pinned items keep their pin and never move for alignment`: edge `a→b`; pins `b: [700, 400]`. Assert `[b.x, b.y]` deep-equals `[700, 400]`, `b.pinAdjusted === false`, and the centres of `a` and `b` are equal (`a` moved, not `b`).
    - `a pin on the far side of a rank-mate is ordered by its coordinate and settles without error`: `a`, `b` in one rank (declared `a, b`); pins `b: [-400, 0]`. Assert no exception, `b` at its pin, no overlap.
    - `an infeasible pin is released to the settle step`: `a`, `b` in one rank; pins `a: [0, 0]`, `b: [100, 0]`. Assert no exception, `stats.pinsReleased === 1`, `a` at its pin, no overlap, and the released box has `pinAdjusted === true`. *(Superseded 2026-11-11: the final review's I1 fix removed the pinned placement pass and with it `stats.pinsReleased`; pins are applied after placement and settled (routing redesign §4.7). The test is now `a box pinned onto another settles just below it and is marked pin adjusted` and asserts `a` at its pin, `b` just below it with `pinAdjusted === true`, and no overlap.)*
    - `direction right turns the flow sideways`: the person graph with `direction: 'right'`. Assert `p.x + p.width < Math.min(a.x, m.x)` and the edge `p→a` has equal centre y. For a scope `s` holding one member, assert `boundaries.s.width >= labelWidth(s)` and `boundaries.s.height >= member.height + 2 * 30 + labelHeight(s)` (the label adds to the cross extent in the right frame).
    - `placement ignores object key order and id spelling`: items `'10'` then `'2'` in one rank: `boxes['10'].x < boxes['2'].x`; the metamorphic rename of 8b-1 on the container-view shape gives identical coordinates after mapping back; two calls deep-equal.
  - `c4-route-metrics.test.js`, known-answer fixtures, thresholds as literals in the test:
    - one proper crossing counts 1; a route passing through another's bend counts 1; a T-touch counts as 1 touch and 0 crossings; a collinear overlap of length 10 counts.
    - a label 6 from its own route is attached, at 7 detached; a foreign route at 11 makes it ambiguous, at 12 not.
    - two ends on a 300 side with n = 2 at 89 apart are stacked (minimum 90), at 90 not; with n = 4 at 59 stacked, 60 not.
    - a segment parallel to a boundary line at 29 with overlap 3 hugs; at 30, or with overlap 2, it does not.
    - the §5.0 classes on hand-built boxes: upward, sameRank, blocked (with the blocker's half-extent), boundaryEntry, exempt, maxBends, detourCap.
    - `straightBand` (the predicate `straightCapable` and avoidable bends share): overlap 88 with a clear band is straight-capable; the same with a box in the band is not.
  - `c4-layout.test.js`:
    - The existing seven `GOLDEN_VIEWS` keep every gate (the old router still draws them).
    - New `PLACEMENT_VIEWS`, gated only on placement (no overlap, containment, people above, pins, width independence) because the old router still draws them:
      - `['campus landscape', CAMPUS_LANDSCAPE, 'landscape']`;
      - `['booking containers', BOOKING, 'containers of booking']`, `['booking components', BOOKING, 'components of api']`, `['booking landscape', BOOKING, 'landscape']`;
      - `['database-as-system context', DBSYS, 'context of registration']`;
      - `['flaw: unlabeled uses', UNLABELED, 'containers of registration']`, `['flaw: backend box', BACKEND, 'containers of registration']`;
      - `['starter context', STARTER, 'context of booking']`, `['starter landscape', STARTER, 'landscape']`;
      - `['container view laid out to the right', REFERENCE_MODEL + RIGHT_VIEW, 'wide']`, with `RIGHT_VIEW = '\nviews:\n  wide:\n    view: containers of registration\n    direction: right\n'`;
      - `['booking components, pinned', BOOKING, 'components of api', { pins: [['finder', [1000, 373]], ['catalog', [30, 1129]]] }]`.
      - Models are read with `fs` from `_includes/c4-models/` (`campus-booking-suggested.yml`, `campus-booking-starter.yml`, `flaws/database-as-system.yml`, `flaws/unlabeled-uses.yml`, `flaws/backend-box.yml`) and the fixtures folder.
    - `people are above every other box (<view>)`, for every golden and placement view: for every person and every non-person node, `person.y + person.height < other.y`.
    - `direction right puts people left of the scope and dependencies right of it` (view `wide`): `student.x + student.width < registration.x` and `billing.x > registration.x + registration.width`.
    - `every edge of the reference container view is straight-capable`: for `student→web`, `web→api`, `api→db`, `api→billing`, `straightBand` from `c4-route-metrics.js` reports an overlap ≥ 88 with a clear band.
    - `members align with their outside partners across the scope boundary` (reference container view): `centre(student).x === centre(web).x`.
    - `recorded seeds still match the seed function`: in Chromium, `seedPositions(graph)` for every `place-graphs.js` graph deep-equals `place-seeds.json`.
    - The stability gate (`one added element moves unrelated elements by at most 200 units`) stays as it is.
- [ ] **Step 3: Run** `node --test js/ArchUML/tests/c4/place.test.js scripts/tests/c4-route-metrics.test.js scripts/tests/c4-layout.test.js`. Expected: the new tests FAIL; the existing gates pass; record any placement gate that fails on a new view with the current layout.
- [ ] **Step 4: Implement** `place` per `design.md` §4.1–§4.7 and wire it into `layoutView`. Do not touch routing or labels. No `Math.random`; integers after every pass; never mutate the input.
- [ ] **Step 5: Run** the Step 3 command plus `node --test js/ArchUML/tests/c4/*.test.js scripts/tests/c4-render.test.js scripts/tests/c4-lazy-render.test.js scripts/tests/uml-static-plugin.test.js` → all PASS; then `npx playwright test tests/c4-display.spec.js` → PASS.
- [ ] **Step 6: Common A/B step** (zero bundle hunks).
- [ ] **Step 7: Checkpoint.** `node $RR/tools/render-views.js $RR/baselines/post-8b-2/js/ArchUML $RR/img/after-8b-2-` (after adding the `wide` view to its list); keep the images and metrics. Report the submodule change. No commit.

---

### Task 8c-1: C4 routing, part 1 — ends, candidates, filters, global selection

**Precondition:** Task 8b-2 is green.

**Files:**
- Create: `js/ArchUML/c4/c4-route.js` (UMD, publishes `ArchUMLC4Route`, DOM-free). It resolves `UMLShared` only inside `route` (from `options.shared`, else `root.UMLShared`) and never writes to it; it loads in a bare `vm` context and under Node `require`.
- Create: `scripts/tests/c4-route-quality.test.js` (node:test plus Playwright Chromium, the pattern of `c4-layout.test.js`).
- Modify:
  - `js/ArchUML/c4/manifest.json`: `"render": ["c4/c4-place.js", "c4/c4-route.js", "c4/c4-render.js"]`.
  - `js/ArchUML/uml-bundle.js`: stub `CORE_SCRIPTS` only; insert `'c4/c4-route.js',` after `'c4/c4-place.js',`.
  - `scripts/tests/c4-render.test.js`: `assert.deepEqual(MANIFEST.render, ['c4/c4-place.js', 'c4/c4-route.js', 'c4/c4-render.js'])`.
  - `scripts/tests/uml-static-plugin.test.js`: the real-manifest case also expects `c4/c4-route.js`.
  - `js/ArchUML/c4/c4-render.js`: `layoutView` routes through `ArchUMLC4Route.route` (resolved at call time) and keeps the old `placeLabels` for labels; delete `facingSides`, `edgeAnchors`, `sideAnchor`, `routeObstacles`, `routeAround`, `routeEdges` and any helper left unused; the Node UMD branch `require`s `./c4-route.js`.
  - `scripts/tests/c4-layout.test.js`: the `PLACEMENT_VIEWS` also get the route gate `no route passes through a box that is not one of its endpoints or their ancestors`.
- Test: `js/ArchUML/tests/c4/route.test.js` (node:test; loads `uml-bundle.js` in a `vm` context as `bundle-stub.test.js` does, then `c4-route.js`).

**Interfaces:** `ArchUMLC4Route.route(scene, options) → routed` and `ArchUMLC4Route.classify(scene, edgeId)` exactly as `design.md` §3.2; `ArchUMLC4Route.CFG` frozen with the routing constants of §3.3. In this task `labelBox` comes from the old `placeLabels`, and `growth` is always empty.

- [ ] **Step 0:** Common Step 0 with `pre-8c-1`.
- [ ] **Step 1: Write the failing tests.**
  - `route.test.js`. Scenes are hand-built and frozen, boxes 300 × 120 at the stated top-left corners, `direction: 'down'`, unlabelled edges. Every oracle is computed in the test from `points` and the scene with the helpers of `c4-route-metrics.js`; router-reported fields are only compared with the computed values.
    - `a straight route wins whenever the two boxes overlap`: `a` (0, 0), `b` (100, 300), edge `a→b`. Assert `points.length === 2`, `points[0].x === points[1].x`, `points[0].x` in `[124, 276]`, and computed bends 0 (equal to the reported `bends`).
    - `a crossing-free route beats a crossing one at equal bends`: `a` (0, 0), `b` (0, 300) with edge `a→b`; `c` (390, 0), `d` (−390, 600) with edge `c→d`. Precondition: a Z for `c→d` with its jog at the mid-line of the corridor between `a` and `b` (y = 210) would cross `a→b`. Assert: `c→d` has computed bends 2, crossings 0 with `a→b`, detour 0, and its horizontal segment lies below `b` (y > 420).
    - `a crossing is taken when avoiding it needs a long detour`: `s1` (0, 0) → `t1` (600, 400) and `s2` (600, 0) → `t2` (0, 400). The two edges' ends interleave around the band between the rows, so every pair of monotone routes crosses once, and a crossing-free route for either edge must leave that band (a detour of about 450 or more). Precondition: `classify` reports neither edge exempt (detour cap 0). Assert: computed crossings 1, both detours 0, both edges ≤ 2 bends, no `fallbackRoute`.
    - `fan-in spreads its heads over two sides and keeps their order`: sources `s1`..`s4` at (0, 0), (390, 0), (780, 0), (1170, 0); target `t` at (585, 400); edges `s_i→t`. Assert: heads on `t`'s top side ≤ 2, the other heads on `t`'s left and right sides (`s1` left, `s4` right); along every side, sorted end coordinates differ by `>= Math.max(60, side / (n + 1) - 10)`; top-side head x-order equals the sources' x-order.
    - `no segment runs inside a boundary's band`: boundary `B` (20, 200, 360 × 180) holding member `m` (50, 230); person `p` (600, 0) outside; edge `p→m`. Precondition: the route has ≥ 1 bend (`p` is outside `m`'s x-range). Assert: for every segment parallel to a side of `B`, distance ≥ 30 or overlap ≤ 2; the outline of `B` is crossed exactly once.
    - `an entering edge crosses the boundary line once`: boundary `B` (0, 200, 360 × 500) holding `m1` (30, 230) and `m2` (30, 550); caller `c` (30, 0); edge `c→m2`. Precondition: `classify` reports `boundaryEntry` and `exempt`. Assert: outline crossings 1; bends ≤ 4; detour ≤ the computed cap.
    - `an upward edge goes straight up when nothing blocks it`: `s` (0, 400), `t` (0, 0), edge `s→t`. Precondition: `classify(...).upward`. Assert: 2 points, detour 0, the route starts on `s`'s top side and ends on `t`'s bottom side.
    - `blocked upward edges nest their lanes`: `s` (0, 1200), unrelated `k` (0, 800), `t1` (0, 400), `t2` (0, 0); edges `s→t1`, `s→t2`. Precondition: both `upward` and `blocked`. Assert: each edge's bends ≤ 4 and detour ≤ its cap; the two routes do not cross; if both lanes lie on the same side, the `s→t1` lane lies between the boxes and the `s→t2` lane.
    - `routing is deterministic, does not mutate its input, and does not touch UMLShared`: two calls deep-equal; the frozen scene is accepted; the metamorphic id rename of 8b-1 gives identical points after mapping back; `Object.keys(UMLShared)` and every function identity in it are unchanged after the calls.
  - `c4-route-quality.test.js`, with `const m = analyse(view, layout)` from `c4-route-metrics.js`, over the 17 views of `design.md` §9.3 (the seven golden views, the placement views, and the pinned view with its own budgets):
    - `crossings and bends meet the budget (<view>)`: computed crossings `=== <Crossings>` (pinned: `<=`), computed total bends `<= <Bends ≤>`, touches 0.
    - `bends and detours per edge stay within the limits (<view>)`: for every edge, computed bends `<= maxBends(e)` and computed detour `<= detourCap(e)`, with both limits computed by the metrics module's own §5.0 classes from the view model and final boxes; total detour `<=` the view's budget; `classify` agrees with the metrics classes on every edge.
    - `no avoidable bend (<view>)`: `m.avoidableBends === 0`.
    - `route ends are spread (<view>)`: end spacing 0 violations, ends per side ≤ 4, heads per side ≤ 2, sides used (Booking Ledger and Room Catalog in booking components; Campus Identity and Course Registration in the campus landscape), crowded approaches 0, over ends 0, short approaches 0.
    - `edges respect boundaries (<view>)`: boundary-hugging 0 (every boundary line), excess boundary crossings 0.
    - `routes stay apart (<view>)`: close parallels 0.
    - `no fallback route (<view>)`: every `fallbackRoute` false and `stats.fallbackRoutes === 0`.
    - `the views together need at most 42 bends and no crossing` (the 17 rows without the pinned view).
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/route.test.js scripts/tests/c4-route-quality.test.js` → FAIL. Record the failing numbers per view (they should match the "Before" columns).
- [ ] **Step 3: Implement** `c4-route.js` per `design.md` §5, wire it into `layoutView`, delete the replaced functions.
  - If a threshold proves unattainable, **stop**. Save the evidence `design.md` §9.4 accepts (for crossings: an `exhaustivePairs` run over the involved edges, with their candidate sets and an annotated image; or a planarity argument) under `$RR/evidence/` and ask the user. Never loosen a threshold silently; a positive bilayer minimum is not evidence.
- [ ] **Step 4: Run** → PASS: `node --test js/ArchUML/tests/c4/*.test.js scripts/tests/c4-layout.test.js scripts/tests/c4-route-quality.test.js scripts/tests/c4-route-metrics.test.js scripts/tests/c4-render.test.js scripts/tests/c4-delegation.test.js scripts/tests/c4-lazy-render.test.js scripts/tests/uml-static-plugin.test.js`; then `npx playwright test tests/c4-display.spec.js tests/uml-renderer.spec.js`.
- [ ] **Step 5: Common A/B step** (one `CORE_SCRIPTS` hunk).
- [ ] **Step 6: Checkpoint.** `node $RR/tools/render-views.js $RR/baselines/post-8c-1/js/ArchUML $RR/img/after-8c-1-`; before/after route metrics side by side; report the submodule change. No commit.

---

### Task 8c-2: C4 routing, part 2 — labels on their edges, growth

**Precondition:** Task 8c-1 is green.

**Files:**
- Modify: `js/ArchUML/c4/c4-route.js` (label positions, joint choice, label conflicts in the selection, `growth`, `noGrowth`, `labelFallback`).
- Modify: `js/ArchUML/c4/c4-render.js`: `layoutView` takes labels from `route`, runs at most 2 growth rounds (`corridorExtra` += growth; corridors that would move a pinned box go into `noGrowth`), and deletes `labelSeeds`, `labelCandidates`, `placeLabels` and any helper left unused.
- Modify: `scripts/tests/c4-layout.test.js`: the `PLACEMENT_VIEWS` also get the label gate `edge labels do not overlap boxes or other labels`.
- Test: `js/ArchUML/tests/c4/route.test.js`; `scripts/tests/c4-route-quality.test.js`.

- [ ] **Step 0:** Common Step 0 with `pre-8c-2`.
- [ ] **Step 1: Write the failing tests.** Every distance is computed by the test (axis-aligned rect-to-segment distance), thresholds as literals.
  - `route.test.js`, labels 308 × 86 unless stated:
    - `a fan-out of three keeps every label on its own edge`: `p` (390, 0); children `c1` (0, 400), `c2` (390, 400), `c3` (780, 400); edges `p→c_i`. Assert: no `labelFallback`; every label ≤ 6 from its own route and ≥ 12 from every other route; no label overlaps a box or another label (pad 8).
    - `a fan-in of four with side heads keeps every label on its own edge`: the 8c-1 fan-in scene with labels. Same assertions; precondition: at least one head is on a side of `t`.
    - `two close straight edges label outward`: source `a` (0, 0); targets `b1` (−195, 400) and `b2` (195, 400); edges `a→b1`, `a→b2`. Their straight bands are x ∈ [24, 81] and [219, 276], so two straight routes lie 138–252 apart (about 150 in practice). Precondition: both routes are straight. Assert both labels are beside their route on the outer side (`a→b1` left, `a→b2` right), ≤ 6 from their own route and ≥ 12 from the other route.
    - `a bundle of three keeps every label unambiguous`: `a` (0, 0), `b` (0, 400); edges `a→b`, `b→a`, `a→b` (three distinct ids). Assert: ambiguous labels 0 (computed), no label of a bundle member is centred on its route, and the third member runs outside both boxes' x-range.
    - `a label that does not fit asks for growth on the flow axis`: `a` (0, 0), `b` (0, 180) (a 60-unit corridor), corridor `{id: 'root|main|0', kind: 'rank', axis: 'main', from: 120, to: 180}`, edge `a→b`. Assert `growth` has exactly one entry, `{corridorId: 'root|main|0', axis: 'main'}`, with `by` in `[82, 106]` (86 + 8 + 18 + 30 − 60, plus at most one trackPitch).
    - `a label squeezed across the flow asks for growth on the cross axis`: three source boxes 120 wide at x 0, 160, 320 and three targets under them (each 1:1, straight), gap corridors `root|cross|0|s1|s2` and `root|cross|0|s2|s3` in the scene. Assert `growth` names both gap corridors with `axis: 'cross'` and `by` in `[6, 30]`.
    - `when growth is not allowed the label stays on its edge`: the 60-unit scene with `noGrowth: ['root|main|0']`. Assert `labelFallback === true`, `growth` empty, the label ≤ 6 from its own route.
  - `c4-route-quality.test.js`, every view of 8c-1:
    - `labels name their own edge (<view>)`: detached 0, ambiguous 0, label overlaps 0, no `labelFallback`, `stats.labelFallbacks === 0`.
    - the route gates of 8c-1 still hold after growth.
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/c4/route.test.js scripts/tests/c4-route-quality.test.js` → the new tests FAIL.
- [ ] **Step 3: Implement** `design.md` §6 and the growth loop. Threshold policy as in 8c-1.
- [ ] **Step 4: Run** the 8c-1 Step 4 commands → PASS.
- [ ] **Step 5: Common A/B step** (zero bundle hunks).
- [ ] **Step 6: Checkpoint.** `render-views.js` to `$RR/img/after-8c-2-`; before/after label metrics; report the submodule change. No commit.

---

### Task 8c-3: C4 routing, part 3 — full quality gates, generated views, performance, display, print, A/B

**Precondition:** Task 8c-2 is green.

**Files:**
- Modify: `scripts/tests/c4-route-quality.test.js` (size, hygiene, generated views, performance).
- Modify: `scripts/tests/c4-layout.test.js`: `layout ignores container width` compares the complete SVG `outerHTML` at 320 and 1400 px for every golden and placement view, keeping the node-transform comparison as the first, readable assertion.
- Modify: `tests/c4-display.spec.js`: add `/SEBook/architecture/c4.html` to `PAGES` (with its C4 figure count); `static build and live render produce the same node coordinates` also compares the complete SVG `outerHTML` of every C4 figure on `/SEBook/tools/uml-reference.html` and `/SEBook/architecture/c4.html`; add the print-size check.
- Modify: `tests/uml-readable-sizing.spec.js`: add `/SEBook/architecture/c4.html` to `READABILITY_URLS`.
- No change to `js/ArchUML/`.

- [ ] **Step 0:** Common Step 0 with `pre-8c-3`.
- [ ] **Step 1: Write the failing tests.**
  - `c4-route-quality.test.js`:
    - `the drawing stays within its size caps (<view>)`: `layout.width` and `layout.height` ≤ the caps of `design.md` §9.3 as recomputed in 8b-1 Step 0.
    - `the SVG has no style attributes, one font size and palette fills (<view>)`, for every view and every generated view: `renderView` output has no `[style]` and no `<style>`; every `<text>` has `font-size="20"`; every edge-label `<rect>` fill is one of the baked palette values exported by `c4-render.js`.
    - `generated views keep every zero gate` (one test per seed): `generatedLandscape(seed, size)` for seeds 1–10 at 10–15 elements. First assert the model's shape and the SHA-256 of its sorted edge list against the values the test pins (a generator change must be visible). Then: every zero gate of `design.md` §9.2 (heads per side ≤ 3); computed crossings ≤ `placement.stats.layerCrossings`, which the test re-counts itself from `placement.ranks` and `placement.order`; total bends ≤ Σ(0 if straight-capable at final positions, else 2) + 2; people above; two runs deep-equal.
    - `the 40-element view meets every zero gate`: `generatedLandscape(7, 40)` (4 people; 26 internal systems in 3 groups; 6 externals; 60 edges): shape and checksum pinned; the same gates.
    - `the 40-element view lays out fast`, in its own test with nothing else in the page: run `layoutView` 3 times, assert the median `<= 1500` ms and log it (design budget 250 ms; above 400 ms needs a note in the checkpoint).
  - `c4-layout.test.js`: the full-SVG width-independence comparison above.
  - `c4-display.spec.js`:
    - the existing 320 px label-size, keyboard-scroll, dark-filter and print-fit tests now also run on `/SEBook/architecture/c4.html`;
    - full-SVG static == live for every C4 figure on both pages;
    - `printed labels stay readable`: under print emulation at A4 portrait, the smallest edge-label line of every C4 figure on both pages is ≥ min(9 pt, the value measured for that figure in 8b-1 Step 0); the per-figure values are written into the test as literals.
  - `uml-readable-sizing.spec.js`: the chapter page in `READABILITY_URLS`.
- [ ] **Step 2: Run** `node --test scripts/tests/c4-route-quality.test.js scripts/tests/c4-layout.test.js` and `npx playwright test tests/c4-display.spec.js tests/uml-readable-sizing.spec.js` → record which new tests fail. Size or print failures are threshold findings: apply the threshold policy, never loosen silently.
- [ ] **Step 3: Fix** what the new gates found, in `c4-place.js`/`c4-route.js`/`c4-render.js` only.
- [ ] **Step 4: Run** → PASS:
  - `node --test js/ArchUML/tests/c4/*.test.js scripts/tests/c4-layout.test.js scripts/tests/c4-route-quality.test.js scripts/tests/c4-route-metrics.test.js scripts/tests/c4-render.test.js scripts/tests/c4-delegation.test.js scripts/tests/c4-lazy-render.test.js scripts/tests/uml-static-plugin.test.js scripts/tests/uml-structural-regressions.test.js scripts/tests/uml-behavioral-regressions.test.js`;
  - then `npx playwright test tests/c4-display.spec.js tests/uml-readable-sizing.spec.js tests/diagram-accessibility.spec.js tests/uml-renderer.spec.js tests/uml-visual-layout-editor.spec.js`;
  - then `WCAG_AUDIT_URL_FILTER='uml-reference|test-uml|architecture/c4' npx playwright test tests/wcag22-complete-audit.spec.js` and `npx playwright test tests/wcag22-print-audit.spec.js`.
- [ ] **Step 5: Common A/B step** (zero bundle hunks); additionally run `compare $RR/baselines/pre-8b-1 $RR/baselines/post-8c-3` and expect `PASS` (the whole milestone leaves every component diagram byte-identical).
- [ ] **Step 6: Checkpoint.**
  - `node $RR/tools/render-views.js $RR/baselines/post-8c-3/js/ArchUML $RR/img/after-8c-3-`.
  - Put the before and after metrics tables side by side (every column of `design.md` §9.3, plus sizes, print sizes and the 40-element timing).
  - Report that the `js/ArchUML` submodule changed (two new files, manifest, stub list, `c4-render.js`), so there are two repositories to commit.
  - No commit.

Design (binding for Tasks 8b-1 to 8c-3): docs/superpowers/specs/2026-11-09-c4-routing-redesign.md.

---

### Task 9: Interface annotations on C4 boxes and edges

**Files:** Modify `js/ArchUML/c4/c4-render.js`; Test `scripts/tests/c4-interface-render.test.js` (node:test + Playwright Chromium, pattern of `scripts/tests/c4-render.test.js`)

**Interfaces:** box text appends `Provides: <names>` (two names with their marks, then `+N more`) when `node.interfaces` is non-empty; edge labels append `via <name>` (one name, then ` (+N more)`) after the technology line when `edge.interfaces` is non-empty and the view's `annotations` include `interfaces`; edge labels wrap at the 300-unit box width; an edge whose `technologySource` is `'interface'` draws its technology like any other; pins are top-left anchors read from `model.layout` by `viewModel.key`, and when grown boxes overlap the lower one moves down by the overlap and is marked `pinAdjusted` (spec §6.4 step 5).

- [ ] **Step 1: Write the failing tests**
  - `the annotated container view shows provided interfaces on boxes` — `containers of registration with interfaces`: the `api` group contains a `<text>` equal to `Provides: Enrollment API` with the same `font-size` as the name; the `billing` group contains `Provides: Tuition Charges`.
  - `annotated edges add one via line after the technology` — edge `web→api` label lines in order: `submits plans to`, `[JSON/HTTPS]`, `via Enrollment API`; with three used interfaces the last line is `via Enrollment API (+2 more)`; the context view with interfaces shows `via Tuition Charges` and no technology line.
  - `plain views are unchanged by interfaces` — `containers of registration` rendered from the second fixture contains no text starting `Provides:` or `via `, and its node coordinates equal those from the Milestone 1 fixture.
  - `pins are top-left anchors shared by the plain and the annotated view` — a layout entry under `containers of registration` places `api`'s top-left corner at the same coordinates in both; with `api` and `db` pinned 10 units apart vertically, the annotated view moves `db` down by the overlap, sets `pinAdjusted`, and the boxes do not overlap.
  - Layout gates (Task 2 of the rendering plan) on the annotated container and component views, and on a fixture whose interface names have 40 characters: no overlapping boxes, labels clear of boxes and each other, every label within 300 units of width per line.
- [ ] **Step 2–5:** run `node --test scripts/tests/c4-interface-render.test.js` → FAIL, implement, run → PASS, checkpoint.

---

### Task 10: Interface card as semantic HTML

**Files:** Modify `js/ArchUML/c4/c4-render.js` (`renderCard(container, viewModel, options)`, called by `render` for notation `interface-card`; a DOM-free `cardMarkup(viewModel, options)` that builds escaped HTML, used by the live renderer and by the static prerender; the container gets `data-c4-notation="interface-card"`, no `role="img"`), `js/ArchUML/uml_to_svg.js` (return the card's outer HTML for card views), `_plugins/uml_static.rb` (accept card markup, namespace its ids, wrap it without `role="img"` and without the verbose block), `js/uml-auto-describe.js` (skip card containers), `_includes/c4-view.html` (parameter `panels`, written as `data-c4-panels`; a ```` ```c4 ```` fence in tutorial instructions requests the same card with its own `# panels: syntax` directive line, spec §6.6 item 7), `css/uml-diagram.css` (C4 card section: layout, tokens, `html.dark-mode` colours, exclusion from the dark invert filter, print rules), `css/print-light.css` (card stays light in print; never `css/tutorial-print.css`); Tests `scripts/tests/c4-interface-card.test.js`, `scripts/tests/uml-static-plugin.test.js` (cases added), `tests/c4-display.spec.js` (cases added)

**Interfaces:** spec §6.6 "Interface description card": article named by the interface name; groups Syntactic view, Semantic view (All operations first; one group per operation labelled with its syntax line), Data types (one table per type and inline map with a two-level header), Shared vocabulary; absence lines; `panels: 'syntax'`; hooks `data-c4-interface`, `data-c4-panel`, `data-c4-operation`.

- [ ] **Step 1: Write the failing tests**
  - `the card is an article with labelled groups, not an image` — `interface enrollment-api`: the container has no `role="img"`; one `article.c4-interface` whose accessible name is `Enrollment API`; groups with accessible names `Syntactic view`, `Semantic view`, `Data types`, `Shared vocabulary`, in that DOM order; the header contains `REST interface · JSON/HTTPS · version 1`, `Provided by Registration API (Container: Python, FastAPI)`, and `Handled inside Registration API by Registration Coordinator (submit-plan)`.
  - `operations and their semantics read in order` — the syntactic group has a `dl` with `POST /v1/enrollments` inside `code`; the semantic group's first block is `All operations` with `unauthorized (401): …`; the next group's accessible name is `submit-plan: POST /v1/enrollments` and contains `Realizes: DECIDE whether a student may enroll in a section (Registration API)` and an example containing `units_enrolled: 8`.
  - `each type is a table whose rows keep a number with its unit` — the `EnrollmentOutcome` table has a caption starting `EnrollmentOutcome`; header cells `Syntactic view` (colspan 5) and `Semantic view` (colspan 3) with `scope="colgroup"`; the `units_enrolled` row's cells read `units_enrolled`, `number`, `required`, empty, empty, `total units the student holds in the term after this attempt`, `quarter units`, empty; the table sits in a focusable scroll region with an accessible name.
  - `the syntax-only option hides the semantics without absence lines` — `panels: 'syntax'`: no Semantic view group, tables with five columns, no text `not stated`.
  - `missing semantics are printed` — shop `interface card-payments`: `Purpose: not stated.` and `Errors: none stated.` inside the `refund` block; shop `interface app`: `Semantic view: not described yet.`
  - `user text cannot inject markup` (description `<img src=x onerror=alert(1)>` appears as text); `no style attributes are emitted`; `the live and the static markup are equal` (after id namespacing).
  - Site (`tests/c4-display.spec.js`): `the card reflows at 320 CSS px` (the article's `scrollWidth` does not exceed its `clientWidth`, table regions excepted and keyboard scrollable), `its text has the surrounding paragraph's size and group labels are at least 1.2em`, `light and dark mode reach 4.5:1 for text and 3:1 for rules with site tokens and no invert filter on the card`, `print shows every card line once in the light palette` (PDF text contains each line exactly once), `the uml-auto-describe script adds no label or verbose block to a card`.
- [ ] **Step 2–5:** run `node --test scripts/tests/c4-interface-card.test.js scripts/tests/uml-static-plugin.test.js` and `npx playwright test tests/c4-display.spec.js` → FAIL, implement, run → PASS, checkpoint.

---

### Task 11: Component-diagram fixes in the bundle

**Files:** Modify `js/ArchUML/uml-bundle.js` (component renderer: draw and measure `parsed.displayNameMap[name] || name`, keeping the alias as `data-layout-id`; parse `<<keyword>>` after a component's name or alias and draw it as a second, italic line in the box; an explicit `layout vertical` or `layout horizontal` overrides the container aspect ratio (around the `containerAspect` uses in the component layout), and declaration order is the rank order), `js/ArchUML/REFERENCE.md` (component section: `component "Display" as alias <<keyword>> { … }`, the layout directives, one example), `scripts/tests/uml-component-render.test.js` (new or extended); Test: the existing component-diagram regression suites stay green

- [ ] **Step 1: Write the failing tests** (render with Playwright Chromium):
  - `a component's display name is drawn and measured, and its alias stays a hook` — `component "Registration API" as e1 { provide "A" as p1 }`: the box contains the text `Registration API` inside its rect, `data-layout-id="e1"`, and no text `e1`.
  - `keywords are drawn as a second italic line` — `<<Container: Python, FastAPI>>` appears under the name, italic, inside the rect.
  - `an explicit layout direction wins over the container's shape` — the spec §6.6 text gives the same node coordinates in 320, 760, and 1440 px containers, with `Planner Web App` above `Registration API` above `Billing System`; `layout horizontal` puts them in one row at every width.
  - Review Focus 4 of 1b, parsed: `generated component text cannot inject statements` — the Task 9 adversarial text parses to exactly 3 components and 2 connectors, no component or port name contains `"`, `{`, or `}`, and the connector label is `a --> b }`; `p1 --> r2 : GET /readers/{id}` parses with that exact label.
  - Render gates on four fixtures generated by the core (the reference `interfaces of api`; one interface with two consumers; one component with two provided interfaces; the endpoint fixture's `interfaces of api`): no label–box and no label–label overlap, each interface name next to its ball, each assembly label nearest its own connector, readable width of the reference view at most 44em (`--uml-readable-width`), and in the two-consumer fixture no ball adjacent to a consumer's box.
- [ ] **Step 2–5:** run → FAIL, implement in the submodule working tree, run the new tests and the existing UML suites (`npx playwright test tests/uml-*.spec.js` for component diagrams, `node --test scripts/tests/uml-*.test.js`) → PASS, checkpoint (report the submodule change).

---

### Task 12: Interfaces view delegation, wrapper, description, content checks, and display

**Files:** Modify `js/ArchUML/c4/c4-render.js` (notation `uml-component` → `ArchUMLC4.toUml(view)` → `UMLComponentDiagram.render(inner, text)` inside `<div class="c4-uml-view">`; the title above and the legend and notes below as paragraph-size text inside the C4 container; the empty-state text instead of the legend), `scripts/tests/c4-content.test.js` (fences using `interfaces of` and `interface` selectors and the `panels` parameter resolve), `js/ArchUML/REFERENCE.md` (C4 section: interface views, `with …`, one example of each, and the interface rules with severity, rationale, and source), `tests/c4-display.spec.js` (cases below); Test `scripts/tests/c4-delegation.test.js` (cases added)

- [ ] **Step 1: Write the failing tests**
  - `the interfaces view renders a UML component diagram inside the C4 container with title, legend, and notes` — outer element keeps `uml-c4-diagram-container`; the title text `Interface view: Registration API` precedes the inner SVG; the inner SVG contains `Registration API`, `Container: Python, FastAPI`, `Enrollment API`, `Tuition Charges`, and two assembly connectors; the legend line follows it; `interfaces of coordinator` shows the delegated note.
  - `an element without interfaces shows the empty-state text` (`interfaces of db`).
  - `C4 interface views are described` — the container's `aria-label` equals the core brief for `interfaces of api`, and its verbose block contains the legend sentence and the notes.
  - `the interfaces view reaches paragraph-size text at 320 and 1440 px and scrolls by keyboard when it overflows`; `dark mode inverts the delegated component SVG once`; `print uses the light palette`.
  - `static prerender and live render agree for the interfaces view` (same text content and node coordinates).
  - `the reference deployment view routes the browser through the ingress` — `deployment production` of `course-registration-interfaces.yml` draws `Web browser` → `Ingress load balancer` → `API pod` and no direct path from the browser to the API pod (spec §6.3; the rule is projected by Milestone 1b).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run `node --test scripts/tests/c4-delegation.test.js scripts/tests/c4-content.test.js scripts/tests/uml-static-plugin.test.js` and `npx playwright test tests/c4-display.spec.js tests/uml-readable-sizing.spec.js tests/print-light-theme.spec.js`, then `WCAG_AUDIT_URL_FILTER='uml-reference|test-uml' npx playwright test tests/wcag22-complete-audit.spec.js` and `npx playwright test tests/wcag22-print-audit.spec.js` → PASS. **Step 5:** checkpoint.
