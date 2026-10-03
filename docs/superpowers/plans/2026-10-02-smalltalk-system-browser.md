# Smalltalk System Browser Implementation Plan

## Current release scope — user update, 2026-10-03

The user explicitly asked to preserve the implemented refactoring work and deactivate it so the Browser and live-programming workspace can be finished now. The earlier refactoring design below remains the deferred roadmap, not an active release promise. The distributed default must disable native refactoring UI and protocol operations and omit expensive guard initialization/trusted-code capture. Keep implementations and their feature-gated tests for later reactivation. Ordinary Browser method/class acceptance, native queries, source views, Versions, Inspector, live terminal, persistent Run, independent fresh checks and popup draft ownership remain in scope. Class-definition acceptance uses ordinary Smalltalk scheduling and the existing checkpoint recovery; it does not claim the deferred compound-refactoring exclusion capability. Creation/removal toolbar actions implemented through the deferred refactoring engine are inactive; classes and methods can still be authored through Smalltalk source and the live image.

One verified protocol capability, `SEBookSmalltalk.FEATURES.refactorings`, defaults to false and coordinates the UI, worker and native bridge. Re-enabling it is future development, requiring completion of the preserved native/UX validation and performance work. Do not delete the plan workspace because it contains deferred implementation evidence and the optional rename exercise. Current release validation covers active capabilities, explicit disabled-feature rejection, cold/warm latency, focused cross-browser behavior and accessibility. Native catalog/structural-guard/rename-exercise gates remain deferred rather than passed or silently discarded.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the real Squeak Smalltalk language, a live System Browser, object inspection, and native refactorings to SEBook tutorials, with persistent Run and terminal commands plus reproducible isolated grading.

**Architecture:** A host workspace controller owns accepted code and drafts. A persistent opaque-origin Worker serves live programming, while a second disposable Worker runs one isolated check or source-baseline job at a time. Smalltalk image services own compilation, reflection, source export, and Refactoring Browser operations; accessible DOM/Monaco views consume those services.

**Tech Stack:** SqueakJS 1.3.3, Squeak 6.0 build 22104 (64-bit), Refactoring Browser 3.1, plain JavaScript, Monaco, Jekyll/Liquid, Node test runner, Playwright, SUnit.

**Spec:** [Approved design](../specs/2026-10-02-smalltalk-system-browser-design.md). Read it alongside this plan.

## Global Constraints

- Preserve full Smalltalk semantics. No substitute parser, JavaScript chunk splitting, or textual refactoring fallback. Keep system method source and headless access to the compiler and native engine.
- Run and terminal Evaluate reuse the same persistent live image as the System Browser. Restart session rebuilds accepted code and clears live objects/bindings. Each individual check uses a fresh image; a check batch freezes one accepted source revision. Keep at most one live Worker and one fresh execution Worker.
- Accepted files and native change exports are durable code; editor drafts are separate; live objects, handles, checkpoints, and undo history are session-only. Follow the existing autosave preference and storage key.
- Source dependencies load in authored order, with `run_file` loaded last exactly once, then accepted changes replay, then optional `run_command` evaluates. Default source format is `filein`; explicit `doit` is supported. Resources are not autoexecuted.
- A test passes only for the actual Smalltalk Boolean `true`. Errors, other values, cancellation, timeouts, and output overflow fail.
- WCAG 2.2 Level AA applies throughout. Paragraph-sized controls, CSS modules, light/dark/print behavior, keyboard operation, and AI-training opt-out metadata are required.
- Vendor immutable inputs, licenses, source artifacts, and SHA-256 manifests. Keep adapters outside unchanged vendor code. Do not add persistent Squeak storage or a service worker.
- Preserve unrelated concurrent changes, especially `js/tutorial-code.js`, `js/tutorial-popout-manager.js`, `_layouts/tutorial.html`, `se-gym.html`, tutorial styles, and project skills. Reinspect these hooks at execution time. Do not commit, push, or publish without the user's request.
- Before executing, read the applicable project skills in `AGENTS.md`, including maintainability, tutorial runtime, test design, accessibility, theme, persistence, and keyboard/glossary guidance. Read tutorial pedagogy skills before authoring the example.

## Review Focus

1. A raw file-in changes an object and a resource before a later syntax error: restore both image and ephemeral filesystem, keep the invalid draft, and do not advance accepted code (Task 3).
2. The image changes successfully but the acknowledgment is lost: reconcile or recover before accepting another mutation; never publish twice or silently diverge (Task 3).
3. A learner accepts new code or switches steps during grading: keep the batch snapshot fixed and never award current completion for stale results (Task 9).
4. A cyclic object graph or overridden `printString` never terminates: inspection remains bounded, and Stop restores a usable session with explicit handle invalidation (Tasks 2 and 7).
5. A popup submits an old draft after another editor renamed its method: reject the stale transaction and preserve the draft for recovery (Task 11).

---

## File ownership and execution order

These are coupled parts of one feature: the Browser and refactorings share the accepted-program transaction boundary. Keep one plan, but make the runtime milestone independently testable. Tasks 1–2 are verified. At the user’s request, Tasks 6–7 and the Task 9 tutorial integration now proceed in parallel with Task 3 using its public Workspace contract. Task 4 and Task 5 native refactoring proofs remain prerequisites for enabling their UI actions. Tasks 10–11 integrate persistence and popouts; Task 12 verifies the complete release. Parallel owners must not edit each other’s files.

