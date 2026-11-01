const {test:base,expect} = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Browser integration at the public runtime API: real locks, channels, caches,
// worker lifecycle and queue. Only the external inference adapter is replaced.
const test=base.extend({modelSite:async({},use)=>{
  let loads=0;
  const held=new Set(),started=new Map(),waiting=new Map(),responses=new Map();
  const adapter=`export async function load(profile) {
    const engine=await (await fetch('/engine-load')).text();
    return {async generate(messages,maxTokens,onText) {
      const question=messages.at(-1).content;
      if(maxTokens===16)return {text:'ready',finishReason:'stop'};
      if(question==='oversize')throw new Error('request (5000 tokens) exceeds the available context size (4096 tokens)');
      onText('stream '+question);
      await fetch('/generate?question='+encodeURIComponent(question));
      return {text:engine+':'+profile.artifact+':'+question,finishReason:'stop'};
    }};
  }`;
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    res.setHeader('Cross-Origin-Opener-Policy','same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy','require-corp');
    if(url.pathname==='/engine-load'){res.end(String(++loads));return;}
    if(url.pathname==='/generate'){
      const question=url.searchParams.get('question');
      started.set(question,true);waiting.get(question)?.();
      if(held.has(question))responses.set(question,res);else res.end('done');
      return;
    }
    if(url.pathname==='/'){
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html lang="en"><title>Shared inference integration fixture</title><body><main><h1>Shared inference integration fixture</h1></main></body></html>');return;
    }
    res.setHeader('Content-Type','text/javascript');
    if(['/js/browser-llm/adapters/wllama.mjs','/js/browser-llm/adapters/webllm.mjs'].includes(url.pathname)){res.end(adapter);return;}
    try {res.end(await fs.readFile(path.join(__dirname,'..',url.pathname)));}
    catch {res.statusCode=404;res.end('missing');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {await use({url:'http://127.0.0.1:'+server.address().port,loads:()=>loads,
    hold:question=>held.add(question),
    hasStarted:question=>started.has(question),
    started:question=>started.has(question)?Promise.resolve():new Promise(resolve=>waiting.set(question,resolve)),
    finish:question=>{held.delete(question);responses.get(question)?.end('done');responses.delete(question);}
  });} finally {
    for(const response of responses.values())response.end('done');
    await new Promise(resolve=>{
      server.close(resolve);
      // The page fixture can outlive this fixture with a worker's HTTP socket.
      server.closeAllConnections();
    });
  }
}});

async function openRuntime(page,site,{sharing=true,model='3b'}={}) {
  await page.goto(site.url);
  return page.evaluate(async({sharing,model})=>{
    if(!sharing)Object.defineProperty(globalThis,'BroadcastChannel',{value:undefined,configurable:true});
    if(model==='7b')Object.defineProperty(navigator,'gpu',{value:{requestAdapter:async()=>({
      features:new Set(['shader-f16']),limits:{maxBufferSize:1073741824,maxStorageBufferBindingSize:1073741824,
        maxComputeWorkgroupStorageSize:32768,maxStorageBuffersPerShaderStage:10},
      requestDevice:async()=>({destroy(){}})
    })},configurable:true});
    const [{BrowserLLM},{ARTIFACTS}]=await Promise.all([import('/js/browser-llm/runtime.mjs'),import('/js/browser-llm/catalog.mjs')]);
    for(const asset of ARTIFACTS[model==='7b'?'mlc7b':'gguf'].assets){
      const cache=await caches.open(asset.cache);
      await cache.put(asset.url,new Response('fixture',{headers:{'x-sebook-model-bytes':String(asset.bytes)}}));
    }
    window.notices=[];window.streams=[];window.phases=[];
    window.runtime=new BrowserLLM({onChange:message=>{window.controller?.abort();notices.push(message);}});
    return runtime.prepare(model==='7b'?'auto':'cpu',{model,memoryConfirmed:model==='7b'});
  },{sharing,model});
}
const generate=(page,question)=>page.evaluate(question=>{
  const controller=window.controller=new AbortController();
  return runtime.generate([{role:'user',content:question}],{signal:controller.signal,
    onText:text=>streams.push(text),onProgress:value=>phases.push({phase:value.phase,ready:runtime.ready})
  }).then(value=>({text:value.text}),error=>({error:error.name,message:error.message,
    recoverable:error.recoverable,contextLimit:error.contextLimit}));
},question);

test('two tutorial tabs share one engine and a non-host can close without cancelling the host',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  const plan=await openRuntime(a,modelSite);await openRuntime(b,modelSite);
  expect(plan.sharing.supported).toBe(true);
  expect((await generate(a,'first')).text).toBe('1:gguf:first');
  expect(await a.evaluate(()=>phases.filter(value=>value.phase==='generating').every(value=>value.ready))).toBe(true);
  expect((await generate(b,'second')).text).toBe('1:gguf:second');
  modelSite.hold('host work');const active=generate(a,'host work');await modelSite.started('host work');
  await b.close();modelSite.finish('host work');
  expect((await active).text).toBe('1:gguf:host work');expect(modelSite.loads()).toBe(1);
  expect(await a.evaluate(()=>streams)).toEqual(['stream first','stream host work']);
});

