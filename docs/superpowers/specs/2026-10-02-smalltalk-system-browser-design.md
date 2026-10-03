# Smalltalk tutorial backend and live System Browser

Status: proposed design for user review; implementation has not started.

## Outcome and agreed choices

Add `backend: smalltalk` to SEBook using SqueakJS, with a System Browser inspired by the supplied screenshot. Learners can browse and change real Smalltalk classes and methods, evaluate code against live objects, inspect those objects, and apply language-aware refactorings in the browser.

The user selected SqueakJS and a fresh image for each Run. The subsequent request adds a System Browser, live programming, and broad refactoring support. These requirements coexist through two explicit execution modes:

| Action | Image state | Source used |
| --- | --- | --- |
| Accept a method/class edit; Evaluate in the live workspace; Inspect | Persistent live session for the current tutorial step | The accepted program, updated immediately on successful acceptance |
| Run | Fresh image for every invocation | One frozen snapshot of the current accepted program and runnable source |
| Each authored test | Fresh image for every individual check | The same frozen program snapshot for the entire check batch |
| Restart live session | Fresh image, then replay accepted code | Accepted code survives; live objects and workspace bindings reset |
| Reset step | Fresh live image and starter program | Existing SEBook reset semantics, including its draft handling |

“Fresh image” resets objects, class mutations, processes, files, and globals; it does not discard accepted source changes. Live workspace evaluations do not become setup actions for Run or grading.

## Language and runtime baseline

Use SqueakJS 1.3.3 and the official Squeak 6.0 build 22104, 64-bit image as the initial compatibility baseline. The SqueakJS launcher explicitly links this image. Squeak 6.1 is newer, but changing the base image is a separate compatibility decision, not an automatic upgrade.

Retain the real compiler, classes/metaclasses, closures and nonlocal returns, exact fractions and large integers, collections, exceptions, reflection, processes, and semaphores. Preserve standard-library source so system methods can be browsed. Add Refactoring Browser engine 3.1 during image preparation: `ConfigurationOfRefactoringBrowser-ct.81` explicitly targets Squeak 6.0 and pins `AST-Core-mt.98`, `AST-Semantic-lr.15`, `Refactoring-Environment-mt.12`, `Refactoring-Changes-mt.24`, and `Refactoring-Core-eem.166`. Preserve the configuration's known-compatible Core dependency group first, including its auxiliary dependencies. The native graphical RefactoringTools adapter is unnecessary.

Headless means suppressing graphical startup and using headless VM display/input modules. It does not require deleting Morphic or tool classes from the image. The visible System Browser is accessible HTML and Monaco owned by SEBook.

Browser restrictions remain explicit: no native desktop windows, arbitrary native libraries, or unrestricted operating-system access. A language feature must not be replaced by a teaching-language approximation to work around an integration problem.

## System Browser

The main browser follows the reference image’s information structure:

1. Package/category list with search.
2. Class list with instance-side/class-side selection.
3. Protocol/category list, including all methods.
4. Method list.
5. Source editor below, with Accept, Revert draft, Refactor, and a visible modified state.

Browser actions include Senders, Implementors, Hierarchy, Variable references, Class definition/comment, and Versions. Results use a docked, navigable panel. The first implementation does not reproduce the screenshot’s overlapping desktop windows; the existing tutorial popout mechanism can detach the workspace without creating another runtime owner.

Selecting a result navigates to its class, side, protocol, and method. Back/forward navigation preserves the learner’s place. Package/class/method creation, method removal, and class removal are explicit actions with compiler/precondition feedback. Browsing includes system classes, while the initial view emphasizes the tutorial’s packages. System-code changes are marked as such and remain local to the learner’s disposable image.

Dirty drafts are keyed by class, side, and selector. Changing selection never silently accepts or discards a draft. Accept compiles through Squeak; a syntax error preserves both the draft and the previously accepted method. A successful acceptance updates the live session immediately without pressing Run.

## Live programming and inspection