| Files | Responsibility |
| --- | --- |
| `scripts/smalltalk/build-image.mjs`, `scripts/smalltalk/inputs.json`, `scripts/smalltalk/README.md` | Pinned input acquisition, image preparation, provenance and rebuild instructions |
| `smalltalk/image/prepare.st`, `SEBookService.st`, `SEBookWorkspace.st`, `SEBookInspector.st`, `SEBookRefactorings.st` (all under `smalltalk/image/`) | Image startup, queued operations, native source transactions, handles, refactoring engine |
| `js/vendor/smalltalk/manifest.json`, `sebook.image`, source/changes files, runtime modules, package archives and notices under `js/vendor/smalltalk/` | Immutable, checksummed runtime distribution |
| `js/smalltalk/protocol.js`, `runtime-host.js`, `worker.js`, `filesystem.js` | Shared contract, asset/session lifecycle, VM bridge, ephemeral files |
| `js/smalltalk/workspace.js`, `refactorings.js`, `progress.js`, `tutorial-adapter.js` | Accepted program, native preview/commit coordination, saved payload validation, tutorial integration |
| `js/smalltalk/browser.js`, `inspector.js`, `refactoring-view.js`, `popup.js`; `css/smalltalk-browser.css` | Accessible views and remote workspace client |
| `js/tutorial-code.js`, `js/monaco-sebook-langs.js`, `js/tutorial-popout-manager.js`, `js/popout/shared-editor.js`, `_layouts/tutorial.html`, `tutorial-pane-popup.html`, `tutorial-tab-popup.html` | Narrow existing lifecycle, language and popup hooks |
| `_data/tutorials/smalltalk.yml`, `SEBook/tools/smalltalk-tutorial.md`, `SEBook/tools/smalltalk-tutorial/print.md` | One runnable integration example and print companion; existing tutorial index discovers the pair |
| `tests/helpers/smalltalk-runtime.js`, `tests/fixtures/smalltalk/`, `tests/smalltalk-*.spec.js`, `scripts/tests/smalltalk-*.test.js` | Real runtime fixtures, semantic/lifecycle/UI regressions, pure data contracts |
| `playwright.smalltalk.config.js`, `docs/smalltalk-runtime-validation.md` | Explicit cross-browser validation and measured runtime evidence |
| `cookies.html`, `settings.html`, `shortcuts.html`, `_data/glossary.yml`, `.agents/skills/tutorial-authoring/SKILL.md` | User-facing inventories and tutorial architecture/schema documentation |

Use the repository's existing classic-script module convention with one `window.SEBookSmalltalk` namespace. Worker modules use the equivalent worker global; avoid a new bundler. Define public contracts in `protocol.js` with JSDoc and boundary validation. View modules do not access `TutorialCode` internals.

## Shared contracts

All new names below are application contracts to implement, not assertions that upstream Squeak has methods with these names.

| Type | Required shape |
| --- | --- |
| `EntityRef` | `{kind: 'package'\|'class'\|'method'\|'comment'\|'protocol'\|'file', packageName?: string, className?: string, side?: 'instance'\|'class', selector?: string, protocol?: string, path?: string}`; validate fields appropriate to the kind |
| `SourceFile` | `{path: string, kind: 'source'\|'resource', format: 'filein'\|'doit'\|null, content: string}` |
| `ChangeBundle` | `{version: 1, source: string, entries: Array<{entity: EntityRef, before: string\|null, after: string\|null}>}`; `source` is native replayable change output, including deletions |
| `Program` | `{version: 1, stepKey: string, revision: number, files: SourceFile[], changes: ChangeBundle, runCommand: string\|null}`; files already in definition-loading order |
| `Draft` | `{target: EntityRef, baseRevision: number, source: string}` |
| `Session` | `{sessionId: string, role: 'live'\|'fresh', revision: number}`; opaque identity owned by `RuntimeHost` |
| `ValueSummary` | `{className: string, text: string, handle?: string, booleanValue?: boolean}`; `booleanValue` is present only for actual Smalltalk Booleans |
| `EvaluationResult` | `{value: ValueSummary\|null, error: RuntimeError\|null, codeChanges: ChangeBundle\|null}`; Transcript streams separately |
| `RuntimeError` | `{code: string, message: string, location?: {path?: string, start: number, end: number}}`; source ranges are zero-based UTF-16 offsets, end-exclusive |
| `RuntimeEvent` | `{sessionId: string, requestId: string\|null, revision: number, type: 'output'\|'codeChanged'\|'recovered'\|'failed', payload: object}`; `output` payload is `{stream: 'stdout'\|'stderr', text: string}` |
| `BrowseQuery` | `{kind: 'packages'\|'classes'\|'protocols'\|'methods'\|'source'\|'senders'\|'implementors'\|'hierarchy'\|'variables'\|'versions', target?: EntityRef, search?: string, offset: number, limit: number}` |
| `BrowseResult` | `{revision: number, items: Array<{id: string, label: string, target?: EntityRef, detail?: string}>, nextOffset: number\|null, source?: string}` |
| `Inspection` | `{className: string, slots: Array<{name: string, value: ValueSummary}>, nextOffset: number\|null, sessionId?: string}` (Workspace adds host-owned session identity for cleanup; native RPC omits it) |
| `RefactorRequest` | `{action: string, target: EntityRef, selection?: {start: number, end: number}, options: object}`; catalog declares and validates each action's options |
| `Preview` | `{token: string, baseRevision: number, changes: ChangeBundle, warnings: string[], consequences: string[]}`; token is session-scoped |
| `WorkspaceEvent` | `{type: 'program'\|'drafts'\|'runtime'\|'history', program: Program, drafts: Draft[], detail?: object}` |

