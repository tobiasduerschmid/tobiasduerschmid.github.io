# Local Python specification assistant

The optional add-on generates Python from a student's natural-language specification and runs conceptual checks through the existing Python tutorial backend. It uses Qwen2.5-Coder 1.5B Instruct locally. The demonstration is `/SEBook/tools/python-specification-tutorial`, with a matching `/print` page.

## Authoring

Enable `llm: true` on a Python-only `backend: pyodide` tutorial. Mixed backends are not supported.

Set top-level `ai_tutor: true` to enable the optional AI tutor chat inside the model panel; `false` or omission turns it off. The Python specification demo enables it. Chat shares the selected engine and downloaded model with generation and feedback, including automatic loading and cancellation. The student must explicitly download the model first. Conversations stay in memory, keep only the last exchange as model context, and reset on step changes. **Reset chat** stops any reply or diagram rendering, clears the transcript, unsent question, and model conversation history, and focuses the question field. It leaves downloaded model files and tutorial work intact. Every prompt includes the step’s `ai_tutor_instructions`, public interface, student specification, and **all current step source files** with their paths. Open editor models supply the latest edits; other declared step files supply authored content. File contents and step guidance are not truncated. Hidden checks and instructor-only solution metadata are excluded. Conversation history remains bounded; model/engine context limits still apply, so very large steps may require another engine or smaller teaching examples. Replies may be incorrect. ArchUML is the default for modeling, visualization, behavior, and architecture explanations **in AI tutor chat only**. Python generation and specification feedback prompts are unchanged. To keep token use low, `tutor-syntax.mjs` supplies one small, renderer-tested syntax example selected for the request; it does not attach the full manual or every diagram grammar. Procedural code defaults to activity diagrams, and examples must be adapted to actual source names and behavior. Chat recognizes complete `uml-class`, `uml-sequence`, `uml-state`, `uml-activity`, `uml-component`, `uml-deployment`, and `uml-usecase` fences (also `archuml-` aliases). It also infers types for generic `uml` / `archuml` / `plantuml` fences, unlabelled fences, and bare complete `@startuml` … `@enduml` blocks. Simple Unicode-arrow relationships are normalized for rendering. It renders one small diagram inline, and exposes its source in a disclosure. Prose and unsupported fences remain literal text. Rendering runs in a disposable worker with a timeout; sanitized SVG is inserted with the shared structural text alternative and keyboard scrolling. Malformed diagrams retain source and a recovery message. Chat cancellation and step changes stop pending rendering. Existing authored failure hints remain independent.

Step-specific tutor behavior is authored separately from student-facing lesson instructions:

```yaml
ai_tutor: true
steps:
  - title: Explore the design
    ai_tutor_instructions: |
      Ask the student to predict behavior before explaining it.
      Use ArchUML to illustrate relationships when useful.
      Give a hint, not a complete solution.
    files:
      - path: main.py
        content: "# Student workspace"
```

The field is optional for backward compatibility; omitted guidance uses the default tutor behavior. It applies on every chat turn, including steps without an `llm` exercise, and never enters specification-generation or specification-feedback prompts.

Each participating specification-assistant step declares:

```yaml
llm:
  file: solution.py
  interface: "Define unique_in_order(items). Accept a list of integers and return a list."
  specification: "Remove repeated integers."
  checks:
    - category: ordering
      command: "assert subject['unique_in_order']([3, -1, 3]) == [3, -1]"
```

The destination must be an editable file. Keep the public interface within 600 characters and editable specification within 1,200. Describe the intended behavior in the lesson so the student can reason about it; hidden checks must not introduce unstated requirements. At most 20 check groups run in a bounded Python worker transaction. Each command receives `subject`, a fresh namespace containing the current program. Allowed categories: `ordering`, `duplicates`, `boundaries`, `input-contract`, `output-contract`, `mutation`. Use independent checks and review plausible wrong implementations. Hidden check commands stay out of prompts, normal results, and print output; browser developer tools can inspect the authored data.

The interface starts with the editable specification and an expandable public function contract. It shows one primary action at a time: Download model (with the size visible before download) or Generate Python. Cached models load automatically when generation or conceptual feedback needs them; there is no separate load button. A spinner and live status describe preparation, with Cancel available. The spinner stops animating under reduced motion. If cached data has been evicted, automatic loading stops and offers an explicit download instead of fetching weights. Downloading shows byte and percentage progress with Cancel. Model & storage expands to reveal engine selection, device details, comparison, unload, and deletion. These controls remain available on steps without an exercise.

