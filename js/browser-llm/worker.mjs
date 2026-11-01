import {ARTIFACTS} from './catalog.mjs';
import {artifactCached} from './storage.mjs';
let adapter;
self.onmessage = async ({data:{id,action,payload}}) => {
  const send = (type,value) => self.postMessage({id,type,value});
  try {
    if (action === 'load') {
      const {profile} = payload;
      if (!await artifactCached(ARTIFACTS[profile.artifact])) throw new Error('Download the model before loading it.');
      const adapters = {webllm:()=>import('./adapters/webllm.mjs'),wllama:()=>import('./adapters/wllama.mjs'),onnx:()=>import('./adapters/onnx.mjs')};
      if (!adapters[profile.engine]) throw new Error('Unknown model engine.');
      const module = await adapters[profile.engine]();
      adapter = await module.load(profile);
      send('result',true);
    } else if (action === 'generate') {
      if (!adapter) throw new Error('Load the model first.');
      const result = await adapter.generate(payload.messages,payload.maxTokens,text=>send('text',text));
      send('result',result);
    } else throw new Error('Unknown model operation.');
  } catch(error) {
    const message = error?.message || 'The local model could not complete this operation.';
    const inputError = error?.name === 'RangeError' || /context (window|length)|input.*too long|token.*exceed/i.test(message);
    self.postMessage({id,type:'error',value:message,errorName:inputError ? 'InputError' : 'BackendError'});
  }
};