RPC envelopes carry protocol version `1`, `sessionId`, `requestId`, `expectedRevision`, operation and payload. Replies echo identity and include the resulting revision. Transport failure rejects with `RuntimeError`; a learner exception is an `EvaluationResult.error`. Background compilation is delivered as `codeChanged` and reconciled through the same controller before subsequent source transactions. Stable error codes include `STALE_REVISION`, `STALE_HANDLE`, `COMPILE_ERROR`, `PRECONDITION_FAILED`, `CANCELLED`, `TIMEOUT`, `OUTPUT_LIMIT`, `ASSET_ERROR`, and `RECOVERED_FAILURE`.

## Task 1: Prepare and boot a pinned, source-preserving image

**Files:** Create `scripts/smalltalk/{build-image.mjs,inputs.json,README.md}`, `smalltalk/image/{prepare.st,SEBookService.st}`, `js/vendor/smalltalk/manifest.json` and its declared assets, `js/smalltalk/{protocol.js,runtime-host.js,worker.js}`, `tests/helpers/smalltalk-runtime.js`, `tests/smalltalk-runtime.spec.js`, `scripts/tests/smalltalk-supply-chain.test.js`. Extend `scripts/tests/runtime-supply-chain.test.js` only at its existing manifest inventory seam.

**Interfaces:** Produce `RuntimeHost.create({manifestURL, onEvent}) -> Promise<RuntimeHost>`, `host.openSession(role: 'live'|'fresh') -> Promise<Session>`, `host.request(session, operation, payload, {signal?, expectedRevision?}) -> Promise<object>`, `host.stop(role) -> void`, and idempotent `host.dispose() -> void`. Opening boots only the base image; Task 2's `loadProgram` loads accepted source exactly once. Define the types above in `protocol.js`. The test helper exports `withSmalltalk(page, scenario, data?) -> Promise<object>`: load real scripts on the site's origin, boot the real opaque Worker, execute the supplied async scenario against public APIs, and always dispose. It never substitutes for a UI journey.

- [ ] Write real boot and supply-chain tests. Core oracle:
  ```js
  test('opaque Worker boots pinned Squeak with method source', async ({ page }) => {
    const result = await withSmalltalk(page, async host => {
      const session = await host.openSession('live');
      return host.request(session, 'info', {}, {});
    });
    expect(result.squeakJS).toBe('1.3.3');
    expect(result.imageBuild).toBe(22104);
    expect(result.refactoringBrowser).toBe('3.1');
    expect(result.hasCompiler && result.hasSystemSources).toBe(true);
  });
  ```
  Supply-chain tests recompute every declared artifact hash, require actual license notices, and reject a deliberately corrupted asset.
- [ ] Run `node --test scripts/tests/smalltalk-supply-chain.test.js` and `npx playwright test tests/smalltalk-runtime.spec.js --grep 'opaque Worker'`; confirm failures identify absent assets/runtime, not a test syntax or server error.
- [ ] Implement the build command `node scripts/smalltalk/build-image.mjs --verify` and normal build invocation without the flag. Resolve and lock an exact compatible build-only VM artifact, URL, SHA-256 and platform in `inputs.json` before the first build; never use a moving `latest` input. Verify the SqueakJS 1.3.3 release commit against upstream, then lock it. Download the spec's exact image archive and Refactoring Browser configuration/packages, retaining the configuration's Core dependency group and selected upstream tests. Save all resolved dependencies in the lock manifest. Install service startup, suppress graphical startup, retain classes/sources, clear build-only processes/state, and save the prepared image.
- [ ] Implement verified same-origin asset loading, immutable page-memory byte cache, copied image transfer, direct opaque `data:` Workers, private MessageChannel bootstrap, and the `info` service. No browser persistent filesystem. Document transfer/memory cost before any size optimization.
- [ ] Run the two test commands again and `node scripts/smalltalk/build-image.mjs --verify`; require PASS and a fully verified manifest. Rebuild once from clean pinned inputs; compare dependency/service hashes and semantic probe results. Record any nondeterministic image bytes rather than promising byte-identical snapshots.

## Task 2: Execute real Smalltalk with bounded lifecycle and inspection

**Files:** Extend Task 1 runtime/service files; create `js/smalltalk/filesystem.js`, `smalltalk/image/SEBookInspector.st`, `tests/fixtures/smalltalk/semantics.st`, `tests/smalltalk-lifecycle.spec.js`.

**Interfaces:** Add RPC `evaluate({source, bindings: 'workspace'|'isolated'}) -> EvaluationResult`, `browse(BrowseQuery) -> BrowseResult`, `inspect({handle, offset, limit}) -> Inspection`, `releaseHandles({handles: string[]}) -> {released: number}`. Produce `host.loadProgram(session, program) -> Promise<void>`. Filesystem API: `snapshot() -> Array<{path: string, bytes: Uint8Array}>` and `restore(files) -> void`; image checkpoints will consume these in Task 3. All VM primitive callbacks enqueue requests; learner execution occurs in Smalltalk processes.

