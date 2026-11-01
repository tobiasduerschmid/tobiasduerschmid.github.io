# Adaptive browser LLM engines for SE Book

Status: design for review; implementation has not started.

## Intent and agreed constraints

Students will write natural-language specifications, generate Python locally, and receive feedback about unclear or contradictory requirements without seeing hidden tests. The initial model is Qwen2.5-Coder 1.5B Instruct. The baseline includes 8 GB Intel laptops without dedicated graphics. Better hardware should improve speed while retaining the same model choice. Tests need to be hidden from the normal interface and feedback; resistance to developer-tool inspection is not required.

The user requested exchangeable inference engines selected according to the machine. This first implementation delivers the reusable inference layer and one complete demonstration exercise: specification entry, Python generation, bounded execution against hidden tests, and conceptual feedback. Limiting the initial content to one exercise is the proposed implementation scope; the requested end-to-end behavior is included without authoring a full exercise catalogue or redesigning the existing tutorial system.

## Approaches

1. **WebLLM only:** prepared GPU model packages, but no CPU execution path for unsupported graphics.
2. **wllama only:** one GGUF artifact can run on CPU or GPU with broad browser compatibility, but the application would have no alternative engine to select if another engine performs better.
3. **Exchangeable adapters:** a stable SE Book interface, initially implemented by WebLLM and wllama. Selection and fallback are outside lesson code. This follows the user's latest direction; the concrete policy below is the proposed implementation choice.

Neither GPU presence nor an Intel/Apple/NVIDIA label proves which engine is fastest. “Auto” means the best supported candidate under the download and memory constraints, refined by available measurements; it is not a guarantee of a globally optimal configuration.

## Model identity and artifacts

Use one logical model identity: `qwen2.5-coder-1.5b-instruct`. Never automatically switch parameter count or instruction-tuned checkpoint.

The model registry records immutable upstream revisions, artifact URLs, byte counts, quantization, format, and engine compatibility. Runtime packages are pinned too. The weights are downloaded on explicit activation, not committed to the repository or fetched by ordinary chapter visits.

The two initial artifacts are:

- WebLLM: MLC `q4f16_1`, approximately 880 MB of model assets.
- wllama: the official Qwen GGUF `Q4_K_M`, approximately 1.12 GB.

These are the same upstream model in different 4-bit representations, not byte-identical weights. Backend arithmetic and quantization can change answers even with matching sampling settings. Cross-engine checks compare behavior, not exact text. If identical quantized weights become a requirement, restrict automatic selection to wllama's CPU/GPU paths sharing the GGUF artifact.

Keep the same prompt policy, 2,048-token initial context budget, output limits, and sampling configuration across candidates. Faster hardware does not receive additional hints, longer reasoning, or a larger model. Reject over-budget input visibly rather than silently truncating specifications. Engine-specific settings concern execution only.

## Boundaries and contracts

Create a focused `js/browser-llm/` module family. The public runtime exposes preparation, generation, cancellation, unloading, and status; it contains no DOM, exercise content, or vendor-specific objects.

Each adapter implements:

- `probe(environment, artifact)`: report supported execution profiles and reasons for exclusion without downloading weights.
- `load(artifact, profile, options)`: initialize with progress events and cancellation.
- `generate(request, options)`: stream plain text and return a normalized result with finish reason and timing information.
- `dispose()`: release workers and model resources; safe after partial initialization.

The registry owns model metadata. The selector owns candidate ranking. Adapters own vendor APIs, cache integration, and worker lifecycle. A thin controller owns the student-facing controls. Specification prompts and Python execution remain separate clients of inference, so changing engines cannot change grading rules.

## Selection, measurement, and fallback

1. Probe WebGPU adapter/features/limits, required WebAssembly features, cross-origin isolation, and reported CPU concurrency. Treat missing memory information as unknown; browser APIs do not expose reliable free GPU memory. A reported 8 GB is not an allocation guarantee.
2. Exclude unsupported profiles. Candidates include WebLLM GPU, wllama GPU, wllama multithreaded CPU, and wllama single-threaded CPU with compatibility assets when required. Respect wllama's documented Firefox/Safari limitations instead of forcing a slow GPU compatibility path.
3. In the absence of valid measurements, prefer a supported already-cached artifact; otherwise use WebLLM GPU when its requirements are met, then wllama GPU/CPU. This initial ranking is a heuristic, not an established performance result.
4. Before transfer, show the selected model's actual download size. Download only that artifact. A fallback needing another large artifact returns a `download-required` state with the additional byte count; it does not silently download both models.
5. After load, run a bounded warm-up with a fixed non-student prompt. Where alternatives are already cached, offer a bounded comparison, loading one candidate at a time. Rank by successful complete-request latency for a fixed input/output workload, including prompt processing and generation. Do not compare token rates from unequal outputs or treat an unmeasured engine as slower.
6. Retain measurements in memory for the current page session, keyed by model artifact, engine version, execution profile, and context budget. Do not create a persistent hardware fingerprint. Reprobe on explicit retry or after a backend failure.
7. On GPU initialization failure or device loss, fully dispose the failed candidate before trying a compatible fallback. Do not retry cancellation, invalid input, download denial, or an exhausted deadline. Bound the number of attempts to the remaining candidates.

