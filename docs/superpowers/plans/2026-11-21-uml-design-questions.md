# Answering Design Questions with UML — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the CS 130 tutorial "Answering Design Questions with UML": students answer design questions about a ~55-file Python system from code, then with a pre-generated agent-style UML diagram, and compare.

**Architecture:** Three independently testable parts. **Part A** adds notation to the ArchUML renderer (submodule). **Part B** adds a reusable `diagram_challenge` step type, a Diagram pane, a folder-tree navigator, project search, and read-only files to the tutorial runtime. **Part C** builds the Headliner codebase, a facts extractor that derives answer keys, nine pre-generated diagrams with conformance checks, and the tutorial content. Parts A, B, and C1–C6 run in parallel; C7–C10 need A and B.

**Tech Stack:** Jekyll + Liquid, vanilla JS (no new dependencies), Monaco 0.44 (vendored), ArchUML (`js/ArchUML`), Pyodide 0.27 (Python 3.12, stdlib only), Playwright, `node --test`, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-uml-design-questions-tutorial-design.md`

**Superseded in part (2026-11-21):** the questions, the learning objectives, `progress_version` (now 2), and the facts the answer keys come from follow `docs/superpowers/specs/2026-11-21-uml-design-questions-redesign.md`. Tasks C6 and C9 below describe the first question set (receivers, the four outage questions, the call count), which the redesign replaced.

## Global Constraints

- Work in the main checkout (`/Users/tobiasduerschmid/Projects/tobiasduerschmid.github.io`); never touch the user's unrelated modified files (`.claude/launch.json`, `css/song-video-frontier.css`, `css/tutorial-print.css`, `js/song-video/**`, untracked song/blog/audit files).
- **Do not commit.** Leave changes in the working tree; the user decides on commits. ArchUML edits stay uncommitted inside the submodule.
- WCAG 2.2 AA on every reachable page (`.agents/skills/wcag-aa-compliance/SKILL.md`); light, dark, and print coherent; print is always light (`css/print-light.css` loaded after page styles).
- Readable text at paragraph size: never `font-size` below `0.85em` for decorative labels or `0.9em` for secondary text; form controls use `font: inherit`; never `rem` below paragraph size (`1rem` = 10 px here).
- No inline `style="…"` or page-local `<style>` in authored HTML/Markdown/includes; presentation lives in CSS modules under `css/`.
- No new third-party runtime dependencies; no new Pyodide packages (Python stdlib only, `tomllib` for TOML).
- No new browser storage keys; new progress fields live in the existing `tutorial-progress-<id>` record and are documented on `/cookies/`.
- Every new keyboard shortcut is documented on `/shortcuts/` (keyboard-glossary-tracker skill).
- Runtime features update `.agents/skills/tutorial-authoring/SKILL.md` in the same change (§3.1, §3.2, §4.x).
- Python package for shared infrastructure is named `infra` (never `platform`, which shadows the standard library).
- Diagrams never state a task's conclusion in notes; every note fact carries `path:line` evidence.

## Review Focus

- Reload in every challenge state (exploring, locked, follow-up, done) restores that state exactly; Part A answers stay read-only after lock-in.
- Timer pauses while the tab is hidden or another step is shown; it resumes without double counting.
- Keyboard-only path: tree → open file → search → lock in → evidence link → editor line → back to the form, with visible focus throughout.
- At 320 px width and at 200 % zoom: tree becomes a disclosure above the editor, diagram stacks below the form, no horizontal page scroll.
- The Headliner codebase behaves identically under CPython and Pyodide (same facts, same scenario output).

---

## Part A — ArchUML notation additions

Edits land in the submodule working tree (`js/ArchUML/uml-bundle.js`, B; `js/ArchUML/REFERENCE.md`, R) plus `js/uml-auto-describe.js` (D) in the parent repository. Line numbers are from the survey on 2026-11-21. Tests use `node:test`; rendering tests launch Chromium directly (`page.setContent` + `page.addScriptTag({path: 'js/ArchUML/uml-bundle.js'})`, pattern in `js/ArchUML/tests/sequence-lifeline-rendering.test.js` and `scripts/tests/uml-structural-regressions.test.js`). Run `node --test js/ArchUML/tests/` and `node --test scripts/tests/uml-*.test.js`. Do **not** run site-based Playwright specs (another worker builds `_site`); the coordinator runs `tests/uml-renderer.spec.js`, `tests/uml-component-port-alignment.spec.js`, and `tests/uml-authored-layout.spec.js` afterwards as the regression net.

Deferred (not needed by any diagram in this release): `ref over a, b : Label` interaction uses and duration constraints.

### Task A1: Component stereotypes, and alias-safe manual positions

**Files:**
- Modify: B component `parse` (declaration regexes ≈16098–16106; bracket form ≈16171–16187; push/merge ≈16158–16167), `computeLayout` header height (≈16375–16376, ≈16988 `nameAreaH` and its uses ≈17038, ≈17042, ≈17301–17302), `getPortMovementBounds` (≈19031, ≈19045), box drawing (≈21385–21414); shared `inferLayoutTargetId` (≈960–989)
- Modify: R component section (≈1396–1440)
- Test: `js/ArchUML/tests/component-stereotypes.test.js`

**Interfaces:**
- Produces: component syntax `component [“Label” as] Id [<<stereotype>>] [#color [texture]] [dashed] [{ ports }]`, with color before or after the stereotype; parsed components carry `stereotype: string | null`; the box draws `«stereotype»` (regular weight) on its own line above the bold name, and the main rect gets `data-layout-bounds-id`.
- Produces: `inferLayoutTargetId` strips `{…}` bodies, `<<…>>`, `#color`, textures, and `dashed` before matching the alias, and recognizes `rectangle`, `package`, and `namespace` keywords.

- [ ] **Step 1: Write failing tests**: `stereotype with a port block keeps the box and its ports` (rendered boxes include `Website`; route source is a Website port, not a floating `w_out`); `stereotype without ports draws «repository» above the name` (text order and y); `color before and after the stereotype both parse`; `two-line header leaves ports below the header` (port tops ≥ header bottom); `aliased stereotyped component keeps its @pos` (`component "Trip Website" as Website <<web application>> @pos(400, 120) {` lands at x=400); `existing component diagrams render identically` (a stereotype-free spec produces the same box geometry as before the change — capture the baseline first).
- [ ] **Step 2: Run** `node --test js/ArchUML/tests/component-stereotypes.test.js` — expect failures.
- [ ] **Step 3: Implement**: extend both regexes with an optional `(?:\s*<<\s*([^>]+?)\s*>>)?` after the alias; run a second `UMLShared.parseHighlightColor` pass after removing the stereotype (as class `parseClassDecl` does ≈7864–7893); store `stereotype` on push and merge; compute a per-entry `headerH` (no ports: `max(compMinH, 2·padY + 2·lineHeight)`; ports: `nameAreaH + lineHeight`) and use it at every header-height site; draw like the class header (`measureBox` ≈8139–8191, drawing ≈10968–10985).
- [ ] **Step 4: Run** — expect pass. Update R with the syntax and one example.

### Task A2: Scope frames in component diagrams

**Files:**
- Modify: B component `parse` (replace the wrapper skip ≈16036–16039 for `rectangle`, keeping the skip for the other wrapper keywords), `generateSVG` (frames drawn right after `svgOpen` ≈18687; title rects added to label obstacles; bounds enlarged)
- Modify: R
- Test: `js/ArchUML/tests/component-frames.test.js`

**Interfaces:**
- Produces: syntax `rectangle "Label" [<<stereotype>>] [dashed] { … }` (multi-line; nesting allowed); parsed `frames: [{id, label, stereotype, dashed, parent, members: string[]}]`; each frame is drawn behind everything as the members' bounding box (including ports and interfaces) plus padding, with its label top-left (and `«stereotype»` above it), `fill="none"`, `pointer-events="none"`, `data-callout-frame="true"`, `data-layout-route-decorative="true"`, dashed when `dashed` is present; frames are not routing obstacles; frames follow manual `@pos` because they are computed after `applyLayoutPositions`.

- [ ] **Step 1: Write failing tests**: `rectangle frame encloses its members and not the others` (geometry); `connectors may cross the frame` (route exists between inside and outside components); `dashed frame uses the component dash`; `frame follows @pos of its members`; `nested frames nest`; `one-line rectangle bodies are reported, not silently dropped` (render shows an error note or the members still render).
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement**, borrowing brace handling from deployment's `splitStatements`/`parents` (≈21781–21858) and the boundary drawing from the use-case system frame (≈23548–23667).
- [ ] **Step 4: Run** — expect pass. Update R.

### Task A3: Package frames in class diagrams

**Files:**
- Modify: B class `parse` (new branch before ≈7787; pop on `}` when no class is open), `generateSVG` (≈9100–11458: compute package boxes from member entries after `applyLayoutPositions` ≈12287, push before relationships ≈9374, enlarge bounds through `expandClassExtraForRect` ≈11420–11428), `computeLayout` note targets (rebuild member `noteTargets` after `applyLayoutPositions` so member notes follow manual positions)
- Modify: R class section
- Test: `js/ArchUML/tests/class-packages.test.js`

**Interfaces:**
- Produces: syntax `package name [<<stereotype>>] { … }` and `namespace name { … }` (multi-line; nesting allowed; `name` may contain dots); classes carry `package: string | null`; parse result includes `packages: [{id, name, parent, members}]`; drawn as the UML package shape (folder tab with the name) behind the classes, not an obstacle, inside the SVG bounds.

- [ ] **Step 1: Write failing tests**: `package frame encloses its classes` ; `classes outside a package stay outside`; `generalization arrows cross package frames`; `package frame is inside the SVG bounds`; `member note follows @pos` (fixes the stale note target).
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect pass. Update R.

### Task A4: Accessible descriptions and documentation

**Files:**
- Modify: D component describers (`describeComponentDiagram` ≈435–502, `describeComponentDiagramVerbose` ≈948–1015), class describers (`describeClassDiagram` ≈126–167, `describeClassDiagramVerbose` ≈735–839); strip `@layout`/`@pos` first, as `parseDeploymentDescription` (≈562–601) does
- Modify: `.agents/skills/diagrams/SKILL.md` (renderer capabilities and limits)
- Test: `scripts/tests/uml-description-notation-additions.test.js`

**Interfaces:**
- Produces: descriptions name each component with its stereotype ("OPC, a service"), say which components a scope frame contains ("Inside Headliner: …"), attribute ports to their owners even with stereotypes or inline `@pos`, resolve `"Order DB" as OrderDB` to "Order DB", keep `A --> B dashed : x`, list stereotyped and positioned classes in the verbose class description, and say which package each class is in.

- [ ] **Step 1: Write failing tests** covering each item above via `node js/uml-describe-cli.js` input JSON.
- [ ] **Step 2: Run** `node --test scripts/tests/uml-description-notation-additions.test.js` — expect failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it plus `node --test scripts/tests/uml-class-description.test.js` and `node --test js/ArchUML/tests/` — expect pass.

---

## Part B — Tutorial runtime features

All of Part B edits `js/tutorial-code.js` (TC), so its tasks run **sequentially** in one worker. Line numbers below are from the survey on 2026-11-21 and will drift; find the named function. Run unit tests with `node --test scripts/tests/<file>.test.js`; run Playwright specs with `PLAYWRIGHT_SERVE_BUILT_SITE=1 npx playwright test tests/<spec>` after `bundle exec jekyll build` (or let `playwright.config.js` build via `make test-run`). Pages are opened with `?instructor-mode=true&autosave=false` only when a test needs instructor mode; persistence tests omit `autosave=false`.

Read before starting: `.agents/skills/tutorial-authoring/SKILL.md` (§3–§5), `wcag-aa-compliance`, `light-dark-mode`, `print-light-mode`, `cookie-storage-tracker`, `keyboard-glossary-tracker`, `maintainable-code`, `test-design` (all under `.agents/skills/`).

A demo tutorial drives the browser tests: `_data/tutorials/diagram-challenge-demo.yml` (`exclude_from_index: true`, `backend: pyodide`, `require_tests: true`, `file_tree: true`, `project_search: true`, `shared_files:` with nested folders and a `.toml` file, two steps with `diagram_challenge`, the second `predict_view: true`) with pages `SEBook/tools/diagram-challenge-demo.md` and `SEBook/tools/diagram-challenge-demo/print.md` (front matter `uml_code_labs: true`).

### Task B1: Shared files and read-only files

**Files:**
- Modify: TC constructor (≈577–984) and `openFile` (≈8009–8133), `_setActiveFile` (≈8135–8162), `_applyFileEditFromPopup` (≈9324–9333)
- Modify: `_layouts/tutorial.html` options object (≈447–531)
- Modify: `js/debugger/editor-attach.js` (≈390–406) and `js/debugger/main.js` (≈3188–3200, 3549–3553) so restoring `readOnly` consults the active file's flag
- Create: `tests/diagram-challenge-demo.spec.js` (first tests), the demo YAML and page pair
- Test: `scripts/tests/tutorial-shared-files.test.js` (vm sandbox, pattern from `scripts/tests/tutorial-worker-lifecycle.test.js`)

**Interfaces:**
- Produces: top-level YAML `shared_files: [file specs]` — any step without `files` uses this array (same objects; nothing duplicated in the page JSON); file-spec key `readonly: true` and step key `readonly: true` (all of that step's files); `TutorialCode.prototype._isReadOnlyFile(path) -> boolean`.

- [ ] **Step 1: Write failing tests** — unit: `steps without files receive shared_files`; `step-level readonly marks every step file read-only`; Playwright: `typing into a read-only file leaves it unchanged`, `Run still executes a read-only file`.
- [ ] **Step 2: Run** them — expect failures.
- [ ] **Step 3: Implement** — store the flag on `editorModels[path].readOnly` when the spec is first seen and never clear it from later spec-less `openFile` calls (`_applySavedFiles`, `applySolution`, `_refreshStepVisibleFiles`); apply `editor.updateOptions({readOnly, readOnlyMessage: {value: "This file is read-only in this tutorial."}})` in `_setActiveFile`; ignore popout and refactoring edits to read-only files.
- [ ] **Step 4: Run** — expect pass.

### Task B2: Folder-tree file navigator

**Files:**
- Create: `js/tutorial-file-tree.js` (UMD-style `window.TutorialFileTree`, also `module.exports` for tests), `css/tutorial-file-tree.css`
- Modify: TC `_buildUI` (≈1644–2555; workspace markup ≈2003–2023), `_renderTabs` (≈8180–8450), `_closeNonStepFiles`; `_layouts/tutorial.html` (load CSS before `print-light.css`, script before `tutorial-code.js`), `shortcuts.html` (tutorial section ≈71–136)
- Test: `scripts/tests/tutorial-file-tree.test.js`, more cases in `tests/diagram-challenge-demo.spec.js`

**Interfaces:**
- Produces: `TutorialFileTree.buildTree(paths: string[]) -> TreeNode` (`{name, path, type: "folder"|"file", children}` sorted folders first, then files, alphabetical); `TutorialFileTree.mount(host, {paths, activePath, onOpen(path)}) -> {setPaths(paths), setActive(path), revealPath(path), destroy()}`; top-level YAML `file_tree: true`; TC keeps `this._openTabs: Set<string>` — with the tree on, `_renderTabs` shows only open tabs (initially `open_file`), each with a close button; every step file still has a Monaco model.

- [ ] **Step 1: Write failing tests** — unit: `buildTree nests services/opc/partners/glamping_co.py under three folders`, `folders sort before files`; Playwright: `ArrowDown/ArrowRight/Enter open a nested file and add one tab`, `closing a tab keeps the model and the draft`, `narrow viewport shows the tree as a disclosure above the editor`, `tree is a role=tree with aria-expanded folders`.
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement** the WAI-ARIA treeview pattern (roving tabindex; Up/Down move; Right expands or enters; Left collapses or goes to parent; Home/End; Enter/Space opens; type-ahead optional). Top-level folders start expanded; the active file's ancestors expand. At ≤ 900 px the tree is inside a native `<details>` above the editor. Add the tree keys to `/shortcuts/`.
- [ ] **Step 4: Run** — expect pass; check light, dark, and print (tree hidden in print).

### Task B3: Project-wide search

**Files:**
- Create: `js/tutorial-project-search.js` (`window.TutorialProjectSearch`, `module.exports`), `css/tutorial-project-search.css`
- Modify: TC (`_buildUI`, a key handler scoped to the tutorial root), `_layouts/tutorial.html`, `shortcuts.html`
- Test: `scripts/tests/tutorial-project-search.test.js`, more cases in `tests/diagram-challenge-demo.spec.js`

**Interfaces:**
- Produces: `TutorialProjectSearch.search(files: {path, content}[], query: string, {matchCase, wholeWord, regex}) -> {results: {path, line, column, preview}[], truncated: boolean, error: string|null}` (cap 500; invalid regex returns `error`, never throws); `TutorialProjectSearch.mount(host, {getFiles(), onOpen(path, line, column)}) -> {open(), close(), destroy()}`; top-level YAML `project_search: true`; `TutorialCode.prototype.revealSource(path: string, line: number, column = 1)` (opens the file, reveals the line, adds a 2-second line decoration, focuses the editor).

- [ ] **Step 1: Write failing tests** — unit: `finds a binding key in a .toml file`, `whole-word excludes partial identifiers`, `invalid regex reports an error`, `caps at 500 and sets truncated`; Playwright: `Ctrl/Cmd+Shift+F opens search and a result opens the file at its line`, `result count is announced in a status region`.
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement**; search reads current model contents (drafts included); results grouped by file with line numbers and highlighted match text; Escape closes the panel and returns focus to the opener. Document Ctrl/Cmd+Shift+F on `/shortcuts/`.
- [ ] **Step 4: Run** — expect pass.

### Task B4: Diagram pane

**Files:**
- Create: `js/tutorial-diagram-pane.js` (prototype mixin loaded after `tutorial-code.js`), `css/tutorial-diagram-pane.css`
- Modify: TC `_buildUI` (generalize the view toggle into a list builder; add a third flex child to `.tvm-editor-body` with an accessible divider wired like the split divider), `_setView` (≈14473–14526; `'diagram'` keeps the editor visible; buttons get `aria-pressed`)
- Test: cases in `tests/diagram-challenge-demo.spec.js`

**Interfaces:**
- Produces: `TutorialCode.prototype.showAuthoredDiagrams(diagrams: {id, label, type, source}[])` (renders with ArchUML into new class names — never reuse `.tvm-diagram-*` UML-pane classes), `hideAuthoredDiagrams()`, `setDiagramPaneAvailable(available: boolean, reason?: string)`; one persistent container; diagram tabs when more than one diagram; zoom in/out/reset buttons, ArchUML's Fit control, a full-screen button (`js/browser-fullscreen.js` pattern), keyboard-scrollable region with the auto-description as its accessible name.

- [ ] **Step 1: Write failing tests**: `Diagram button is disabled with an explanation before lock-in`, `after showAuthoredDiagrams the pane sits beside the editor and the editor stays visible`, `three diagrams show as tabs`, `at ≤900 px the pane stacks below the editor`.
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect pass; check both themes.

### Task B5: Diagram challenge engine and widget

**Files:**
- Create: `js/tutorial-diagram-challenge.js` (`window.DiagramChallenge` with `initFrom(root, {runtime, readOnly}) -> Promise`, `destroyWithin(root)`; pure core `window.DiagramChallengeCore` also exported via `module.exports`), `css/tutorial-diagram-challenge.css`
- Create: `_includes/tutorial-diagram-challenge.html` (server-rendered host: static question markup with `markdownify`, plus `<script type="application/json">` holding the step's challenge spec)
- Modify: `_includes/tutorial-step-instructions.html` (render the include after the instructions when `step.diagram_challenge` exists); TC `_loadStepContent` (≈12122–12205: `destroyWithin` before the `innerHTML` swap, `initFrom` joined to the readiness barrier), `destroy()` (≈1535), `_renderTimedPracticeLockout` (≈11577)
- Test: `scripts/tests/diagram-challenge-core.test.js`

**Interfaces:**
- YAML (step level), exactly as spec §9.1, but question types are `single` and `multiple` only (no ordering questions in this release): `diagram_challenge: {mode, budget_minutes, min_score, predict_view, questions, plan, reply: {request, summary, diagrams, evidence, files_read, left_out, label}, follow_up, debrief: {hidden_by, find_in_code, view_shows}}`.
- Produces: `DiagramChallengeCore.createSession(spec, record?) -> Session` with `answer(id, value)`, `canLock() -> boolean`, `lock(nowMs)`, `checkMain(nowMs) -> QuestionResult[]`, `answerFollowUp(id, value)`, `checkFollowUp(nowMs) -> QuestionResult[]`, `score() -> number` (main Part B + follow-up), `state` (`exploring|locked|follow-up|done`), `serialize() -> record` (shape of spec §9.1 Persistence); `QuestionResult = {id, correct, found: number[], missed: number[], extra: number[]}`; `ActiveTimer` with `resume(nowMs)`, `pause(nowMs)`, `elapsedMs(nowMs)`.
- Widget events: `onRecord(record)` callback to the runtime; the runtime owns persistence and gating (B6).
- Revisions from the pedagogy review (spec §16 and the updated §9.1 schema; these are part of B5):
  - **Part A attempt:** the session also exposes `setHypothesis(text)`, `addEvidence({path, line})`, `removeEvidence(index)`, and `setViewWish(text)`. `canLock()` additionally requires a non-blank hypothesis, at least `attempt.evidence_pins` pins, and a view wish. Options and the confidence choice stay hidden until the hypothesis is written.
  - **Pin this line:** the runtime adds `TutorialCode.prototype.currentEditorLocation() -> {path, line} | null`, which the widget uses.
  - **Contrast stage:** an optional `reply.contrast` diagram and question are shown and answered before the main reply diagrams (`answerContrast(id, value)`).
  - **Comparison:** `checkMain` records the *first* attempt separately (`firstAttempt`) from the latest attempt.
  - **Debrief:** `answerEvidenceCheck(id, value)`, `setConsolidation(text)` (required, non-blank), and `answerMechanism(id, value)`. `score()` counts the latest Part B attempt, the follow-up, the evidence check, and the mechanism question.
  - **Display:** the comparison panel leads with correctness (found, missed, extra) and shows times on a secondary line labeled "your experience, not an experiment", with a **Hide times** toggle. No ratios.
  - **Unit tests:** `options stay hidden until a hypothesis exists`, `lock requires pinned evidence and a view wish`, `comparison uses the first part B attempt after a retry`, `contrast question must be answered before the main diagram`, `score includes evidence check and mechanism question`.

- [ ] **Step 1: Write failing unit tests**: `cannot lock until every question and the confidence are answered`, `lock freezes part A answers` (later `answer` calls change only Part B), `multiple-choice grading reports found, missed, extra`, `score combines part B and follow-up`, `timer excludes paused intervals`, `serialize and restore round-trip every state`, `plan-first sessions lock view choices and grade them`.
- [ ] **Step 2: Run** `node --test scripts/tests/diagram-challenge-core.test.js` — expect failures.
- [ ] **Step 3: Implement** the core, then the widget: fieldsets/legends, native radios and checkboxes (`font: inherit`), confidence radios (`Guessing`, `Fairly sure`, `Sure`), optional view prediction, **Lock in my answer** through `SebookConfirmation.confirm`, a polite status nudge at `budget_minutes`, the reply card (request, summary, Show diagram → `runtime.showAuthoredDiagrams`, evidence buttons → `runtime.revealSource`, files read, left out, label), Part B prefilled from Part A, follow-up, comparison panel (per question Part A/Part B/key, option feedback, times, confidence calibration, debrief), focus moves to the new heading after lock and after each check, live announcements in one polite region.
- [ ] **Step 4: Run** — expect pass.

### Task B6: Persistence, gating, reset, timing, instructor mode

**Files:**
- Modify: TC `saveProgress` (≈11009–11050; add `diagramChallenges`), `start()` restore (≈1227–1309), `_isNextStepLocked` (≈9200–9211), Next handling in `_renderStepControls` (≈12545–12561) and popout `onNextStepRequest` (≈9445–9465), `_renderTestResults` unlock (≈14329–14331), `_timedPracticeStepSolved` (≈11532–11541), `resetStep` (≈11212–11281); `_layouts/tutorial.html` Reset confirmation text (≈553–556); `cookies.html` (≈393, ≈900)
- Test: more cases in `tests/diagram-challenge-demo.spec.js`

**Interfaces:**
- Produces: `TutorialCode.prototype._stepGateSatisfied(index) -> boolean` — the one predicate every Next/unlock path uses: tests passed (if `tests:`), quiz passed (if required), challenge `done` with `score >= min_score` (if `diagram_challenge` and `require_tests`); progress field `diagramChallenges: {"key:<stepKey>": record}` keyed by `_draftStepKey`; `resetStep` clears that step's record after the confirmation.

- [ ] **Step 1: Write failing tests**: `Next stays locked until the challenge is done`, `reload restores each state` (exploring with draft answers, locked, follow-up, done), `timer pauses while another step is shown`, `Reset Step clears the challenge after confirmation`, `instructor mode shows keys and never locks`.
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement**; update `/cookies/` wording to mention saved challenge answers and times inside the tutorial progress record.
- [ ] **Step 4: Run** — expect pass.

### Task B7: Print view, instructions popout, results card, documentation

**Files:**
- Modify: `_includes/tutorial-print-content.html` (new block between the shell-command block and the solution block, ≈84–86), `_layouts/print-tutorial.html` (load the challenge CSS before `print-light.css`), `tutorial-instructions-popup.html` (load the challenge JS/CSS; call `DiagramChallenge.initFrom(els.stepContent, {readOnly: true})` where content renders, ≈199), TC snapshot data (`challengeState` per step)
- Modify: `.agents/skills/tutorial-authoring/SKILL.md` (§3.1 `shared_files`, `file_tree`, `project_search`; §3.2 `diagram_challenge`, `readonly`; §4.4 popout behavior; §4.7 `diagramChallenges`; §4.8 challenge completion), `shortcuts.html`
- Test: print and popout cases in `tests/diagram-challenge-demo.spec.js`

**Interfaces:**
- Produces: print block — questions, then the reply card titled "Shown after you lock in" with each diagram as `<pre><code class="language-uml-<type>">` and the evidence list; keys and debriefs inside a `.step-solution` container (visible only with `?instructor-mode=true`); results card (`mode: plan-first` steps render a per-task table from the progress record when present, screen and print).

- [ ] **Step 1: Write failing tests**: `print view renders the diagram and hides keys without instructor mode`, `popout shows the challenge read-only with a pointer to the main window`, `results card lists every challenge with both times`.
- [ ] **Step 2: Run** — expect failures.
- [ ] **Step 3: Implement**; update the skill and inventories.
- [ ] **Step 4: Run** the demo spec, `node --test scripts/tests/*.test.js`, and `WCAG_AUDIT_URL_FILTER=diagram-challenge-demo npx playwright test tests/wcag22-complete-audit.spec.js` — expect pass.

---

## Part C — Headliner content

All Headliner sources live under `tutorial_sources/uml-design-questions/headliner/` (paths below are relative to that root unless they start with `scripts/`, `tests/`, `_data/`, or `SEBook/`). Run Headliner tests with `cd tutorial_sources/uml-design-questions/headliner && python3 -m pytest -q`.

**Student-visible tests versus hidden checks (applies to every Part C task).** Everything under `headliner/` ships to students as searchable, read-only files.
- `headliner/tests/` holds only a realistic product test suite: passing behavior tests of normal functionality with neutral examples. These tests never name or assert a task answer (receivers, bindings, multiplicities, outage outcomes, call counts, the website's database connection), never assert a seeded defect, and never use topic or routing examples from the tasks. Comments, docstrings, and names in `headliner/` likewise never hint at a seeded defect.
- Every test that pins a task fact or a seeded defect is a **hidden check**. It lives in `scripts/tests/test_headliner_hidden_checks.py`, which puts `headliner/` on `sys.path`. The facts extractor (C6) and its tests are hidden as well. The test names listed in C2–C5 below are hidden checks unless they describe ordinary behavior.
- C1 follow-up: `headliner/tests/test_infra.py` must replace the `trip.*`/`trip.confirmed`/`supplier.shuttle.*` topic examples with neutral ones (e.g. `inventory.*`, `inventory.restocked`).
- `SupplierOrderTask` catches `SupplierUnavailable` itself and reschedules. Otherwise the broker's retry-on-`ServiceUnavailable` would rerun the capture.
- C1 interfaces as implemented:
  - The broker is a network service (caller `"amqp-client"`); `BrokerUnavailable` subclasses `ServiceUnavailable`.
  - Consumers receive `Message(routing_key, body)`.
  - `drain()` retries a message whose consumer raised `ServiceUnavailable` on a later drain.
  - `create_database(dsn, *, replica_dsn=None)` must be called by `devstack.py` for the order DB (with its replica) and the catalog DB.
  - `Network.request(caller, service, endpoint, payload)` is the transport; `call_log` holds `Call(caller, service, endpoint)` entries, including failed calls.

Shared fixed values (used by code, facts, keys, and instructions — copy exactly):

| Value | Setting |
|---|---|
| Fake clock start | `2027-06-11T09:00:00+00:00` |
| Festivals | Desert Bloom (starts 2027-04-16), Neon Nights (2027-07-09), Lakeside Fest (2027-08-20), Sunset Sessions (presale opens 2027-06-11 12:00 UTC) |
| Website service fee | `SERVICE_FEE_RATE = 0.12` in `services/website/pricing.py` |
| Attendees per order | 1..8 (validator) |
| GlampingCo manual-cancellation window | 72 hours before check-in |
| Simulated latency (ms) | bank validate 300; box office quote 1100 per call (bulk quote 400 per call); experience capacity 600 / 750 / 900 for the three Lakeside Fest experiences; OPC submit 200; catalog query 20. A group of 5 attendees with 3 experiences takes about 8.4 s; the keyed fix (one bulk quote, parallel capacity checks) takes under 2 s |
| Component and stereotype names (UML 2.5.1) | TripWebsite «WebApplication»; OPC «BackendService»; OrderDB, CatalogDB «Database»; MessageBroker «MessageBroker»; trips «TopicExchange»; Notifications, Loyalty, WarehouseETL, AffiliateRelay, ShuttlePlanner «BackendService»; SupportConsole «WebApplication»; Bank, BoxOffice, LodgingProvider, ShuttleProvider, ExperienceProvider, MailRelay, AffiliatePartners «ExternalSystem». `component_of()` returns these names |
| Broker bindings (`deploy/broker.toml`) | loyalty.trips ← `trip.confirmed`; warehouse.all ← `#`; affiliates.trips ← `trip.*`; support.cancellations ← `trip.cancelled`; shuttle.planning ← `supplier.shuttle.*` (all on exchange `trips`) |
| Code-declared binding | `services/notifications/consumers.py`: `@consumes("trips", "trip.confirmed", "trip.cancelled", "trip.failed")` → queue `notifications.trips` |
| Website order-history DSN | `ORDER_HISTORY_DSN = "postgres://order-db-replica.internal/orders"` in `deploy/website.toml` |

### Task C1: `infra` runtime library and deploy configuration

**Files:**
- Create: `infra/__init__.py`, `infra/clock.py`, `infra/http.py`, `infra/broker.py`, `infra/db.py`, `infra/scheduler.py`
- Create: `deploy/services.toml`, `deploy/broker.toml`, `deploy/website.toml`
- Test: `tests/test_infra.py`

**Interfaces:**
- Produces: `FakeClock(start: datetime)` with `now() -> datetime`, `advance(seconds: float) -> None`; `class ServiceUnavailable(Exception)`; `Network(clock)` with `register(service: str, endpoint: str, handler: Callable[[dict], dict], latency_ms: int = 0)`, `take_down(service)`, `restore(service)`, `call_log: list[tuple[str, str, str]]` (caller, service, endpoint); `ServiceDirectory.from_toml(path)` with `address(service) -> str`; `ServiceClient(service: str, network: Network, caller: str)` with `call(endpoint: str, payload: dict) -> dict` (raises `ServiceUnavailable` when down, advances the clock by latency); `topic_matches(pattern: str, routing_key: str) -> bool` (`*` = exactly one dot-separated word, `#` = zero or more words); `class BrokerUnavailable(Exception)`; `Broker(network)` with `declare_queue(name)`, `bind(queue, exchange, pattern)`, `publish(exchange, routing_key, message: dict)`, `send(queue, message)`, `consume(queue, handler, component: str)`, `drain() -> int`, `bindings() -> list[tuple[str, str, str]]`, `Broker.load_config(path)`; `Database(name)` with `insert(table, row) -> str`, `get(table, key)`, `update(table, key, **changes)`, `find(table, **criteria) -> list[dict]`; `connect(dsn: str) -> Database` (primary `postgres://order-db.internal/orders` and replica `postgres://order-db-replica.internal/orders` resolve to the same store; replica is read-only); `Scheduler(clock)` with `every(seconds, fn, name)`, `run_due() -> int`.

- [ ] **Step 1: Write failing tests** `test_topic_matching` (pairs: `("trip.*","trip.confirmed")→True`, `("trip.*","trip.confirmed.v2")→False`, `("#","supplier.shuttle.confirmed")→True`, `("supplier.shuttle.*","trip.confirmed")→False`, `("trip.confirmed","trip.confirmed")→True`), `test_service_down_raises`, `test_latency_advances_clock` (one call with `latency_ms=1100` advances `now()` by 1.1 s), `test_publish_routes_by_binding`, `test_publish_when_broker_down_raises`, `test_replica_is_read_only` (insert via replica raises `PermissionError`).
- [ ] **Step 2: Run** `python3 -m pytest -q tests/test_infra.py` — expect failures (modules missing).
- [ ] **Step 3: Implement** the modules with the interfaces above; `Broker.load_config` reads `deploy/broker.toml` with `tomllib`. `publish` routes a copy of the message to every bound queue whose pattern matches; delivery happens only in `drain()`.
- [ ] **Step 4: Run** the tests — expect all pass.

### Task C2: OPC data model, gateways, partners

**Files:**
- Create: `services/opc/model/orders.py`, `services/opc/model/items.py`, `services/opc/model/suppliers.py`, `services/opc/model/rules.py`
- Create: `services/opc/gateways/base.py`, `box_office.py`, `lodging.py`, `shuttle.py`, `experiences.py`, `registry.py`
- Create: `services/opc/partners/errors.py`, `glamping_co.py`, `meet_and_greet.py`, `vip_shuttle.py`
- Test: `tests/test_model.py`, `tests/test_gateways.py`

**Interfaces:**
- Produces: dataclasses `Fan(fan_id, name, email)`, `Attendee(name, age_group: Literal["adult","teen"])`, `Payment(card_token, amount: int, capture_id: str | None = None)`, `TripOrder(order_id, buyer: Fan, attendees: list[Attendee], items: list[TripItem], payment: Payment, festival_id: str, status: str = "received", supplier_orders: list[SupplierOrder] = [])` (validators: 1..8 attendees; ≥1 item; `rules.check_experience_attendees`); `TripItem(ABC)` with field `attendees: list[Attendee]` and abstract `price() -> int`, `supplier_kind() -> str`, `cancellation_deadline(festival_start: datetime) -> datetime`; `FestivalPass`, `LodgingStay(check_in: datetime)`, `Experience`, `TransportItem(TripItem)` (abstract; implements `cancellation_deadline` = 24 h before departure), `ShuttleRide(TransportItem)`; `SupplierOrder(supplier_id, trip_order_id: str, items: list[TripItem], status: str = "placed", invoice: Invoice | None = None)`; `Invoice(amount, reference)`.
- Produces: `class SupplierGateway(ABC)` with abstract `place(order: SupplierOrder) -> dict`, `cancel(order: SupplierOrder) -> None` (docstring contract: raises only `SupplierUnavailable`), `parse_invoice(payload: dict) -> Invoice`; concrete `BoxOfficeGateway`, `LodgingGateway`, `ShuttleGateway`, `ExperienceGateway` (each wraps a `ServiceClient`); `ManualCancellationRequired(Exception)` in `partners/errors.py` (NOT a subclass of `SupplierUnavailable`); `GlampingCoGateway(LodgingGateway)` overrides `cancel` (raises within 72 h of check-in); `MeetAndGreetGateway(ExperienceGateway)` overrides `cancel` (always raises); `VipShuttleGateway(ShuttleGateway)` overrides only `place`; `registry.gateway_for(supplier_id: str, network) -> SupplierGateway` with ids `box-office`, `lodging`, `glampingco`, `shuttle`, `vip-shuttle`, `experiences`, `meet-and-greet`.

- [ ] **Step 1: Write failing tests**: `test_attendee_limit` (9 attendees raise `ValueError`); `test_buyer_need_not_attend`; `test_shared_tent_and_cabin_allowed` (two `LodgingStay` items with attendees `[a,b]` and `[c]`); `test_meet_and_greet_requires_pass` (raises); `test_payment_is_single` (annotation of `TripOrder.payment` is `Payment`); `test_supplier_order_has_one_trip_order`; `test_transport_item_supplies_deadline` (a subclass implementing only `price` and `supplier_kind` instantiates); `test_partner_cancel_overrides` (GlampingCo raises `ManualCancellationRequired` 48 h before check-in, not 96 h before; MeetAndGreet always raises; VipShuttle inherits `ShuttleGateway.cancel`); `test_manual_cancellation_is_not_supplier_unavailable`.
- [ ] **Step 2: Run** `python3 -m pytest -q tests/test_model.py tests/test_gateways.py` — expect failures.
- [ ] **Step 3: Implement** the files with the interfaces above; gateways call stub services through `ServiceClient` endpoints `place`, `cancel`.
- [ ] **Step 4: Run** the tests — expect all pass.

### Task C3: OPC workflow, events, and external stubs

**Files:**
- Create: `services/opc/api.py`, `intake.py`, `workflow.py`, `payment_task.py`, `supplier_task.py`, `invoice_task.py`, `cancellation_task.py`, `events.py`
- Create: `stubs/bank.py`, `stubs/box_office.py`, `stubs/lodging.py`, `stubs/shuttle.py`, `stubs/experiences.py`, `stubs/mail_relay.py`, `stubs/affiliate_partners.py`
- Test: `tests/test_opc_workflow.py`

**Interfaces:**
- Consumes: C1 (`Network`, `ServiceClient`, `Broker`, `Database`, `Scheduler`), C2 (model, `gateway_for`).
- Produces: endpoints registered on the network under service `opc`: `PurchaseOrderService.submit` (payload → `{"order_id"}`), `OrderTrackingService.status`, `SupplierCallbackService.answer` (`{"supplier_order_id","decision": "confirm"|"reject","invoice": {...}}`); `intake.accept(order) -> str` (saves to Order DB, then `broker.send("orders.received", …)` synchronously — raises `BrokerUnavailable` when the broker is down); `WorkflowManager` consuming `orders.received` (runs `PaymentTask.capture`, then `SupplierOrderTask.place_all`) and `supplier.answered` (runs `InvoiceTask.on_answer`); `SupplierOrderTask` reschedules a placement after `SupplierUnavailable`; `InvoiceTask.on_answer`: reject → `mark_failed()` and publish `trip.failed` (and nothing else — this is the seeded T3 defect); all confirmed → `mark_confirmed()` and publish `trip.confirmed`; `CancellationTask.cancel(order)`: `bank.refund` first, then `gateway.cancel` per supplier order, retrying only `SupplierUnavailable`; `TripEvents.confirmed/failed/cancelled(order)` publish to exchange `trips` with payload keys `order_id, fan_id, fan_name, festival_id, items`. Stubs register handlers with the latencies in the fixed-values table; supplier stubs answer `place` asynchronously by scheduling a `SupplierCallbackService.answer` call (decision configurable per supplier id; default confirm).

- [ ] **Step 1: Write failing tests**: `test_submit_returns_before_processing` (response arrives with zero bank calls in `network.call_log`); `test_capture_happens_before_supplier_answers`; `test_rejection_marks_failed_without_refund` (after a shuttle reject: status `failed`, a capture exists, no `bank.refund` call, glamping order still `confirmed`) — this pins the seeded defect; `test_broker_down_blocks_submit`; `test_lodging_down_delays_processing` (submit succeeds; order completes after `restore`); `test_cancellation_refunds_first`; `test_glampingco_cancellation_48h_stays_cancelling`.
- [ ] **Step 2: Run** `python3 -m pytest -q tests/test_opc_workflow.py` — expect failures.
- [ ] **Step 3: Implement** with the interfaces above.
- [ ] **Step 4: Run** the tests — expect all pass.

### Task C4: Trip Website

**Files:**
- Create: `services/website/clients.py`, `payments.py`, `pricing.py`, `availability.py`, `checkout.py`, `order_history.py`, `app.py`
- Test: `tests/test_website.py`

**Interfaces:**
- Produces: `OpcClient.submit(order_payload) -> str`, `OpcClient.track(order_id)`; `BankClient.validate(card_token, amount) -> bool`; `BoxOfficeClient.quote_pass(festival_id, age_group) -> int` and `quote_passes(festival_id, age_groups: list[str]) -> list[int]` (bulk endpoint, unused by pricing); `ExperienceClient.check_capacity(experience_id, count) -> bool`; decorator `requires_valid_card` (calls `BankClient.validate` before the view); `SERVICE_FEE_RATE = 0.12`; `TripPricer.price(cart) -> Quote` (one `quote_pass` call per attendee); `AvailabilityGuard.check(cart)` (one `check_capacity` call per experience); `CheckoutController.submit(fan, cart, card_token) -> dict` (`{"message": "Order received", "order_id": …}`); `OrderHistoryPage.render(fan_id)` reads `connect(settings["ORDER_HISTORY_DSN"])` directly (the capstone rule violation); `create_app(stack_parts) -> WebsiteApp`.

- [ ] **Step 1: Write failing tests**: `test_group_checkout_external_calls` (5 attendees, 3 experiences → exactly 9 calls to bank/box_office/experiences before the response; elapsed fake time between 8.0 s and 8.8 s); `test_bulk_quote_and_parallel_checks_meet_target` (the same order through the keyed fix — `quote_passes` once plus capacity checks whose time is the maximum, not the sum — finishes in under 2.0 s, so the fact is computed, not asserted by hand); `test_bank_down_blocks_submit`; `test_service_fee_applied` (12 %); `test_order_history_reads_replica` (the page's database DSN is the replica).
- [ ] **Step 2: Run** `python3 -m pytest -q tests/test_website.py` — expect failures.
- [ ] **Step 3: Implement** with the interfaces above.
- [ ] **Step 4: Run** the tests — expect all pass.

### Task C5: Event consumers, devstack, scenarios, README

**Files:**
- Create: `services/notifications/consumers.py`, `services/notifications/mailer.py`, `services/loyalty/points.py`, `services/reporting/warehouse_etl.py`, `services/affiliates/relay.py`, `services/support_console/app.py`, `services/shuttle_planner/planner.py`
- Create: `devstack.py`, `scenarios/failed_trip.py`, `scenarios/slow_group_checkout.py`, `README.md`
- Test: `tests/test_consumers.py`, `tests/test_devstack.py`

**Interfaces:**
- Produces: `consumes(exchange: str, *patterns: str)` decorator; `build_stack(*, down: tuple[str, ...] = (), supplier_decisions: dict[str, str] | None = None) -> Stack` with attributes `clock, network, broker, website, opc, run_until_idle()` and `component_of(queue: str) -> str` (queue → component name: `notifications.trips→Notifications`, `loyalty.trips→Loyalty`, `warehouse.all→Warehouse ETL`, `affiliates.trips→Affiliate Relay`, `support.cancellations→Support Console`, `shuttle.planning→Shuttle Planner`). Scenario outputs print symptoms only (failed_trip: captured amount, status `failed`, the still-booked glamping tent; slow_group_checkout: total seconds with one decimal) and never the cause.

- [ ] **Step 1: Write failing tests**: `test_trip_confirmed_receivers` (`{Notifications, Loyalty, Warehouse ETL, Affiliate Relay}`); `test_trip_cancelled_receivers` (`{Notifications, Warehouse ETL, Affiliate Relay, Support Console}`); `test_affiliate_relay_calls_partner_webhook`; `test_scenarios_run` (both scripts exit 0; failed_trip output contains `failed` and does not contain `refund`).
- [ ] **Step 2: Run** `python3 -m pytest -q` — expect failures.
- [ ] **Step 3: Implement**; README describes Headliner and lists services with one-line responsibilities and how to run tests — no relationships, no diagrams.
- [ ] **Step 4: Run** the whole suite — expect all pass; report the total line count of `.py` files (target 2,000–2,400).

### Task C6: Facts extractor (answer keys come from code)

**Files:**
- Create: `scripts/uml_design_questions/facts.py`
- Create: `scripts/tests/test_uml_design_questions_facts.py`
- Output: `tutorial_sources/uml-design-questions/facts.json` (generated; committed with sources)

**Interfaces:**
- Consumes: C1–C5 (`build_stack`, model, gateways).
- Produces: `extract() -> dict` and CLI `python3 scripts/uml_design_questions/facts.py --write` with keys:
  - `event_consumers`: `{"trip.confirmed": [...], "trip.cancelled": [...], "external_forwarders": ["Affiliate Relay"]}`
  - `gateway_contracts`: `{"fails_cancel_when_online": ["GlampingCoGateway","MeetAndGreetGateway"], "overrides": {class: [methods]}, "experience_place_inheritors": ["ExperienceGateway","MeetAndGreetGateway"]}`
  - `failed_trips`: `{"capture_before_first_answer": true, "reject_branch_calls": [...], "missing": ["refund","cancel confirmed suppliers"]}`
  - `data_model`: `{"allowed": [1,3], "split_payment_multiplicity": "TripOrder-Payment"}`
  - `outages`: `{"bank": "cannot_submit", "lodging": "finish_afterwards", "broker": "cannot_submit", "mail_relay": "emails_wait"}`
  - `checkout_latency`: `{"external_calls": 9, "elapsed_seconds": <float>}`
  - `capstone`: `{"website_reads_order_db": true, "rideshare_must_implement": ["price","supplier_kind"], "refund_before_cancel": true, "glampingco_48h_stays_booked": true, "service_fee": 0.12}`
  - `evidence`: `{"<symbol>": "path:line"}` for every symbol a diagram note cites (filled by C8).

- [ ] **Step 1: Write the failing test** `test_facts_match_spec_keys` asserting every value above (the spec's keys).
- [ ] **Step 2: Run** `python3 -m pytest -q scripts/tests/test_uml_design_questions_facts.py` — expect failure.
- [ ] **Step 3: Implement** `extract()` by exercising the stack (behavior), not by text search: outages via `build_stack(down=(…))`; latency via `network.call_log`; receivers via `broker.bindings()` + `topic_matches` + `component_of`.
- [ ] **Step 4: Run** — expect pass; run `--write` and inspect `facts.json`.

### Task C7: Shared files and YAML generator

**Files:**
- Create: `scripts/uml_design_questions/build_yaml.py`, `scripts/tests/test_uml_design_questions_yaml.py`
- Modify: `_config.yml` (`exclude:` adds `tutorial_sources`)
- Output: the generated block of `_data/tutorials/uml-design-questions.yml`

**Interfaces:**
- Consumes: Part B's top-level `shared_files` key (Task B1); the Headliner tree; `tutorial_sources/uml-design-questions/diagrams/*.uml` (Task C8).
- Produces: `python3 scripts/uml_design_questions/build_yaml.py --write | --check`. It rewrites only the text between `# BEGIN GENERATED` and `# END GENERATED` in the tutorial YAML: `shared_files:` (every Headliner file with `readonly: true`; `.toml` files get `language: ini` and `print_language: toml`; `.md` files get `language: markdown`) and one YAML anchor per diagram (`x-diagrams: {event_consumers: &d_event_consumers |-, …}`) that challenge blocks reference with `source: *d_event_consumers`. `--check` exits 1 when the YAML and the sources differ.

- [ ] **Step 1: Write failing tests**: `generated block lists every source file exactly once`, `toml files use the ini editor language and toml print language`, `check mode fails after a source edit`, `hand-written YAML outside the markers is untouched`.
- [ ] **Step 2: Run** `python3 -m pytest -q scripts/tests/test_uml_design_questions_yaml.py` — expect failures.
- [ ] **Step 3: Implement**; add `tutorial_sources` to `_config.yml` `exclude:`.
- [ ] **Step 4: Run** — expect pass.

### Task C8: Pre-generated diagrams and diagram-code conformance

**Files:**
- Create: `tutorial_sources/uml-design-questions/diagrams/` with `event-consumers.component.uml`, `failed-trips.sequence.uml`, `data-model.class.uml`, `outages-imports.class.uml` (the T5 contrast view), `outages.component.uml`, `checkout-latency.sequence.uml`, `capstone-website-connections.component.uml` (contains the one deliberate omission), `capstone-trip-items.class.uml`, `capstone-cancellation.sequence.uml`, `capstone-gateways.class.uml`
- Create: `scripts/tests/uml-design-questions-diagrams.test.js`, `scripts/uml_design_questions/diagram_facts.py` (adds diagram-checkable facts and evidence `path:line` values to `facts.json`)

**Interfaces:**
- Consumes: Part A syntax (stereotypes, package frames, connector labels); C6 `facts.json`; the exemplars in `docs/superpowers/specs/2026-11-20-uml-design-questions-tutorial-kit/diagrams/`.
- Produces: diagrams written by the authoring agent from the finished code. They follow spec §8.1–§8.2 (UML 2.5.1 contract, key note, notes state facts with `path:line`, size ceilings 11 classes / 8 lifelines / 14 components, manual `@pos` layouts with no saved route bends or label positions).

- [ ] **Step 1: Write failing tests** (Node; parse each diagram with ArchUML's `parse` in a vm sandbox):
  - `component diagrams contain exactly the components, interfaces, and subscribe bindings in facts.json`;
  - `the capstone website diagram omits only the order-history database connection`;
  - `sequence diagrams contain the facts' call order`;
  - `class diagrams match the hierarchy and multiplicities in facts.json`;
  - `every note path:line points at a line containing its symbol`;
  - `notation lint`:
    - lifelines are `name: Type`, `: Type`, or `x[i]: Type`;
    - no reply follows an asynchronous message;
    - component diagrams use no `-->` between components;
    - no port name ends in `()`;
    - every diagram has a key note;
    - size ceilings hold;
  - `every diagram renders without overlapping text` (Chromium, pattern from `scripts/tests/uml-structural-regressions.test.js`).
  - `no package frame contains a non-member` (the rendered `g[data-uml-package]` has no `data-package-overlaps` attribute; automatic layout does not keep members together, so every diagram with packages uses manual `@pos`).
  - `joined interface names stay visible` (give each ball-and-socket assembly room with `@pos`; the renderer can hide the shared interface name behind the provider box in tight layouts).
- [ ] **Step 2: Run** `node --test scripts/tests/uml-design-questions-diagrams.test.js` — expect failures.
- [ ] **Step 3: Write the diagrams** by reading the Headliner code for each request in spec §7, then lay them out manually. Render every diagram in both themes and fix any label that sits on the wrong path.
- [ ] **Step 4: Run** — expect pass; then `python3 scripts/uml_design_questions/build_yaml.py --write`.

### Task C9: Tutorial content, pages, navigation

**Files:**
- Create: `_data/tutorials/uml-design-questions.yml` (hand-written parts), `SEBook/tools/uml-design-questions.md`, `SEBook/tools/uml-design-questions/print.md` (front matter includes `uml_code_labs: true`)
- Modify: `_data/CS130_nav.yml` (UML → after Component Diagrams), Practice sections of `SEBook/uml_class_diagram.md`, `SEBook/uml_sequence_diagram.md`, `SEBook/uml_component_diagram.md` (one sentence plus a link each)
- Test: `scripts/tests/test_uml_design_questions_content.py`

**Interfaces:**
- Consumes: spec §7 (five tasks plus capstone, as revised in §16), the §9.1 schema, keys from `facts.json`, diagrams from C8.
- Produces:
  - Top-level keys: `backend: pyodide`, `require_tests: true`, `progress_version: 1`, `file_tree: true`, `project_search: true`, `print_unchanged_files: false`, `learning_objectives` (5, from spec §3).
  - Seven steps with stable keys `headliner`, `event-consumers`, `failed-trips`, `data-model`, `outages`, `checkout-latency`, `choose-the-view`.
  - Each step's instructions open with `### Why this matters` and `### 🎯 You will learn to` and carry a `# Pedagogy:` comment.
  - Knowledge checks on steps 1, 3, and 6 (`Step N — Knowledge Check`, `min_score: 0.8`, quiz-format rules).

- [ ] **Step 1: Write failing tests**:
  - `every key in the YAML equals facts.json`;
  - `steps open with the required headings`;
  - `instructions stay within 300 words per step before the challenge`;
  - `quizzes follow quiz-format`, using the same checks as other tutorials' content tests;
  - `no diagram note or summary states a task's key`;
  - `step keys are stable and unique`.
- [ ] **Step 2: Run** `python3 -m pytest -q scripts/tests/test_uml_design_questions_content.py` — expect failures.
- [ ] **Step 3: Write the content** (read `.agents/skills/quiz-format/SKILL.md` and `.agents/skills/tutorial-authoring/SKILL.md` first); wire the pages and navigation.
- [ ] **Step 4: Run** the content tests and `bundle exec jekyll build` — expect pass, with no build warnings for the new files.

### Task C10: Journey test, audits, and release check

**Files:**
- Create: `tests/uml-design-questions-tutorial.spec.js`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the journey test.**
  - For each challenge step:
    - write a hypothesis; pin a line through the tree and search;
    - choose wrong-then-right answers; lock in; open the evidence link;
    - check Part B; answer the follow-up, the evidence check, and the mechanism question;
    - expect Next to unlock.
  - Then:
    - reload in the locked state and expect it restored;
    - answer the capstone; expect the results card;
    - check the print view: diagrams render and keys stay hidden without instructor mode;
    - expect no console errors.
  - Use role and label locators only.
- [ ] **Step 2: Run** `PLAYWRIGHT_SERVE_BUILT_SITE=1 npx playwright test tests/uml-design-questions-tutorial.spec.js` — expect pass.
- [ ] **Step 3: Run the audits:**
  - `WCAG_AUDIT_URL_FILTER=uml-design-questions npx playwright test tests/wcag22-complete-audit.spec.js`
  - `npx playwright test tests/ai-training-opt-out.spec.js`
  - `npx playwright test tests/uml-renderer.spec.js tests/uml-component-port-alignment.spec.js tests/uml-authored-layout.spec.js`
  - `node --test scripts/tests/*.test.js`

  Check light mode, dark mode, and print by screenshot.
- [ ] **Step 4: Release gate.** A TA pilot times each whole step; adjust `budget_minutes` and distractors if any step exceeds 16 minutes. The tutorial is linked from the CS 130 navigation only after the pilot. After the pilot, apply these in one change (ready to paste):
  - **Index.** In `_data/tutorials/uml-design-questions.yml`, delete `exclude_from_index: true` and the comment above it. In `scripts/tests/test_uml_design_questions_content.py`, delete the `exclude_from_index` assertion in `test_top_level_settings_follow_the_plan`, which pins the pre-release state.
  - **Navigation.** In `_data/CS130_nav.yml`, under `UML`, directly after the `Component Diagrams` entry:

    ```yaml
          - name: "Answering Design Questions with UML"
            url: /SEBook/tools/uml-design-questions.html
    ```

  - **Practice links.** Add one sentence at the top of each chapter's practice section, before its flashcards:
    - `SEBook/uml_class_diagram.md`, under `## 6. Practice`: `To use class diagrams on a system too large to read in one sitting, judge a data model and a class hierarchy in the [Answering Design Questions with UML](/SEBook/tools/uml-design-questions.html) tutorial, first from the code and then with a diagram.`
    - `SEBook/uml_sequence_diagram.md`, under `## Practice`: `To trace a failure path and a slow checkout across several services, try the [Answering Design Questions with UML](/SEBook/tools/uml-design-questions.html) tutorial, which compares your answers from the code with your answers from a sequence diagram.`
    - `SEBook/uml_component_diagram.md`, under `## 8. Practice`: `To find an event's consumers, what an outage stops, and a connection that breaks an architecture rule, try the [Answering Design Questions with UML](/SEBook/tools/uml-design-questions.html) tutorial, which compares your answers from the code with your answers from a component diagram.`
  - **Labels.** Only if course staff have reviewed a diagram (spec §8.3), append "and reviewed by course staff" to that reply's `label`, never to the capstone's, which holds the deliberate omission; update `test_reply_labels_say_how_each_diagram_was_made` to match.
  - **Verify.** `LANG=en_US.UTF-8 bundle exec jekyll build`, the content test, `tests/uml-design-questions-tutorial.spec.js`, `WCAG_AUDIT_URL_FILTER=uml-design-questions npx playwright test tests/wcag22-complete-audit.spec.js`, and a look at `/SEBook/CS130.html` in light mode, dark mode, and print: the course page now embeds the tutorial, and `combined_has_diagram_challenges` loads the challenge stylesheet and scripts there. Also confirm that `/SEBook/tutorials` lists the tutorial.
