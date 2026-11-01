// Match the pinned wllama runtime's actual requirements before downloading it.
export function wllamaFeatures({userAgent=globalThis.navigator?.userAgent || '',wasm=globalThis.WebAssembly}={}) {
  const firefox = /Firefox\//.test(userAgent);
  const jspi = typeof wasm?.Suspending === 'function';
  let memory64 = false;
  try { new wasm.Memory({address:'i64',initial:1n});memory64=true; } catch { /* Compatibility build is still available. */ }
  return {firefox,jspi,memory64,gpu:!firefox || (jspi && memory64),
    // Firefox's native CPU build works without JSPI. Forcing Asyncify there
    // slows CPU inference too. Older browsers lacking Memory64 need compat.
    compatMode:firefox && memory64 ? 'safari' : 'firefox_safari'};
}
