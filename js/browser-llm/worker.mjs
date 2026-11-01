import {ARTIFACTS,CONTEXT_TOKENS} from './catalog.mjs';
import {artifactCached} from './storage.mjs';
let adapter;
let contextLimit;
self.onmessage = async ({data:{id,action,payload}}) => {
  const send = (type,value) => self.postMessage({id,type,value});
  let outputStarted = false;
  try {
    if (action === 'load') {
      const {profile} = payload;
      if (!await artifactCached(ARTIFACTS[profile.artifact])) throw new Error('Download the model before loading it.');
      const adapters = {webllm:()=>import('./adapters/webllm.mjs'),wllama:()=>import('./adapters/wllama.mjs'),onnx:()=>import('./adapters/onnx.mjs')};
      if (!adapters[profile.engine]) throw new Error('Unknown model engine.');
      const module = await adapters[profile.engine]();
      adapter = await module.load(profile);
      contextLimit = {contextTokens:CONTEXT_TOKENS,maxInputTokens:profile.engine === 'wllama' ?
        CONTEXT_TOKENS-1 : ARTIFACTS[profile.artifact].maxInputTokens ?? CONTEXT_TOKENS};
      send('result',true);
    } else if (action === 'generate') {
      if (!adapter) throw new Error('Load the model first.');
      const result = await adapter.generate(payload.messages,payload.maxTokens,text=>{
        if (text) outputStarted = true;
        send('text',text);
      });
      send('result',result);
    } else throw new Error('Unknown model operation.');
  } catch(error) {
    const message = error?.message || 'The local model could not complete this operation.';
    // These pinned native/preflight errors happen before inference mutates its state.
    // Other input-related failures (including a full KV cache) still need disposal.
    const rejectedPrompt = (error?.name === 'ContextWindowSizeExceededError' && /^Prompt tokens exceed context window size:/i.test(message)) ||
      (error?.name === 'RangeError' && /^The (?:specification and interface exceed this graphics engine’s \d+-token input limit|input exceeds the model context window)\./i.test(message)) ||
      /^request \(\d+ tokens\) exceeds the available context size \(\d+ tokens\)/i.test(message) ||
      /^input \(\d+ tokens\) is larger than the max context size \(\d+ tokens\)/i.test(message);
    const terminal = ['AbortError','TimeoutError','BackendError'].includes(error?.name);
    const inputError = !terminal && (rejectedPrompt ||
      /(?:exceed|too (?:long|large)|limit).*(?:context (?:window|length|size)|input limit)|(?:context (?:window|length|size)|input).*?(?:exceed|too (?:long|large)|limit)|kv[_ -]cache[_ -]full/i.test(message));
    const recoverable = action === 'generate' && inputError && !outputStarted && rejectedPrompt;
    self.postMessage({id,type:'error',value:message,errorName:terminal ? error.name : inputError ? 'InputError' : 'BackendError',
      recoverable,contextLimit:inputError ? contextLimit : undefined});
  }
};
