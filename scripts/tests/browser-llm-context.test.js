const {test} = require('node:test');
const assert = require('node:assert/strict');
const {build} = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');

// Keep production modules real; replace only browser storage and vendor imports.
async function browserModule(file, boundaries, globals, run) {
  const result = await build({entryPoints:[path.resolve(__dirname,'../../js/browser-llm',file)],
    bundle:true,write:false,platform:'node',format:'cjs',supported:{'dynamic-import':false},logLevel:'silent',plugins:[{
      name:'browser-boundaries',setup(builder) {
        builder.onResolve({filter:/.*/},args=>Object.hasOwn(boundaries,args.path) ? {path:args.path,external:true} : undefined);
      }
    }]});
  const module = {exports:{}};
  vm.runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,
    require:key=>boundaries[key],URL,DOMException,AbortController,performance,setTimeout,clearTimeout,...globals});
  return run(module.exports);
}

async function inferenceReply(generate) {
  const replies=[];
  const self={postMessage:reply=>replies.push(reply)};
  return browserModule('worker.mjs',{
    './storage.mjs':{artifactCached:async()=>true},
    './adapters/wllama.mjs':{load:async()=>({generate})}
  },{self},async()=>{
    await self.onmessage({data:{id:1,action:'load',payload:{profile:{engine:'wllama',artifact:'gguf'}}}});
    assert.equal(replies.at(-1).type,'result',replies.at(-1).value);
    await self.onmessage({data:{id:2,action:'generate',payload:{messages:[],maxTokens:128}}});
    return replies.at(-1);
  });
}

for (const [message,name,recoverable] of [
  ['request (2100 tokens) exceeds the available context size (2048 tokens), try increasing it','WllamaError',true],
  ['input (2100 tokens) is larger than the max context size (2048 tokens). skipping','WllamaError',true],
  ['Prompt tokens exceed context window size: number of prompt tokens: 2100; context window size: 2048','ContextWindowSizeExceededError',true],
  ['The specification and interface exceed this graphics engine’s 768-token input limit.','RangeError',true],
  ['The input exceeds the model context window.','RangeError',true],
  ['kv_cache_full','Error',false],
  ['The input is too long.','Error',false],
  ['The context length was exceeded.','Error',false],
  ['The input limit was exceeded.','Error',false],
]) {
  test('context rejection is explicit and safely reusable only when known: '+message,async()=>{
    const result = await inferenceReply(async()=>{throw Object.assign(new Error(message),{name});});
    assert.equal(result.errorName,'InputError');
    assert.equal(result.recoverable,recoverable);
    assert.equal(result.value,message);
    assert.equal(result.contextLimit.contextTokens,2048);
    assert.equal(result.contextLimit.maxInputTokens,2047);
  });
}

test('a context error after streaming output cannot retain the inference state',async()=>{
  const result = await inferenceReply(async(_,__,onText)=>{
    onText('Partial reply');
    throw Object.assign(new Error('Prompt tokens exceed context window size: 2100'),{name:'ContextWindowSizeExceededError'});
  });
  assert.equal(result.recoverable,false);
});

for (const [message,name] of [['GPU device lost','Error'],['Invalid typed array length','RangeError'],['Unable to allocate context size buffers','Error']]) {
  test('backend failures are never retained as safe input rejections: '+message,async()=>{
    const result = await inferenceReply(async()=>{throw Object.assign(new Error(message),{name});});
    assert.equal(result.errorName,'BackendError');
  });
}

test('worker client keeps safe rejected input usable without replaying it',async()=>{
  const {WorkerClient} = await import('../../js/browser-llm/worker-client.mjs');
  const calls=[];
  let terminated=0,created=0;
  const worker={terminate(){terminated++;},postMessage(message){
    calls.push(message);
    queueMicrotask(()=>this.onmessage({data:calls.length===1 ? {id:message.id,type:'error',value:'context full',
      errorName:'InputError',recoverable:true,contextLimit:{contextTokens:2048,maxInputTokens:2047}} :
      {id:message.id,type:'result',value:{text:'A new reply'}}}));
  }};
  const client=new WorkerClient(()=>{created++;return worker;});
  await assert.rejects(client.request('generate',{messages:['complete original input']}),error=>{
    assert.equal(error.name,'InputError');
    assert.equal(error.recoverable,true);
    assert.equal(error.contextLimit.maxInputTokens,2047);
    return true;
  });
  assert.equal(calls.length,1,'the rejected prompt is never retried');
  assert.equal((await client.request('generate',{messages:['student recap']})).text,'A new reply');
  assert.equal(terminated,0);
  assert.equal(created,1);
  client.stop();
});