test('an active response from another tab survives cancelling a queued request',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite);await generate(a,'ready');
  modelSite.hold('A private');const active=generate(a,'A private');await modelSite.started('A private');
  const queued=b.evaluate(async()=>{
    window.controller=new AbortController();window.queued=false;
    return runtime.generate([{role:'user',content:'B private'}],{signal:controller.signal,
      onProgress:value=>{if(value.phase==='queued')window.queued=true;},onText:text=>streams.push(text)
    }).then(value=>({text:value.text}),error=>({error:error.name}));
  });
  await expect.poll(()=>b.evaluate(()=>window.queued)).toBe(true);
  await b.evaluate(()=>controller.abort());expect((await queued).error).toBe('AbortError');
  modelSite.finish('A private');expect((await active).text).toBe('1:gguf:A private');
  expect(await b.evaluate(()=>streams)).toEqual([]);expect(modelSite.loads()).toBe(1);
});

test('closing the hosting tab reports an interrupted response and the next attempt uses cached weights',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await generate(a,'host ready');await openRuntime(b,modelSite);
  modelSite.hold('interrupted');const pending=generate(b,'interrupted');await modelSite.started('interrupted');
  await a.close();const interrupted=await pending;
  expect(interrupted.error).toBe('HostLostError');expect(interrupted.message).toMatch(/hosting.*closed|hosting.*unavailable/i);
  expect(await b.evaluate(()=>notices)).toEqual([]);
  expect(await b.evaluate(()=>controller.signal.aborted)).toBe(false);
  expect((await generate(b,'try again')).text).toBe('2:gguf:try again');
  expect(modelSite.loads()).toBe(2);
});

test('idle tabs are notified when their shared model host closes',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite);
  await generate(a,'host ready');await generate(b,'guest ready');
  await a.close();
  await expect.poll(()=>b.evaluate(()=>notices.some(message=>message.includes('hosting')))).toBe(true);
  expect(await b.evaluate(()=>runtime.ready)).toBe(false);
  expect((await generate(b,'next request')).text).toBe('2:gguf:next request');
});

test('deleting model files in either tab cancels shared inference and invalidates the other tab',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite);await generate(a,'host ready');
  modelSite.hold('to delete');const pending=generate(b,'to delete');await modelSite.started('to delete');
  await a.evaluate(()=>runtime.deleteModels());expect((await pending).error).toBe('AbortError');
  expect(await b.evaluate(()=>runtime.ready)).toBe(false);
  expect((await generate(b,'after delete')).message).toMatch(/no longer downloaded/);
  expect(modelSite.loads()).toBe(1);
});

