const {test} = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../../js/browser-llm/runtime.mjs'),import('../../js/browser-llm/catalog.mjs')]);

// Browser boundaries only: inference replies are not evidence of model quality.
async function browser(t,{cached=['mlc','gguf'],reply=()=>true}={}) {
  const [{BrowserLLM},{ARTIFACTS}] = await modules;
  const assets = new Map(cached.flatMap(key=>ARTIFACTS[key].assets.map(asset=>[asset.url,asset])));
  const calls=[];
  let probes=0;
  const match=async url=>assets.has(url) ? new Response('',{headers:{'x-sebook-model-bytes':String(assets.get(url).bytes)}}) : undefined;
  const cacheStorage={match,open:async()=>({match})};
  const values={
    caches:cacheStorage,
    navigator:{hardwareConcurrency:8,locks:{request:async(_,options,callback)=>callback({})},gpu:{requestAdapter:async()=>{
      probes++;
      return {features:new Set(['shader-f16']),limits:{maxBufferSize:1<<30,maxStorageBufferBindingSize:1<<30,maxComputeWorkgroupStorageSize:32768,maxStorageBuffersPerShaderStage:10},requestDevice:async()=>({destroy(){}})};
    }}},
    BroadcastChannel:class {addEventListener(){} close(){}},
    Worker:class {
      postMessage(message) {
        calls.push(message);
        queueMicrotask(async()=>{
          const result=await reply(message,value=>this.onmessage?.({data:{id:message.id,type:'progress',value}}));
          if (result instanceof Error) this.onmessage?.({data:{id:message.id,type:'error',value:{name:result.name,message:result.message}}});
          else this.onmessage?.({data:{id:message.id,type:'result',value:message.action==='generate' ? {text:message.payload.maxTokens===96?message.payload.messages[1].content:'ready',finishReason:'stop'} : result}});
        });
      }
      terminate(){}
    },
    fetch:async()=>{throw new Error('Unexpected network request');}
  };
  const descriptors=Object.fromEntries(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,configurable:true});
  const runtime=new BrowserLLM();
  t.after(async()=>{
    await runtime.unload();runtime.destroy();
    for (const [key,descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
  });
  return {runtime,calls,cacheStorage,probes:()=>probes};
}
const failure=name=>Object.assign(new Error(name==='TimeoutError'?'Operation timed out':'Graphics device lost'),{name});

test('an older hardware check cannot replace the student’s newer Processor selection',async t=>{
  const {runtime,cacheStorage,calls}=await browser(t);
  const match=cacheStorage.match;
  let release,started;
  const waiting=new Promise(resolve=>started=resolve);
  cacheStorage.match=async(...args)=>{
    if (started) {const signal=started;started=null;signal();await new Promise(resolve=>release=resolve);}
    return match(...args);
  };
  const old=runtime.prepare('webllm-gpu');
  const rejected=assert.rejects(old,{name:'AbortError'});
  await waiting;
  const current=await runtime.prepare('cpu');
  release();await rejected;
  assert.equal(current.profile.id,'wllama-cpu');
  await runtime.load();
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.id),['wllama-cpu']);
});

test('exhausted initialization deadlines do not silently start a CPU retry',async t=>{
  const {runtime,calls}=await browser(t,{cached:['gguf'],reply:m=>m.action==='load'?failure('TimeoutError'):true});
  await runtime.prepare();
  await assert.rejects(runtime.load(),{name:'TimeoutError'});
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.id),['wllama-gpu']);
});

test('a GPU initialization failure disposes that attempt and can reuse GGUF on the CPU',async t=>{
  const {runtime,calls}=await browser(t,{cached:['gguf'],reply:m=>m.action==='load'&&m.payload.profile.gpu?failure('BackendError'):true});
  await runtime.prepare();await runtime.load();
  assert.equal(runtime.ready,true);
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.id),['wllama-gpu','wllama-cpu']);
});

test('generation GPU failure reprobes, excludes that candidate, and needs a new load action',async t=>{
  let broken=false;
  const {runtime,calls,probes}=await browser(t,{cached:['gguf'],reply:m=>broken&&m.action==='generate'?failure('BackendError'):true});
  await runtime.prepare();await runtime.load();
  const previous=probes();broken=true;
  await assert.rejects(runtime.generate([{role:'user',content:'Write a function.'}]),/Graphics device lost/);
  assert.equal(runtime.ready,false);
  assert.equal(runtime.profile.id,'wllama-cpu');
  assert.ok(probes()>previous);
  assert.equal(calls.filter(c=>c.action==='load').length,1);
});

test('load validates inference with a separate bounded non-student warm-up',async t=>{
  const {runtime,calls}=await browser(t,{cached:['gguf']});
  await runtime.prepare('cpu');await runtime.load();
  assert.equal(calls.filter(c=>c.action==='generate').length,1);
  assert.equal(runtime.warmups.size,1);
  assert.equal(runtime.measurements.size,0);
  assert.equal(runtime.ready,true);
});

