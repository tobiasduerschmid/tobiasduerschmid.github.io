const {test}=require('node:test');
const assert=require('node:assert/strict');
const features=()=>import('../../js/browser-llm/wasm-features.mjs');
const wasm=({jspi=false,memory64=false}={})=>({Suspending:jspi?function(){}:undefined,Memory:class {
  constructor(){if(!memory64)throw new TypeError('Memory64 unavailable');}
}});

test('Firefox CPU avoids Asyncify when Memory64 works even without JSPI',async()=>{
 const {wllamaFeatures}=await features();
 const result=wllamaFeatures({userAgent:'Mozilla/5.0 Firefox/145.0',wasm:wasm({memory64:true})});
 assert.equal(result.compatMode,'safari');
 assert.equal(result.gpu,false);
});
test('Firefox graphics requires both native JSPI and Memory64, not just a GPU',async()=>{
 const {wllamaFeatures}=await features();
 for(const jspi of [false,true])for(const memory64 of [false,true]) {
  const result=wllamaFeatures({userAgent:'Mozilla/5.0 Firefox/145.0',wasm:wasm({jspi,memory64})});
  assert.equal(result.gpu,jspi&&memory64);
 }
});
test('browsers without Memory64 keep a compatible CPU fallback',async()=>{
 const {wllamaFeatures}=await features();
 assert.equal(wllamaFeatures({userAgent:'Firefox/145.0',wasm:wasm()}).compatMode,'firefox_safari');
 assert.equal(wllamaFeatures({userAgent:'Version/26.0 Safari/605.1.15',wasm:wasm()}).compatMode,'firefox_safari');
});
