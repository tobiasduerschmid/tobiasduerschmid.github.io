# Pinned Smalltalk runtime

The current distribution **disables native refactoring**. Its implementation,
upstream classes and tests are retained for future work, but refactoring controls
and protocol operations are unavailable. The single verified declaration
`SEBookSmalltalk.FEATURES.refactorings` in `js/smalltalk/protocol.js` is `false`;
changing this verified adapter requires rebuilding the distribution, not just
editing a UI flag. Expensive structural-guard initialization is inactive. Ordinary
Browser acceptance, source queries, Versions, terminal evaluation, Inspector,
persistent Run, fresh checks and shared-owner popups remain active. Future
reactivation requires completing the deferred native, performance and UI gates.
See [the validation record](../../docs/smalltalk-runtime-validation.md) for evidence
and remaining limits.

From the repository root:

```sh
node scripts/smalltalk/build-image.mjs
node scripts/smalltalk/build-image.mjs --verify
node --test scripts/tests/smalltalk-supply-chain.test.js scripts/tests/runtime-supply-chain.test.js
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/sebook-smalltalk-browsers JEKYLL_PORT=4178 npx playwright test tests/smalltalk-runtime.spec.js --grep 'opaque Worker'
```

The build requires macOS ARM64, Node, curl, tar, unzip and hdiutil. It downloads the **build-only** OpenSmalltalk stack VM release `202606270913` into a private input cache, mounts its DMG read-only, runs `-headless`, and detaches it. It does not install a VM globally. `SMALLTALK_INPUTS_DIRECTORY` selects another cache directory; an empty directory exercises clean acquisition. Downloaded bytes must match the SHA-256 lock before extraction or execution. A missing or changed upstream input fails the build; never update hashes to make an unexplained mismatch pass.

`inputs.json` is the acquisition lock: URLs, SHA-256 hashes and platform for SqueakJS release commit `284b7dacd385cfd3258c6337d41fc875459816ea` (its package version is 1.3.3), the official Squeak 6.0 build 22104 archive, the native Refactoring Browser configuration `ConfigurationOfRefactoringBrowser-ct.81`, its complete 3.1 Core and Tests package closure. `js/vendor/smalltalk/manifest.json` is the **distributed artifact** inventory. It hashes every runtime module, prepared image, source/changes stream, archived MCZ package, service source and license notice. It also hashes the local worker/protocol adapters and input lock. `--verify` recomputes these hashes, detects missing or undeclared artifacts, and detects service edits requiring an image rebuild.

The upstream configuration's `version31:` method pins the package closure. The builder loads those exact MCZ archives through a local `MCDirectoryRepository`, omitting only optional English spelling initialization. The full 15-archive Core/Tests closure and all 25 native refactoring classes remain available; English spelling lint and its dictionary-dependent tests are unavailable. Invoking Metacello dynamically would acquire unpinned bootstrap dependencies from an obsolete HTTP server. The service reads the installed configuration's version pragma and actual Monticello ancestry; it also executes the real compiler and RB parser, and reads `Object >> yourself` from system sources. The version/availability answers are not fixed success constants.

`prepare.st` retains system classes, compiler, source/changes streams and all loaded upstream tests. It removes graphical startup hooks and build repository locations. Preparation terminates its active process after starting a separate native service process; that process saves and resumes the image into the request loop. The original SqueakJS headless bundle and required upstream plugin modules are copied unchanged. Local adapters supply private RPC, the volatile filesystem, full checkpoint capture/reload, bounded immutable source reads and a native-rooted source metadata watch. JavaScript/FFI/network bridge plugins are not included.

The host verifies same-origin asset bytes before executing them, creates an opaque-origin `data:` Worker directly, and transfers one private MessageChannel and copies of the image/source/changes buffers. Requests and replies carry session/request/revision identity. Payloads must be plain JSON objects containing only strings, booleans, null, finite numbers, dense arrays and nested plain objects. Functions, undefined, symbols, BigInt, nonfinite numbers, sparse arrays, cycles, accessors and custom objects such as Date/Map are rejected with `PRECONDITION_FAILED` before dispatch. Synchronous browser transport failures reject with `RECOVERED_FAILURE` and remove the pending watchdog/abort listener; an undelivered request does not stop the healthy session. Stopping a role terminates its worker and rejects pending operations; disposal is idempotent. Each worker uses only an in-memory filesystem. No localStorage, IndexedDB, Cache API or service worker is introduced.