- [ ] Add `test('real image preserves Smalltalk semantics')` with exact results: `(1 / 3 + (1 / 6)) = (1 / 2)` → true; `2 raisedTo: 100` → `1267650600228229401496703205376`; fixtures prove classes/metaclasses, inheritance/`super`, closures/nonlocal returns, collections, exception handlers, reflection/`become:`, processes and semaphores. Add native chunk imports containing escaped `!`, comments and Unicode; verify source lookup and error locations, not just successful boot.
- [ ] Add `test('Stop terminates infinite evaluation and permits a new session')` with `await expect(pending).rejects.toMatchObject({code: 'CANCELLED'})`, `expect(next.value.text).toBe('42')`, and `await expect(oldInspection).rejects.toMatchObject({code: 'STALE_HANDLE'})` after a real `[true] whileTrue: []` is stopped and the session replaced. Cover timeout, output overflow, failed asset load then Retry, VM crash, stale/duplicate replies and dispose during loading. A cyclic graph must yield one bounded slot page; an infinite `printString` must not be called implicitly by inspection.
- [ ] Run `npx playwright test tests/smalltalk-runtime.spec.js tests/smalltalk-lifecycle.spec.js`; verify the new assertions fail for missing behavior.
- [ ] Implement `loadProgram` and the RPC operations in their owning modules. `loadProgram` loads definitions and change overlays only; entry/check evaluation is a separate call. Use native file-in/compiler readers; page output is plain text. Add a central configurable limits object with defaults: boot 120,000 ms, foreground operation 30,000 ms, Run/check 60,000 ms, 1,048,576 UTF-8 output bytes per operation, 100 slots/results per page and 256 preview characters. Expose no unbounded recursive object serialization. Hard cancellation terminates the correct Worker; every request settles once and releases listeners/timers/ports.
- [ ] Run the same suites to PASS. Verify ordinary method-service requests can be processed while a cooperative forked learner process remains alive. Reject an unobtainable structural safe point by deadline; do not silently reset.

## Task 3: Own accepted code, drafts, and recoverable transactions

**Files:** Create `js/smalltalk/workspace.js`, `smalltalk/image/SEBookWorkspace.st`, `scripts/tests/smalltalk-workspace.test.js`, `tests/smalltalk-workspace.spec.js`; extend runtime host/worker and service.

**Interfaces:** Produce `Workspace.create({runtime, program, drafts?}) -> Promise<Workspace>`; `snapshot() -> Program`; `getDrafts() -> Draft[]`; `setDraft(draft) -> void`; `revertDraft(target) -> void`; `commit({baseRevision, action, params}) -> Promise<Program>`; `evaluate(source, {signal?}) -> Promise<EvaluationResult>`; `browse(query: BrowseQuery) -> Promise<BrowseResult>`; `inspect(handle, offset, limit) -> Promise<Inspection>`; `restart() -> Promise<void>`; `subscribe(listener: WorkspaceEvent => void) -> (() => void)`; `dispose() -> void`. Initial commit actions: `createPackage`, `acceptMethod`, `acceptClass`, `acceptComment`, `acceptFile`, `restoreVersion`, `replaceProgram`. RPC additions: `checkpoint`, `restoreCheckpoint`, `prepareMutation`, `commitMutation`, `abortMutation`, `mutationStatus`, `exportChanges`, `replayChanges`; checkpoint bytes include image and filesystem and stay host-private until acknowledgment/recovery completes.

- [ ] Write pure draft/revision tests and `test('Accept changes behavior on a retained instance and replays in a fresh image')`. Pin live-object behavior with `expect(before.value.text).toBe('1')` and `expect(after.value.text).toBe('2')` on the same retained instance after accepting its method; assert its separately assigned instance variable is unchanged. Export class/instance/class-side methods, deletions and a baseline-method change, replay into a fresh image, and assert the same source and behavior. Invalid Accept preserves both old behavior and draft.
- [ ] Test Review Focus 1 with a native file-in fixture that mutates an existing object/resource before a malformed method; assert original object value, file bytes, accepted revision and preserved draft. Test Review Focus 2 by dropping one commit acknowledgment at the transport boundary after genuine native work; assert exactly one source revision and consistent subsequent fresh replay. Add conflicting raw-file/browser edits, Unicode source offsets, and generated code from Evaluate. Code compiled before an ordinary evaluation exception must still be reconciled into accepted source; display the evaluation error separately.
- [ ] Run `node --test scripts/tests/smalltalk-workspace.test.js` and `npx playwright test tests/smalltalk-workspace.spec.js`; establish red tests for missing transaction behavior.
- [ ] Implement one revision-checked transaction queue and native change capture. Export replayable deletions/class definitions/protocol changes with native tools. Keep draft text independent of accepted files/changes. Take/recover full checkpoints around potentially partial file-in/structural edits; preserve pre-transaction state until both sides acknowledge. Reject stale or conflicting mutations. Capture background compiler changes before another source mutation; invalidate old previews/test results. Whole-image recovery announces state rewind and creates a new handle generation.
- [ ] Run both commands to PASS, including real checkpoint restoration of object relationships and ephemeral files. If serialization/recovery cannot satisfy these tests with the pinned image, stop dependent UI work and report the concrete design gap.

## Task 4: Prove native refactoring preview, apply, undo and rollback

**Files:** Create `smalltalk/image/SEBookRefactorings.st`, `js/smalltalk/refactorings.js`, `tests/fixtures/smalltalk/refactorings.st`, `tests/smalltalk-refactorings.spec.js`; extend Workspace commit actions.

**Interfaces:** Produce `Refactorings.create(workspace) -> Refactorings`; `catalog(target) -> Promise<Array<{action: string, label: string, options: object, applicable: boolean, reason?: string}>>`; `prepare(request: RefactorRequest) -> Promise<Preview>`; `apply(preview) -> Promise<Program>`; `cancel(preview) -> Promise<void>`; `undo()`, `redo() -> Promise<Program>`; `historyState() -> {canUndo: boolean, canRedo: boolean, reason: string|null}`. Add corresponding image RPC operations and Workspace transaction actions `applyRefactoring`, `undoRefactoring`, `redoRefactoring`.

