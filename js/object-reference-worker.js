/** Execute one Object Reference Lab program in an isolated Python worker. */
'use strict';

const PYODIDE_INDEX_URL = new URL('vendor/pyodide/0.27.0/', self.location.href).href;

async function initializeTracer() {
  importScripts(PYODIDE_INDEX_URL + 'pyodide.js');
  const [pyodide, response] = await Promise.all([
    loadPyodide({ indexURL: PYODIDE_INDEX_URL }),
    fetch(new URL('object-reference-tracer.py', self.location.href).href),
  ]);
  if (!response.ok) throw new Error('Unable to load the object reference tracer.');
  pyodide.runPython(await response.text());
  return pyodide;
}

// Initialization failures are retained without an unhandled rejection while the
// worker waits for its trace request. Each UI run owns and terminates its worker.
const runtimeReady = initializeTracer().then(
  (pyodide) => {
    self.postMessage({ type: 'ready' });
    return { pyodide };
  },
  (error) => ({ error })
);

self.onmessage = async (event) => {
  const message = event.data;
  if (!message || message.type !== 'trace') return;
  try {
    if (typeof message.code !== 'string') throw new Error('Python code must be text.');
    const runtime = await runtimeReady;
    if (runtime.error) throw runtime.error;
    runtime.pyodide.globals.set('__object_reference_source', message.code);
    const serialized = runtime.pyodide.runPython('trace_code(__object_reference_source)');
    self.postMessage({ type: 'result', trace: JSON.parse(serialized) });
  } catch (error) {
    self.postMessage({
      type: 'result',
      trace: { steps: [], error: error.message || String(error), truncated: false },
    });
  }
};
