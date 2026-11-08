/** Disposable local C++ compiler/observer worker. The host owns cancellation/deadlines. */
import { runClang } from './vendor/yowasp-clang/22.0.0-git20542-10/gen/bundle.js';
import { WASI, File, OpenFile, ConsoleStdout } from './vendor/browser-wasi-shim/0.4.2/dist/index.js';
import { Parser, Language } from './vendor/tree-sitter/web-tree-sitter-0.25.10/tree-sitter.js';
import { preprocessingSource, mappedPreprocessedSource, instrumentCpp, decodeCppTrace, CPP_OUTPUT_LIMIT } from './object-reference-cpp-instrument.mjs';
const encoder = new TextEncoder();
let parser, header;
const ready = (async () => {
  await runClang(null, {}, { fetchProgress() {} });
  await Parser.init({ locateFile: () => new URL('./vendor/tree-sitter/web-tree-sitter-0.25.10/tree-sitter.wasm', import.meta.url).href });
  parser = new Parser();
  parser.setLanguage(await Language.load(new URL('./vendor/tree-sitter/tree-sitter-cpp-0.23.4/tree-sitter-cpp.wasm', import.meta.url).href));
  const response = await fetch(new URL('./object-reference-cpp-runtime.hpp', import.meta.url));
  if (!response.ok) throw new Error('Could not load the local C++ observer.');
  header = await response.text();
  postMessage({ type: 'ready' });
})();
ready.catch(error => postMessage({ type: 'error', message: error.message }));
function capture() {
  const text = { stdout: '', stderr: '' };
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() };
  let bytesSeen = 0;
  return { text, write(type, bytes) {
    if (!bytes) return;
    bytesSeen += bytes.length;
    if (bytesSeen > CPP_OUTPUT_LIMIT) throw new Error('C++ trace output exceeds the 2 MiB limit.');
    text[type] += decoders[type].decode(bytes, { stream: true });
  } };
}
async function clang(args, tree) {
  const output = capture();
  try {
    const files = await runClang(args, tree, { decodeASCII: false, stdout: bytes => output.write('stdout', bytes), stderr: bytes => output.write('stderr', bytes) });
    return { files, ...output.text };
  } catch (error) { throw new Error(output.text.stderr || error.message); }
}
async function trace(code) {
  const preprocessed = await clang(['clang++', '-std=c++17', '-E', '/input.cpp'], { 'input.cpp': preprocessingSource(code) });
  const source = instrumentCpp(mappedPreprocessedSource(preprocessed.stdout), parser);
  const compiled = await clang(['clang++', '-std=c++17', '-O0', '-fno-elide-constructors', '-fno-exceptions', '-fno-color-diagnostics', '-Werror=unsequenced', '-Werror=return-stack-address', '-Wl,-z,stack-size=1048576', '-Wl,--max-memory=134217728', '/program.cpp', '-o', '/program.wasm'], {
    'program.cpp': source, 'object-reference-cpp-runtime.hpp': header,
  });
  const output = capture();
  const wasi = new WASI(['program'], [], [new OpenFile(new File(encoder.encode(''))), new ConsoleStdout(bytes => output.write('stdout', bytes)), new ConsoleStdout(bytes => output.write('stderr', bytes))]);
  const module = await WebAssembly.compile(compiled.files['program.wasm']);
  const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
  postMessage({ type: 'running' });
  let exitCode;
  try { exitCode = wasi.start(instance); }
  catch (error) {
    const partial = decodeCppTrace(output.text.stderr, output.text.stdout, 1);
    partial.error = error.message; partial.truncated = true;
    if (partial.steps.length) partial.steps.at(-1).note = error.message;
    return partial;
  }
  return decodeCppTrace(output.text.stderr, output.text.stdout, exitCode);
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    await ready;
    if (data.type !== 'trace') throw new Error('The C++ lab worker accepts trace requests only.');
    postMessage({ type: 'result', trace: await trace(data.code) });
  }).catch(error => postMessage({ type: 'error', message: error.message }));
};