- [ ] Add `test('native rename previews without mutation and supports Apply Undo Redo')`: rename a method with a sender. Before Apply, `expect(sourceAfterPreview).toBe(sourceBefore)` and behavior remains unchanged; after Apply, `expect(senderSource).toContain('newSelector')` and `expect(result.booleanValue).toBe(true)`. Undo restores the old selector/sender; redo restores the rename. Ordinary Accept clears native undo/redo availability. Stale preview yields `STALE_REVISION` without mutation.
- [ ] Add a controlled native failure after the first member of a composite change, using a test-loaded Smalltalk change class rather than a production fault flag. Verify checkpoint recovery restores all definitions, pre-apply object relationships/state and filesystem. Cover collision, inherited implementors, warnings for dynamic sends and affected definitions outside the selected target package.
- [ ] Run `npx playwright test tests/smalltalk-refactorings.spec.js`; verify red before implementation.
- [ ] Implement native `primitiveExecute`/`RBNamespace` preview separately from application. Inspect actual pinned package selectors before binding them; do not invent upstream APIs. Map interactive options to structured inputs. Apply and publish through Task 3's transaction queue; use the native change managers for Undo/Redo and their edit-history boundary. Preserve a recovery checkpoint for structural failure.
- [ ] Run the suite to PASS and selected upstream AST/Refactoring Browser SUnit tests inside SqueakJS. Save results with the input/service hashes. **Runtime milestone:** Tasks 1–4 now prove boot, semantics, live replacement, export/replay, native preview/application and atomic recovery. Only enable native refactoring UI after this evidence exists; the user has authorized Browser and terminal implementation in parallel with the remaining runtime proofs.

## Task 5: Cover the agreed refactoring catalog

**Files:** Extend native/host refactoring adapters and `tests/smalltalk-refactorings.spec.js`; create `tests/fixtures/smalltalk/refactoring-cases.json` plus its native source fixtures in the same directory.

**Interfaces:** Extend the Task 4 catalog with explicit action IDs: `renameClass`, `renameMethod`, `renameInstanceVariable`, `renameClassVariable`, `renameTemporary`, `renameArgument`, `extractMethod`, `extractTemporary`, `inlineMethod`, `inlineTemporary`, `moveMethod`, `moveVariable`, `pullUpMethod`, `pushDownMethod`, `pullUpVariable`, `pushDownVariable`, `addParameter`, `removeParameter`, `reorderParameters`, `addClass`, `removeClass`, `addMethod`, `removeMethod`, `createAccessors`, `splitClass`. Parameter rename is `renameArgument`; selector changes use `renameMethod`. Store each action's required options and native adapter together.

- [ ] Write `test(action + ' preserves the declared behavior and rejects invalid targets')` for each catalog action, with expected affected entities and a Smalltalk postcondition independent of engine-produced changes. Each runs prepare-without-mutation, apply, postcondition, undo and redo; a matched invalid fixture checks precondition rejection. Core assertions: `expect(actualTargets).toEqual(expectedTargets)` and `expect(postcondition.booleanValue).toBe(true)`. Cover shadowed locals, strings/comments containing old names, multiple implementors, inheritance, selector arity/reordering and destructive instance-data consequences.
- [ ] Run `npx playwright test tests/smalltalk-refactorings.spec.js`; confirm unsupported actions fail the coverage table.
- [ ] Implement each action through its genuine native class and options. Convert Monaco UTF-16 selections to native source positions correctly. Reject moving methods with primitives or `super`, preserve native preconditions, and show unresolved computed sends. Never advertise an enabled action without its fixture. Report any unavailable engine operation to the user with evidence for a scope decision; do not quietly reduce the approved catalog.
- [ ] Run the suite to PASS for the full enabled catalog and record exact supported operations in the runtime documentation. Reuse Task 4 rollback coverage where actions share the same apply mechanism; add distinct structural-failure cases where the native operation differs.

### Execution scope decision: split class

The controller's recorded scope ruling keeps `splitClass` explicitly unavailable, with a native migration/Undo reason and a rejection oracle. The 24 other actions remain subject to real positive/negative fixtures and verified safe application. The proposed stateful split extension is deferred; do not enable the stock operation or infer migration proof from scheduling isolation. Final validation and user-facing limitations must disclose this scope.

## Task 6: Build the accessible System Browser and source editing

**Files:** Create `js/smalltalk/browser.js`, `js/smalltalk/source-views.js`, `css/smalltalk-browser.css`, `tests/smalltalk-browser.spec.js`; modify `js/monaco-sebook-langs.js` and `tests/helpers/smalltalk-runtime.js`; extend image browsing operations and workspace query facade.

**Interfaces:** Produce `Browser.mount({root, workspace, createEditor, refactorings}) -> {navigate(target): Promise<void>, dispose(): void}`. `createEditor({element, value, language, ariaLabel, onChange})` uses the existing Monaco wrapper and returns `{getValue(): string, setValue(value): void, getSelection(): {start: number, end: number}, dispose(): void}`. The view consumes Workspace and Refactorings public APIs only. Add test setup `mountSmalltalkFixture(page, {program, views}) -> Promise<() => Promise<void>>`, returning cleanup; `views` lists `browser`, `inspector` or `refactor`. Until Task 9 supplies the public route, mount real production views, Monaco and Worker on the site's origin. Use this helper only for setup and role/label-based UI assertions for behavior.