Provide a live workspace with Evaluate, Inspect result, Transcript, and Restart session. Evaluation bindings persist within the live session. An accepted method replacement affects subsequent sends to existing instances. An activation already executing the old method may finish using that method; accepting source is not a rewind of the call stack.

The image service handles browser requests at VM scheduling boundaries while learner processes can remain alive. Serialize code-change transactions, not the entire lifetime of every forked learner process. Ordinary method replacement must not require terminating those processes. Structural changes and refactorings require a safe application point; if the runtime cannot obtain one within its deadline, refuse the change rather than silently resetting live state.

The inspector exposes named instance variables, indexed slots, class information, and bounded previews. Objects remain inside the VM and are represented to the page by session-scoped handles. Expand lazily rather than recursively traversing the object graph. Stale handles are rejected after a restart. Evaluating `printString` or a user expression is bounded and cancellable because either can run arbitrary Smalltalk code.

Class-layout changes use Squeak’s class-building and instance-migration machinery. If a change cannot be performed safely, show the engine’s precondition failure. Do not silently restart the session to make an incompatible live change appear successful.

Stopping a stuck live evaluation terminates its Worker. The browser then offers/reconstructs the accepted program in a fresh live image and announces that live objects were reset. Stopping Run or a test only disposes that fresh execution image. Browser queries and editing stay responsive while fresh execution runs.

## One accepted program, with revision tracking

A host-side workspace controller owns the accepted source snapshot and a monotonically increasing code revision. The live image supplies authoritative Smalltalk parsing, source metadata, and change descriptions; it is not the only durable copy of accepted code.

The accepted program includes authored source files plus normalized Smalltalk changes for browser edits to classes and methods, including removals and changes to baseline classes. Export these changes as ordinary Smalltalk source that a fresh image can replay. Show these changes in the workspace so a learner can inspect and export what will run.

Browser edits, file edits, and refactorings commit through this same controller. Source and browser metadata update as one transaction after VM acknowledgment. A stale editor/refactoring preview cannot overwrite a newer revision. If a raw-file edit conflicts with accepted browser changes, report the conflict instead of silently letting one representation override the other. Accepted raw-file changes compile/file-in as a transaction too; typing alone changes a draft.

File-in can execute arbitrary do-it chunks before a later chunk fails. Its recovery checkpoint therefore covers the live image and ephemeral filesystem, not only method source. Retain recovery state until both the VM operation and host source commit are acknowledged. A lost acknowledgment triggers reconciliation/recovery before further mutations are accepted. External effects, if a program invokes an available external service, cannot be rolled back; do not describe image recovery as undoing those effects.

Compilation or class changes performed from Evaluate are captured through the image's native change notifications and exported into the same accepted program. They advance its revision and invalidate old tests/previews. Ordinary object mutations and workspace variable bindings remain live-session state. This distinction prevents a method created in the workspace from disappearing silently on fresh Run.

Unaccepted method drafts are distinct from accepted code. Run and tests must visibly identify when drafts are excluded; failed compilation must never look like the invalid draft executed. Accepted changes and drafts follow the existing autosave preference. Reload restores code/drafts, then creates a new live image; it does not restore arbitrary live objects.

Extend the existing tutorial progress payload with a versioned `smalltalk_workspace` record containing accepted files, accepted change exports, and separate drafts. The current single saved model value per file cannot represent both accepted code and an invalid draft. Preserve this record through ordinary restore, SE Gym import/export, and reset; include migration from records without the extension. Runtime images, object handles, recovery checkpoints, and native undo history remain page-session-only. The existing storage key and opt-out control remain authoritative, while `/cookies/` and `/settings/` describe the expanded saved content.

Changing steps, Reset, or teardown cancels outstanding operations and invalidates object handles and previews. Test results belong to the program revision that produced them; accepting another change makes prior passing results stale.

## Source execution and grading

Use Squeak’s actual compiler for workspace do-its and the native file-in reader for traditional chunk files. Source format is explicit in Smalltalk file metadata (`smalltalk_format: doit` or `filein`); declared definition files default to `filein`. Never split chunk files with a JavaScript `!` heuristic or implement a second Smalltalk parser.