for (const [errorName,recoverable] of [['BackendError',true],['InputError',false],['AbortError',true],['TimeoutError',true]]) {
  test('worker client terminates an unsafe '+errorName,async()=>{
    const {WorkerClient} = await import('../../js/browser-llm/worker-client.mjs');
    let terminated=0;
    const worker={terminate(){terminated++;},postMessage(message){
      queueMicrotask(()=>this.onmessage({data:{id:message.id,type:'error',value:'unsafe operation',errorName,recoverable}}));
    }};
    const client=new WorkerClient(()=>worker);
    await assert.rejects(client.request('generate',{}),{name:errorName});
    assert.equal(terminated,1);
  });
}

test('failed loading always terminates the worker even if mislabeled recoverable',async()=>{
  const {WorkerClient}=await import('../../js/browser-llm/worker-client.mjs');
  let terminated=0;
  const worker={terminate(){terminated++;},postMessage(message){
    queueMicrotask(()=>this.onmessage({data:{id:message.id,type:'error',value:'context full',errorName:'InputError',recoverable:true}}));
  }};
  const client=new WorkerClient(()=>worker);
  await assert.rejects(client.request('load',{}),{name:'InputError'});
  assert.equal(terminated,1);
});

for (const name of ['AbortError','TimeoutError']) {
  test('native '+name+' remains terminal when its message mentions the context limit',async()=>{
    const result=await inferenceReply(async()=>{throw Object.assign(new Error(
      'request (2100 tokens) exceeds the available context size (2048 tokens), try increasing it'),{name});});
    assert.equal(result.errorName,name);
    assert.equal(result.recoverable,false);
  });
}

test('runtime retains a safely rejected prompt without unloading or retrying',async t=>{
  const {BrowserLLM} = await import('../../js/browser-llm/runtime.mjs');
  const runtime=new BrowserLLM();
  t.after(()=>runtime.destroy());
  runtime.ready=true;
  runtime.activeProfile={id:'wllama-cpu',gpu:false};
  let terminated=0,calls=0;
  runtime.client.factory=()=>({terminate(){terminated++;},postMessage(message){
    calls++;
    queueMicrotask(()=>this.onmessage({data:calls===1 ? {id:message.id,type:'error',value:'context full',errorName:'InputError',recoverable:true} :
      {id:message.id,type:'result',value:{text:'Use your recap',finishReason:'stop'}}}));
  }});
  await assert.rejects(runtime.generate([{role:'user',content:'Full prior reasoning'}]),{name:'InputError'});
  assert.equal(runtime.ready,true);
  assert.equal(calls,1);
  assert.equal((await runtime.generate([{role:'user',content:'My recap'}])).text,'Use your recap');
  assert.equal(terminated,0);
});

test('wllama disables automatic removal of prompt tokens from a full context',async()=>{
  let options;
  class Wllama {
    setCompat(){} getWorkerResources(){return {compat:false};}
    async loadModel(_,settings){options=settings;}
  }
  await browserModule('adapters/wllama.mjs',{
    '../wasm-features.mjs':{wllamaFeatures:()=>({gpu:false})},
    '../vendor.mjs':{importRuntime:async()=>({Wllama}),runtimeWasm:async()=>({url:'local-wasm',revoke(){}}),runtimeText:async()=>'',
      RUNTIME_ASSETS:{'wllama-3.8.1.wasm':{url:'cached'},'wllama-compat-3.8.1.wasm':{url:'cached'},'wllama-compat-3.8.1.js':{url:'cached'}}},
    '../storage.mjs':{readArtifactBlob:async()=>new Blob(['cached model'])}
  },{Blob},async({load})=>load({threads:2,gpu:false}));
  assert.equal(options.ctx_shift,false);
  assert.equal(options.n_ctx,2048);
});
