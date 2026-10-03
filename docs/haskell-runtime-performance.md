# Haskell runtime performance investigation

Measured October 2, 2026. The site continues to use its existing browser-only
MicroHs distribution: **2,596,069 bytes before compression, approximately
1.4 MB gzip**. Its compiler, libraries, and Wasm bytes are unchanged. The work
improves the adapter and demand debugger; it does not introduce a hosted service,
new persistent browser storage, or the rejected 49 MB GHC distribution.

The [alternatives investigation](haskell-runtime-alternatives.md) records actual
browser GHC language/debugger experiments and why its size is unacceptable here.
MicroHs remains an extended Haskell subset with a teaching debugger, not full
GHC/GHCi compatibility. No smaller replacement meeting all those requirements
was established.

## Hidden-frame scheduling correction

A subsequent production-style reproduction found that the measurements below
missed a browser scheduling problem: the old benchmark displayed its runtime
iframe, and Playwright's default Chromium launch flags disabled background
timer throttling. The actual tutorial hides its sandboxed runtime frame.
Chrome can delay timers in that frame, turning MicroHs's zero-delay cooperative
compiler yields into one-second waits. Compilation can then exhaust the host
deadline even for a small, finite program. This is unrelated to the CanvHs
animation-frame import, which ordinary compilation did not call.

Controlled diagnostic runs on Chrome 154.0.8037.93, macOS arm64, Apple M4 found
that the same small program's first Run took 1,196 ms in a visible frame with
normal scheduling; the hidden-frame Run did not complete within the diagnostic
12-second bound. Both visible and hidden frames completed in about 1.1 seconds
with Playwright's default throttling-disabling flags. These are individual
diagnostic samples, not cross-device performance guarantees.

The corrected adapter's [sequential hidden-frame measurements](research/haskell-runtime-performance-2026-10-02/runtime-hidden-scheduling-after.json)
on the same browser/device completed every workload: first Run took 1,350 ms,
and three repeated Runs had a median of 1,004 ms (219–1,025 ms). Repeated
evaluation, type queries, and checks were generally about one second. Positive
input-polling delays still account for waits between requests, so these results
do not imply that all repeated requests take the earlier visible-frame timings.

The adapter now schedules zero-delay yields and completion callbacks through
a `MessageChannel` task queue. Real task boundaries preserve host-message and
Stop delivery; a microtask loop would not. The pinned Emscripten
`safeSetTimeout` hook retains `callUserCallback` and leaves all positive delays,
including idle input polling, unchanged. The compiler, Wasm, sandbox, execution
deadline and download size are unchanged. See the
[vendor integration contract](../js/vendor/microhs/README.md) for the internal
loader ABI dependency. Browser suspension of an entire background tab remains
outside this adapter's control.

`tests/haskell-scheduling.spec.js` exercises step 1 of the main Haskell tutorial
with normal Chromium background scheduling restored. Before the change, its
starter program failed to produce `66` within 30 seconds. After the change,
the starter produced `66` and the edited solution produced `21`; the entire
test, including boot and light/dark accessibility checkpoints, took 8.2 seconds
in the local run. The regression does
not raise the normal 30-second execution deadline. Startup cancellation also
now clears its own boot timer and ignores stale frame messages, covered by
the tutorial lifecycle tests.

`scripts/benchmark-haskell-runtime.cjs` now uses the hidden frame and removes
these Playwright defaults so future measurements exercise production scheduling:

```text
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```

The earlier measurements below remain evidence for compilation reuse under
their original conditions; they did not establish performance in a normally
throttled hidden frame. Chrome's general timer behavior is documented in
[its timer-throttling explainer](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/).

## Measured changes

Indicative local medians on an Apple M4 Max, macOS arm64, Chromium
145.0.7632.6. Compiler rows contain three sequential repeated requests after
the first request of each workload. Measurements include the real sandbox
message boundary and compiler; they exclude tutorial rendering and internet
delivery. First means first use of a workload in the session, not a new compiler
instance. Results vary with source, device, GC and browser load.

