/** Cancellable, ordered Python re.finditer requests through the local simulator worker. */
(function () {
  'use strict';

  if (window.PythonRegexClient) return;
  const workerURL = new URL('regex-simulator-worker.js', document.currentScript.src);
  const STARTUP_TIMEOUT_MS = 45000;
  const EXECUTION_TIMEOUT_MS = 3000;

  function abortError() {
    return new DOMException('Python regex evaluation was cancelled.', 'AbortError');
  }

  function create() {
    let worker = null;
    let ready = false;
    let active = null;
    let nextId = 0;
    const queue = [];

    function stopWorker() {
      if (worker) worker.terminate();
      worker = null;
      ready = false;
    }

    function settle(job, error, result) {
      clearTimeout(job.timer);
      job.signal.removeEventListener('abort', job.abort);
      if (active === job) active = null;
      if (error) job.reject(error);
      else job.resolve(result);
      queueMicrotask(pump);
    }

    function setDeadline(job, milliseconds) {
      clearTimeout(job.timer);
      job.timer = setTimeout(function () {
        if (active !== job) return;
        const message = ready
          ? 'Python regex evaluation timed out. Simplify the pattern and try again.'
          : 'Loading Python timed out. Check your connection and try again.';
        stopWorker();
        settle(job, new Error(message));
      }, milliseconds);
    }

    function handleMessage(event, owner) {
      if (worker !== owner || !active) return;
      const message = event.data;
      if (message.type === 'ready') {
        ready = true;
        setDeadline(active, EXECUTION_TIMEOUT_MS);
      } else if (message.id === active.id && message.type === 'result') {
        settle(active, null, message.result);
      } else if (message.id === active.id && message.type === 'fatal') {
        stopWorker();
        settle(active, new Error('Unable to load Python: ' + message.message));
      }
    }

    function startWorker() {
      const owner = new Worker(workerURL);
      worker = owner;
      owner.addEventListener('message', function (event) { handleMessage(event, owner); });
      owner.addEventListener('error', function () {
        if (worker !== owner) return;
        stopWorker();
        if (active) settle(active, new Error('The Python worker stopped. Try checking the pattern again.'));
      });
    }

    function pump() {
      if (active || !queue.length) return;
      const job = queue.shift();
      if (job.signal.aborted) {
        settle(job, abortError());
        return;
      }
      active = job;
      try {
        if (!worker) startWorker();
        setDeadline(job, ready ? EXECUTION_TIMEOUT_MS : STARTUP_TIMEOUT_MS);
        worker.postMessage({ type: 'run', id: job.id, request: job.request });
      } catch (error) {
        stopWorker();
        settle(job, error);
      }
    }

    function request(pattern, text, signal) {
      if (signal.aborted) return Promise.reject(abortError());
      return new Promise(function (resolve, reject) {
        const job = { id: ++nextId, request: { pattern, text, operation: 'finditer' },
          signal, resolve, reject, timer: null, abort: null };
        job.abort = function () {
          if (active === job) stopWorker();
          else queue.splice(queue.indexOf(job), 1);
          settle(job, abortError());
        };
        signal.addEventListener('abort', job.abort, { once: true });
        queue.push(job);
        pump();
      });
    }

    /** Return complete matches per input, with UTF-16 spans suitable for DOM text slicing. */
    async function findAll(pattern, texts, { signal }) {
      const results = [];
      for (const text of texts) {
        const result = await request(pattern, text, signal);
        if (!result.ok) {
          const error = new Error(result.error.message);
          error.name = 'PythonRegexError';
          throw error;
        }
        if (result.truncated) throw new Error('Too many matches to check. Use a more specific pattern.');
        results.push(convertSpans(text, result.matches));
      }
      return results;
    }

    function destroy() {
      stopWorker();
      const jobs = queue.splice(0);
      if (active) jobs.push(active);
      for (const job of jobs) settle(job, abortError());
    }

    return { findAll, destroy };
  }

  function convertSpans(text, matches) {
    const offsets = [0];
    for (const character of text) offsets.push(offsets[offsets.length - 1] + character.length);
    return matches.map(function (match) {
      return { ...match, start: offsets[match.start], end: offsets[match.end] };
    });
  }

  window.PythonRegexClient = { create };
})();