- [ ] Write `test('Browser preserves an invalid method draft across navigation')` against real services: select package → class → side → protocol → method; Accept a changed method, get a compile error without losing the draft, navigate away/back, revert only that draft, and browse a system-class source. Pin `await expect(page.getByRole('status', {name: 'Compilation status'})).toContainText('error')` and `await expect(page.getByRole('region', {name: 'Method source'})).toContainText('badDraftToken')` after returning, using an invalid draft with that unique marker. Also assert accepted runtime behavior. Add Senders/Implementors/Hierarchy/Variable references/Class definition/comment/Versions journeys that navigate results and preserve back/forward history.
- [ ] Run `npx playwright test tests/smalltalk-browser.spec.js`; confirm the views/actions are absent before implementation.
- [ ] Implement semantic labeled pane controls, searched/paged lists, source editor, visible draft/system-change state, Accept/Revert, package creation, create/remove class/method and query actions. Register Smalltalk syntax highlighting and `.st` language mapping in the shared Monaco module; highlighting is not parsing. Use native metadata for all results. Draft identity includes class, side and selector; rename preserves recoverable drafts rather than discarding them.
- [ ] Add `a11yCheckpoint` calls for loaded browser, compile error and query-result states. Implement coherent light/dark/print CSS with paragraph-sized text and inherited form fonts. At narrow widths use sequential panes, breadcrumb and Back controls; do not shrink four columns. Keep labels/focus usable under text spacing and zoom.
- [ ] Run `A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/smalltalk-browser.spec.js`; require semantic journeys and accessibility assertions to pass. Manually inspect normal-zoom readability and keyboard navigation in both themes now, not only at release.

## Task 7: Add live terminal, Transcript and object inspector

**Files:** Create `js/smalltalk/inspector.js`, `tests/smalltalk-inspector.spec.js`; extend `css/smalltalk-browser.css`.

**Interfaces:** Produce `Inspector.mount({root, workspace, createEditor}) -> {dispose(): void}` composing the live terminal and bounded object inspector; consume Task 3 `evaluate`, `inspect`, `restart`, events, and Task 2 handle release through the Workspace facade. Use `workspace.releaseHandles(handles, {sessionId?}?) -> Promise<void>` for view-owned handles. Workspace attaches its captured session identity to Inspection; queued cleanup with that identity skips obsolete sessions. Stop uses the caller-owned AbortSignal passed to Workspace.evaluate, then awaits Workspace.restart to rebuild accepted code; it does not cancel another caller’s request through an unscoped facade.

- [ ] Add `test('live edits preserve the inspected instance')`: retain a counter object in workspace bindings, inspect it, Accept a changed method in Browser, send again, and assert `await expect(page.getByRole('region', {name: 'Evaluation result'})).toHaveText('2')` without reconstructing the object. Assert instance state remains. Inspect named/indexed slots and a cycle using Expand/Next controls. For Review Focus 4, request an explicit hostile `printString`, Stop, then assert a reset announcement and successful new evaluation; old inspector handles show stale state.
- [ ] Run `npx playwright test tests/smalltalk-inspector.spec.js`; confirm red.
- [ ] Implement a real multiline Smalltalk terminal with Evaluate, visible command-history controls, result/Transcript output, Inspect result, Stop evaluation and Restart session. Commands share the Browser’s persistent Workspace/image and retain bindings between submissions. Keep output and history bounded; document custom keyboard shortcuts. Explain that checks are isolated. Bound rendered output and lazy slot pages; release handles when closing views. Restart/Stop reconstruct accepted code and announce lost live bindings/objects. Use safe VM summaries for previews; evaluate requested printing in a cancellable process. Preserve browser responsiveness during isolated checks. Verify terminal commands see accepted Browser edits on a retained object and that Restart invalidates its old handle/bindings.
- [ ] Run `A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/smalltalk-inspector.spec.js`; require behavioral and accessibility PASS. Check bounded status announcements, focus restoration, themes and narrow layout manually.

## Task 8: Expose refactorings, versions and change previews

**Files:** Create `js/smalltalk/refactoring-view.js`, `tests/smalltalk-refactoring-ui.spec.js`; extend Browser and component CSS. Reuse `js/tutorial-refactorings.js` only for genuinely compatible host-neutral presentation/mediation; do not route through its per-file edit application or Python AST path.

**Interfaces:** Produce `RefactoringView.mount({root, workspace, refactorings}) -> {open(request: RefactorRequest): Promise<void>, dispose(): void}`; Browser's Refactor control opens it. Versions uses `BrowseQuery.kind: 'versions'` and `Workspace.commit({action: 'restoreVersion', ...})`.

- [ ] Write `test('native refactoring preview applies once and ordinary edits end Undo history')`, plus option validation, Cancel without mutation, precondition failure, stale preview and structural-loss cases. Assert preview lists every fixture's changed definition/call site and runtime result remains valid after apply. After an ordinary edit, `await expect(page.getByRole('button', {name: 'Undo refactoring', exact: true})).toBeDisabled()`; an explanation is visible and prior method versions remain restorable as new edits.
- [ ] Run `npx playwright test tests/smalltalk-refactoring-ui.spec.js`; confirm red.
- [ ] Implement catalog-driven controls, structured native options, before/after sources, warnings, consequences and Apply/Cancel. Show rollback as recovery that resets live handles. Keep the preview's base revision visible enough to explain stale rejection; no hidden auto-reapplication. Include keyboard dismissal, trapped dialog focus where appropriate and restored trigger focus. Every operation also has a visible button/menu action.
- [ ] Run `A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/smalltalk-refactoring-ui.spec.js`; require PASS for dialogs, warnings and disabled-history states, then manually check keyboard/zoom/dark theme.

## Task 9: Integrate persistent Run, isolated grading and tutorial lifecycle

**Files:** Create `js/smalltalk/tutorial-adapter.js`, `_data/tutorials/smalltalk.yml`, the live/print page pair, `tests/smalltalk-tutorial.spec.js`, `scripts/tests/smalltalk-program.test.js`; modify narrow hooks in `js/tutorial-code.js` and `_layouts/tutorial.html`; use the existing print include unchanged unless the new metadata demands a specific fix.