Provide Auto and explicit engine choices for diagnosis. Unsupported choices state why they cannot run. The selector cannot override an explicit CPU-only choice. CPU threading is capped conservatively; more reported logical cores do not justify occupying all of them.

## Responsiveness and failure semantics

Keep inference in workers and allow only one loaded candidate and one active generation per runtime. A new request cannot overwrite an in-flight request. Cancellation settles the request once; an unresponsive backend is terminated after a bounded grace period. Disposal, navigation, errors, and late worker messages must not publish stale results.

A backend failure during streaming ends that attempt. The UI labels its text incomplete and clears it before an explicit retry; output from different attempts is never concatenated. Configure separate finite deadlines for loading, warm-up, and generation. A generation deadline is not evidence that a student's specification is wrong.

Reuse the site's existing cross-origin-isolation helper only in the dedicated integration surface, before students enter work. Isolation failure leaves single-thread CPU execution available where supported. Do not reload an active exercise to gain threading or impose new isolation headers on every SE Book page.

## Storage and student experience

Cache only selected model artifacts through the pinned engines' supported mechanisms. Inspect and document their actual Cache Storage, IndexedDB, or OPFS usage before enabling them. Add scoped deletion to `/cookies/`, including “Delete everything,” and represent any persistent preference on `/settings/`. Engine selection remains session-only initially. Do not persist prompts, generated code, or feedback in the inference layer.

The integration surface shows model download progress, cancellation, selected execution mode, and actionable failures. Generated text is rendered as text, never trusted HTML. It follows the project's WCAG 2.2 AA, paragraph-sized text, light/dark, print-light, and training-opt-out rules. Use existing shared layouts and named CSS modules.

## Specification feedback boundary

Generation receives the student's specification and public interface requirements, not hidden tests or the intended solution. Feedback receives only the specification, generated code, and instructor-approved conceptual failure categories. Actual test inputs, expected outputs, assertion bodies, and hidden-run tracebacks are excluded. A test failure is evidence about the generated implementation; feedback must allow for a generator mistake and must not automatically blame the specification.

The demonstration exercises generation and feedback as separate requests on the same loaded model. It includes a small instructor-authored hidden suite with predefined conceptual categories and a deterministic mapping from failed checks to approved category labels. The normal interface exposes the aggregate outcome and conceptual feedback, never individual hidden cases or raw test-runner output. If all checks pass, it says the generated program passes those checks rather than claiming that the specification is complete. Python runs in the existing bounded worker infrastructure only through its owning API; model text is never executed as JavaScript. Full tutorial integration and its corresponding authoring-skill update follow when the exercise flow is defined.

## Verification and acceptance

- Unit tests cover observable selection, unsupported capabilities, cached-artifact preference, additional-download boundaries, explicit overrides, bounded fallback, cancellation, stale replies, and cleanup.
- Both real adapters must load the selected Qwen model and complete a short Python-generation request. Mocked adapters establish orchestration behavior, not real inference support.
- Verify the complete demonstration flow, including actual Python execution, deterministic failure-category mapping, omission of hidden-test details from prompts and displayed output, and treatment of syntax/runtime failures as possible generation errors.
- Exercise a forced CPU path as well as available WebGPU. Verify Chrome/Edge, Firefox, and Safari/WebKit paths separately; emulation is not evidence of native hardware speed.
- Record cold loading, cached loading, first output, complete response, cancellation, and resource failures. Do not claim 8 GB Intel performance without an actual representative device run.
- Check the demonstration and any storage/settings changes with focused browser, accessibility, keyboard, light/dark, and print checks. Do not describe these as a whole-site audit.

An actual 8 GB Intel laptop remains the baseline acceptance target. If representative hardware is unavailable during implementation, report that validation as outstanding and do not label the baseline supported or classroom-ready. No latency threshold has been agreed; publish measured task-completion times before making a usability claim. These are verification boundaries, not reasons to omit the CPU implementation.

The builder may settle internal filenames, dependency packaging consistent with repository conventions, conservative deadlines/thread caps, and the exact demonstration prompts and exercise. Preserve the contracts above and report unverified hardware paths explicitly.

## Sources checked

- [WebLLM engine documentation](https://webllm.mlc.ai/docs/)
- [MLC model artifact](https://huggingface.co/mlc-ai/Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC/tree/main)
- [Official Qwen GGUF artifacts](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/tree/main)
- [wllama execution and threading](https://github.com/ngxson/wllama)
- [wllama browser compatibility](https://github.com/ngxson/wllama/blob/master/compat/README.md)

Local integration evidence: `js/pyodide-worker.js`, `js/tutorial-code.js`, `js/coi-serviceworker-client.js`, `coi-serviceworker.js`, and `playwright.config.js`.
