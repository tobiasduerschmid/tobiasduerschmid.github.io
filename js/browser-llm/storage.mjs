import {ARTIFACTS} from './catalog.mjs';

export const MODEL_LOCK = 'sebook-browser-llm-model';
export const MODEL_CHANNEL = 'sebook-browser-llm-storage';
export const MODEL_CACHES = ['sebook-llm-gguf-v1','sebook-llm-onnx-v1','webllm/model','webllm/config','webllm/wasm'];
const SIZE_HEADER = 'x-sebook-model-bytes';

export async function artifactCached(artifact, cacheStorage = globalThis.caches) {
  if (!cacheStorage) return false;
  for (const asset of artifact.assets) {
    const response = await cacheStorage.match(asset.url,{cacheName:asset.cache});
    if (!response || Number(response.headers.get(SIZE_HEADER)) !== asset.bytes) return false;
  }
  return true;
}
export async function modelStorageStatus(cacheStorage = globalThis.caches) {
  if (!cacheStorage) return {available:false,cached:[],bytes:0};
  try {
    const cached = [];
    for (const [key,artifact] of Object.entries(ARTIFACTS)) {
      if (await artifactCached(artifact,cacheStorage)) cached.push(key);
    }
    let bytes = 0;
    for (const artifact of Object.values(ARTIFACTS)) {
      for (const asset of artifact.assets) {
        // CacheStorage.match is read-only; caches.open would recreate a cache
        // if another page deleted it between enumerating and reading it.
        const response = await cacheStorage.match(asset.url,{cacheName:asset.cache});
        bytes += Number(response?.headers.get(SIZE_HEADER) || 0);
      }
    }
    return {available:true,cached,bytes};
  } catch { return {available:false,cached:[],bytes:0}; }
}

// Stream one file at a time into the vendor's own data cache. This avoids a second
// download/cache, reports actual bytes, and bounds transient memory to one chunk.
export async function acquireArtifact(artifact, {onProgress = ()=>{}, signal,
  fetchImpl = globalThis.fetch, cacheStorage = globalThis.caches,
  estimateStorage = () => globalThis.navigator?.storage?.estimate?.()} = {}) {
  let estimate;
  try { estimate = await estimateStorage(); } catch { /* Unknown quota is not a rejection. */ }
  if (Number.isFinite(estimate?.quota) && Number.isFinite(estimate?.usage)) {
    let missing = 0;
    for (const asset of artifact.assets) {
      const cached = await cacheStorage.match(asset.url,{cacheName:asset.cache});
      if (Number(cached?.headers.get(SIZE_HEADER)) !== asset.bytes) missing += asset.bytes;
    }
    if (estimate.quota-estimate.usage < missing) {
      throw new Error('This browser profile does not have enough model storage. Delete unused downloads or use a regular browser window, then try again.');
    }
  }
  let loaded = 0;
  let lastReport = 0, timer;
  const emit = () => { lastReport=performance.now(); onProgress({phase:'download',loaded,total:artifact.bytes}); };
  const report = () => {
    clearTimeout(timer);
    const delay = 100-(performance.now()-lastReport);
    if (loaded === 0 || loaded === artifact.bytes || delay <= 0) emit();
    else timer=setTimeout(emit,delay);
  };
  report();
  try {
    for (const asset of artifact.assets) {
      signal?.throwIfAborted();
      const cache = await cacheStorage.open(asset.cache);
      const cached = await cache.match(asset.url);
      if (Number(cached?.headers.get(SIZE_HEADER)) === asset.bytes) {
        loaded += asset.bytes; report(); continue;
      }
      // Some restricted browser contexts expose Cache API but do not retain even
      // tiny entries. Detect that before transferring model weights.
      const probeKey = new URL('/__sebook-model-storage-check__',globalThis.location?.origin || 'https://sebook.invalid').href;
      try {
        await cache.put(probeKey,new Response('ok'));
        if (!await cache.match(probeKey)) throw new Error('This browser cannot retain model storage. Use a regular browser profile or another supported browser.');
      } finally { await cache.delete(probeKey); }
      signal?.throwIfAborted();
      const response = await fetchImpl(asset.url,{signal,cache:'no-store',
        headers:asset.range ? {Range:'bytes='+asset.range.start+'-'+asset.range.end} : {}});
      if (!response.ok || !response.body) throw new Error('The model download failed. Check your connection and try again.');
      if (asset.range && (response.status !== 206 || response.headers.get('content-range') !==
        'bytes '+asset.range.start+'-'+asset.range.end+'/'+asset.range.total)) {
        await response.body.cancel();
        throw new Error('The model server returned an unexpected file range. Try downloading again later.');
      }
      let received = 0;
      const stream = response.body.pipeThrough(new TransformStream({
        transform(chunk,controller) {
          signal?.throwIfAborted();
          received += chunk.byteLength;
          if (received > asset.bytes) throw new Error('Unexpected model file size.');
          loaded += chunk.byteLength;
          report();
          controller.enqueue(chunk);
        },
        flush() { if (received !== asset.bytes) throw new Error('The model download is incomplete. Try again.'); }
      }));
      await cache.put(asset.url,new Response(stream,{headers:{
        'content-type':response.headers.get('content-type') || 'application/octet-stream',
        [SIZE_HEADER]:String(asset.bytes), 'content-length':String(asset.bytes)
      }}));
      if (!await cacheStorage.match(asset.url,{cacheName:asset.cache})) {
        throw new Error('This browser could not retain the model download. Try a regular browser profile with more storage.');
      }
    }
    report();
  } catch(error) {
    if (error.name === 'QuotaExceededError') throw new Error('The browser ran out of model storage. Delete unused downloads or use a browser profile with more storage, then retry.');
    throw error;
  } finally { clearTimeout(timer); }
}
// Composite blobs retain the browser's backing files; never concatenate the
// full model into a JavaScript byte array on an 8 GB laptop.
export async function readArtifactBlob(artifact,cacheStorage = globalThis.caches) {
  const parts = [];
  for (const asset of artifact.assets) {
    const response = await cacheStorage.match(asset.url,{cacheName:asset.cache});
    if (!response) throw new Error('The downloaded model is missing. Download it again.');
    parts.push(await response.blob());
  }
  return new Blob(parts,{type:'application/octet-stream'});
}

