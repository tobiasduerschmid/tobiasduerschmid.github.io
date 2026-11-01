import {detectCapabilities,selectCandidates} from './capabilities.mjs';
import {ARTIFACTS,OUTPUT_TOKENS} from './catalog.mjs';
import {WorkerClient,abortError,timeoutError} from './worker-client.mjs';
import {WARMUP_MESSAGES,BENCHMARK_MESSAGES,measurementKey,comparableResult} from './measurements.mjs';
import {modelStorageStatus,deleteModelStorage,holdModelLock,MODEL_CHANNEL,acquireArtifact} from './storage.mjs';

export class BrowserLLM {
  constructor({onChange = ()=>{}} = {}) {
    this.client = new WorkerClient();
    this.onChange = onChange;
    this.epoch = 0;
    this.prepareRevision = 0;
    this.failed = new Set();
    this.measurements = new Map();
    this.warmups = new Map();
    this.channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(MODEL_CHANNEL) : null;
    this.channel?.addEventListener('message',event => {
      if (event.data.type === 'delete') { this.unload(); this.onChange('The downloaded model is being deleted.'); }
      if (event.data.type === 'deleted') this.onChange('Downloaded model deleted. Your Python files and tutorial progress are unchanged.');
    });
  }
  async prepare(choice = 'auto') {
    const revision = ++this.prepareRevision;
    if (!navigator.locks) throw new Error('This browser cannot safely manage model downloads. Try an updated browser, or continue the tutorial without model assistance.');
    // Reprobe on each explicit selection/retry; devices can disappear mid-session.
    const capabilities = await detectCapabilities();
    const storage = await modelStorageStatus();
    if (revision !== this.prepareRevision) throw abortError();
    if (!storage.available) throw new Error('Model storage is unavailable. Allow site storage or use a regular browser window. You can continue the tutorial without model assistance.');
    const candidates = selectCandidates(capabilities,{choice,cached:storage.cached,measurements:this.measurements,excluded:choice === 'auto' ? this.failed : new Set()});
    const profile = candidates[0];
    if (!profile) throw new Error('No working model engine is available. You can continue the tutorial without model assistance.');
    this.choice = choice;
    this.profile = profile;
    this.capabilities = capabilities;
    return {profile,artifact:ARTIFACTS[profile.artifact],cached:storage.cached.includes(profile.artifact),
      storedBytes:storage.bytes,capabilities,available:selectCandidates(capabilities).map(p=>p.id),comparable:choice === 'auto' && candidates.filter(p=>storage.cached.includes(p.artifact)).length > 1};
  }
  async initialize(profile,{signal,onProgress}) {
    onProgress({phase:'initializing',message:'Loading '+profile.label+' into memory…'});
    await this.client.request('load',{profile},{signal,timeoutMs:5*60*1000});
    onProgress({phase:'warmup',message:'Checking the model with a short local warm-up…'});
    const start = performance.now();
    const result = await this.client.request('generate',{messages:WARMUP_MESSAGES,maxTokens:16},{signal,timeoutMs:60000});
    if (!result.text.trim()) throw Object.assign(new Error('The model returned no warm-up output. Try another engine.'),{name:'BackendError'});
    this.warmups.set(measurementKey(profile),performance.now()-start);
  }
  async load({onProgress=()=>{},signal,cachedOnly=false,allowFallback=true} = {}) {
    if (this.loadPending || this.ready) throw new Error('The model is already loaded or loading.');
    if (!this.profile) throw new Error('Check browser capabilities before downloading.');
    const epoch = ++this.epoch;
    const choice = this.choice;
    let profile = this.profile;
    this.loadPending = true;
    let initializing = false;
    try {
      const release = await holdModelLock();
      if (epoch !== this.epoch || signal?.aborted) { release(); throw abortError(); }
      this.releaseLock = release;
      if (cachedOnly) {
        if (!(await modelStorageStatus()).cached.includes(profile.artifact)) throw new Error('This model is no longer downloaded. Download it again before using it.');
      } else {
        this.downloadController = new AbortController();
        const downloadTimer = setTimeout(()=>this.downloadController?.abort(timeoutError()),20*60*1000);
        const abortDownload = () => this.downloadController?.abort();
        signal?.addEventListener('abort',abortDownload,{once:true});
        // The page owns acquisition: worker termination alone can leave Cache.put waiting.
        this.acquisition = acquireArtifact(ARTIFACTS[profile.artifact],{signal:this.downloadController.signal,onProgress});
        try { await this.acquisition; }
        finally {
          clearTimeout(downloadTimer);
          this.acquisition = null;
          this.downloadController = null;
          signal?.removeEventListener('abort',abortDownload);
        }
      }
      if (epoch !== this.epoch || signal?.aborted) throw abortError();
      initializing = true;
      try { await this.initialize(profile,{signal,onProgress}); }
      catch(error) {
        // Only backend failures can retry. Cancellation, input and deadlines end the attempt.
        if (error.name !== 'BackendError' || signal?.aborted || epoch !== this.epoch || !allowFallback || choice !== 'auto' || profile.id !== 'wllama-gpu') throw error;
        this.failed.add(profile.id);
        this.client.stop();
        profile = {...profile,id:'wllama-cpu',gpu:false,label:'Processor (wllama)'};
        onProgress({phase:'initializing',message:'Graphics initialization failed. Loading the same download on the processor.'});
        await this.initialize(profile,{signal,onProgress});
      }
      if (epoch !== this.epoch || signal?.aborted) throw abortError();
      this.activeProfile = profile;
      this.profile = profile;
      this.ready = true;
      return profile;
    } catch(error) {
      if (initializing && error.name === 'BackendError') this.failed.add(profile.id);
      await this.releaseModel();
      throw error;
    } finally { this.loadPending = false; }
  }
  async generate(messages,{onText,onProgress=()=>{},signal,maxTokens = OUTPUT_TOKENS} = {}) {
    if (!this.ready) {
      onProgress({phase:'initializing',message:'Loading model into memory…'});
      await this.load({signal,cachedOnly:true,onProgress});
    }
    onProgress({phase:'generating'});
    const profile = this.activeProfile;
    const start = performance.now();
    let firstTokenMs;
    try {
      const result = await this.client.request('generate',{messages,maxTokens},{signal,onText:text=>{
        if (text && firstTokenMs === undefined) firstTokenMs = performance.now()-start;
        onText?.(text);
      }});
      return {...result,timing:{elapsedMs:performance.now()-start,firstTokenMs,completionTokens:result.usage?.completion_tokens}};
    }
    catch(error) {
      if (error.name === 'InputError' && error.recoverable === true) throw error;
      if (error.name === 'BackendError' && profile.gpu) this.failed.add(profile.id);
      await this.unload();
      // Failed streaming output is never replayed or combined with a new attempt.
      if (error.name === 'BackendError') await this.prepare(this.choice).catch(()=>{});
      throw error;
    }
  }
  async compare({signal,onProgress=()=>{}} = {}) {
    if (this.loadPending || this.client.pending || this.comparePending) throw new Error('Wait for the current model operation to finish.');
    this.comparePending = true;
    const controller = this.comparisonController = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener('abort',cancel,{once:true});
    const timer = setTimeout(()=>controller.abort(timeoutError()),120000);
    try {
      if (signal?.aborted) throw abortError();
      await this.releaseModel();
      await this.prepare('auto');
      const storage = await modelStorageStatus();
      const candidates = selectCandidates(this.capabilities,{cached:storage.cached,excluded:this.failed})
        .filter(p=>storage.cached.includes(p.artifact));
      if (candidates.length < 2) throw new Error('Download-compatible alternatives are not available to compare.');
      for (const profile of candidates) {
        controller.signal.throwIfAborted();
        this.profile = profile;
        try {
          await this.load({signal:controller.signal,cachedOnly:true,allowFallback:false,onProgress});
          onProgress({phase:'comparison',message:'Measuring a short Python task with '+profile.label+'…'});
          const start = performance.now();
          const result = await this.client.request('generate',{messages:BENCHMARK_MESSAGES,maxTokens:96},{signal:controller.signal,timeoutMs:60000});
          // A one-word warm-up does not predict code-generation throughput.
          if (comparableResult(result)) this.measurements.set(measurementKey(profile),performance.now()-start);
          else this.measurements.delete(measurementKey(profile));
        } catch(error) {
          if (error.name !== 'BackendError') throw error;
          this.failed.add(profile.id);
        }
        await this.releaseModel();
      }
      controller.signal.throwIfAborted();
      await this.prepare('auto');
      const profile = await this.load({signal:controller.signal,cachedOnly:true,allowFallback:false,onProgress});
      const measured = candidates.filter(p=>!this.failed.has(p.id)).every(p=>this.measurements.has(measurementKey(p)));
      return {profile,measured};
    } catch(error) {
      await this.releaseModel();
      throw error;
    } finally {
      clearTimeout(timer);signal?.removeEventListener('abort',cancel);
      this.comparePending = false;
      this.comparisonController = null;
    }
  }
  unload() {
    this.comparisonController?.abort();
    return this.releaseModel();
  }
  releaseModel() {
    this.epoch++;
    this.prepareRevision++;
    this.ready = false;
    this.downloadController?.abort();
    this.client.stop();
    const release = this.releaseLock;
    this.releaseLock = null;
    // Deletion may acquire the lock only after the writer has actually settled.
    return Promise.resolve(this.acquisition).catch(()=>{}).then(()=>release?.());
  }
  async deleteModels() { await this.unload(); await deleteModelStorage(); }
  destroy() { this.unload(); this.channel?.close(); }
}