Separate definition loading from entry evaluation. Dependencies load in authored `steps[].files` order, with the designated `run_file` loaded last and exactly once in that definition phase. Apply accepted browser change exports after all source loading. Then evaluate `steps[].run_command` as the entry do-it, if supplied; when it is absent, report successful program loading. In particular, a chunk `run_file` must never be filed in again after browser changes, which would overwrite accepted methods. Only declared source dependencies are auto-loaded; resource files remain available in the in-memory workspace. Missing files, ambiguous formats, and invalid dependency configuration produce actionable errors.

The same ordered loading and accepted-code overlay populate the live image and every fresh check. Keep application entry actions in `run_command`, rather than running them prematurely as definition-file initialization. Code can still create or compile classes dynamically using ordinary Smalltalk; mutations made during a disposable Run/test belong to that disposable image.

Run snapshots the accepted source revision once at invocation. Unaccepted drafts are visibly identified and excluded; provide an explicit Accept and Run action for compiling drafts before starting a fresh execution. Compilation failure prevents that execution and preserves the draft. Later accepted edits belong to the next Run. Stream Transcript as plain text and show the final entry do-it value separately. Chunk file-in success is reported as file-in completion rather than pretending the stream object is a program result.

Each `tests[].command` is ordinary Smalltalk evaluated after loading that check’s fresh program. It must return the Boolean `true` to pass. `false`, non-Boolean results, compiler/file-in errors, exceptions, timeouts, cancellation, and output-limit failures cannot pass. SUnit remains usable within a command; authors can finish successful assertions with `true`.

Every check receives its own image, including its own filesystem and processes. The batch uses one frozen code revision. This costs more initialization time than sharing an image, but prevents test-order dependence and follows the user’s choice.

## Refactoring scope

Use Squeak’s Refactoring Browser engine, parser/model, preconditions, and change objects. The initial supported catalog targets the following common operations, subject to the native engine’s applicability checks:

| Group | Operations |
| --- | --- |
| Rename | Class, method/selector, instance variable, class variable, temporary variable, method argument |
| Extract and inline | Extract method, extract expression to temporary, inline method, inline temporary |
| Move and inheritance | Move method, move variable definition where supported, pull up/push down methods, pull up/push down variables |
| Method signatures | Add parameter, remove parameter, reorder/rename parameters through selector transformation |
| Class organization | Add/remove class or method with checks, create accessors, split class using the native operation |

“Most refactorings” means this explicit catalog, not an unrestricted claim that every transformation in every Smalltalk IDE is supported. Each enabled action requires real integration coverage. If an engine operation proves unavailable or cannot run headlessly, surface that gap for a scope decision rather than providing a textual approximation or a decorative menu item.

The interaction is Select target → supply parameters → check preconditions → preview all affected definitions/call sites → Apply or Cancel. Preview does not mutate the live image or accepted source. The engine's `primitiveExecute` builds changes on an `RBNamespace` model; applying those changes is a separate action. Supply its interaction options through structured browser controls instead of invoking native dialogs. Show collisions, inheritance effects, references outside the writable scope, and dynamic sends such as `perform:` that prevent a complete static guarantee. Do not claim that every dynamic reference has been found. Preserve native restrictions, including rejection of move-method requests involving primitives or `super` sends.

Bind each preview to its code revision. Applying a stale preview requires regeneration. Apply the native composite change as one serialized operation, then publish its source change transaction. Keep a pre-apply recovery checkpoint so a failed structural change restores the prior program/live session rather than leaving half-applied source. Checkpoint/restore behavior must be demonstrated with the selected image before this contract is considered implemented.

Provide native refactoring Undo/Redo and a versions/change log. Undo reverses the recorded code change and associated class structure; it does not reverse unrelated effects of workspace evaluations. The engine clears refactoring undo/redo history after ordinary source edits: expose that boundary and disable stale history rather than promising unlimited interleaved undo. Earlier method versions remain reviewable and can be restored as a new accepted edit. Destructive structural changes that can lose instance data must state that consequence before Apply and preserve the recovery checkpoint. Whole-image recovery restores live state as well as code and invalidates inspector handles; it is labelled recovery, not code-only undo.