## Size and memory

The source-preserving distribution measured on 2026-10-03 contains 54,055,512 image bytes, 54,972,153 system-source bytes, 1,459,993 changes bytes and 728,548 runtime-module bytes: **111,216,206 bytes** for those boot assets. Per-file gzip level 6 totals **26,378,263 bytes**; this is a compression estimate, not measured deployed transfer. Small adapters and the manifest add further bytes. The validation record identifies the exact manifest. The page keeps verified byte buffers privately for reuse during its lifetime. Each worker receives its own binary inputs, then expands the image into JavaScript objects; actual resident memory is unmeasured and depends on the browser. Simultaneous live/fresh workers multiply that cost. No stripped image or resident-memory reduction is claimed.

## Provenance and limitations

Actual notices are copied from the pinned SqueakJS archive and the running image's `Smalltalk license`; the latter includes MIT and Apache attribution. The native MCZ archives preserve package authors, version ancestry and method stamps. The upstream [RB repository](https://www.squeaksource.com/rb.html) declares MIT licensing. The optional external English dictionary is not acquired or shipped because its matching data-license notice was not established. Package source/archives remain intact. The builder skips `postLoadRBSpelling`, whose only action is constructing `RBInternalSpellChecker`; ordinary refactorings do not initialize spelling. Explicit spelling lint or spelling test-resource setup would request the missing dictionary and is unsupported. No alternative wordlist is substituted; the worker has no network plugin.

Prepared image/changes bytes are not reproducible byte-for-byte: the native system includes timestamps, object identity hashes and snapshot state. Clean rebuild verification compares every stable dependency/service hash and the actual semantic probe, and records differing image/changes hashes. Browser tests remain the boot oracle for the published image. The initial dated Cog VM crashed in code compaction on this macOS version, including with a larger code cache; the pinned stack interpreter avoids that path.

The runtime provides persistent Workspace evaluation, accepted source and drafts, native transactions, full checkpoint recovery, browsing and inspection. The System Browser, terminal and tutorial adapter compose that Workspace; individual grading checks use fresh images. Refactoring preview/apply and durable Browser draft persistence remain separate integration work. Native service operations must consider that Smalltalk reflection can redefine image code; the private JavaScript channel protects browser capabilities but does not establish adversarial isolation inside the image.

## Native execution and inspection API

`RuntimeHost.create({manifestURL, onEvent, limits?, signal?})` verifies the distribution,
with a bounded, cancellable asset-loading phase,
then `openSession('live' | 'fresh')` owns one disposable Worker for that role.
`loadProgram(session, program)` writes source/resources into the volatile filesystem,
loads source files in their supplied order using the native chunk reader (or the
explicit `doit` compiler mode), and replays the native changes overlay. It does not
execute `program.runCommand`. Ordinary Run and terminal Evaluate use the persistent live
Workspace. Each individual grading check leases a fresh image, loads the frozen accepted
Program and requests `evaluate` separately. `withFreshSession(operation, {signal})`
serializes fresh jobs; queued cancellation never interrupts another owner. Ordinary
fresh execution skips ledger capture; raw-file rebase explicitly enables `captureChanges`.

`request(session, 'evaluate', {source, bindings: 'workspace' | 'isolated'})` returns
an EvaluationResult. Workspace bindings last for the session; isolated bindings
last for that evaluation. Native classes, closures, reflection, exceptions, processes
and semaphores retain Smalltalk behavior. Native interactive compilation uses the
anonymous `sebook` author stamp, so the image never waits for a graphical initials
dialog when learners compile methods from an expression. A learner exception is `result.error`;
transport failure rejects. Only an actual Boolean has `value.booleanValue`.