test('using a cached model loads it on demand, reports preparation, and reuses memory',async t=>{
  let release,started;
  const pending=new Promise(resolve=>release=resolve);
  const loading=new Promise(resolve=>started=resolve);
  const {runtime,calls}=await browser(t,{reply:m=>{
    if (m.action==='load') {started();return pending;}
    return true;
  }});
  await runtime.prepare();
  assert.equal(calls.length,0,'preflight must not load a model');
  const progress=[];
  const generation=runtime.generate([{role:'user',content:'Write a function.'}],{onProgress:value=>progress.push(value)});
  await Promise.race([loading,generation]);
  assert.ok(progress.some(value=>value.phase==='initializing'));
  assert.equal(calls.filter(c=>c.action==='generate').length,0,'generation waits for initialization');
  release(true);
  await generation;
  assert.equal(progress.at(-1).phase,'generating','preparation ends before student output');
  await runtime.generate([{role:'user',content:'Write another function.'}]);
  assert.equal(calls.filter(c=>c.action==='load').length,1,'a ready model stays in memory');
});

test('on-demand loading never downloads an evicted or absent model',async t=>{
  const {runtime,calls}=await browser(t,{cached:[]});
  await runtime.prepare();
  await assert.rejects(runtime.generate([{role:'user',content:'Write a function.'}]),/no longer downloaded/);
  assert.equal(calls.length,0);
});

test('comparison uses cached candidates only and retains measurements in this session',async t=>{
  const {runtime,calls}=await browser(t,{cached:['gguf']});
  const plan=await runtime.prepare();
  assert.equal(plan.comparable,true);
  await runtime.compare();
  const loaded=calls.filter(c=>c.action==='load').map(c=>c.payload.profile.id);
  assert.ok(loaded.includes('wllama-gpu'));
  assert.ok(loaded.includes('wllama-cpu'));
  assert.ok(!loaded.includes('webllm-gpu'));
  assert.equal(runtime.measurements.size,2);
  assert.equal(runtime.ready,true);
});

test('waiting for another tab and reloading a profile do not make a faster engine lose the comparison',async t=>{
  let clock=0;
  t.mock.method(performance,'now',()=>clock);
  const {runtime}=await browser(t,{cached:['gguf'],reply:(message,progress)=>{
    if(message.action==='generate' && message.payload.maxTokens===96) {
      if(message.payload.profile.gpu) {
        progress({phase:'queued'});clock+=1000;
        progress({phase:'initializing'});clock+=500;
      }
      progress({phase:'generating'});
      clock+=message.payload.profile.gpu ? 20 : 100;
    }
    return true;
  }});
  await runtime.prepare();
  const result=await runtime.compare();
  assert.equal(result.measured,true);
  assert.equal(result.profile.id,'wllama-gpu','Compare should select the faster inference, excluding another tab’s wait');
});


for (const name of ['TimeoutError','InputError','AbortError','HostLostError']) {
  test(name+' during generation does not mark a compatible GPU as broken',async t=>{
    let broken=false;
    const {runtime}=await browser(t,{cached:['gguf'],reply:m=>broken&&m.action==='generate'?failure(name):true});
    await runtime.prepare();await runtime.load();broken=true;
    await assert.rejects(runtime.generate([{role:'user',content:'Write a function.'}]),{name});
    const plan=await runtime.prepare();
    assert.equal(plan.profile.id,'wllama-gpu');
  });
}


test('a comparison deadline releases the model and does not benchmark another candidate',async t=>{
  const {runtime,calls}=await browser(t,{cached:['gguf'],reply:m=>m.action==='generate'&&m.payload.maxTokens===96?failure('TimeoutError'):true});
  await runtime.prepare();
  await assert.rejects(runtime.compare(),{name:'TimeoutError'});
  assert.equal(runtime.ready,false);
  assert.equal(runtime.releaseLock,null);
  assert.equal(calls.filter(c=>c.action==='load').length,1);
});

test('7B needs an explicit memory confirmation even when its weights are already downloaded',async t=>{
  const {runtime,calls}=await browser(t,{cached:['mlc7b']});
  const plan=await runtime.prepare('auto',{model:'7b'});
  assert.equal(plan.cached,true);
  assert.equal(plan.canLoad,false);
  await assert.rejects(runtime.load({cachedOnly:true}),/16 GB/);
  assert.equal(calls.length,0);
  await runtime.prepare('auto',{model:'7b',memoryConfirmed:true});
  await runtime.load({cachedOnly:true});
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.artifact),['mlc7b']);
});

test('changing model releases the previous model before the selected cached model can load',async t=>{
  const {runtime,calls}=await browser(t,{cached:['mlc','mlc7b']});
  await runtime.prepare();await runtime.load({cachedOnly:true});
  const plan=await runtime.prepare('auto',{model:'7b',memoryConfirmed:true});
  assert.equal(runtime.ready,false);
  assert.equal(runtime.releaseLock,null);
  assert.equal(plan.profile.artifact,'mlc7b');
  await runtime.load({cachedOnly:true});
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.artifact),['mlc','mlc7b']);
});

test('7B backend failure never substitutes the 3B model or downloads another representation',async t=>{
  const {runtime,calls}=await browser(t,{cached:['mlc7b','gguf'],reply:m=>m.action==='load'?failure('BackendError'):true});
  await runtime.prepare('auto',{model:'7b',memoryConfirmed:true});
  await assert.rejects(runtime.load({cachedOnly:true}),{name:'BackendError'});
  assert.deepEqual(calls.filter(c=>c.action==='load').map(c=>c.payload.profile.artifact),['mlc7b']);
  const plan=await runtime.prepare('auto',{model:'3b'});
  assert.equal(plan.profile.artifact,'gguf','a 7B failure must not blacklist the lower-memory model');
});
