const {test} = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([
  import('../../js/browser-llm/capabilities.mjs'),
  import('../../js/browser-llm/worker-client.mjs')
]);
const capable = {wasm: true, simd: true, isolated: true, cores: 8, memoryGB: null,
  gpu: {available: true, f16: true, maxBufferSize: 1073741824, maxStorageBufferBindingSize: 1073741824,maxStorageBuffersPerShaderStage:10}};

test('preflight probes and destroys a GPU device without requesting model data', async () => {
  const [{detectCapabilities}] = await modules;
  let destroyed = 0;
  const nav = {hardwareConcurrency: 8, gpu: {requestAdapter: async () => ({
    features: new Set(['shader-f16']), limits: capable.gpu,
    requestDevice: async () => ({destroy() {destroyed++;}})
  })}};
  const report = await detectCapabilities({navigator: nav, isolated: true});
  assert.equal(destroyed, 1);
  assert.equal(report.memoryGB, null);
  assert.equal(report.gpu.available, true);
  assert.equal(report.threads, 4);
});
test('CPU choice stays CPU; unknown memory does not reject an otherwise compatible browser', async () => {
  const [{selectCandidates}] = await modules;
  assert.deepEqual(selectCandidates(capable, {choice:'cpu'}).map(p=>p.id), ['wllama-cpu']);
  assert.equal(selectCandidates({...capable, gpu:{available:false}})[0].id, 'wllama-cpu');
});
test('automatic choice prefers a compatible cached artifact without another download', async () => {
  const [{selectCandidates}] = await modules;
  assert.equal(selectCandidates(capable)[0].id, 'webllm-gpu');
  assert.equal(selectCandidates(capable, {cached:['gguf']})[0].id, 'wllama-gpu');
  assert.equal(selectCandidates({...capable, gpu:{available:false}}, {cached:['mlc']})[0].id, 'wllama-cpu');
});
test('missing half precision excludes WebLLM, and explicit unavailable choices explain why', async () => {
  const [{selectCandidates}] = await modules;
  const noF16 = {...capable, gpu:{...capable.gpu,f16:false}};
  assert.equal(selectCandidates(noF16)[0].id, 'wllama-gpu');
  assert.throws(()=>selectCandidates(noF16,{choice:'webllm-gpu'}), /unavailable/i);
  assert.throws(()=>selectCandidates({...capable,wasm:false}), /WebAssembly/);
});
test('worker abort terminates inference, rejects pending work, and ignores late results', async () => {
  const [, {WorkerClient}] = await modules;
  const worker = {messages:[], postMessage(m){this.messages.push(m);},terminate(){this.terminated=true;}};
  const client = new WorkerClient(()=>worker);
  const abort = new AbortController();
  const request = client.request('load',{}, {signal:abort.signal});
  abort.abort();
  await assert.rejects(request, {name:'AbortError'});
  assert.equal(worker.terminated,true);
  worker.onmessage?.({data:{id:1,type:'result',value:'too late'}});
});
test('worker deadlines release pending work; concurrent operations are rejected', async () => {
  const [, {WorkerClient}] = await modules;
  const worker = {postMessage(){},terminate(){this.terminated=true;}};
  const client = new WorkerClient(()=>worker);
  const first = client.request('load',{}, {timeoutMs:10});
  await assert.rejects(client.request('generate',{}), /busy/i);
  await assert.rejects(first, {name:'TimeoutError'});
  assert.equal(worker.terminated,true);
});


test('automatic ranking compares identical completed workloads and keeps unmeasured candidates unknown',async()=>{
  const [{selectCandidates}] = await modules;
  const {measurementKey,comparableResult,BENCHMARK_PROGRAM}=await import('../../js/browser-llm/measurements.mjs');
  const profiles=selectCandidates(capable);
  const timings=new Map(profiles.filter(p=>p.gpu).map(p=>[measurementKey(p),p.id==='webllm-gpu'?30:20]));
  const options={cached:['mlc','gguf','onnx'],measurements:timings};
  assert.equal(selectCandidates(capable,options)[0].id,'webllm-gpu');
  timings.set(measurementKey(profiles.find(p=>p.id==='wllama-cpu')),10);
  assert.equal(selectCandidates(capable,options)[0].id,'wllama-cpu');
  assert.equal(selectCandidates(capable,{...options,choice:'webllm-gpu'})[0].id,'webllm-gpu');
  assert.equal(comparableResult({text:BENCHMARK_PROGRAM,finishReason:'stop'}),true);
  assert.equal(comparableResult({text:BENCHMARK_PROGRAM,finishReason:'length'}),false);
  assert.equal(comparableResult({text:'I am ready',finishReason:'stop'}),false);
});

test('a graphics adapter with only nine storage buffers cannot run the pinned WebLLM runtime',async()=>{
  const [{selectCandidates}]=await modules;
  const limited={...capable,gpu:{...capable.gpu,maxStorageBuffersPerShaderStage:9}};
  assert.ok(!selectCandidates(limited).some(p=>p.id==='webllm-gpu'));
  assert.throws(()=>selectCandidates(limited,{choice:'webllm-gpu'}),/unavailable/);
});


test('Firefox starts with CPU for GGUF until a complete-task comparison establishes a faster GPU',async()=>{
  const [{selectCandidates}]=await modules;
  const {measurementKey}=await import('../../js/browser-llm/measurements.mjs');
  const browser={...capable,firefox:true};
  const options={cached:['gguf']};
  assert.equal(selectCandidates(browser,options)[0].id,'wllama-cpu');
  const candidates=selectCandidates(browser,options);
  options.measurements=new Map(candidates.filter(p=>p.artifact==='gguf').map(p=>[measurementKey(p),p.gpu?100:200]));
  assert.equal(selectCandidates(browser,options)[0].id,'wllama-gpu');
});

test('Firefox can select ONNX graphics with nine storage buffers and no native JSPI',async()=>{
  const [{selectCandidates}]=await modules;
  const firefox={...capable,firefox:true,wllamaGPU:false,gpu:{...capable.gpu,maxStorageBuffersPerShaderStage:9}};
  assert.equal(selectCandidates(firefox)[0].id,'onnx-gpu');
  assert.equal(selectCandidates(firefox,{choice:'onnx-gpu'})[0].artifact,'onnx');
  assert.equal(selectCandidates(firefox,{cached:['gguf']})[0].id,'wllama-cpu');
  assert.equal(selectCandidates(firefox,{cached:['onnx','gguf']})[0].id,'onnx-gpu');
});

test('ONNX rejects unsupported half precision, buffer sizes, or shader limits before downloading',async()=>{
  const [{selectCandidates}]=await modules;
  for(const limits of [{f16:false},{maxStorageBufferBindingSize:536870912},{maxBufferSize:536870912},
    {maxStorageBuffersPerShaderStage:8},{maxComputeWorkgroupStorageSize:16384}]) {
    assert.throws(()=>selectCandidates({...capable,gpu:{...capable.gpu,...limits}},{choice:'onnx-gpu'}),/unavailable/);
  }
});

test('3B graphics eligibility rejects WebLLM bindings that would fall back below its tensor size',async()=>{
  const [{selectCandidates}]=await modules;
  const constrained={...capable,wllamaGPU:false,gpu:{...capable.gpu,maxStorageBufferBindingSize:536870912}};
  assert.throws(()=>selectCandidates(constrained,{choice:'webllm-gpu'}),/unavailable/);
  assert.equal(selectCandidates(constrained)[0].id,'wllama-cpu');
});