Check Python works without a model. It checks the current editor contents and reports only conceptual mismatches, syntax/runtime trouble, or unavailable checks. If a model is already downloaded, it loads when needed to suggest questions from the public prose and failed categories. Passing checks and syntax/runtime errors need no model initialization. It never receives hidden test source, input/output values, or exception text. Its suggestions may be wrong; failed code is not proof of a faulty specification. Passing checks is not proof of completeness. Generated Python is previewed, applied only by a separate action, and checked through Python only. Edits/navigation invalidate stale suggestions and cancel in-flight work. Feedback appears below the actions only when there is something to report.

## Engines and selection

- WebLLM 0.2.87: WebGPU, MLC `q4f16_1`, 875,705,734 model bytes including metadata/tokenizer.
- wllama 3.8.1: WebGPU or WebAssembly processor inference, GGUF `Q4_K_M`, 1,117,320,768 bytes. Hosted compatibility assets cover browsers lacking newer WebAssembly features.
- Transformers.js 3.8.1 with ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4: JavaScript WebGPU backend, ONNX `q4f16`, 1,355,668,005 bytes including tokenizer/configuration. This is the Firefox graphics path.
- All three derive from the same upstream Qwen2.5-Coder 1.5B Instruct checkpoint. Quantization/layout differ, so their generated outputs need not be identical.
- Context: 2,048 tokens; output: up to 384 tokens for code, 220 for feedback. ONNX additionally caps the complete templated input at 768 tokens: its graph materializes FP32 logits for every prompt position, which must fit supported 512 MiB storage bindings. Longer inputs are rejected before graphics execution with a request to shorten the specification or choose Processor; input is never silently truncated. One worker/model and one request at a time. Processor threads are capped at four and half the reported concurrency, or one without isolation.

Preflight checks ONNX’s required nine storage buffers, half precision, 512 MiB buffer/binding capacity (its embedding table is about 467 MB), and 32 KiB workgroup storage; it also checks WebLLM’s required ten storage buffers per shader stage (some Firefox adapters expose only nine), half precision, buffer sizes, and workgroup storage. Unsupported options are disabled before a download. It requests and releases a real graphics device, inspects exposed features/limits, WebAssembly vector support, isolation, and concurrency. Memory is only an optional coarse hint; free memory, exact processor model, and available graphics memory cannot be reliably inferred. No model or inference vendor is fetched by preflight. Automatic selection is a conservative heuristic: compatible cached formats first, otherwise ONNX graphics in Firefox, WebLLM graphics in other browsers, then the remaining compatible graphics engines and processor. It does not guarantee the globally fastest engine. Explicit Processor never selects graphics. A same-format wllama graphics initialization failure can retry processor mode without downloading again. Cancellation, invalid input, and exhausted deadlines never trigger that retry. A graphics failure during generation ends the attempt, unloads it, and reprobes before offering a new load action; partial output is never replayed. Switching from a failed graphics engine to another model representation requires a new explicit download action. No automatic larger models, background benchmark downloads, or server inference.

Each load validates inference with a non-student warm-up (60-second deadline). The warm-up verifies readiness; it is not used to rank generation speed. The optional comparison generates a fixed Python function instead of timing a one-word reply. Session-only measurements include the artifact revision, engine version, execution profile, thread count, context budget, and fixed workload. Only identical completed outputs are compared. Automatic offers a two-minute comparison when multiple compatible profiles already have their model format cached; it loads one at a time, requests no additional weights, and uses total request latency rather than unequal token rates. Unmeasured engines remain unknown. Measurements do not persist or create a hardware fingerprint.

Firefox processor inference avoids the slower Asyncify compatibility build when Memory64 is available. Firefox wllama graphics requires both native JSPI and Memory64; the known-slow compatibility graphics path is excluded. WebLLM remains an independent graphics option when the required limits are available. For fresh downloads, Automatic prefers ONNX graphics in Firefox when its limits are met. Existing compatible downloads remain preferred to avoid a silent second-format download. For an already cached GGUF, Automatic initially chooses processor mode; the student can explicitly select ONNX for graphics or compare compatible cached engines. The ONNX backend does not require JSPI or Memory64.

A working integrated Intel graphics device can use graphics acceleration; a dedicated graphics card is not required. Processor mode remains available when browser graphics support is missing. The 8 GB classroom baseline still requires physical-device validation, including an Intel laptop with integrated graphics, its real browser/driver combination, other tabs, and sustained generation. A development-machine smoke test cannot establish that acceptance criterion.

## Download, storage, deletion

