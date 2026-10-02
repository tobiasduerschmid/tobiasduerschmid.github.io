# Haskell runtime alternatives investigation

Reviewed and probed on October 2, 2026. The deployment constraints are **browser-only execution** and a small download; the user explicitly rejected the approximately 49 MB browser GHC distribution. No alternative runtime was installed into the site.

## Decision

Improve the current MicroHs integration without reducing its existing language or demand-debugging capabilities. Browser GHC is a credible future upgrade for richer language support and native debugger operations, but its current payload fails the download constraint. Smaller historical interpreters do not preserve modern GHC compatibility and debugger capabilities.

“Full Haskell” needs a precise scope. MicroHs describes itself as an extended subset of Haskell 2010, with documented semantic and library differences. The site's debugger instruments top-level equations and Boolean guards, preserves lazy evaluation, and does not inspect values or evaluate watch expressions. Keeping those capabilities does **not** mean the site offers full GHC/GHCi compatibility. [MicroHs language reference](https://github.com/augustss/MicroHs/wiki/Language), [current demand debugger](../js/debugger/haskell/session.js).

## Alternatives compared

| Alternative | Language and debugging | Deployment and latency finding | Decision |
|---|---|---|---|
| Current MicroHs | Broad Haskell 2010 subset with many extensions; custom demand debugger in this site. | Vendored distribution: 2,596,069 bytes uncompressed, approximately 1,401,005 bytes gzip. Already runs without a server or cross-origin isolation. | Optimize the existing integration. |
| GHC compiled to WebAssembly, fully in the browser | GHC parser, type checker and bytecode interpreter. Real stepping and resuming worked in the experiment below. | Published rootfs: 49,091,550 bytes compressed. Exploratory startup 5.6–9.6 seconds; simple warmed runs 18–67 milliseconds. | Rejected for download size despite promising warm latency. |
| Official GHC wasm GHCi browser mode | Official documentation states that GHCi features, including its debugger, work. | A host GHC process and Node broker communicate with the browser. This is a cross-compiler workflow, distinct from the fully client-side compiler. | Does not satisfy browser-only deployment. |
| Native GHC/GHCi | Mature compiler and interactive debugger; reload avoids unnecessary recompilation. | Requires a local installation or hosted execution service. No latency comparison was attempted. | Does not satisfy browser-only deployment. |
| GHC JavaScript backend / GHCJS | Compiles Haskell programs to JavaScript; target/runtime and C library support require separate evaluation. | A compiler targeting the browser is not automatically a compiler running inside it. No ready small, browser-only compiler plus GHCi debugger was established. | No verified replacement matching the requirements. |
| Asterius | Historical GHC-based wasm toolchain. | Archived and explicitly deprecated in favor of the GHC wasm backend. | Do not adopt. |
| Hugs / hugs-js | Haskell 98 with selected extensions; HugsHood observation facilities are not the GHCi debugger. | An Emscripten port exists, but its language baseline and tooling are older. No modern GHC compatibility or debugger parity was demonstrated. | Reject as a capability downgrade. |
| Fay | Its project explicitly describes a proper subset of Haskell that compiles to JavaScript. | A smaller target runtime does not establish a complete browser compiler/interpreter. | Reject as a language downgrade. |

