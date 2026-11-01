import {wllamaFeatures} from '../wasm-features.mjs';
import {importRuntime,runtimeWasm,runtimeText,RUNTIME_ASSETS} from '../vendor.mjs';
import {ARTIFACTS,CONTEXT_TOKENS} from '../catalog.mjs';
import {readArtifactBlob} from '../storage.mjs';

export async function load(profile) {
  const {Wllama} = await importRuntime('wllama-3.8.1.mjs');
  const features = wllamaFeatures();
  if (profile.gpu && !features.gpu) throw new Error('This Firefox graphics path is too slow for the assistant. Choose ONNX graphics or Processor.');
  const logger = {log(){},debug(){},warn(){},error(){}};
  const paths = {default:RUNTIME_ASSETS['wllama-3.8.1.wasm'].url};
  const engine = new Wllama(paths,{logger,suppressNativeLog:true});
  engine.setCompat({wasm:RUNTIME_ASSETS['wllama-compat-3.8.1.wasm'].url,
    worker:RUNTIME_ASSETS['wllama-compat-3.8.1.js'].url},features.compatMode);
  const compat = engine.getWorkerResources().compat;
  const wasm = await runtimeWasm(compat ? 'wllama-compat-3.8.1.wasm' : 'wllama-3.8.1.wasm');
  try {
    if (compat) engine.setCompat({wasm:wasm.url,worker:{code:await runtimeText('wllama-compat-3.8.1.js')}},features.compatMode);
    else paths.default = wasm.url;
    // Composite blobs avoid a full-file JavaScript ArrayBuffer copy.
    await engine.loadModel([await readArtifactBlob(ARTIFACTS.gguf)],{n_ctx:CONTEXT_TOKENS,n_parallel:1,
      n_threads:profile.threads,n_gpu_layers:profile.gpu ? 99999 : 0,n_batch:128,n_ubatch:128});
  } finally { wasm.revoke(); }
  return {
    async generate(messages,maxTokens,onText) {
      let text='',finishReason,usage;
      const stream = await engine.createChatCompletion({messages,stream:true,max_tokens:maxTokens,temperature:0,top_p:1});
      for await (const chunk of stream) {
        usage = chunk.usage || usage;
        text += chunk.choices[0]?.delta?.content || '';
        finishReason = chunk.choices[0]?.finish_reason || finishReason;
        onText(text);
      }
      return {text,finishReason,usage};
    },
    dispose:()=>engine.exit()
  };
}
