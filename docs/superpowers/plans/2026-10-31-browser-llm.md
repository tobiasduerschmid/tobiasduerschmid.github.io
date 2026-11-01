# Browser LLM Tutorial Add-on Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add optional local specification-to-Python generation and conceptual feedback to the Pyodide tutorial backend, with pre-download capability selection, progress, cancellation, and model deletion.

**Architecture:** Small ES modules own capability detection, selection, inference lifecycle, vendor adapters, storage, and prompts. A tutorial adapter supplies current lesson files and bounded Python checks; a separate view owns the accessible controls. Ordinary Python tutorials load no model or inference vendor unless explicitly enabled and activated.

**Tech Stack:** Existing Jekyll/Liquid, vanilla JavaScript modules and workers, Pyodide 0.27.0, pinned WebLLM 0.2.87 and wllama 3.8.1, Qwen2.5-Coder 1.5B Instruct, Node tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-browser-llm-engine-design.md`

## Global Constraints

- Initial context is 2,048 tokens; keep one model and one generation active.
- Detect browser/hardware capabilities and select a compatible engine before any model-asset request.
- Download only the selected artifact after explicit activation; never download a second representation for benchmarking.
- Use the same Qwen checkpoint, with documented MLC/GGUF quantization differences.
- Keep model data separate from learner drafts; deletion cancels active work and clears complete and partial model storage.
- Hidden test source, concrete cases, expected answers, and raw errors never enter inference prompts or normal feedback.
- Use paragraph-sized controls, native progress semantics, both screen themes, light print, and bounded worker operations.
- Preserve existing unrelated working-tree changes; stage only explicit owned paths.

## Review Focus

- Cancelling or deleting during a download must prevent late writers from restoring removed model data (Task 2).
- GPU device loss and unknown memory must yield bounded fallback without an unapproved extra download (Task 1).
- Editing or changing lessons during generation/checking must discard stale results and preserve the current draft (Task 3).
- Generated syntax errors and failing implementations must not be described as proof of a bad specification (Task 3).
- Cached reload, private/denied storage, and deletion from another page must leave a usable, truthful interface (Tasks 2 and 4).

## Task 1: Exchangeable engines and capability selection

**Files:** Create `js/browser-llm/{catalog,capabilities,runtime,worker-client,worker}.mjs`, `js/browser-llm/adapters/{webllm,wllama}.mjs`, `js/vendor/browser-llm/` (small license/provenance records only), and `scripts/tests/browser-llm.test.js`.

**Interfaces:** `detectCapabilities()` returns WebGPU requirements, WebAssembly support, isolation, concurrency, and optional approximate memory. `selectCandidates(capabilities, {choice,cached,measurements})` returns supported profiles and exclusions. `BrowserLLM.prepare(choice)`, `load({onProgress,signal})`, `generate(messages,{onText,signal,maxTokens})`, `unload()`, and `deleteModels()` form the public API. Adapters expose `load`, `generate`, and `dispose`; vendor objects stay in the worker.

- [x] Write failing selection tests: CPU-only never selects GPU; absent GPU selects CPU; missing memory remains unknown; cached compatible artifacts win an unmeasured tie; unsupported explicit choices fail with a reason.
- [x] Run `node --test scripts/tests/browser-llm.test.js`; confirm failure before implementation.
- [x] Implement the registry, capability-only probes, and selection. Pin model revisions and byte counts from upstream manifests. Use pinned hosted executable dependencies with integrity verification, small license/provenance records, and no large files in the repository (per the user’s additional instruction).
- [x] Implement one terminable worker owner with finite initialization/generation deadlines, exclusive operations, cancellation, normalized streaming, and cleanup after partial initialization. Keep cross-artifact fallback behind a fresh download action.
- [x] Run unit tests covering cancellation, stale worker replies, explicit engine choices, and bounded fallback.

## Task 2: Model acquisition and deletion

**Files:** Create `js/browser-llm/storage.mjs`; update adapters and `cookies.html`.

**Interfaces:** `modelStorageStatus()` reports selected-artifact cache availability; `deleteModelStorage()` deletes only documented inference stores and returns a completion result. Download progress reports phase, completed bytes, total bytes when known, and a human-readable status. Runtime unload must precede deletion.

- [x] Add failing tests for zero preflight model requests, progress, cancellation during transfer, complete/partial deletion, failed deletion, and preservation of tutorial progress/unrelated caches.
- [x] Inspect pinned vendor cache implementations and use supported storage APIs; avoid duplicate model caches or whole-file memory copies during acquisition.
- [x] Implement deletion accessible from the add-on and `/cookies/`, including Delete everything. Coordinate active model writers so deletion cannot race with a download in another tab.
- [x] Run storage tests in real browser storage; confirm a cached load requests no model weights and a deleted model requires a new explicit download.

## Task 3: Python tutorial integration and learning flow

**Files:** Create `js/browser-llm/{prompts,tutorial-addon,view}.mjs`, `js/tutorial-llm.js`, `css/tutorial-llm.css`, `_includes/tutorial-llm.html`; modify `_layouts/tutorial.html`, `js/tutorial-code.js`, and `_includes/tutorial-print-content.html` as needed.

**Interfaces:** Top-level `llm: true` enables the add-on only on single-backend Pyodide tutorials. Each participating step supplies `llm: {file, interface, specification, checks:[{category,command}]}`. `file` names the destination Python file; `interface` is public; `specification` is the editable starting prose. Checks execute through the Python runtime and return only pass/fail plus allowlisted conceptual categories. No hidden commands are passed to prompts.

- [x] Add failing prompt-boundary and tutorial behavior tests, including source edits/navigation during requests and syntax/runtime failure feedback.
- [x] Mount the add-on alongside the instructions; expose selected execution mode, Download model, a labeled progress bar and byte status, Cancel, Delete downloaded model, specification entry, Generate Python, and Check and explain.
- [x] Use the existing Python worker request, timeout, and recovery ownership; reserve execution during checks and discard results from changed source. Generated text never runs as JavaScript. Applying a complete result is explicit and checks the destination revision to avoid overwriting edits.
- [x] Include session-only specification/result state, no new learner-progress schema. Preserve the ordinary manual Python editing/run path. Add corresponding printed specification prompts without runtime controls or hidden cases.
- [x] Run focused integration tests for the end-to-end flow and generation errors without relying on mocked inference as proof of model support.

## Task 4: Demonstration and author documentation

**Files:** Create `_data/tutorials/python-specification.yml`, `SEBook/tools/python-specification-tutorial.md`, its `print.md` companion, and `docs/browser-llm.md`; modify `.agents/skills/tutorial-authoring/SKILL.md`, `settings.html`, and the storage inventory where relevant.

- [x] Author one small specification-refinement exercise with a public function contract, independent hidden cases, conceptual categories, and a manual path when local inference is unavailable. This is a short demonstration, deliberately smaller than a full tutorial catalogue.
- [x] Verify reference and independently correct Python implementations pass while plausible boundary/order/duplicate mistakes fail.
- [x] Document the YAML opt-in, public interface, storage/cache ownership and deletion, engine formats, browser limits, and unverified hardware acceptance. Update tutorial schema, checklist, and architecture in the same change.

## Task 5: Real runtime and browser verification

**Files:** Create `tests/tutorial-llm.spec.js` and targeted real-model verification support where justified; retain temporary downloads/reports outside the repository.

- [x] Run the complete fast unit suite for the new modules, tutorial integration checks, and affected existing Python tests.
- [x] Load real Qwen weights using both engines, including forced CPU and available WebGPU; record model download/cached startup, first token, completion, and cancellation. Mark unavailable hardware paths unverified rather than passing them with mocks.
- [x] Verify keyboard-only controls, light/dark readability, narrow reflow, progress semantics, deletion, and print. Run scoped WCAG and print audits for the demo and storage/settings pages.
- [x] Request an independent code review as required by the execution skill; resolve actionable findings, rerun affected checks, inspect scoped diffs, and report exact validation and remaining hardware limits.

Execution: native in this session. The user explicitly requested implementation; no additional planning approval is required.

Implementation and independent review are complete in the isolated worktree; no implementation commit, merge, or push was requested. User testing added Firefox runtime selection and GPU-limit regressions. Physical 8 GB Intel and Safari performance acceptance remain unverified.
## Follow-up: fast Firefox graphics with the same checkpoint

Use the existing exchangeable-engine interface to add Transformers.js 3.8.1 / ONNX Runtime Web's JavaScript WebGPU backend, retaining Qwen2.5-Coder 1.5B Instruct. Prototype real Firefox inference before integration. The prototype completed on a device explicitly limited to nine storage buffers; Transformers.js 4.3.2's native backend failed the same limit.

Add pre-download ONNX eligibility checks, a pinned 1.36 GB ONNX representation, streamed resumable ranges, a read-only cache bridge, verified hosted executables, and the existing cancel/unload/delete flow. Prefer ONNX for fresh Firefox graphics selections while honoring cached formats and explicit choices. Validate full generation, cache reload, same-origin deletion, browser interactions, and affected-page accessibility. Keep weights, executables, benchmark scripts, and reports outside the repository.
