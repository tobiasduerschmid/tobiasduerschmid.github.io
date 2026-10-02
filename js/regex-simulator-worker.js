/**
 * Real Python re execution; the main thread owns cancellation and timeouts.
 * run.request.action selects analyze (default) or user-authored test cases.
 */
'use strict';

let runtimePromise;

async function initializeRuntime() {
  const indexURL = new URL('vendor/pyodide/0.27.0/', self.location.href).href;
  importScripts(new URL('pyodide.js', indexURL).href);
  const [runtime, source] = await Promise.all([
    loadPyodide({ indexURL }),
    fetch(new URL('regex-simulator-engine.py', self.location.href)).then(async response => {
      if (!response.ok) throw new Error('Unable to load the Python regex engine.');
      return response.text();
    }),
  ]);
  runtime.runPython(source);
  self.postMessage({ type: 'ready', version: runtime.runPython('platform.python_version()') });
  return runtime;
}

function executeRequest(runtime, request) {
  try {
    runtime.globals.set('__regex_request_json', JSON.stringify(request));
    return JSON.parse(runtime.runPython('analyze_regex_json(__regex_request_json)'));
  } catch (error) {
    return { ok: false, error: {
      message: error.message || String(error), field: 'pattern',
      position: null, line: null, column: null,
    } };
  } finally {
    runtime.globals.delete('__regex_request_json');
  }
}

async function handleRun(message) {
  try {
    if (!runtimePromise) runtimePromise = initializeRuntime();
    const runtime = await runtimePromise;
    self.postMessage({ type: 'result', id: message.id,
      result: executeRequest(runtime, message.request) });
  } catch (error) {
    self.postMessage({ type: 'fatal', id: message.id, message: error.message || String(error) });
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'run') void handleRun(event.data);
});
