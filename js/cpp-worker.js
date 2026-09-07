/**
 * C++17 compiler/executor protocol, entirely inside a disposable Web Worker.
 * write/read store source files in memory; run compiles the named entry point;
 * runTest compiles an authored C++ harness against the same current files.
 * Every compilation gets a fresh filesystem and every execution a fresh WASI
 * instance. Failed compilation can never execute a previous binary. The host
 * owns Stop and the deadline, so even an infinite loop can be terminated.
 */
import { runClang } from './vendor/yowasp-clang/22.0.0-git20542-10/gen/bundle.js';
import { WASI, File, OpenFile, ConsoleStdout } from './vendor/browser-wasi-shim/0.4.2/dist/index.js';

const files = new Map();
const encoder = new TextEncoder();
const OUTPUT_LIMIT = 256 * 1024;
let lastProgress = -1;

const ready = runClang(null, {}, {
  fetchProgress({ doneLength, totalLength }) {
    const progress = Math.floor(doneLength / totalLength * 10) * 10;
    if (progress === lastProgress) return;
    lastProgress = progress;
    postMessage({ type: 'loading', message: `Loading C++ compiler… ${progress}%` });
  },
}).then(() => postMessage({ type: 'ready' }));
ready.catch(error => postMessage({ type: 'error', message: error.message }));

function sourcePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/tutorial/') ||
      path.split('/').some(part => part === '..' || part === '.') || path.includes('\0')) {
    throw new Error('C++ source files must be inside /tutorial/');
  }
  return path;
}

function sourceTree() {
  const root = Object.create(null);
  for (const [path, content] of files) {
    const parts = path.slice(1).split('/');
    let directory = root;
    for (const part of parts.slice(0, -1)) {
      if (!directory[part]) directory[part] = Object.create(null);
      if (typeof directory[part] !== 'object') throw new Error('Conflicting source paths');
      directory = directory[part];
    }
    directory[parts.at(-1)] = content;
  }
  return root;
}

function outputCapture(silent) {
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  const text = { stdout: '', stderr: '' };
  let length = 0;
  return {
    text,
    write(type, bytes) {
      if (!bytes) return;
      length += bytes.length;
      if (length > OUTPUT_LIMIT) throw new Error('Output limit exceeded; check for an unintended loop.');
      const chunk = decoders[type].decode(bytes, { stream: true });
      text[type] += chunk;
      if (!silent && chunk) postMessage({ type, text: chunk });
    },
  };
}

async function compileAndRun(message) {
  const output = outputCapture(message.silent);
  let phase = 'compile';
  let exitCode = 1;
  try {
    const tree = sourceTree();
    let entry = sourcePath(message.path);
    if (!files.has(entry)) throw new Error(`Source file not found: ${entry}`);
    if (message.type === 'runTest') {
      if (typeof message.code !== 'string' || !message.code.trim()) {
        throw new Error('A C++ check needs a complete test program.');
      }
      tree.tutorial['__sebook_check.cpp'] = message.code;
      entry = '/tutorial/__sebook_check.cpp';
    }
    const result = await runClang([
      // The packaged WASI libc++ was built without exception support.
      'clang++', '-std=c++17', '-O0', '-fno-color-diagnostics', '-fno-exceptions',
      '-I/tutorial', '-Wl,-z,stack-size=1048576', '-Wl,--max-memory=134217728',
      entry, '-o', '/program.wasm',
    ], tree, {
      decodeASCII: false,
      stdout: bytes => output.write('stdout', bytes),
      stderr: bytes => output.write('stderr', bytes),
    });
    phase = 'run';
    const wasi = new WASI(['program'], [], [
      new OpenFile(new File(encoder.encode(message.stdin || ''))),
      new ConsoleStdout(bytes => output.write('stdout', bytes)),
      new ConsoleStdout(bytes => output.write('stderr', bytes)),
    ]);
    const module = await WebAssembly.compile(result['program.wasm']);
    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
    exitCode = wasi.start(instance);
  } catch (error) {
    exitCode = Number.isInteger(error.code) && error.code !== 0 ? error.code : 1;
    // Compiler failures already carry source diagnostics. A runtime trap or
    // output limit still needs its own explanation after warnings/program stderr.
    if (phase === 'run' || !output.text.stderr) {
      const diagnostic = `${error.message || error}\n`;
      output.text.stderr += diagnostic;
      if (!message.silent) postMessage({ type: 'stderr', text: diagnostic });
    }
  }
  postMessage({ type: 'run_done', id: message.id, exitCode, phase, ...output.text });
}

async function handle(message) {
  await ready;
  if (message.type === 'run' || message.type === 'runTest') return compileAndRun(message);
  if (message.type === 'write') {
    try {
      files.set(sourcePath(message.path), String(message.content));
      postMessage({ type: 'write_ok', id: message.id });
    } catch (error) {
      postMessage({ type: 'write_error', id: message.id, message: error.message });
    }
    return;
  }
  if (message.type === 'read') {
    const content = files.get(message.path);
    postMessage(content === undefined
      ? { type: 'read_error', id: message.id, message: 'Source file not found' }
      : { type: 'read_ok', id: message.id, content });
    return;
  }
  postMessage({ type: 'run_done', id: message.id, exitCode: 1,
    stderr: 'The C++ backend supports source files, not shell or script commands.' });
}

let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data)).catch(error => {
    postMessage({ type: 'error', message: error.message });
  });
};
