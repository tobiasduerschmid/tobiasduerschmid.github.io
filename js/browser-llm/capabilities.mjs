import {wllamaFeatures} from './wasm-features.mjs';
import {measurementKey} from './measurements.mjs';
import {DEFAULT_MODEL,MODELS} from './catalog.mjs';
// Capability checks never import an inference engine or fetch model assets.
export const GPU_LIMIT = 1 << 30;
const SIMD = new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]);

async function bounded(promise, timeoutMs = 3000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_,reject) => {
    timer = setTimeout(() => reject(new Error('Capability check timed out')), timeoutMs);
  })]); } finally { clearTimeout(timer); }
}
export async function detectCapabilities({navigator: nav = globalThis.navigator,
  isolated = globalThis.crossOriginIsolated} = {}) {
  const wasm = typeof WebAssembly === 'object';
  const wllama = wllamaFeatures({userAgent:nav?.userAgent});
  const cores = Math.max(1, Math.floor(nav?.hardwareConcurrency || 1));
  const report = {wasm, simd: wasm && WebAssembly.validate(SIMD), isolated: !!isolated,
    exceptions: typeof globalThis.WebAssembly?.Tag === 'function',
    wllamaGPU:wllama.gpu,firefox:wllama.firefox,
    cores, threads: isolated ? Math.max(1, Math.min(4, Math.floor(cores/2))) : 1,
    memoryGB: Number.isFinite(nav?.deviceMemory) ? nav.deviceMemory : null,
    gpu: {available: false, f16: false}};
  if (nav?.gpu) {
    let expired = false;
    try {
      // Late successful probes must also release their device after a timeout.
      await bounded((async () => {
        const adapter = await nav.gpu.requestAdapter({powerPreference:'high-performance'});
        if (!adapter || expired) return;
        const limits = adapter.limits;
        const f16 = adapter.features.has('shader-f16');
        const requiredLimits = {};
        for (const key of ['maxBufferSize','maxStorageBufferBindingSize']) {
          requiredLimits[key] = Math.min(limits[key], GPU_LIMIT);
        }
        requiredLimits.maxStorageBuffersPerShaderStage = Math.min(limits.maxStorageBuffersPerShaderStage || 8,10);
        requiredLimits.maxComputeWorkgroupStorageSize = Math.min(limits.maxComputeWorkgroupStorageSize || 32768,32768);
        const device = await adapter.requestDevice({requiredFeatures:f16 ? ['shader-f16'] : [], requiredLimits});
        device.destroy();
        if (!expired) report.gpu = {available: true, f16, ...requiredLimits};
      })());
    } catch { /* A usable CPU path remains available after adapter/device failure. */ }
    finally { expired = true; }
  }
  return report;
}

const PROFILES = {
  '3b':[
  {id:'webllm-gpu',engine:'webllm',artifact:'mlc',gpu:true,label:'Graphics acceleration (WebLLM)'},
  {id:'onnx-gpu',engine:'onnx',artifact:'onnx',gpu:true,label:'Graphics acceleration (ONNX)'},
  {id:'wllama-gpu',engine:'wllama',artifact:'gguf',gpu:true,label:'Graphics acceleration (wllama)'},
  {id:'wllama-cpu',engine:'wllama',artifact:'gguf',gpu:false,label:'Processor (wllama)'}
  ],
  // A 7B download must never be handed to the 3B library or a wasm32 CPU path.
  '7b':[{id:'webllm-7b-gpu',choice:'webllm-gpu',engine:'webllm',artifact:'mlc7b',gpu:true,label:'Graphics acceleration (WebLLM, 7B)'}]
};
function graphicsLimitation(profile,capabilities) {
  const gpu = capabilities.gpu;
  if (!gpu.available) return 'This browser could not create a graphics device.';
  if (profile.engine === 'wllama') return capabilities.wllamaGPU === false ? 'This browser cannot run the wllama graphics engine.' : null;
  if (!gpu.f16) return 'This graphics device does not support half-precision calculations.';
  if ((gpu.maxComputeWorkgroupStorageSize || 32768) < 32768) return 'This graphics device provides less than the required 32 KiB of workgroup storage.';
  // The 3B ONNX embedding is 622 MB. WebLLM's largest quantized tensors
  // (3B: 155 MB; 7B: 272 MB) exceed its 128 MiB fallback without a 1 GiB binding.
  if (gpu.maxBufferSize < GPU_LIMIT || gpu.maxStorageBufferBindingSize < GPU_LIMIT) return 'This graphics device provides less than the required 1 GiB buffer and binding limits.';
  const required = profile.engine === 'onnx' ? 9 : 10;
  if (!(gpu.maxStorageBuffersPerShaderStage >= required)) return 'This graphics device allows '+(gpu.maxStorageBuffersPerShaderStage || 0)+' storage buffers per shader stage; this engine requires '+required+'.';
  return null;
}
export function selectCandidates(capabilities, {model=DEFAULT_MODEL,choice='auto',cached=[],measurements=new Map(),excluded=new Set()} = {}) {
  if (!Object.hasOwn(MODELS,model)) throw new Error('Unknown model selection. Choose 3B or 7B.');
  if (!capabilities.wasm || !capabilities.simd || capabilities.exceptions === false) throw new Error('This browser needs WebAssembly with vector instructions. You can continue the tutorial without model assistance.');
  let candidates = PROFILES[model].filter(profile => !excluded.has(profile.id) && (!profile.gpu || !graphicsLimitation(profile,capabilities)))
    .map(p=>({...p,model,threads:p.engine === 'onnx' ? 1 : capabilities.threads || 1}));
  const upgradeUnavailable = '7B requires the WebLLM graphics engine. '+
    (model === '7b' ? graphicsLimitation(PROFILES['7b'][0],capabilities) || 'Select Automatic or Graphics — WebLLM; if it already failed, try another compatible browser.' : '')+
    ' Choose 3B to use the other engines on this browser.';
  if (model === '7b' && !candidates.length) throw new Error(upgradeUnavailable);
  if (choice !== 'auto') {
    candidates = candidates.filter(p => (p.choice || p.id) === (choice === 'cpu' ? 'wllama-cpu' : choice));
    if (!candidates.length) throw new Error(model === '7b' ? upgradeUnavailable : 'That engine is unavailable in this browser. Choose Automatic or Processor.');
  } else {
    candidates.sort((a,b) => Number(cached.includes(b.artifact))-Number(cached.includes(a.artifact)) ||
      (capabilities.firefox ? Number(b.id === 'onnx-gpu')-Number(a.id === 'onnx-gpu') : 0) ||
      (capabilities.firefox ? Number(a.id === 'wllama-gpu')-Number(b.id === 'wllama-gpu') : 0));
    const available = candidates.filter(p=>cached.includes(p.artifact));
    // An unmeasured engine is unknown, not slower. Refine the heuristic only
    // when all currently eligible cached profiles completed the same workload.
    if (available.length && available.every(p=>measurements.has(measurementKey(p)))) {
      candidates.sort((a,b)=>{
        if (!cached.includes(a.artifact) || !cached.includes(b.artifact)) return 0;
        return measurements.get(measurementKey(a))-measurements.get(measurementKey(b));
      });
    }
  }
  return candidates;
}