| Workload | Before | After | Speedup |
|---|---:|---:|---:|
| Repeated Run | 1,557 ms | 308 ms | 5.1× |
| Repeated expression evaluation | 1,612 ms | 314 ms | 5.1× |
| Repeated type query | 1,385 ms | 52 ms | 26.4× |
| Repeated Boolean exercise check | 1,724 ms | 332 ms | 5.2× |
| Repeated explicit-signature check | 2,203 ms | 354 ms | 6.2× |
| Repeated headerless-file evaluation | 2,073 ms | 374 ms | 5.5× |
| Repeated imported-module evaluation | 2,223 ms | 384 ms | 5.8× |
| Evaluation after editing a dependency | 2,628 ms | 1,659 ms | 1.6× |
| Debugger Continue across 302 demand events | 3,406 ms | 69 ms | 49.4× |

First Run improved from 1,938 to 1,520 ms in these sessions. Boot was 648 ms
before and 744 ms after (one sample each): **this work does not establish a boot
speedup**. The strongest improvement is repeated interaction with unchanged
source. A scope change can require another reload while an old private module
is retired; the raw headerless/imported samples include that slower transition.

The debugger baseline comes from three alternating baseline/prefill samples;
the final result comes from three fresh debug sessions. Continue timing starts
at the first pause and excludes initial compilation. Every measured run checked
the exact output and all 302 trace events. This improvement does not promise
that every Haskell algorithm executes 49 times faster.

[Raw measurements and source hashes](research/haskell-runtime-performance-2026-10-02/manifest.json):
[compiler before](research/haskell-runtime-performance-2026-10-02/runtime-before.json),
[compiler after](research/haskell-runtime-performance-2026-10-02/runtime-after.json),
[debugger A/B](research/haskell-runtime-performance-2026-10-02/debugger-prefill-ab.json),
[debugger after](research/haskell-runtime-performance-2026-10-02/debugger-after.json).

## What changed and why it is safe

1. **Reuse compilation, never results.** The adapter retains a successful import
   scope and compares a snapshot of all workspace file bytes before the next
   request. Unchanged inputs reuse type checking and compiled combinator syntax.
   Changed files trigger MicroHs's own content-hash and dependency invalidation.
   Reading MEMFS catches changes made by learner `writeFile`, including changes
   to transitive imports; host editor-write tracking alone would miss them.