**Interfaces:** Produce `normalizeProgram({stepKey, files, runFile, runCommand}) -> Program`, with revision zero and an empty ChangeBundle; `TutorialAdapter.create({root, step, createEditor, onOutput, onProgramChange}) -> Promise<TutorialAdapter>`; `run({acceptDrafts?: boolean, signal?}) -> Promise<{revision: number, result: EvaluationResult}>`; `runTests(tests, {signal?}) -> Promise<{revision: number, results: Array<{passed: boolean, error: RuntimeError|null}>}>`; `stop() -> void`; `loadStep(step)`, `applySolution(files)`, `resetStep() -> Promise<void>`; `dispose() -> void`. `tests` contains authored `{command: string}` plus existing display metadata. Input `files` uses existing `{path, content, language}` fields plus optional `smalltalk_format`; `language: smalltalk` (or omitted language with `.st`) denotes source, other languages denote resources. Adapter owns one Workspace and view set; expose `getWorkspace() -> Workspace` for persistence/popout integration.

- [ ] Add `test('Run and terminal commands share the persistent live image')` and source-normalization tests with exact ordering, missing/duplicate dependencies, resource exclusion, `smalltalk_format`, and `run_file` once. Use a retained counter/global so repeated invocations produce 1 then 2; verify a terminal command observes the same object and Restart clears its bindings. Verify ordinary Run does not reload source over a live method edit. An accepted browser change must override the chunk run-file definition on every fresh load. Add class/method deletions and modified core methods to replay tests.
- [ ] Test one fresh image per individual check; only Boolean true passes. Cover false, `1`, `'true'`, errors, output overflow and cancellation. For Review Focus 3, accept an edit during a running batch and switch steps before another result arrives; assert no current-step completion credit. Frozen old-revision results may be displayed as stale. Invalid Accept and Run must never execute the entry command; plain Run identifies excluded drafts.
- [ ] Run `node --test scripts/tests/smalltalk-program.test.js` and `npx playwright test tests/smalltalk-tutorial.spec.js`; establish red.
- [ ] Integrate the adapter at backend initialization, UI setup/dependencies, Run/Test/Stop transaction boundaries, solution/reset/loadStep and destroy. Do not alias the persistent runtime to the existing single `_worker`. Add backend editor naming and an explicit `_runTestsSmalltalk` delegate. Load the live Workspace once per step, then evaluate Run on that Workspace without reloading sources. Freeze Program once per check batch; load each isolated check image via `host.loadProgram`, evaluate its command after overlays, dispose each fresh Worker, and reject stale grading before common completion rendering.
- [ ] Author one small counter/example workspace demonstrating reading a method, live replacement, retained object state, native rename preview, terminal commands, persistent Run and isolated checks. Include a solvable Boolean check and clear live/fresh instructions; no full curriculum or step debugger. Add standard live/print front matter, scripts/styles and AI opt-out inheritance. Confirm the auto-index discovers it.
- [ ] Run the two commands to PASS, plus `npx playwright test tests/tutorial-async-lifecycle.spec.js tests/cpp-lifecycle.spec.js tests/refactoring-engine.spec.js`. Preserve active Prolog/Java integrations. Record warm Run, terminal evaluation, isolated-check and live-edit timing from the real example.

## Task 10: Preserve accepted code and drafts through autosave and transfer

**Files:** Create `js/smalltalk/progress.js`, `scripts/tests/smalltalk-progress.test.js`, `tests/smalltalk-progress.spec.js`; modify `js/smalltalk/tutorial-adapter.js`, `js/tutorial-code.js`, `cookies.html`, `settings.html`; touch `se-gym.html` only if its existing whole-record transfer fails the new tests.

**Interfaces:** Produce `encodeProgress(workspace, previous|null) -> {version: 1, steps: Record<string, {program: Program, drafts: Draft[]}>}` and `decodeProgress(value, starter: Program, legacyFiles) -> {program: Program, drafts: Draft[], warnings: string[]}`. Store the extension at the root `smalltalk_workspace` field of the existing tutorial progress record; key `steps` by stable `Program.stepKey` and preserve other steps during saves. Missing extension migrates from declared starter/saved files without inventing passed status; malformed/unsupported extension preserves recoverable drafts and reports why it was not loaded.

- [ ] Add `test('reload restores accepted code separately from an invalid draft')`; assert `expect(restored.program.changes.source).toBe(acceptedChanges)` and `expect(restored.drafts[0].source).toBe(invalidSource)`, then run the accepted behavior through the visible tutorial. Include generated definitions/removals, legacy records, reset, autosave disabled, targeted file save, step reorder, and storage quota failure. Assert no live image, handles, checkpoints or undo history in serialized progress. Exercise SE Gym export/import, its existing 4 MiB import limit and 250-entry limit without changing them.
- [ ] Run `node --test scripts/tests/smalltalk-progress.test.js` and `npx playwright test tests/smalltalk-progress.spec.js tests/se-gym-tutorial-progress-io.spec.js`; confirm missing preservation fails.
- [ ] Implement validation/migration and both full/targeted save paths. Restore accepted code before exposing live views; do not filter generated change exports through the ordinary declared-file-only path. Respect current preference/deletion controls and stable keys. Update `/cookies/` and `/settings/` descriptions to distinguish saved code/drafts from unsaved live state. Keep SE Gym's existing whole-record envelope when it already preserves the extension.
- [ ] Run both commands to PASS and `npx playwright test tests/tutorial-autosave.spec.js tests/tutorial-progress-migration.spec.js tests/browser-storage-management.spec.js` for affected persistence regressions.

