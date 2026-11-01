import {WorkerClient,abortError,timeoutError} from './worker-client.mjs';
import {InferenceBroker} from './inference-broker.mjs';
import {MODEL_CHANNEL} from './storage.mjs';

export const INFERENCE_CHANNEL = 'sebook-browser-llm-inference-v1';
export const HOST_LOCK = 'sebook-browser-llm-host-v1';
const HEARTBEAT_MS = 10000;
const HOST_TIMEOUT_MS = 90000;
export const SHARING_MESSAGE = 'Tabs on this site share one model in memory and take turns generating. Closing the hosting tab may interrupt a reply; try again to reload the downloaded model.';
export const UNSHARED_MESSAGE = 'Cross-tab model sharing is unavailable in this browser. This tab uses its own model instance.';

export function hostLostError() {
  return Object.assign(new Error('The tab hosting the shared model closed or became unavailable. Your draft and chat are kept. Try again to reload the downloaded model.'),{name:'HostLostError'});
}
function serializedError(error) {
  return {name:error.name,message:error.message,recoverable:error.recoverable,contextLimit:error.contextLimit};
}
export function canShareModel() {
  return !!globalThis.navigator?.locks?.query && !!globalThis.navigator?.locks?.request &&
    typeof globalThis.BroadcastChannel?.prototype?.postMessage === 'function';
}
export function createModelClient(options) {
  return canShareModel() ? new SharedModelClient(options) : new WorkerClient();
}