Download is explicit. A tiny cache write/read is checked before any uncached model transfer. When the browser exposes a storage quota, known-insufficient space is rejected before requesting model data; the estimate cannot guarantee that a later write will succeed. Acquisition uses an abortable stream in the owning page, and releases the cross-tab lock only after the stream settles. It streams actual byte counts one file at a time with a labeled progress element. Model HTTP requests use `cache: no-store`; reusable files live only in dedicated Cache API stores: `sebook-llm-gguf-v1`, `sebook-llm-onnx-v1`, `webllm/model`, `webllm/config`. The GGUF and ONNX weight files are requested in validated 32 MiB byte ranges, stored as separate entries, and reconstructed as file-backed composite Blobs. The ONNX adapter serves those files through a read-only custom cache with remote model loading disabled; it creates no Transformers.js cache. ONNX Runtime needs a contiguous in-memory model buffer at initialization, unlike wllama’s Blob loader, so peak memory remains an additional acceptance check on physical 8 GB machines. This bounds individual cache entries and supports resuming completed ranges; it does not change the model bytes. Interrupted transfers retain completed entries but never mark incomplete files complete. An engine switch can retain multiple formats until deletion. Browser storage eviction can require a fresh download. Private/denied storage is reported rather than pretending a persistent cache exists.

The page offers Cancel, Unload from memory, and Delete downloaded model. Deletion also lives at `/cookies/#browser-model-storage` and is included in Delete everything. It clears all four stores plus any legacy `webllm/wasm` cache and leaves learner drafts/progress intact. A BroadcastChannel (`sebook-browser-llm-storage`) asks active tabs to terminate model workers; the Web Lock (`sebook-browser-llm-model`) ensures deletion waits for their writer ownership to end. If another tab cannot respond, deletion reports that it must be closed instead of falsely claiming success. Web Locks are required for safe model acquisition/deletion. No additional cookies/localStorage/IndexedDB/preferences are introduced. Specifications and replies are page-memory-only.

Executables are fetched from pinned jsDelivr versions and an immutable GitHub commit, with SHA-256 integrity checks and small license/provenance records. No model weights or large runtime files are stored in the repository. They use ordinary browser HTTP caching and are not model data. Verified executable assets use temporary blob URLs; WebLLM’s model library bypasses its writable model cache. The shared tutorial isolation service worker enables processor threads where supported; it never caches model weights.

## Verification

Fast checks: `node --test scripts/tests/browser-llm*.test.js`.
Browser interaction checks: `npx playwright test tests/tutorial-llm.spec.js --project=chromium` against a fresh Jekyll build.

Real inference and hardware acceptance results are recorded in the implementation report. Orchestration fixtures are not evidence that a model or graphics adapter works. Re-run real model inference after vendor/model upgrades, and check cached reload, interruption/deletion during a transfer, other-tab deletion, syntax/runtime errors, stale editor results, keyboard operation, narrow layout, screen themes, and print output.


## Verification environment limits

The development device is an Apple M4 MacBook Air with 16 GB RAM. The development run exercised real Qwen inference on Chrome using CPU, wllama graphics, and WebLLM graphics, plus the complete generation/apply/check flow. A temporary WebKit session hit its quota. In this host's persistent Playwright WebKit profile, even four-byte Cache API writes could not be read back (same-origin and cross-origin, with and without isolation). This browser environment therefore cannot establish Safari support. The feature detects that storage failure before model transfer. Physical Safari and the 8 GB Intel classroom baseline remain unverified.

On the M4/16 GB development device, three Chrome WebLLM runs of the complete demonstration (129 input tokens, 47 output tokens, identical output) took 1.29–1.39 seconds with a 128-token prompt batch, approximately 42–46 output tokens/second after the first token. Testing batches of 256 and 512 gave small, noisy differences; the conservative default remains 128. These are local measurements, not guarantees for 8 GB classroom devices. Firefox’s nine-storage-buffer limit cannot run this pinned WebLLM build: its Qwen prefill shader actually needs ten storage buffers.

The Firefox graphics prototype used real Playwright Firefox 146 on the M4 Mac, with the actual GPU device explicitly capped at nine storage buffers. Transformers.js 3.8.1 / the JavaScript WebGPU backend completed the same 47-token demonstration in 6.04 seconds, with first text at 1.34 seconds (about 10 tokens/second during decoding). A repeated 34-token fixed function took 4.17 seconds after initial shader compilation. Transformers.js 4.3.2 / the native WebGPU backend failed this constrained-device test because a shader required ten buffers. These measurements establish the chosen backend, not performance in every Firefox version or on an 8 GB Intel laptop.

Integrated Firefox verification also covered streamed acquisition, cache-only reload with no model requests, explicit application, Python checks, stale-generation cancellation, and navigation. With the final generation settings, the complete tutorial example took 6.3 seconds. On a real device constrained to nine buffers and 512 MiB buffer/binding limits, a 719-token input completed; a 919-token input was rejected in 42 ms before inference by the 768-token guard. Scoped screen/print accessibility audits cover the tutorial, its print page, cookies, settings, and glossary; this is not a whole-site audit.
