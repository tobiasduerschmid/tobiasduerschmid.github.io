const {test} = require('node:test');
const assert = require('node:assert/strict');
const storage = import('../../js/browser-llm/storage.mjs');
function cachesForTest() {
  const stores = new Map();
  return {stores, async match(url,{cacheName}){return stores.get(cacheName)?.get(String(url))?.clone();}, async keys(){return [...stores.keys()];}, async delete(name){return stores.delete(name);},
    async open(name){
      if (!stores.has(name)) stores.set(name,new Map());
      const entries=stores.get(name);
      return {match:async url=>entries.get(String(url))?.clone(),delete:async url=>entries.delete(String(url)),
        keys:async()=>[...entries.keys()].map(url=>new Request(url)),
        async put(url,response){const bytes=await response.arrayBuffer();entries.set(String(url),new Response(bytes,{headers:response.headers}));}};
    }};
}
const asset = {url:'https://example.test/model',bytes:4,cache:'sebook-llm-gguf-v1'};
const artifact = {bytes:4,assets:[asset]};
test('acquisition streams measured progress, reuses cached weights, and does not use the HTTP cache', async () => {
  const {acquireArtifact,artifactCached}=await storage;
  const cacheStorage=cachesForTest();let requests=0;const progress=[];
  const options={cacheStorage,onProgress:p=>progress.push(p),fetchImpl:async(url,opts)=>{
    requests++;assert.equal(opts.cache,'no-store');return new Response(new Uint8Array([1,2,3,4]));}};
  await acquireArtifact(artifact,options);
  assert.equal(progress.at(-1).loaded,4);
  assert.equal(progress.at(-1).total,4);
  assert.equal(await artifactCached(artifact,cacheStorage),true);
  await acquireArtifact(artifact,options);
  assert.equal(requests,1);
});
test('truncated downloads are rejected and never count as cached models',async()=>{
  const {acquireArtifact,artifactCached}=await storage;const cacheStorage=cachesForTest();
  await assert.rejects(acquireArtifact(artifact,{cacheStorage,fetchImpl:async()=>new Response(new Uint8Array([1,2]))}),/incomplete/i);
  assert.equal(await artifactCached(artifact,cacheStorage),false);
});
test('deletion clears all complete and partial inference stores but preserves student data',async()=>{
  const {clearModelCaches}=await storage;const cacheStorage=cachesForTest();
  for (const name of ['webllm/model','webllm/config','sebook-llm-gguf-v1','sebook-llm-onnx-v1','vm-assets-v2']) await cacheStorage.open(name);
  await clearModelCaches(cacheStorage);
  assert.deepEqual(await cacheStorage.keys(),['vm-assets-v2']);
});

test('a multi-file model serves only the requested cached file, assembling its ranges without refetching',async()=>{
  const {acquireArtifact,readArtifactFile}=await storage;
  const fileUrl='https://example.test/model.onnx';
  const multi={bytes:6,assets:[{...asset,url:'https://example.test/config.json',bytes:2},
    ...[0,2].map(start=>({...asset,fileUrl,url:fileUrl+'?part='+start,bytes:2,range:{start,end:start+1,total:4}}))]};
  const cacheStorage=cachesForTest();
  await acquireArtifact(multi,{cacheStorage,fetchImpl:async(url)=>url.endsWith('.json') ? new Response('{}') :
    new Response(new Uint8Array(url.endsWith('0')?[1,2]:[3,4]),{status:206,headers:{'Content-Range':url.endsWith('0')?'bytes 0-1/4':'bytes 2-3/4'}})});
  assert.equal(await (await readArtifactFile(multi,'https://example.test/config.json',cacheStorage)).text(),'{}');
  const response=await readArtifactFile(multi,fileUrl,cacheStorage);
  assert.equal(response.headers.get('Content-Length'),'4');
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3,4]);
  assert.equal(await readArtifactFile(multi,'https://example.test/unknown',cacheStorage),undefined);
  await cacheStorage.delete(asset.cache);
  await assert.rejects(readArtifactFile(multi,fileUrl,cacheStorage),/missing/i);
});
test('failed storage deletion is reported, not presented as success',async()=>{
  const {clearModelCaches}=await storage;
  await assert.rejects(clearModelCaches({keys:async()=>['webllm/model'],delete:async()=>{throw new Error('denied');}}),/denied/);
});

test('checking cache availability never creates or reopens cache namespaces during deletion',async()=>{
  const {acquireArtifact,artifactCached,modelStorageStatus}=await storage;
  const cacheStorage=cachesForTest();
  await acquireArtifact(artifact,{cacheStorage,fetchImpl:async()=>new Response(new Uint8Array(4))});
  cacheStorage.open=async()=>{throw new Error('Read-only status must not open a writable cache');};
  assert.equal(await artifactCached(artifact,cacheStorage),true);
  assert.equal((await modelStorageStatus(cacheStorage)).available,true);
});

test('insufficient browser quota is rejected before requesting any model bytes',async()=>{
  const {acquireArtifact}=await storage;let requests=0;
  await assert.rejects(acquireArtifact(artifact,{cacheStorage:cachesForTest(),
    estimateStorage:async()=>({quota:3,usage:0}),fetchImpl:async()=>{requests++;return new Response(new Uint8Array(4));}}),/storage/i);
  assert.equal(requests,0);
});

test('range-backed model parts validate the server range and reconstruct the original model bytes',async()=>{
  const {acquireArtifact,readArtifactBlob}=await storage;
  const parts={bytes:4,assets:[0,2].map(start=>({...asset,url:asset.url+'?part='+start,bytes:2,range:{start,end:start+1,total:4}}))};
  const cacheStorage=cachesForTest();
  await acquireArtifact(parts,{cacheStorage,fetchImpl:async(url,options)=>{
    const start=url.endsWith('0')?0:2;
    assert.equal(options.headers.Range,`bytes=${start}-${start+1}`);
    return new Response(new Uint8Array([start+1,start+2]),{status:206,headers:{'Content-Range':`bytes ${start}-${start+1}/4`}});
  }});
  assert.deepEqual([...new Uint8Array(await (await readArtifactBlob(parts,cacheStorage)).arrayBuffer())],[1,2,3,4]);
  await assert.rejects(acquireArtifact(parts,{cacheStorage:cachesForTest(),fetchImpl:async()=>new Response(new Uint8Array(2))}),/range/i);
});

test('a broken cache fails a tiny write/read check before any model request',async()=>{
  const {acquireArtifact}=await storage;let requests=0;
  const broken={match:async()=>undefined,open:async()=>({put:async()=>{},match:async()=>undefined,delete:async()=>false})};
  await assert.rejects(acquireArtifact(artifact,{cacheStorage:broken,fetchImpl:async()=>{requests++;return new Response(new Uint8Array(4));}}),/storage|retain/i);
  assert.equal(requests,0);
});