`browse` implements the shared BrowseQuery contract through native class organization,
compiled-method literals, source files and native ChangeSet version records.
`inspect({handle, offset, limit})` reads one page of fixed/indexed slots.
Summaries never recursively traverse object graphs and do not send `printString`
to arbitrary objects. Exact built-in scalar classes receive scalar previews;
other objects receive a class description and an explicit releasable handle.
`releaseHandles({handles})` releases those session references. A replacement image
uses a new handle generation and rejects prior handles with `STALE_HANDLE`.

The native `SEBookService` transport pump queues one operation Process at a time.
Learner-created processes use the image scheduler and remain alive after the
foreground result. `SEBookBrowser` owns system queries; `SEBookInspector` owns object
handles; `SEBookWorkspace` owns compiler requestor bindings and source diagnostics.
The source stream extends the native reader solely to record chunk offsets; it does
not replace chunk parsing. Locations use zero-based, end-exclusive UTF-16 offsets.
Requests cross as UTF-8 JSON bytes. `SEBookJSON` fixes the upstream WebUtils encoder's
four-digit truncation for supplementary Unicode without changing upstream classes.
Its decoder also consumes the closing brace of an empty JSON object: the pinned
WebUtils decoder omitted this, corrupting later siblings in nested source snapshots.
A public RPC oracle covers nested empty dictionaries/arrays and later siblings.

Limits default to 120,000ms boot, 30,000ms foreground operations, 60,000ms Run/check
(`request` option `purpose: 'run' | 'check'`), 1,048,576 UTF-8 output bytes,
100 slots/results per page and 256 preview characters. `limits` may override positive
integer values. Asset acquisition, image boot, and each `loadProgram` initialization
(definitions, accepted overlays and source-baseline capture) each use the finite
`bootMs` budget. Loading is separate from foreground Evaluate and explicit Run/check;
those retain `operationMs` and `runMs` respectively. Stop/cancellation still interrupts
initialization immediately. Output has a per-operation budget and a cumulative session budget
for detached background output. Exhaustion, Stop and ordinary operation deadlines
terminate the exact Worker and settle all requests. A `barrier` request queued behind
active work has a non-destructive deadline: it rejects without resetting the image.
This is an idle-operation seam, not a claim that future structural mutations have
already frozen every learner process.

## Ephemeral filesystem and checkpoint handoff

`FileSystem.snapshot()` / `restore(files)` copy path-to-byte entries. A byte snapshot
alone cannot restore open native streams. `checkpoint.js` uses `prepareHandleRoots(vm, nonce)`
from the native service checkpoint barrier, then `capture(handles)` / `rebind(sidecar,
restoredHandles)` alongside the synchronized VM snapshot. The global
`SEBookCheckpointRoots` is `[1, nonce, handles, service]` in native one-based order.
Preparation clears old handle roots, collects the image, enumerates live JS-backed
handles, and roots the new native Array. The capture primitive synchronizes active context/process registers and performs
its final collection before serializing the actual image.

The filesystem sidecar deduplicates shared backing records by identity and preserves
path bindings, empty directories, the open-file registry, refcounts, contents,
modified flags, handle modes and positions, including records detached by deletion.
Flush never recreates a deleted path. Captured bytes are copied so one retained bundle
can restore more than once. Console writes stream directly without a partial-line
buffer. The native true/false snapshot continuation restarts only the service barrier.
Scheduling sidecars pause the monotonic clock; wall time remains current. A new Worker
and channel rebind streams before interpretation, skip cold-boot image patches, reset
inspection handles and confirm the retained nonce/revision/runtime identity.
Checkpoint bytes remain host-private and volatile; public callers receive opaque IDs.

Focused verification:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/sebook-smalltalk-browsers JEKYLL_PORT=4178 \
  npx playwright test tests/smalltalk-runtime.spec.js tests/smalltalk-lifecycle.spec.js