2. **Keep evaluation fresh.** In the pinned compiler, `TranslateMap` holds `Exp`
   syntax; each expression is serialized and deserialized into fresh runtime
   values. The cache does not preserve evaluated thunks or mutable `IORef` state
   between requests. Compiler/runtime errors invalidate reuse, and scope changes
   remove the old imports. [Pinned translation implementation](https://github.com/augustss/MicroHs/blob/9e8f923c614c12f14412e63e329de25ff9309c4f/src/MicroHs/Translate.hs),
   [dependency validation](https://github.com/augustss/MicroHs/blob/9e8f923c614c12f14412e63e329de25ff9309c4f/src/MicroHs/Compile.hs#L298-L328).
3. **Bound the optimization.** Snapshots allow at most 128 filesystem entries and
   1 MiB of file/path data. Larger workspaces, symlinks, and inaccessible entries
   use ordinary reload. This is an optimization limit, not a language/file-size
   restriction. The cache lives only inside the current runtime frame.
4. **Reuse owned helper modules.** Headerless expression scopes and identical
   signature checks can retain their private module names. Helpers are reused
   or deleted only while they remain readable regular files containing the
   adapter's source. Files replaced by learner IO or editor writes are preserved.
   Deferred cleanup never deletes the helper currently in use.
5. **Remove compilation from completion signaling.** Ordinary operations finish
   with a request-specific REPL prompt set by a control command. They no longer
   compile another `putStrLn` expression just to tell JavaScript they finished.
   Echoed commands are filtered; matching and rechecking the full prompt line
   avoids treating an echoed marker or a longer output prefix as completion.
   Debug and test pass/fail markers still use their existing qualified output.
6. **Avoid debugger waits during Continue.** MicroHs's browser `GETRAW` primitive
   polls input with a 10 ms sleep. Ordinary Continue events now acknowledge input
   before that wait begins. Initial pauses, stepping, breakpoints, and history
   limits remain deferred so output ordering and Asyncify suspension are intact.
   All trace events are still recorded. [Pinned GETRAW implementation](https://github.com/augustss/MicroHs/blob/9e8f923c614c12f14412e63e329de25ff9309c4f/src/runtime/unix/extra.c).
7. **Fix recursive debugger continuation overflow.** The pinned loader's default
   4 KiB Asyncify continuation buffer could trap during recursive pauses. A
   guarded initialization hook sets it to 256 KiB before its first allocation.
   The real runtime now reaches a breakpoint at depth 151, steps out, and
   completes correctly. This adds at most 252 KiB to that buffer, not to the
   download. The internal loader ABI dependency is documented in the
   [vendor integration notes](../js/vendor/microhs/README.md); a future rebuild
   should use Emscripten's build-time setting instead.

## Experiments not adopted

- **A larger general heap:** increasing `-H8M` to `-H16M`/`-H32M` grew measured
  Wasm memory from about 141 MiB to 227/447 MiB. The smaller experiment showed
  inconsistent latency changes; 32M helped one evaluation workload but not type
  queries or boot. The default remains 8M. Raw probes:
  [8M](research/haskell-runtime-performance-2026-10-02/heap-8M.json),
  [16M](research/haskell-runtime-performance-2026-10-02/heap-16M.json),
  [32M](research/haskell-runtime-performance-2026-10-02/heap-32M.json).
- **MessageChannel for debugger callbacks alone:** the debugger's 302-event workload stayed
  around 3.4 seconds because the underlying 10 ms input poll remained. The
  additional scheduler in that earlier experiment was discarded. The later
  hidden-frame correction above addresses the compiler's zero-delay yields,
  which this experiment did not change. [A/B samples](research/haskell-runtime-performance-2026-10-02/debugger-scheduler-ab.json).
- **Only retaining imports while reloading every request:** warm latency still
  stayed around 1.5 seconds. Avoiding redundant reloads required checking actual
  workspace contents and establishing the fresh-runtime-value invariant.
- **Replacing the compiler with browser GHC:** real GHC stepping and language
  features worked, but the published 49.1 MB compressed filesystem fails the
  user's download constraint. Its compiler library alone compressed to about
  31.3 MB using gzip; routine package removal is insufficient. See the separate
  alternatives report for sources, limits, and exact experiments.

## Reproduce and validate

Serve the revision being measured with its own source assets and generated
`haskell-runtime-frame.html`. Use baseline commit `17469cc0` for the before
measurement. From the current checkout, point the same scripts at either server:

```sh
node scripts/benchmark-haskell-runtime.cjs --base-url http://127.0.0.1:4000 \
  --iterations 3 --output /tmp/haskell-runtime.json
node scripts/benchmark-haskell-debugger.cjs --base-url http://127.0.0.1:4000 \
  --iterations 3 --output /tmp/haskell-debugger.json
```

Run benchmarks sequentially, with other browser workloads idle. These scripts
verify results and preserve all individual samples; elapsed times are not CI
pass/fail thresholds.

The hidden-frame correction passed **114 browser tests** across compilation-cache,
course-backend, signature-backend, interpreter, debugger, and cycle-diagnostics
suites, the real lesson scheduling regression, and tutorial lifecycle coverage.
Interactive accessibility checkpoints were enabled. The focused WCAG audit
reported zero findings on the main Haskell tutorial and runtime frame;
automated checks do not by themselves establish full WCAG conformance. **69 Node tests**
covered debugger logic, signature/cycle analysis and supply-chain integrity.
The unchanged compiler payload still matches all pinned SHA-256 checks.