Reuse the existing refactoring preview/popout mediation where it fits, but do not treat the current per-file edit application as an atomic Smalltalk transaction. Keep the native Smalltalk adapter separate from Python AST handling.

## Runtime boundaries and lifecycle

Use dedicated opaque-origin Workers, following the repository’s existing `data:` Worker pattern. The page retains Worker handles for unconditional termination. No iframe or cross-origin-isolation service worker is required by this design.

The host loads and verifies local runtime/image assets once and retains immutable bytes in page memory. A fresh execution Worker receives a copy of those bytes, never the sole cached buffer. There is one persistent live Worker and at most one fresh execution Worker per tutorial; a test batch runs sequentially. A short-lived isolated refactoring preview model must not compete with an unbounded number of additional images.

Communicate through a private MessageChannel with session, request, and code-revision identifiers. Reject stale replies. Keep transport completion distinct from printed text and compiler results. Each operation settles exactly once on completion, failure, cancellation, timeout, navigation, or destruction.

Use a small image-side service with a request/result primitive bridge. Learner evaluation runs in its own Smalltalk process; it does not execute synchronously inside a JavaScript callback. This avoids the upstream JSBridge’s short synchronous callback deadline. Arbitrary JavaScript interoperability is not needed for the tutorial transport.

Provide an ephemeral filesystem for tutorial resources and the image’s source/changes needs. Do not enable SqueakJS’s default persistent image/filesystem storage accidentally. Browser-origin storage remains owned by SEBook. Opaque Workers are not advertised as a complete network sandbox or tamper-proof grading system.

## Module responsibilities

| Proposed boundary | Responsibility |
| --- | --- |
| `js/smalltalk/runtime-host.js` | Verified asset loading, Worker sessions, RPC lifecycle, cancellation and deadlines |
| `js/smalltalk/worker.js` | Headless VM boot, ephemeral filesystem, image-service transport |
| Checked-in Smalltalk image-service sources | Compilation, browsing, object handles, native refactoring and code export |
| `js/smalltalk/workspace.js` | Accepted program/draft revisions and serialized source transactions |
| `js/smalltalk/browser.js` | Browser selection, source editing, queries and navigation |
| `js/smalltalk/inspector.js` | Live workspace and object inspection views |
| `js/smalltalk/refactorings.js` | Native engine capability mapping, previews, apply and undo integration |
| `css/smalltalk-browser.css` | Browser/inspector presentation in light, dark and print modes |
| `js/tutorial-code.js` and tutorial layouts | Narrow backend/panel lifecycle hooks; no general backend-registry rewrite |

Names can be adjusted to existing conventions during planning; responsibilities and ownership are the design constraints. Main windows and popouts send mutations through the same host controller rather than owning independent images.

## Accessibility and responsive behavior

Apply the project’s full WCAG 2.2 AA requirement. Use semantic controls, explicit labels, visible selection and focus, keyboard-operable search/navigation, and status announcements without focus theft. Source editors expose descriptive labels and an escape route from editor key handling. Every shortcut has a visible control and an entry in `/shortcuts/`.

Use paragraph-sized controls and source text, with `font: inherit` on ordinary inputs/buttons. Do not shrink four columns to make them fit. On narrow viewports, use a sequential package/class/protocol/method view with a breadcrumb and Back controls; keep source editing usable at text zoom. No essential operation requires dragging, hovering, color recognition, or a context menu.

Refactoring preview has readable per-file changes, explicit destructive consequences, proper dialog focus/escape behavior, and focus restoration. The inspector bounds announcements and output growth. All presentation belongs in CSS modules; use `html.dark-mode` and coherent light-only print behavior. Printed tutorials show source and explanatory content, not interactive browser chrome.

Any new HTML entry/runtime page includes the site’s AI-training opt-out metadata. Update glossary terms, shortcut documentation, storage inventory/settings descriptions, and the tutorial-authoring skill in the implementation change. Do not claim an automated accessibility scan establishes complete manual conformance.

