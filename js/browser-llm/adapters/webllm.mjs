import {importRuntime,runtimeWasm} from '../vendor.mjs';
import {ARTIFACTS,CONTEXT_TOKENS} from '../catalog.mjs';

export async function load(profile) {
  const {CreateMLCEngine} = await importRuntime('webllm-0.2.87.mjs');
  const library = await runtimeWasm('qwen2-1.5b-webllm-0.2.87.wasm');
  const model = ARTIFACTS.mlc;
  let engine;
  try {
  engine = await CreateMLCEngine(model.modelId,{
    logLevel:'ERROR',
    appConfig:{cacheBackend:'cache',model_list:[{
      model_id:model.modelId,model:model.baseUrl,
      // A verified blob URL bypasses WebLLM's writable model cache.
      model_lib:library.url,
      integrity:model.integrity,
      required_features:['shader-f16'],
      overrides:{context_window_size:CONTEXT_TOKENS,prefill_chunk_size:profile.prefillTokens || 128}
    }]}
  });
  } finally { library.revoke(); }
  return {
    async generate(messages,maxTokens,onText) {
      await engine.resetChat();
      const stream = await engine.chat.completions.create({messages,stream:true,stream_options:{include_usage:true},max_tokens:maxTokens,temperature:0,top_p:1});
      let text='',finishReason,usage;
      for await (const chunk of stream) {
        usage = chunk.usage || usage;
        text += chunk.choices[0]?.delta?.content || '';
        finishReason = chunk.choices[0]?.finish_reason || finishReason;
        onText(text);
      }
      return {text,finishReason,usage};
    },
    dispose:()=>engine.unload()
  };
}
