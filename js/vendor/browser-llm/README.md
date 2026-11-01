# Hosted browser inference runtimes

No model weights, JavaScript bundles, WebAssembly binaries, or package archives are stored here. Only small license and provenance records are kept in the repository.

The current model target is Qwen2.5-Coder 3B Instruct with four-bit quantization. Its pinned artifacts live in `js/browser-llm/catalog.mjs`. Download size is not a measurement of peak browser RAM; validate loading and inference for each engine after changing model size.

`js/browser-llm/vendor.mjs` fetches pinned runtime assets from jsDelivr and an immutable mlc-ai GitHub commit after explicit model activation. Each executable fetch uses its SHA-256 integrity value before import or execution. Verified JavaScript and WebAssembly use temporary blob URLs; they are not executed from writable model-data caches. Browser HTTP caching may reuse the small runtime downloads.

- @mlc-ai/web-llm 0.2.87: Apache-2.0 (WEBLLM-LICENSE).
- @wllama/wllama and @wllama/wllama-compat 3.8.1: MIT (WLLAMA-LICENSE).
- Compiled Qwen2 model library: mlc-ai/binary-mlc-llm-libs, Apache-2.0.
- @huggingface/transformers 3.8.1: Apache-2.0 (TRANSFORMERS-LICENSE), with ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4 (MIT, ONNX-LICENSE).

The Qwen2.5-Coder 3B model weights use the [Qwen Research license](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct/blob/488639f1ff808d1d3d0ba301aef8c11461451ec5/LICENSE). The package licenses above apply to the inference runtimes. `provenance.json` records the upstream model revision and license separately.

The ONNX adapter intentionally pins the JavaScript WebGPU backend in Transformers.js 3.8.1. Historical Qwen2.5-Coder **1.5B** inference passed in real Firefox with a nine-buffer device. The native WebGPU backend in Transformers.js 4.3.2 exceeded that limit for the 1.5B test. Neither result validates 3B: a model or runtime upgrade requires repeating the constrained-device test and measuring full generation.

`provenance.json` records the upstream npm archive integrity, hosted asset URLs, and SHA-256 hashes. When upgrading, inspect runtime/cache behavior, update these records and the small runtime registry, and re-run real inference. Keep all large downloaded verification assets outside the repository.