node --test scripts/tests/smalltalk-filesystem.test.js scripts/tests/smalltalk-supply-chain.test.js
node scripts/smalltalk/build-image.mjs --verify
```


## Accepted source and transactions

`Workspace` owns code-only Program snapshots, semantic draft identities, the mutation
queue and publication events. `SEBookTransactions` owns stable mutation ID/digest,
prepared/staged/committed/acknowledged status and deduplication. `SEBookChanges` owns
native source snapshots, conflicts and the native ChangeSet exporter. Service remains
the transport/scheduler owner; Workspace compiler bindings and Browser queries are
separate native objects. No JavaScript parser, chunk splitter or refactoring fallback
is present.

Accept prepares the native transaction, retains a full image/filesystem checkpoint,
commits and explicitly acknowledges before publishing one revision. Lost replies query
native status; failed/unknown mutations restore the retained image and abort the saved
prepared transaction. Observers cannot make an acknowledged commit roll back. Drafts
survive rejection, and recovery announces a state rewind/new handle generation. Accept clears
only the submitted draft instance; a newer edit remains unchanged and can be stale.
Workspace disposal aborts its lifetime signal, releases retained checkpoints and cancels
only its own live session/fresh lease. Pending boot, replacement and rollback continuations
cannot publish or recover after disposal; repeated cleanup cannot stop a newer owner.
Raw files first stage genuine native file-in, then obtain a fresh candidate-files
baseline through the shared fresh lease. Native copied source comparison rejects actual
conflicts and derives the overlay against that baseline, including definitions omitted
from replacement text that native incremental file-in retained. No blanket overlay ban.

Notifier events retain generated source, including code compiled before an ordinary
exception. Native boundary comparison catches silent method installation and organization
changes. Comparisons use installed CompiledMethod identity, because native bytecode
equality hides source-only changes. Native export preserves definitions, methods,
comments, protocols and deletions. Native rename lineage feeds ChangeSet rename records,
so previously compiled clients retain their global Associations on replay and after
further edits following Restart. A raw-file replacement that removes the original
declaration required by an accepted rename is an overlapping class conflict: it is
rejected with full recovery, while disjoint file edits remain supported. The narrow
ChangeSet subclass omits automatic
class-side `initialize` sends. Source-less silent compilation may require native
decompilation, which preserves replayable behavior rather than nonexistent original text.

`source-watch.js` skips the expensive native scan only when native-supplied metadata is
unchanged. Each descriptor roots an object in the image, gives a traversal depth and,
for class objects, a native structural slot count that excludes live class-instance
state. The pinned adapter compares pointer identity, class identity and copied byte/word
contents; it does not interpret source. Method dictionaries, nested organizations,
shape/trait/pool metadata and the class set are watched. Any difference falls back to
native reconciliation/export. A replacement Worker discards the watch and rebuilds it
from restored native roots. The immutable vendor VM is unchanged.

Original cold source/changes bytes remain in the Worker from verified assets. A bounded
primitive returns only a byte range (at most one MiB) selected by native source-pointer
metadata. Native chunk parsing occurs before UTF-8 decoding, so escaped chunk markers
and multibyte characters at the window edge retain native semantics. Reads start at
4 KiB and grow only when a chunk crosses the boundary; overlong chunks fail clearly.
Cold method/comment text comes from this immutable backing even if learner files are
truncated. Authored/accepted source is copied in the ledger; notified changes are copied
before a later mutation can overwrite their backing. The local native ChangeSet exporter
consumes these captured method/comment strings as well: it never falls back to mutable
SourceFiles for an already retained source cut. Native chunk writing, organization,
rename/fat-definition ordering, deletions and the no-initializer policy remain in force. No global SourceFiles replacement
or filesystem read mode affects other native processes.

The runtime does not enable JavaScriptPlugin, sockets or FFI. Checkpoints cannot undo
external browser/OS effects. VM snapshots are substantial (~54 MB image plus filesystem
and expanded VM memory); warm Evaluate avoids them, whereas Accept deliberately retains
a full recovery point. See the Task3 report for measured latency and exact real-image
proof coverage.

Inspector results include the `sessionId` captured by the queued inspection.
`workspace.releaseHandles(handles, {sessionId})` skips cleanup when a queued Restart
has already replaced that generation; callers need not parse opaque handle strings.
Unscoped callers retain the existing release behavior.

Durable source capture currently covers classes/metaclasses and their methods,
comments and organizations. Standalone Trait definitions and Trait-owned method edits
made only in the terminal are **not captured for Restart or fresh grading**. Authored
source files can still define Traits and native evaluation executes them normally.
Watching a class's trait composition does not establish general standalone Trait
capture/replay support. Do not describe every reflective compilation as durable.
