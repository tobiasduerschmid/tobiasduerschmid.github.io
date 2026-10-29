const path = require('node:path');
const { fork } = require('node:child_process');

const DEADLINE_MS = 30_000;

function createPyodideWorker(t) {
  // Pyodide's Node stdio adapter needs real file descriptors, which a Node
  // worker_thread's process.stdout lacks. A disposable child retains them.
  const runtime = fork(path.join(__dirname, 'pyodide-worker-runtime.js'), { silent: true });
  runtime.stdout.resume();
  runtime.stderr.resume();
  t.after(() => runtime.kill());
  const messages = [];
  const pending = new Map();
  let nextId = 0;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const bootDeadline = setTimeout(() => stop(new Error('Pyodide initialization timed out')), DEADLINE_MS);

  function stop(error) {
    clearTimeout(bootDeadline);
    rejectReady(error);
    for (const request of pending.values()) {
      clearTimeout(request.deadline);
      request.reject(error);
    }
    pending.clear();
    runtime.kill();
  }

  runtime.on('error', stop);
  runtime.on('exit', (code, signal) => {
    stop(new Error(`Pyodide process exited before replying (${code ?? signal})`));
  });
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
      clearTimeout(request.deadline);
      pending.delete(message.id);
      request.resolve(message);
    }
  });

  return {
    messages,
    async request(message) {
      await ready;
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const deadline = setTimeout(() => stop(new Error(`Pyodide ${message.type} timed out`)), DEADLINE_MS);
        pending.set(id, { resolve, reject, deadline });
        runtime.send({ ...message, id });
      });
    },
  };
}

module.exports = { createPyodideWorker };
