#!/usr/bin/env node
/** Trusted authored-source generator. Browser edits execute in WASI, never this native process. */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { preprocessingSource, mappedPreprocessedSource, instrumentCpp, decodeCppTrace, CPP_OUTPUT_LIMIT } from '../js/object-reference-cpp-instrument.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let parserPromise;
async function getParser() {
  if (!parserPromise) parserPromise = (async () => {
    const directory = join(root, 'js/vendor/tree-sitter');
    const script = join(directory, 'web-tree-sitter-0.25.10/tree-sitter.js');
    // The vendored ESM .js lives in this repository's CommonJS package. Preserve its
    // own URL when loading those unchanged bytes through a Node ESM data module.
    const source = (await readFile(script, 'utf8')).replaceAll('import.meta.url', JSON.stringify(pathToFileURL(script).href));
    const { Parser, Language } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    await Parser.init({ locateFile: () => join(directory, 'web-tree-sitter-0.25.10/tree-sitter.wasm') });
    const parser = new Parser();
    parser.setLanguage(await Language.load(await readFile(join(directory, 'tree-sitter-cpp-0.23.4/tree-sitter-cpp.wasm'))));
    return parser;
  })();
  return parserPromise;
}
function run(command, args, cwd, timeout = 30000) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout, maxBuffer: CPP_OUTPUT_LIMIT });
  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') throw new Error('C++ execution or compilation deadline exceeded.');
    if (result.error.code === 'ENOBUFS') throw new Error('C++ trace output exceeds the 2 MiB limit.');
    throw result.error;
  }
  return result;
}
/** Compile and execute one trusted snippet using the identical browser instrumenter/runtime. */
export async function traceCpp(code) {
  const directory = await mkdtemp(join(tmpdir(), 'sebook-cpp-trace-'));
  try {
    await writeFile(join(directory, 'input.cpp'), preprocessingSource(code));
    const compiler = process.env.CXX || 'clang++';
    const expanded = run(compiler, ['-std=c++17', '-E', '-x', 'c++', 'input.cpp'], directory);
    if (expanded.status !== 0) throw new Error(expanded.stderr || 'C++ macro preprocessing failed.');
    const instrumented = instrumentCpp(mappedPreprocessedSource(expanded.stdout), await getParser());
    await writeFile(join(directory, 'program.cpp'), instrumented);
    await writeFile(join(directory, 'object-reference-cpp-runtime.hpp'), await readFile(join(root, 'js/object-reference-cpp-runtime.hpp')));
    const compiled = run(compiler, ['-std=c++17', '-O0', '-fno-elide-constructors', '-fno-exceptions', '-fno-color-diagnostics', '-Werror=unsequenced', '-Werror=return-stack-address', 'program.cpp', '-o', 'program'], directory);
    if (compiled.status !== 0) throw new Error(compiled.stderr || 'C++ compilation failed.');
    const executed = run(join(directory, 'program'), [], directory, 3000);
    return decodeCppTrace(executed.stderr, executed.stdout, executed.status || (executed.signal ? 1 : 0));
  } catch (error) { return { steps: [], error: error.message, truncated: /limit|deadline/.test(error.message) }; }
  finally { await rm(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    const examples = JSON.parse(input);
    if (!Array.isArray(examples)) throw new Error('Expected an array of {id, code} records.');
    const traces = {};
    for (const { id, code } of examples) {
      if (typeof id !== 'string' || Object.hasOwn(traces, id)) throw new Error('Example IDs must be unique strings.');
      Object.defineProperty(traces, id, { value: await traceCpp(code), enumerable: true });
    }
    process.stdout.write(JSON.stringify(traces));
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
