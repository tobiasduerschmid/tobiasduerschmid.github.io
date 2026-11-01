const {test} = require('node:test');
const assert = require('node:assert/strict');

const small = {id:'webllm-gpu',engine:'webllm',artifact:'mlc',gpu:true,threads:1};
const large = {...small,id:'webllm-7b-gpu',artifact:'mlc7b'};
const request = (clientId,id,profile=small) => ({clientId,id,action:'generate',payload:{profile,messages:[{role:'user',content:clientId+' private question'}],maxTokens:32}});
const deferred = () => {let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};

// The production broker and worker transport are real; only native inference
// replies are controlled, so no model files or remote execution are needed.
async function fixture(t) {
  const {InferenceBroker} = await import('../../js/browser-llm/inference-broker.mjs');
  const {WorkerClient} = await import('../../js/browser-llm/worker-client.mjs');
  const generations=[],loads=[],states=[];
  let nextGeneration=deferred(),created=0,terminated=0;
  const worker = new WorkerClient(()=>{
    created++;
    let profile;
    return {terminate(){terminated++;},postMessage(message){
      const reply=(type,value)=>this.onmessage?.({data:{id:message.id,type,value}});
      if (message.action==='load') {
        profile=message.payload.profile;loads.push(profile.artifact);
        queueMicrotask(()=>reply('result',true));
      } else {
        const generation={profile,messages:message.payload.messages,
          text:value=>reply('text',value),finish:value=>reply('result',{text:value,finishReason:'stop'})};
        generations.push(generation);nextGeneration.resolve(generation);nextGeneration=deferred();
      }
    }};
  });
  const broker=new InferenceBroker({client:worker,holdStorage:async()=>()=>{},onState:state=>states.push(state)});
  t.after(()=>broker.dispose());
  return {broker,generations,loads,states,next:()=>nextGeneration.promise,created:()=>created,terminated:()=>terminated};
}

test('two tabs reuse one in-memory engine and receive only their own serialized output',async t=>{
  const f=await fixture(t),aText=[],bText=[];
  const firstStarted=f.next();
  const a=f.broker.request(request('A',1),{onText:value=>aText.push(value)});
  const first=await firstStarted;
  const b=f.broker.request(request('B',1),{onText:value=>bText.push(value)});
  assert.equal(f.generations.length,1,'another tab waits while inference is active');
  first.text('A only');
  const secondStarted=f.next();first.finish('A answer');
  assert.equal((await a).text,'A answer');
  const second=await secondStarted;second.text('B only');second.finish('B answer');
  assert.equal((await b).text,'B answer');
  assert.deepEqual(aText,['A only']);assert.deepEqual(bText,['B only']);
  assert.deepEqual(f.loads,['mlc']);assert.equal(f.created(),1);
  assert.equal(second.messages[0].content,'B private question');
});

test('cancelling a queued tab leaves another tab’s running response intact',async t=>{
  const f=await fixture(t),started=f.next();
  const a=f.broker.request(request('A',1));const running=await started;
  const b=f.broker.request(request('B',1));const rejected=assert.rejects(b,{name:'AbortError'});
  f.broker.cancel('B',1);await rejected;
  assert.equal(f.terminated(),0);running.finish('still A');
  assert.equal((await a).text,'still A');assert.equal(f.generations.length,1);
});

test('cancelling active work reloads the cached profile for the next tab without replaying cancelled output',async t=>{
  const f=await fixture(t),started=f.next(),texts=[];
  const a=f.broker.request(request('A',1));const rejected=assert.rejects(a,{name:'AbortError'});
  const old=await started;
  const b=f.broker.request(request('B',1),{onText:value=>texts.push(value)});
  const next=f.next();f.broker.cancel('A',1);await rejected;
  old.text('late private A text');old.finish('late private A result');
  const current=await next;current.text('B text');current.finish('B answer');
  assert.equal((await b).text,'B answer');assert.deepEqual(texts,['B text']);
  assert.deepEqual(f.loads,['mlc','mlc']);assert.equal(f.terminated(),1);
});

test('releasing a different tab cannot cancel the current owner’s request',async t=>{
  const f=await fixture(t);
  await f.broker.request({clientId:'A',id:1,action:'load',payload:{profile:small}});
  const started=f.next(),b=f.broker.request(request('B',1));const running=await started;
  f.broker.release('A');assert.equal(f.terminated(),0);
  running.finish('B survives');assert.equal((await b).text,'B survives');
  f.broker.release('B');assert.equal(f.terminated(),1);
  assert.equal(f.states.at(-1).profile,null);
});

test('each request runs with its requested model even after another tab switches models',async t=>{
  const f=await fixture(t);
  for (const [client,profile,answer] of [['A',small,'3B first'],['B',large,'7B'],['A',small,'3B again']]) {
    const started=f.next(),reply=f.broker.request(request(client,1,profile));
    const running=await started;assert.equal(running.profile.artifact,profile.artifact);
    running.finish(answer);assert.equal((await reply).text,answer);
  }
  assert.deepEqual(f.loads,['mlc','mlc7b','mlc']);
});

test('deleting model data rejects both active and queued tabs and invalidates readiness',async t=>{
  const f=await fixture(t),started=f.next();
  const a=f.broker.request(request('A',1));const rejectedA=assert.rejects(a,{name:'AbortError'});
  await started;
  const b=f.broker.request(request('B',1));const rejectedB=assert.rejects(b,{name:'AbortError'});
  f.broker.invalidate();await Promise.all([rejectedA,rejectedB]);
  assert.equal(f.terminated(),1);assert.equal(f.generations.length,1);
  assert.equal(f.states.at(-1).profile,null);
});
