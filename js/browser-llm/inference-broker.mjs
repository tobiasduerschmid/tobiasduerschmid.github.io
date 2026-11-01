import {WorkerClient,abortError} from './worker-client.mjs';
import {holdModelLock} from './storage.mjs';

// All values that can change a loaded engine's behavior belong in its identity.
export function profileKey(profile) {
  return profile ? [profile.id,profile.engine,profile.artifact,profile.gpu,
    profile.threads,profile.prefillTokens || 128].join('|') : null;
}

/** Serializes one origin's inference. The caller owns routing; this owns memory. */
export class InferenceBroker {
  constructor({client = new WorkerClient(),holdStorage = () => holdModelLock({shared:true}),onState = ()=>{}} = {}) {
    this.client = client;
    this.holdStorage = holdStorage;
    this.onState = onState;
    this.queue = [];
    this.users = new Set();
    this.revision = 0;
    this.profile = null;
  }
  request(request,{onProgress,onText} = {}) {
    if (this.disposed) return Promise.reject(abortError());
    if (!['load','generate'].includes(request.action) || !request.payload?.profile) {
      return Promise.reject(new Error('Choose a model before using shared inference.'));
    }
    this.users.add(request.clientId);
    return new Promise((resolve,reject) => {
      const task = {request,onProgress,onText,resolve,reject};
      if (this.active) onProgress?.({phase:'queued',message:'Waiting for another tab’s model request…'});
      this.queue.push(task);
      void this.drain();
    });
  }
  async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const task = this.active = this.queue.shift();
        try {
          await this.ensureProfile(task);
          if (task.cancelled) throw abortError();
          const {action,payload,timeoutMs} = task.request;
          if (action === 'load') task.resolve(true);
          else {
            task.onProgress?.({phase:'generating'});
            task.resolve(await this.client.request('generate',payload,{
              onText:task.onText,onProgress:task.onProgress,timeoutMs
            }));
          }
        } catch(error) {
          if (!(error.name === 'InputError' && error.recoverable === true)) this.reset(error);
          task.reject(error);
        } finally { this.active = null; }
      }
    } finally { this.draining = false; }
  }
  async ensureProfile(task) {
    const profile = task.request.payload.profile;
    if (profileKey(this.profile) === profileKey(profile)) return;
    this.reset();
    const revision = this.revision;
    const release = await this.holdStorage();
    if (revision !== this.revision || task.cancelled) {release();throw abortError();}
    this.releaseStorage = release;
    task.onProgress?.({phase:'initializing',message:'Loading the selected downloaded model into shared memory…'});
    await this.client.request('load',{profile},{timeoutMs:task.request.timeoutMs});
    if (task.cancelled) throw abortError();
    this.profile = profile;
    this.onState({profile});
  }
  cancel(clientId,id,error = abortError()) {
    const owns = task => task.request.clientId === clientId && (id === undefined || task.request.id === id);
    const removed = this.queue.filter(owns);
    this.queue = this.queue.filter(task=>!owns(task));
    removed.forEach(task=>task.reject(error));
    if (this.active && owns(this.active)) {
      this.active.cancelled = true;
      this.reset(error);
    }
  }
  release(clientId) {
    this.cancel(clientId);
    this.users.delete(clientId);
    if (!this.users.size) this.reset();
  }
  reset(error = abortError()) {
    this.revision++;
    this.client.stop(error);
    this.releaseStorage?.();
    this.releaseStorage = null;
    this.profile = null;
    this.onState({profile:null});
  }
  invalidate(error = abortError()) {
    const queued = this.queue.splice(0);
    queued.forEach(task=>task.reject(error));
    if (this.active) this.active.cancelled = true;
    this.users.clear();
    this.reset(error);
  }
  dispose(error) { this.disposed = true; this.invalidate(error); }
}