/** Elects a tab to own the dedicated worker; all replies are origin-local RPC. */
export class SharedModelClient {
  constructor({onState = ()=>{},onHostLost = ()=>{}} = {}) {
    this.shared = true;
    this.clientId = crypto.randomUUID();
    this.sequence = 0;
    this.onState = onState;
    this.onHostLost = onHostLost;
    this.members = new Map();
    this.pagehide = () => this.close();
  }
  request(action,payload,{signal,onProgress,onText,timeoutMs = 300000} = {}) {
    if (this.pending) return Promise.reject(new Error('The model is busy.'));
    if (signal?.aborted) return Promise.reject(abortError());
    this.used = true;
    return new Promise((resolve,reject) => {
      const id = ++this.sequence;
      const cancel = () => this.stop(signal.reason?.name === 'TimeoutError' ? signal.reason : abortError());
      const timer = setTimeout(()=>this.stop(timeoutError()),timeoutMs);
      this.pending = {id,action,payload,timeoutMs,onProgress,onText,finish:(error,value)=>{
        clearTimeout(timer);
        signal?.removeEventListener('abort',cancel);
        this.pending = null;
        if (error) reject(error); else resolve(value);
      }};
      signal?.addEventListener('abort',cancel,{once:true});
      try {
        this.connect();
        this.post({type:'hello',active:true});
        this.sendPending();
      } catch(error) { this.stop(error); }
    });
  }
  connect() {
    if (this.channel) return;
    const channel = this.channel = new BroadcastChannel(INFERENCE_CHANNEL);
    channel.onmessage = event => this.receive(event.data);
    const election = this.election = new AbortController();
    globalThis.addEventListener?.('pagehide',this.pagehide);
    this.lastHeard = Date.now();
    this.heartbeat = setInterval(()=>this.pulse(),HEARTBEAT_MS);
    // The browser releases this exclusive lease after navigation or a crash.
    // Queued owners take over; a timer never steals a live host's ownership.
    void navigator.locks.request(HOST_LOCK,{signal:election.signal},async()=>{
      if (channel !== this.channel) return;
      await this.host(channel);
    }).catch(error=>{
      if (error.name !== 'AbortError' && channel === this.channel) this.loseHost();
    });
  }
  async host(channel) {
    let release;
    const lifetime = new Promise(resolve=>release=resolve);
    this.releaseHost = release;
    const lockInfo = (await navigator.locks.query()).held.find(lock=>lock.name === HOST_LOCK);
    if (channel !== this.channel) return;
    this.leadership = crypto.randomUUID();
    this.lockClientId = lockInfo.clientId;
    const broker = this.broker = new InferenceBroker({onState:state=>{
      this.post({type:'state',hostId:this.leadership,...state});
    }});
    const storage = this.storageChannel = new BroadcastChannel(MODEL_CHANNEL);
    storage.onmessage = event => { if (event.data?.type === 'delete') broker.invalidate(); };
    this.announce();
    try { await lifetime; }
    finally {
      broker.dispose(hostLostError());storage.close();
      if (this.broker === broker) {
        this.broker = null;this.storageChannel = null;this.leadership = null;this.releaseHost = null;
      }
    }
  }
  post(message) {
    if (!this.channel) return;
    const data = {...message,from:this.clientId};
    this.channel.postMessage(data);
    // BroadcastChannel excludes its sender; the host tab also uses this API.
    this.receive(data);
  }
  announce() {
    this.post({type:'leader',hostId:this.leadership,lockClientId:this.lockClientId,profile:this.broker.profile});
  }
  receive(message) {
    if (!message || !this.channel) return;
    if (message.type === 'leader') { void this.acceptLeader(message);return; }
    if (message.type === 'host-left') {
      if (message.hostId === this.hostId) this.loseHost();
      return;
    }
    if (message.type === 'state') {
      if (message.hostId === this.hostId) this.onState({profile:message.profile});
      return;
    }
    if (message.type === 'reply') { this.receiveReply(message);return; }
    if (!this.broker) return;
    if (message.type === 'hello') {
      if (message.active) this.members.set(message.from,Date.now());
      // A local hello only needs the periodic announcement from pulse().
      if (message.from !== this.clientId) this.announce();
      return;
    }
    if (message.hostId !== this.leadership) return;
    if (message.type === 'request') this.serve(message);
    else if (message.type === 'cancel') this.broker.cancel(message.from,message.id);
    else if (message.type === 'release') {this.members.delete(message.from);this.broker.release(message.from);}
  }
  async acceptLeader(message) {
    const channel = this.channel;
    // Late announcements from a former host cannot revive its stale model.
    let snapshot;
    try { snapshot = await navigator.locks.query(); }
    catch { this.loseHost();return; }
    if (channel !== this.channel || !snapshot.held.some(lock=>lock.name === HOST_LOCK && lock.clientId === message.lockClientId)) return;
    if (this.hostId && this.hostId !== message.hostId) this.loseHost();
    this.hostId = message.hostId;
    this.lastHeard = Date.now();
    this.onState({profile:message.profile});
    this.sendPending();
  }
  sendPending() {
    const pending = this.pending;
    if (!pending || pending.hostId || !this.hostId) return;
    pending.hostId = this.hostId;
    this.post({type:'request',hostId:this.hostId,id:pending.id,action:pending.action,
      payload:pending.payload,timeoutMs:pending.timeoutMs});
  }
  serve(message) {
    const hostId = this.leadership;
    this.members.set(message.from,Date.now());
    const reply = (kind,value) => this.post({type:'reply',hostId,to:message.from,id:message.id,kind,value});
    void this.broker.request({clientId:message.from,id:message.id,action:message.action,
      payload:message.payload,timeoutMs:message.timeoutMs}, {
      onProgress:value=>reply('progress',value),onText:value=>reply('text',value)
    }).then(value=>reply('result',value),error=>reply('error',serializedError(error)));
  }
  receiveReply(message) {
    const pending = this.pending;
    if (message.to !== this.clientId || !pending || message.id !== pending.id || message.hostId !== pending.hostId) return;
    this.lastHeard = Date.now();
    if (message.kind === 'progress') pending.onProgress?.(message.value);
    else if (message.kind === 'text') pending.onText?.(message.value);
    else if (message.kind === 'result') pending.finish(null,message.value);
    else if (message.kind === 'error') pending.finish(Object.assign(new Error(message.value.message),message.value));
  }
  pulse() {
    this.post({type:'hello',active:this.used});
    if (this.broker) {
      this.announce();
      for (const [clientId,lastSeen] of this.members) {
        if (Date.now()-lastSeen > HOST_TIMEOUT_MS) {this.members.delete(clientId);this.broker.release(clientId);}
      }
    } else if (Date.now()-this.lastHeard > HOST_TIMEOUT_MS) this.loseHost();
  }
  loseHost() {
    const notify = this.used;
    const interrupted = !!this.pending;
    const error = hostLostError();
    this.stop(error);
    if (this.hostId) this.post({type:'release',hostId:this.hostId});
    this.hostId = null;
    this.used = false;
    this.onState({profile:null});
    if (notify) this.onHostLost(error,{interrupted});
  }
  stop(error = abortError()) {
    const pending = this.pending;
    if (!pending) return;
    const {id,hostId} = pending;
    pending.finish(error);
    if (hostId) this.post({type:'cancel',hostId,id});
  }
  release() {
    this.stop();
    this.used = false;
    if (this.hostId) this.post({type:'release',hostId:this.hostId});
  }
  close() {
    this.release();
    if (this.broker) {
      this.post({type:'host-left',hostId:this.leadership});
      this.broker.dispose(hostLostError());
    }
    this.election?.abort();this.releaseHost?.();
    clearInterval(this.heartbeat);
    this.members.clear();
    this.channel?.close();this.channel = null;this.hostId = null;
    globalThis.removeEventListener?.('pagehide',this.pagehide);
  }
}