// Read-only bridge for engines that expect a complete model file. The engine
// cannot fetch another representation or create a second persistent cache.
export async function readArtifactFile(artifact,url,cacheStorage = globalThis.caches) {
  const assets = artifact.assets.filter(asset=>(asset.fileUrl || asset.url) === url);
  if (!assets.length) return undefined;
  if (assets.length === 1 && !assets[0].range) {
    const response = await cacheStorage.match(url,{cacheName:assets[0].cache});
    if (!response) throw new Error('The downloaded model is missing. Download it again.');
    return response;
  }
  const blob = await readArtifactBlob({assets},cacheStorage);
  return new Response(blob,{headers:{'content-length':String(blob.size),'content-type':blob.type}});
}

export async function clearModelCaches(cacheStorage = globalThis.caches) {
  if (!cacheStorage) throw new Error('Model storage is unavailable in this browser.');
  for (const name of await cacheStorage.keys()) {
    if (MODEL_CACHES.includes(name)) await cacheStorage.delete(name);
  }
  if ((await cacheStorage.keys()).some(name=>MODEL_CACHES.includes(name))) {
    throw new Error('Some model files could not be deleted. Close other tutorial tabs and try again.');
  }
}
export async function deleteModelStorage() {
  if (!globalThis.caches) return;
  if (!navigator.locks && !(await caches.keys()).some(name=>MODEL_CACHES.includes(name))) return;
  // Active pages terminate their worker before releasing this origin-wide lock.
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(MODEL_CHANNEL) : null;
  channel?.postMessage({type:'delete'});
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),6000);
  try {
    if (!navigator.locks) throw new Error('Close all tutorial tabs and clear this site’s data in browser settings. This browser cannot coordinate model deletion.');
    await navigator.locks.request(MODEL_LOCK,{signal:controller.signal},()=>clearModelCaches());
    channel?.postMessage({type:'deleted'});
  } catch(error) {
    if (error.name === 'AbortError') throw new Error('Close other tutorial tabs, then try deleting the model again.');
    throw error;
  } finally { clearTimeout(timer); channel?.close(); }
}

export function holdModelLock() {
  if (!navigator.locks) return Promise.reject(new Error('This browser cannot safely manage model downloads. Try an updated browser.'));
  return new Promise((resolve,reject) => {
    navigator.locks.request(MODEL_LOCK,{ifAvailable:true},lock => {
      if (!lock) { reject(new Error('The model is active in another tab. Unload it there, then try again.')); return; }
      return new Promise(release => resolve(release));
    }).catch(reject);
  });
}
