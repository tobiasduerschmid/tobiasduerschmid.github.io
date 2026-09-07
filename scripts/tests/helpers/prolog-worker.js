const path = require('node:path');
const { after } = require('node:test');
const { Worker } = require('node:worker_threads');

const REQUEST_DEADLINE_MS = 3000;

// Use the actual interpreter in a terminable thread. A host-owned deadline also
// bounds nested searches such as a nonterminating findall/3.
function createPrologWorker() {
  const messages = [];
  const pending = new Map();
  let nextId = 0;
  const runtime = new Worker(path.join(__dirname, 'prolog-worker-runtime.js'));
  after(() => runtime.terminate());
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const bootDeadline = setTimeout(() => stop(new Error('Prolog initialization did not complete')), REQUEST_DEADLINE_MS);

  function stop(error) {
    clearTimeout(bootDeadline);
    rejectReady(error);
    for (const request of pending.values()) {
      clearTimeout(request.deadline);
      request.reject(error);
    }
    pending.clear();
    void runtime.terminate();
  }

  runtime.on('error', stop);
  runtime.on('message', message => {
    messages.push(message);
    if (message.type === 'ready') {
      clearTimeout(bootDeadline);
      resolveReady();
    } else if (message.type === 'error') {
      stop(new Error(message.message));
    }
    const request = pending.get(message.id);
    if (request) {
      pending.delete(message.id);
      clearTimeout(request.deadline);
      request.resolve(message);
    }
  });

  return {
    messages,
    async request(message) {
      await ready;
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => {
          const error = new Error(`Prolog ${message.type} request exceeded its execution deadline`);
          error.code = 'PROLOG_EXECUTION_TIMEOUT';
          stop(error);
        }, REQUEST_DEADLINE_MS);
        pending.set(id, { resolve, reject, deadline });
        runtime.postMessage({ ...message, id });
      });
    },
  };
}

module.exports = { createPrologWorker };
