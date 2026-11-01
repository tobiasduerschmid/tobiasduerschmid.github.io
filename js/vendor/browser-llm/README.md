# Hosted browser inference runtimes

No model weights, JavaScript bundles, WebAssembly binaries, or package archives are stored here. Only small license and provenance records are kept in the repository.

The default model is Qwen2.5-Coder 3B Instruct with four-bit quantization. Its pinned artifacts live in `js/browser-llm/catalog.mjs`. The optional Qwen2.5-Coder 7B Instruct upgrade uses its own four-bit MLC artifact in `catalog-7b.mjs` and its own compiled WebLLM library. Download size is not a measurement of peak browser RAM; validate loading and inference for each engine after changing model size.

The 7B manifest contains 4,291,435,425 bytes (4.29 GB), checked against Hugging Face's file metadata at revision `56dea5411b44b2a45cf0ceb16ead4c1f30141f49`. The [official WebLLM 0.2.87 configuration](https://github.com/mlc-ai/web-llm/blob/v0.2.87/src/config.ts) pairs that model with `Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu.wasm`, advertises 5,106.67 MB of graphics memory, and overrides the context to 4,096 tokens. This site uses the same context for 3B and 7B, while ONNX retains its separate 768-token input limit. The 16 GB device-memory recommendation and about 6 GB available graphics/shared-memory guidance allow headroom but are estimates, not measured peak-memory guarantees. Browser memory reporting can be capped at 8 GB or absent, so a learner explicitly confirms device memory; graphics limits are still checked independently.

7B is offered only through WebLLM with half-precision graphics, at least 10 storage buffers per shader stage, 32 KiB workgroup storage, and 1 GiB buffer/binding limits. Its largest quantized tensor is 272,498,688 bytes, too large for the runtime's 128 MiB fallback binding. A nine-buffer Firefox device keeps the existing 3B alternatives and receives a specific 7B incompatibility reason. No 7B CPU, ONNX, or wllama path is advertised. The 88 parameter shards, two MLC metadata files, and `tokenizer.json` cover this engine's downloads; [WebLLM selects `tokenizer.json`](https://github.com/mlc-ai/web-llm/blob/v0.2.87/src/cache_util.ts#L150-L167) and ignores the alternative tokenizer formats listed in the model config. No 7B weights were downloaded or full 7B inference measured as part of adding this catalog entry.

`js/browser-llm/vendor.mjs` fetches pinned runtime assets from jsDelivr and an immutable mlc-ai GitHub commit after explicit model activation. Each executable fetch uses its SHA-256 integrity value before import or execution. Verified JavaScript and WebAssembly use temporary blob URLs; they are not executed from writable model-data caches. Browser HTTP caching may reuse the small runtime downloads.

- @mlc-ai/web-llm 0.2.87: Apache-2.0 (WEBLLM-LICENSE).
- @wllama/wllama and @wllama/wllama-compat 3.8.1: MIT (WLLAMA-LICENSE).
- Compiled Qwen2 model library: mlc-ai/binary-mlc-llm-libs, Apache-2.0.
- @huggingface/transformers 3.8.1: Apache-2.0 (TRANSFORMERS-LICENSE), with ONNX Runtime Web 1.22.0-dev.20250409-89f8206ba4 (MIT, ONNX-LICENSE).

The Qwen2.5-Coder 3B model weights use the [Qwen Research license](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct/blob/488639f1ff808d1d3d0ba301aef8c11461451ec5/LICENSE). The package licenses above apply to the inference runtimes. `provenance.json` records the upstream model revision and license separately.

The optional 7B weights use [Apache-2.0](https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct/blob/c03e6d358207e414f1eca0bb1891e29f1db0e242/LICENSE). The MLC conversion is published by [mlc-ai at the pinned revision](https://huggingface.co/mlc-ai/Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC/tree/56dea5411b44b2a45cf0ceb16ead4c1f30141f49).

The ONNX adapter intentionally pins the JavaScript WebGPU backend in Transformers.js 3.8.1. Historical Qwen2.5-Coder **1.5B** inference passed in real Firefox with a nine-buffer device. The native WebGPU backend in Transformers.js 4.3.2 exceeded that limit for the 1.5B test. Neither result validates 3B: a model or runtime upgrade requires repeating the constrained-device test and measuring full generation.

`provenance.json` records the upstream npm archive integrity, hosted asset URLs, and SHA-256 hashes. When upgrading, inspect runtime/cache behavior, update these records and the small runtime registry, and re-run real inference. Keep all large downloaded verification assets outside the repository.
