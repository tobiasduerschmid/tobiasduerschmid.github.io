// Large runtime assets stay on pinned public hosts, outside this repository.
// Verify downloaded executable bytes before creating any executable blob URL.
export const RUNTIME_ASSETS = {
  "transformers-3.8.1.mjs": {
    "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js",
    "integrity": "sha256-qlACtw54l5jaJj9fmcYr0+j80MEZJYpJPEDBgGSDZfo="
  },
  "onnx-jsep-1.22.mjs": {
    "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.mjs",
    "integrity": "sha256-CPuG7EM8eL+wMsXYSmi46OWo2BJo+jniQxQXmldnpbk="
  },
  "onnx-jsep-1.22.wasm": {
    "url": "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/ort-wasm-simd-threaded.jsep.wasm",
    "integrity": "sha256-xGZV6KlK/EUzjUyyuEBHX4jlAS1SRQmRblBQecAL+jk="
  },
  "webllm-0.2.87.mjs": {
    "url": "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.87/lib/index.js",
    "integrity": "sha256-O/9MVc0vAgBxFRc0G6vOvnqRqO+FuYNCBDn88mg1pnQ="
  },
  "wllama-3.8.1.mjs": {
    "url": "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/index.js",
    "integrity": "sha256-5VBnU+QaWcEfYfLFJCIEW+n8duMqfkfwN6qtXfTscj4="
  },
  "wllama-3.8.1.wasm": {
    "url": "https://cdn.jsdelivr.net/npm/@wllama/wllama@3.8.1/esm/wasm/wllama.wasm",
    "integrity": "sha256-VR8TQ5Nm7/EeBXsbkf5Gp/2sKdVtZzctTF8ZpUnf5ww="
  },
  "wllama-compat-3.8.1.wasm": {
    "url": "https://cdn.jsdelivr.net/npm/@wllama/wllama-compat@3.8.1/wasm/wllama.wasm",
    "integrity": "sha256-LbP2fQvMGc348U8SnkbKtpG/+JiVSAj4otxMWG61u2g="
  },
  "wllama-compat-3.8.1.js": {
    "url": "https://cdn.jsdelivr.net/npm/@wllama/wllama-compat@3.8.1/wasm/wllama.js",
    "integrity": "sha256-JknutAiYiEHDcuVIBa36Ja7V0C+FDAmt14wvOsDz/OE="
  },
  "qwen2.5-3b-webllm-0.2.87.wasm": {
    "url": "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/146ed9cd4b4062e967b017fd2291f7106b50599f/web-llm-models/v0_2_87/base/Qwen2.5-3B-Instruct-q4f16_1_cs1k-webgpu.wasm",
    "integrity": "sha256-EOqE35gjopJ7UsvfdSvWTapuHbPRYX6+eRvp3CgApx4="
  }
};

async function verifiedResponse(name) {
  const asset = RUNTIME_ASSETS[name];
  if (!asset) throw new Error('Unknown model runtime asset.');
  const response = await fetch(asset.url,{integrity:asset.integrity});
  if (!response.ok) throw new Error('The model runtime could not be downloaded. Check your connection and try again.');
  return response;
}
export async function importRuntime(name) {
  const module = await runtimeModule(name);
  try { return await import(module.url); } finally { module.revoke(); }
}
export async function runtimeText(name) { return (await verifiedResponse(name)).text(); }
async function executableBlob(name,type) {
  const response = await verifiedResponse(name);
  const url = URL.createObjectURL(new Blob([await response.arrayBuffer()],{type}));
  return {url,revoke:()=>URL.revokeObjectURL(url)};
}
export const runtimeModule = name => executableBlob(name,'text/javascript');
export const runtimeWasm = name => executableBlob(name,'application/wasm');