## Task 11: Keep popouts attached to the same workspace owner

**Files:** Create `js/smalltalk/popup.js`, `tests/smalltalk-popout.spec.js`; modify `js/tutorial-popout-manager.js`, `js/popout/shared-editor.js`, `tutorial-pane-popup.html`, `tutorial-tab-popup.html`, and narrow TutorialCode callbacks. Full System Browser detachment uses the pane popup; tab popouts retain raw source editing and share the same acceptance controller.

**Interfaces:** Produce `PopupWorkspace.connect({port, sessionId}) -> Promise<PopupWorkspace>` with the Workspace read/draft/commit/evaluate/browse/inspect subscription API as a remote facade; all runtime ownership remains in the opener. Commands include request ID, session ID, step key and base revision. PopoutManager mediates the private connection; closing the popup detaches subscriptions, and owner destruction rejects all pending requests.

- [ ] Add `test('a stale popup edit cannot overwrite a renamed method')`, plus visible journeys for draft navigation, Accept, native preview and persistent Run across parent/popup. Assert both views show the same accepted behavior and no second live state. For Review Focus 5, rename in the parent then submit the popup's old method draft; assert `await expect(popup.getByRole('status', {name: 'Compilation status'})).toContainText('changed')` and that its source remains recoverable. Close either window mid-request and ensure the surviving UI reaches a settled state.
- [ ] Run `npx playwright test tests/smalltalk-popout.spec.js`; confirm red.
- [ ] Implement the revision-aware remote facade and popup lifecycle hooks. Reuse shared Monaco registration; load component CSS and opt-out metadata. Keep per-file draft events distinct from whole-program acceptance; never reuse generic `apply-refactor-edits` as an atomic Smalltalk commit. Restore focus to the opener control on reattachment where available.
- [ ] Run `A11Y_INTERACTIVE_CHECKS=1 npx playwright test tests/smalltalk-popout.spec.js tests/tutorial-popout-session.spec.js` and `node --test scripts/tests/popout-editor-bootstrap.test.js`; require PASS.

## Task 12: Verify compatibility, accessibility, documentation and distribution

**Files:** Create `playwright.smalltalk.config.js`, `docs/smalltalk-runtime-validation.md`; update `shortcuts.html`, `_data/glossary.yml`, `.agents/skills/tutorial-authoring/SKILL.md`, `scripts/smalltalk/README.md`, and `tests/wcag-audit-inventory.js` only if automatic discovery misses a new route/state. Extend the existing Smalltalk tests at the owning boundary for any discovered defect.

**Interfaces:** The dedicated Playwright config imports existing server/use settings, limits discovery to `smalltalk-*.spec.js`, and defines explicit Chromium, Firefox and WebKit projects. `docs/smalltalk-runtime-validation.md` records browser/OS versions, artifact hashes/sizes, commands/results, native engine catalog and known verified limits; it is evidence, not an assertion of untested support.

- [ ] Confirm the actual user journeys appear in tests with observable oracles: `await expect(page.getByRole('button', {name: 'Accept', exact: true})).toBeEnabled()`, source/behavior after edits, dialog focus, and fresh grading results. Add a failing regression for each discovered defect before its fix; no implementation-mirroring or snapshot-only tests. Update tutorial-authoring with Smalltalk YAML fields, source order, accepted/draft persistence, live/fresh ownership, refactor history/recovery and popup contracts. Document every new custom shortcut and introduced glossary term.
- [ ] Run `npm run test:unit`, `make test-check`, and `npx playwright test tests/smalltalk-*.spec.js tests/ai-training-opt-out.spec.js`. Use a fresh verified Jekyll preview instead of reusing stale shared output. Require all task-owned and affected regressions to pass.
- [ ] Run `npx playwright test --config=playwright.smalltalk.config.js` with installed Chromium/Firefox/WebKit. Diagnose and fix real browser differences; if an engine cannot support the required opaque Worker/image path, report that concrete gap before claiming browser support. Run `node scripts/smalltalk/build-image.mjs --verify` against the distributed files again.
- [ ] Run `WCAG_AUDIT_FULL_SWEEP=1 make audit-a11y` and `make audit-a11y-interactive`. Manually check main and popup keyboard-only use, source-editor escape, visible/non-obscured focus, dialog return focus, screen-reader announcements, light/dark contrast, 200% text and 400% zoom/reflow, text spacing, touch targets, narrow panes and light-mode printing. Fix introduced violations; surface unrelated pre-existing failures without sweeping changes.
- [ ] Measure actual compressed transfer size, cold boot, steady-state memory where the browser exposes a valid measurement, warm Run, terminal evaluation, isolated-check and live Accept latency. State measurement environment and unsupported metrics; do not invent memory measurements. Include upstream SUnit results and the complete refactoring coverage matrix in the validation record.
- [ ] Run `git diff --check`, inspect the complete task diff and artifact manifest, and obtain the chosen workflow's final independent review. Report implemented operations, test/browser evidence, any concrete limitations and exact files. Leave changes uncommitted unless the user subsequently authorizes publication.

## Plan review record

Self-review maps the spec's runtime/semantics to Tasks 1–2, source/state/recovery to Task 3, native engine/catalog to Tasks 4–5, Browser/live/refactor views to Tasks 6–8, persistent Run, isolated grading and example to Task 9, persistence to Task 10, popup ownership to Task 11, and packaging/evidence/accessibility/references to Task 12. Each Review Focus condition has an explicit owning test. Public contracts above are shared across tasks; native selector bindings remain evidence-driven implementation work. No runtime feasibility or test pass is claimed by this plan.