## Packaging and delivery

Vendor exact runtime, image, sources, refactoring packages, and required plugins with provenance, actual license notices, and SHA-256 manifests. Keep the repository adapter outside unchanged vendor sources. Image preparation is a checked-in script with pinned inputs and a pinned build VM. Users of the site need only their browser.

The prepared image starts at the tutorial service, with graphical startup disabled and no previous learner state. Record compressed transfer size, steady-state memory, cold boot time, fresh-run time, and live-edit latency from actual measurements. No performance claim follows merely from using JavaScript or an image snapshot.

Integrate a minimal Smalltalk workspace/example through the existing live/print tutorial route convention so the backend and Browser can be exercised. This is an integration example, not a new multi-lesson course. A full curriculum and a step-through debugger are separate additions.

## Validation required before completion

- Real compiler/VM cases: classes/metaclasses, inheritance and `super`, blocks/nonlocal returns, fractions/large integers, collections, exceptions, reflection, `become:`, processes/semaphores, and native chunk imports including escaped exclamation marks and Unicode.
- Fresh-state cases: repeated Run, removed definitions, mutated globals, altered core methods, changed files, forked processes, independent tests, and edits made during an active batch.
- Live-programming case: retain an object, accept a new method implementation, send the same message to that same object, and observe the new behavior without rerunning construction.
- Draft and code consistency: failed Accept leaves prior behavior intact; selection/popout navigation preserves drafts; accepted browser changes run identically in fresh execution; stale previews/replies cannot overwrite new code; reload respects autosave settings.
- Browser behavior: class/side/protocol/method selection, actual senders/implementors, hierarchy and variable references, bounded inspectors, versions, and reset/teardown.
- Each refactoring: correct target and affected references, precondition rejection, preview without mutation, successful apply, undo/redo, and failed-apply recovery. Cover collisions, inheritance, shadowed locals, escaped strings/comments, and unresolved dynamic references.
- Lifecycle: real infinite-loop Stop, timeout, bounded output, syntax/runtime errors, failed asset fetch, retry, Worker crash, session reset and stale object handles; the page remains responsive.
- Repository checks: vendor manifest/build reproducibility checks, existing affected backend/popout regressions, Jekyll build, AI-training opt-out audit, focused and full required accessibility checks, manual keyboard/reflow/light-dark/print review, and `git diff --check`.

The first implementation milestone must prove the pinned image, native refactoring packages, opaque Worker boot, live method replacement, code export/replay, and structural rollback. If any fails, revise the affected design with concrete evidence before building a UI that assumes it works.

## Evidence

- [SqueakJS runtime and headless modes](https://github.com/codefrau/SqueakJS)
- [Official launcher and supported image examples](https://squeak.js.org/run/)
- [Squeak 6.0 build 22104 image archive](https://files.squeak.org/6.0/Squeak6.0-22104-64bit/Squeak6.0-22104-64bit.zip)
- [Squeak license information](https://squeak.org/license/)
- [Squeak Refactoring Browser model packages](https://www.squeaksource.com/rb/)
- [Refactoring Browser 3.1 dependency configuration](https://www.squeaksource.com/MetacelloRepository/ConfigurationOfRefactoringBrowser-ct.81.mcz)
- [Native refactoring implementation](https://www.squeaksource.com/rb/Refactoring-Core-eem.166.mcz)
- [Native change and undo implementation](https://www.squeaksource.com/rb/Refactoring-Changes-mt.24.mcz)
- [JavaScript bridge callback implementation](https://github.com/codefrau/SqueakJS/blob/main/vm.plugins.javascript.js)
- Existing repository integration: `js/tutorial-code.js`, `js/playwright-compat/runner.js`, `js/tutorial-refactorings.js`, `js/tutorial-popout-manager.js`, `js/monaco-sebook-langs.js`, and `scripts/tests/runtime-supply-chain.test.js`.

Upstream documentation and source have been inspected. The proposed image preparation, integration, performance, refactoring behavior, and browser compatibility have not yet been executed or verified.