test('unsupported cross-tab transport clearly reports a dedicated model instance',async({page,modelSite})=>{
  const plan=await openRuntime(page,modelSite,{sharing:false});
  expect(plan.sharing.supported).toBe(false);expect(plan.sharing.message).toMatch(/unavailable.*this tab/i);
  expect((await generate(page,'local only')).text).toBe('1:gguf:local only');
});

test('safe context errors retain their metadata and the shared engine remains reusable',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite);await generate(a,'host ready');
  const rejected=await generate(b,'oversize');
  expect(rejected.error).toBe('InputError');expect(rejected.recoverable).toBe(true);
  expect(rejected.contextLimit).toEqual({contextTokens:4096,maxInputTokens:4095});
  expect(await b.evaluate(()=>runtime.ready)).toBe(true);
  expect((await generate(b,'short question')).text).toBe('1:gguf:short question');
  expect(modelSite.loads()).toBe(1);
});

test('tabs with different model choices load the right cached profile on every turn and can still delete it',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite,{model:'7b'});
  expect((await generate(a,'small first')).text).toBe('1:gguf:small first');
  expect((await generate(b,'large')).text).toBe('2:mlc7b:large');
  await expect.poll(()=>a.evaluate(()=>runtime.ready)).toBe(false);
  expect((await generate(a,'small again')).text).toBe('3:gguf:small again');
  await b.evaluate(()=>runtime.deleteModels());
  expect(await a.evaluate(()=>runtime.ready)).toBe(false);
  expect((await generate(a,'deleted')).message).toMatch(/no longer downloaded/);
  expect(modelSite.loads()).toBe(3);
});

test('cancelling active inference lets the next tab run with a clean cached engine',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await openRuntime(a,modelSite);await openRuntime(b,modelSite);await generate(a,'host ready');
  await generate(b,'guest ready');
  modelSite.hold('B cancelled');
  const cancelled=b.evaluate(async()=>{
    window.controller=new AbortController();
    return runtime.generate([{role:'user',content:'B cancelled'}],{signal:controller.signal})
      .then(value=>({text:value.text}),error=>({error:error.name}));
  });
  await modelSite.started('B cancelled');
  const next=generate(a,'A after cancel');
  await expect.poll(()=>a.evaluate(()=>phases.some(value=>value.phase==='queued'))).toBe(true);
  await b.evaluate(()=>controller.abort());expect((await cancelled).error).toBe('AbortError');
  expect((await next).text).toBe('2:gguf:A after cancel');expect(modelSite.loads()).toBe(2);
  expect(await a.evaluate(()=>streams)).toEqual(['stream host ready','stream A after cancel']);
});

test('an unresponsive host times out without a duplicate instance and retry rediscovers it immediately',async({context,modelSite})=>{
  const a=await context.newPage(),b=await context.newPage();
  await a.clock.install();await b.clock.install();
  // Control only the browser messaging boundary; election and RPC remain real.
  await a.addInitScript(()=>{
    const NativeChannel=BroadcastChannel;
    window.BroadcastChannel=class extends NativeChannel {
      postMessage(message){
        if(window.withholdHostReplies && ['leader','reply','state'].includes(message.type))return;
        return super.postMessage(message);
      }
    };
  });
  await openRuntime(a,modelSite);await generate(a,'host ready');await openRuntime(b,modelSite);
  await generate(b,'guest ready');
  modelSite.hold('host unresponsive');
  const lost=generate(b,'host unresponsive');await modelSite.started('host unresponsive');
  await a.evaluate(()=>window.withholdHostReplies=true);
  await b.clock.fastForward(100000);
  expect((await lost).error).toBe('HostLostError');expect(modelSite.loads()).toBe(1);
  await a.evaluate(()=>window.withholdHostReplies=false);
  const retry=generate(b,'retry after silence');
  await expect.poll(()=>modelSite.hasStarted('retry after silence')).toBe(true);
  expect((await retry).text).toBe('2:gguf:retry after silence');
});