Primary references: [MicroHs](https://github.com/augustss/MicroHs), [GHC browser demo](https://github.com/haskell-wasm/ghc-in-browser), [official wasm GHCi architecture](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/wasm.html#using-ghci-with-the-wasm-backend), [native GHCi](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/ghci.html), [JavaScript backend](https://ghc.gitlab.haskell.org/ghc/doc/users_guide/javascript.html), [Asterius archive](https://github.com/tweag/asterius), [Hugs manual](https://www.haskell.org/hugs/pages/users_guide/index.html), [hugs-js](https://github.com/junjihashimoto/hugs-js), [Fay](https://github.com/faylang/fay).

## Browser GHC: what was actually verified

The public demo was tested with Playwright 1.58.2 and headless Chromium 145.0.7632.6 on the development Mac. These are exploratory samples, with varying network/cache/JIT state, not controlled benchmark distributions or predictions for student devices. Initial UI timings include Playwright interaction overhead; later API timings measure the awaited compiler call directly. Exact programs, outputs, failures, timings, environment and upstream commit are retained in [the probe record](research/haskell-runtime-alternatives-2026-10-02/probes.json).

The demo loads a zstd-compressed filesystem, extracts it through `bsdtar.wasm`, and dynamically links wasm shared libraries. Its Haskell wrapper reuses a `GHC.Session`, loads `/tmp/Main.hs`, compiles `Main.main` to bytecode and executes it. It is genuinely client-side; `DyLDBrowserHost` uses the in-memory filesystem instead of RPC. [Published loader](https://raw.githubusercontent.com/haskell-wasm/ghc-in-browser/gh-pages/index.html), [dynamic loader](https://raw.githubusercontent.com/haskell-wasm/ghc-in-browser/gh-pages/dyld.mjs), [upstream wrapper](https://raw.githubusercontent.com/ghc/ghc/master/testsuite/tests/ghc-api-browser/playground001.hs).

| Probe | Observed result |
|---|---|
| First run, `sum [1..1000]` | `500500`; 272–339 ms across two sessions. |
| Identical rerun | `500500`; 43 ms in the initial session. |
| Edited program | Correct output; examples measured 21–48 ms. |
| Multiple modules | Writing `Helper.hs`, then importing it with `-i/tmp`, returned `42`; 67 ms. |
| Type families | A closed family reducing `Result Int` to `Bool` compiled and returned `True`. |
| Template Haskell | A quotation/splice calculating an `Int` returned `42`. |
| Type error and recovery | Reported the `Bool`/`Int` mismatch; the next valid program returned `42`. |
| Filesystem effects | A file written by one run could be read by the next. Effects are not automatically reset. |
| Module without `main` | The published wrapper rejected it. Its contract is running `Main.main`. |
| `--interactive` argument | Still ran `Main.main`; did not create a GHCi command interface. |
| CPP | Failed with `createPipe: unsupported operation`; the next ordinary compile recovered. |
| Type query through the GHC API | `exprType TM_Inst "map"` returned `forall a b. (a -> b) -> [a] -> [b]`. |
| Real debugger through the GHC API | Reached `ExecBreak`, then `resumeExec` returned `ExecComplete` and printed `42`; 229 ms after API warmup. |

The debugger experiment required **no rebuilt compiler**. An interpreted driver imported `GHC` with `-package ghc`, initialized a second session with `interpreterBackend`, `LinkInMemory` and `Opt_InsertBreakpoints`, loaded a small function, and called:

```haskell
execStmt "f 41" execOptions { execSingleStep = SingleStep }
resumeExec RunToCompletion Nothing
```

This proves that the published bundle contains working native breakpoint/step machinery. It does not establish a completed interactive debugger: the experiment resumed immediately within one request. Persistent session ownership across JavaScript requests, breakpoint source mapping, value inspection, cancellation recovery and the tutorial protocol remain integration work. The existing MicroHs debugger pauses through its specific `GETRAW` primitive and cannot simply be reused unchanged. [GHC evaluation API](https://github.com/ghc/ghc/blob/ghc-9.14/compiler/GHC/Runtime/Eval.hs), [breakpoint generation condition](https://github.com/ghc/ghc/blob/ghc-9.14/compiler/GHC/Driver/Config/HsToCore/Ticks.hs).

One type-query session emitted a missing `liblibdl.so` warning but still returned the correct type after selecting the bytecode backend. Earlier failed API probes are retained in the record rather than omitted. They were corrected for this GHC version before claiming the successful breakpoint result.

## Sandbox, input and language limits

The public demo also compiled and printed `42` inside `<iframe sandbox="allow-scripts">`, with an opaque origin, `crossOriginIsolated === false` and no `SharedArrayBuffer`. Its evaluation promise exposed a `throwTo` function; interruption and subsequent session recovery were **not** tested. Three generic page `Event` errors occurred in this sandbox experiment, so this is compiler feasibility evidence rather than a clean production integration test.

That experiment used the public hosts' CORS-enabled resources. Self-hosted module imports and binary fetches must preserve the site's opaque sandbox; their CORS behavior or parent-to-frame asset transport would need validation. The loader's stdin is currently an empty read-only file. A terminal frontend alone does not add interactive input to the compiler. [Published loader source](https://raw.githubusercontent.com/haskell-wasm/ghc-in-browser/gh-pages/dyld.mjs).

The upstream author described a full browser GHCi frontend as technically possible but still requiring terminal and boot-library plumbing in May 2026. The same discussion documents the absence of subprocess support for CPP and restrictions on newly interpreted foreign imports. Our CPP failure reproduces that limitation. Thus even a GHC frontend in wasm should not be described as unrestricted native-language, package, operating-system or debugger support. [Upstream author discussion](https://discourse.haskell.org/t/ghc-now-runs-in-your-browser/13169?page=2).

## Why stripping the published GHC archive is not a small fix

The inspected archive at commit `c57d8b6e37737d662aed05cab88f867918307053` contains:

| Content | Bytes before archive compression |
|---|---:|
| All regular files | 251,151,681 |
| Wasm shared libraries | 194,910,054 |
| GHC interface files | 55,218,645 |
| Compiler shared library alone | 134,551,576 |

Compressing the compiler shared library alone with gzip level 9 produced **31,284,138 bytes**. This is a different compression format from the complete zstd archive and is not a mathematical lower bound; it demonstrates that incidental packages are not the main payload. The upstream build recipe already removes Cabal, documentation, static libraries, profiling variants and unnecessary interfaces, and recommends size optimization and DWARF stripping. [Upstream archive recipe](https://raw.githubusercontent.com/ghc/ghc/master/testsuite/tests/ghc-api-browser/playground001.sh).

Lazy package downloads could defer some interfaces and libraries. They do not eliminate the compiler frontend needed for arbitrary programs. No evidence from this investigation supports shrinking this existing full GHC distribution to the current few-megabyte budget through routine file removal while preserving its language and debugger capabilities. A custom size-reduction research project would need its own measurements; it is not a justified replacement in this change.

## Reproduction notes

- Download `rootfs.tar.zst` from the pinned [published tree](https://github.com/haskell-wasm/ghc-in-browser/tree/c57d8b6e37737d662aed05cab88f867918307053), and use `tar -tvf` to reproduce the uncompressed inventory.
- For the basic timing probe, load the public demo in a fresh Chromium context, wait until Run is enabled, set its Monaco editor to each recorded source, and time Run until it is enabled again.
- The API experiments only added JavaScript references to the existing `rootfs` and returned `main_func` in a temporary intercepted copy of the demo HTML. They did not change compiler binaries. Call `await main_func(args, source)` with the exact source and arguments retained in the JSON record.
- The corrected type and breakpoint programs are in `probes.corrected_api_and_debugger.cases`. The failed preliminary programs remain separately under `multimodule_and_initial_api`.
- No new runtime dependency, external execution service, student-code upload, persistent browser storage, compiler binary or production backend was introduced by this research.
