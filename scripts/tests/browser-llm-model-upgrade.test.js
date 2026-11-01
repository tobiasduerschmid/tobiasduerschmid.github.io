const {test} = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([
  import('../../js/browser-llm/capabilities.mjs'),
  import('../../js/browser-llm/catalog.mjs'),
  import('../../js/browser-llm/vendor.mjs')
]);
const capable = {wasm:true,simd:true,threads:4,memoryGB:8,
  gpu:{available:true,f16:true,maxBufferSize:1<<30,maxStorageBufferBindingSize:1<<30,
    maxStorageBuffersPerShaderStage:10,maxComputeWorkgroupStorageSize:32768}};

test('automatic selection retains the lower-memory 3B default even when 7B is downloaded',async()=>{
  const [{selectCandidates}] = await modules;
  assert.equal(selectCandidates(capable,{cached:['mlc7b']})[0].artifact,'mlc');
  assert.equal(selectCandidates(capable,{choice:'cpu'})[0].artifact,'gguf');
});

test('an explicit 7B selection uses only its own WebLLM artifact and never a CPU fallback',async()=>{
  const [{selectCandidates}] = await modules;
  const candidates = selectCandidates(capable,{model:'7b',cached:['gguf','onnx']});
  assert.deepEqual(candidates.map(p=>[p.engine,p.artifact]),[['webllm','mlc7b']]);
  assert.throws(()=>selectCandidates(capable,{model:'7b',choice:'cpu'}),/7B.*WebLLM/i);
  assert.throws(()=>selectCandidates(capable,{model:'7b',choice:'onnx-gpu'}),/7B.*WebLLM/i);
});

for (const [name,limits] of Object.entries({
  unavailable:{available:false},'no half precision':{f16:false},'nine shader buffers':{maxStorageBuffersPerShaderStage:9},
  'small binding':{maxStorageBufferBindingSize:536870912},'small buffer':{maxBufferSize:536870912},
  'small workgroup storage':{maxComputeWorkgroupStorageSize:16384}
})) {
  test('7B explains incompatible graphics before any download: '+name,async()=>{
    const [{selectCandidates}] = await modules;
    assert.throws(()=>selectCandidates({...capable,gpu:{...capable.gpu,...limits}},{model:'7b'}),/7B.*WebLLM.*3B/i);
  });
}

test('privacy-clamped or absent browser memory does not reject a compatible 7B graphics path',async()=>{
  const [{selectCandidates}] = await modules;
  for (const memoryGB of [null,4,8,16]) {
    assert.equal(selectCandidates({...capable,memoryGB},{model:'7b'})[0].artifact,'mlc7b');
  }
});

test('a nine-buffer graphics device gets the specific 7B compatibility reason',async()=>{
  const [{selectCandidates}] = await modules;
  assert.throws(()=>selectCandidates({...capable,gpu:{...capable.gpu,maxStorageBuffersPerShaderStage:9}},{model:'7b'}),/allows 9 storage buffers.*requires 10/);
});

test('7B download is complete, immutable, and paired with a separately verified 7B library',async()=>{
  const [, {ARTIFACTS,CONTEXT_TOKENS},{RUNTIME_ASSETS}] = await modules;
  assert.equal(CONTEXT_TOKENS,4096,'WebLLM and wllama reserve the configured 4K context');
  const model = ARTIFACTS.mlc7b;
  assert.equal(model.modelId,'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
  assert.equal(model.bytes,4291435425);
  assert.equal(model.assets.reduce((sum,asset)=>sum+asset.bytes,0),model.bytes);
  assert.equal(new Set(model.assets.map(a=>a.url)).size,model.assets.length);
  assert.ok(model.assets.every(asset=>asset.url.startsWith(model.baseUrl) && /\/resolve\/[0-9a-f]{40}\//.test(asset.url)));
  assert.notEqual(model.library,ARTIFACTS.mlc.library);
  assert.match(RUNTIME_ASSETS[model.library].url,/Qwen2-7B-Instruct-q4f16_1_cs1k-webgpu\.wasm$/);
  assert.equal(RUNTIME_ASSETS[model.library].integrity,model.integrity.model_lib);
});
