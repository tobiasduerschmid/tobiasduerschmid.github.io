import {importRuntime,runtimeModule,runtimeWasm} from '../vendor.mjs';
import {ARTIFACTS,CONTEXT_TOKENS} from '../catalog.mjs';
import {readArtifactFile} from '../storage.mjs';

export async function load() {
  // Deliberately use the tested JavaScript WebGPU backend. The newer native
  // backend needs ten storage buffers for this model and fails on Firefox's nine.
  const {AutoTokenizer,AutoModelForCausalLM,TextStreamer,env} = await importRuntime('transformers-3.8.1.mjs');
  const artifact = ARTIFACTS.onnx;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useBrowserCache = false;
  env.useFSCache = false;
  env.useCustomCache = true;
  env.customCache = {
    match:url=>readArtifactFile(artifact,String(url)),
    put:async()=>{throw new Error('Download the model before loading it.');}
  };
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.webgpu.powerPreference = 'high-performance';
  const factory = await runtimeModule('onnx-jsep-1.22.mjs');
  let binary,model,tokenizer;
  try {
    binary = await runtimeWasm('onnx-jsep-1.22.wasm');
    env.backends.onnx.wasm.wasmPaths = {mjs:factory.url,wasm:binary.url};
    const options = {revision:artifact.revision,local_files_only:true};
    tokenizer = await AutoTokenizer.from_pretrained(artifact.modelId,options);
    model = await AutoModelForCausalLM.from_pretrained(artifact.modelId,{
      ...options,device:'webgpu',dtype:'q4f16',session_options:{logSeverityLevel:3}
    });
  } finally { factory.revoke();binary?.revoke(); }
  return {
    async generate(messages,maxTokens,onText) {
      const inputs = tokenizer.apply_chat_template(messages,{tokenize:true,add_generation_prompt:true,return_dict:true});
      const promptTokens = inputs.input_ids.dims[1];
      if (promptTokens > artifact.maxInputTokens) throw new RangeError('The specification and interface exceed this graphics engine’s 768-token input limit. Shorten the specification or choose Processor.');
      if (promptTokens+maxTokens > CONTEXT_TOKENS) throw new RangeError('The input exceeds the model context window. Shorten the specification.');
      let text = '';
      const streamer = new TextStreamer(tokenizer,{skip_prompt:true,skip_special_tokens:true,
        callback_function:part=>{text+=part;onText(text);}});
      const result = await model.generate({...inputs,max_new_tokens:maxTokens,do_sample:false,repetition_penalty:1,streamer});
      const tokens = result.dims[1]-promptTokens;
      const last = Number(result.data[result.data.length-1]);
      const eos = model.generation_config.eos_token_id ?? model.config.eos_token_id;
      const stopped = (Array.isArray(eos) ? eos : [eos]).includes(last);
      return {text,finishReason:stopped || tokens < maxTokens ? 'stop' : 'length',
        usage:{prompt_tokens:promptTokens,completion_tokens:tokens}};
    },
    dispose:()=>model.dispose()
  };
}
