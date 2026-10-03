/**
 * MicroHs tutorial runtime adapter
 *
 * Runs the vendored MicroHs compiler and evaluator in an Emscripten MEMFS.
 * MicroHs exposes an interactive prompt rather than a JavaScript compile API,
 * so this adapter serializes requests and terminates each command sequence
 * with an exact, request-specific output marker. The adapter can run either
 * in a Web Worker or in the sandboxed Haskell runtime frame. The frame is the
 * production path because Chrome gives workers too little Wasm call stack for
 * MicroHs to boot reliably.
 *
 * Inbound protocol messages (tutorial host -> adapter):
 *   { type: 'write',   id, path, content }
 *   { type: 'read',    id, path }
 *   { type: 'run',     id, path, args?, silent? }
 *   { type: 'evaluate', id, path, expression, silent? }
 *   { type: 'runTest', id, path, expression, signature?, silent? }
 *   { type: 'runCode', id }  (rejected; retained only for protocol parity)
 *   { type: 'interrupt', id }
 *
 * `runTest.expression` is a single Haskell Boolean expression evaluated after
 * the module at `path` is imported. Only `True` passes. The legacy `code`
 * field is also accepted by the worker adapter. Optional signature {name,type}
 * requires an explicit top-level declaration and an exact compiler-resolved
 * monomorphic type, independently scoped from the student module.
 * `evaluate.expression` is one expression or :type/:t followed by one
 * expression. It uses fresh workspace source, does not require main, and
 * does not retain interactive definitions. Other REPL commands are rejected.
 *
 * Outbound protocol messages (adapter -> tutorial host):
 *   { type: 'loading', message }
 *   { type: 'ready' }
 *   { type: 'stdout' | 'stderr', text }
 *   { type: 'run_done', id, exitCode, stdout, stderr }
 *   { type: 'write_ok' | 'write_error', id, message? }
 *   { type: 'read_ok' | 'read_error', id, content?, message? }
 *   { type: 'interrupt_ok', id }
 *   { type: 'error', message }
 */
'use strict';

const MICROHS_BUNDLE_PATH = '/js/vendor/microhs/mhs-embed.js';
const WORKSPACE_ROOT = '/tutorial';
const RUNTIME_ARGUMENTS = ['+RTS', '-H8M', '-RTS'];
const FRAME_MESSAGE_NAMESPACE = 'sebook-haskell-runtime';
const READY_BANNER = "Type ':quit' to quit, ':help' for help";
const HASKELL_MODULE_PATTERN =
  /^module\s+([A-Z][A-Za-z0-9_']*(?:\.[A-Z][A-Za-z0-9_']*)*)\b/;

const runtimeScope = globalThis;
const isWindowRuntime = typeof window !== 'undefined' &&
  typeof document !== 'undefined';
const hasParentFrame = isWindowRuntime && runtimeScope.parent !== runtimeScope;
let trustedParentOrigin = parentOriginFromReferrer();

const pendingMessages = [];
const runtimeOutputDecoders = {
  stdout: new TextDecoder('utf-8'),
  stderr: new TextDecoder('utf-8'),
};
const runtimeOutputByteBuffers = {
  stdout: new Uint8Array(1),
  stderr: new Uint8Array(1),
};
let activeOperation = null;
let pendingCleanupCommands = [];
let pendingCleanupFiles = [];
let compiledScope = null;
let compiledWorkspace = null;
let hasStartedOperation = false;
let expressionScope = null;
let signatureScope = null;
const temporarySources = new Map();
let bootOutput = '';
let isRuntimeReady = false;
let hasRuntimeFailed = false;
let operationSequence = 0;

// The runtime frame is intentionally hidden. Browsers can throttle its timers
// to one per second, so zero-delay compiler yields must use a task queue, not
// timers. A task (rather than a microtask) still lets Stop and host messages run.
const runtimeTasks = new MessageChannel();
const pendingRuntimeTasks = [];
runtimeTasks.port1.onmessage = function () {
  pendingRuntimeTasks.shift()();
};

function deferRuntimeTask(callback) {
  pendingRuntimeTasks.push(callback);
  runtimeTasks.port2.postMessage(null);
}

function parentOriginFromReferrer() {
  if (!hasParentFrame || !document.referrer) return null;
  try {
    const origin = new URL(document.referrer).origin;
    return origin === 'null' ? null : origin;
  } catch (error) {
    return null;
  }
}

function updateStandaloneStatus(message) {
  if (!isWindowRuntime) return;
  const status = document.getElementById('haskell-runtime-status');
  if (status) status.textContent = message;
}

function postProtocolMessage(message) {
  if (isWindowRuntime) {
    if (!hasParentFrame) return;
    runtimeScope.parent.postMessage(
      { namespace: FRAME_MESSAGE_NAMESPACE, message: message },
      trustedParentOrigin || '*'
    );
    return;
  }
  runtimeScope.postMessage(message);
}

function registerProtocolMessageHandler(handler) {
  if (!isWindowRuntime) {
    runtimeScope.onmessage = function (event) {
      handler(event.data || {});
    };
    return;
  }
  if (!hasParentFrame) return;

  runtimeScope.addEventListener('message', function (event) {
    const envelope = event.data;
    if (event.source !== runtimeScope.parent ||
        !envelope || envelope.namespace !== FRAME_MESSAGE_NAMESPACE) {
      return;
    }
    if (trustedParentOrigin && event.origin !== trustedParentOrigin) return;
    if (!trustedParentOrigin && event.origin && event.origin !== 'null') {
      trustedParentOrigin = event.origin;
    }
    handler(envelope.message || {});
  });
}

function postLoading(message) {
  updateStandaloneStatus(message);
  postProtocolMessage({ type: 'loading', message: message });
}

function postFatalError(message) {
  updateStandaloneStatus(message);
  postProtocolMessage({ type: 'error', message: message });
}

function appendRuntimeText(text, channel) {
  const output = String(text);
  bootOutput = (bootOutput + output).slice(-8192);

  if (activeOperation) {
    captureOperationOutput(activeOperation, output, channel);
    finishOperationAtPrompt(activeOperation);
  }
  announceReadyAfterPrompt();
}

function appendRuntimeByte(value, channel) {
  const decoder = runtimeOutputDecoders[channel];
  if (value === null || value === undefined) {
    const trailingText = decoder.decode();
    if (trailingText) appendRuntimeText(trailingText, channel);
    return;
  }

  const byteBuffer = runtimeOutputByteBuffers[channel];
  byteBuffer[0] = value;
  const decodedText = decoder.decode(byteBuffer, { stream: true });
  if (decodedText) appendRuntimeText(decodedText, channel);
}

function captureOperationOutput(operation, text, channel) {
  if (channel === 'stderr') {
    operation.rawStderr += operation.debug ? operation.debug.consumeStderr(text) : text;
    if (containsRuntimeFailure(text)) operation.failed = true;
    return;
  }

  operation.rawStdout += text;
  operation.stdoutLineBuffer += text;
  consumeCompleteStdoutLines(operation);
}

function consumeCompleteStdoutLines(operation) {
  let newlineIndex = operation.stdoutLineBuffer.indexOf('\n');
  while (newlineIndex !== -1) {
    const line = operation.stdoutLineBuffer.slice(0, newlineIndex).replace(/\r$/, '');
    operation.stdoutLineBuffer = operation.stdoutLineBuffer.slice(newlineIndex + 1);
    observeOperationLine(operation, line);
    newlineIndex = operation.stdoutLineBuffer.indexOf('\n');
  }
}

function observeOperationLine(operation, line) {
  const normalizedLine = line.trim();
  if (operation.passMarker && normalizedLine === operation.passMarker) {
    operation.sawTestPass = true;
  }
  if (operation.failMarker && normalizedLine === operation.failMarker) {
    operation.sawTestFail = true;
  }
  if (containsRuntimeFailure(line)) operation.failed = true;

  if (normalizedLine === operation.doneMarker && !operation.isFinishing) {
    operation.isFinishing = true;
    deferRuntimeTask(function () {
      finishOperation(operation);
    });
  }
}

function announceReadyAfterPrompt() {
  if (isRuntimeReady || hasRuntimeFailed) return;
  if (!bootOutput.includes(READY_BANNER) || !bootOutput.endsWith('> ')) return;

  isRuntimeReady = true;
  updateStandaloneStatus('Haskell runtime is ready.');
  postProtocolMessage({ type: 'ready' });
  processNextMessage();
}

function containsRuntimeFailure(text) {
  return /\*\*\* Exception:|Fatal error:|Aborted\(|RuntimeError:|heap exhausted|out of heap/i
    .test(text);
}

function failRuntime(error) {
  if (hasRuntimeFailed) return;
  hasRuntimeFailed = true;
  const message = error && error.message ? error.message : String(error);

  if (activeOperation) {
    activeOperation.failed = true;
    activeOperation.rawStderr += 'MicroHs runtime failed: ' + message + '\n';
    finishOperation(activeOperation);
  }
  rejectPendingMessages(message);
  postFatalError('MicroHs runtime failed: ' + message);
}

function rejectPendingMessages(message) {
  while (pendingMessages.length > 0) {
    rejectMessage(pendingMessages.shift(), message);
  }
}

function rejectMessage(message, reason) {
  if (message.type === 'start') {
    postProtocolMessage({ type: 'debugComplete', exitCode: 1, error: reason });
    return;
  }
  if (message.type === 'write') {
    postProtocolMessage({ type: 'write_error', id: message.id, message: reason });
    return;
  }
  if (message.type === 'read') {
    postProtocolMessage({ type: 'read_error', id: message.id, message: reason });
    return;
  }
  if (message.type === 'evaluate') {
    postProtocolMessage({ type: 'run_done', id: message.id, exitCode: 1, stdout: '', stderr: reason + '\n' });
    return;
  }
  postProtocolMessage({ type: 'run_done', id: message.id, exitCode: 1, error: reason });
}

function normalizeWorkspacePath(path) {
  const suppliedPath = String(path || '').replace(/\\/g, '/');
  if (!suppliedPath) throw new Error('A file path is required');

  const absolutePath = suppliedPath.startsWith('/')
    ? suppliedPath
    : WORKSPACE_ROOT + '/' + suppliedPath;
  const pathSegments = [];

  absolutePath.split('/').forEach(function (segment) {
    if (!segment || segment === '.') return;
    if (segment === '..') pathSegments.pop();
    else pathSegments.push(segment);
  });

  const normalizedPath = '/' + pathSegments.join('/');
  if (normalizedPath !== WORKSPACE_ROOT &&
      !normalizedPath.startsWith(WORKSPACE_ROOT + '/')) {
    throw new Error('File paths must stay inside ' + WORKSPACE_ROOT);
  }
  return normalizedPath;
}

function parentDirectory(path) {
  const separatorIndex = path.lastIndexOf('/');
  return separatorIndex > 0 ? path.slice(0, separatorIndex) : '/';
}

function readWorkspaceFile(path) {
  return runtimeScope.Module.FS.readFile(path, { encoding: 'utf8' });
}

function writeWorkspaceFile(path, content) {
  runtimeScope.Module.FS.mkdirTree(parentDirectory(path));
  runtimeScope.Module.FS.writeFile(path, String(content));
}

function ownsTemporaryFile(path) {
  if (!temporarySources.has(path)) return false;
  const fs = runtimeScope.Module.FS;
  try {
    return fs.isFile(fs.lstat(path).mode) && readWorkspaceFile(path) === temporarySources.get(path);
  } catch (error) {
    if (error instanceof fs.ErrnoError) return false;
    throw error;
  }
}

function writeTemporaryFile(path, content) {
  writeWorkspaceFile(path, content);
  temporarySources.set(path, content);
}

function removeTemporaryFile(path) {
  // A learner may replace a helper through Haskell IO or an editor write.
  // Reclaim only the exact source that this adapter created.
  if (ownsTemporaryFile(path)) runtimeScope.Module.FS.unlink(path);
  temporarySources.delete(path);
}

function sourceAfterLeadingHaskellTrivia(source) {
  let cursor = 0;

  while (cursor < source.length) {
    if (/\s/.test(source[cursor])) {
      cursor += 1;
      continue;
    }
    if (source.startsWith('--', cursor)) {
      const newlineIndex = source.indexOf('\n', cursor + 2);
      cursor = newlineIndex === -1 ? source.length : newlineIndex + 1;
      continue;
    }
    if (source.startsWith('{-', cursor)) {
      cursor = indexAfterNestedBlockComment(source, cursor);
      continue;
    }
    break;
  }

  return source.slice(cursor);
}

function indexAfterNestedBlockComment(source, openingIndex) {
  let cursor = openingIndex + 2;
  let nestingDepth = 1;

  while (cursor < source.length && nestingDepth > 0) {
    if (source.startsWith('{-', cursor)) {
      nestingDepth += 1;
      cursor += 2;
    } else if (source.startsWith('-}', cursor)) {
      nestingDepth -= 1;
      cursor += 2;
    } else {
      cursor += 1;
    }
  }

  return cursor;
}

function moduleDescriptor(path) {
  const source = readWorkspaceFile(path);
  const declaration = sourceAfterLeadingHaskellTrivia(source)
    .match(HASKELL_MODULE_PATTERN);
  const moduleName = declaration ? declaration[1] : inferredMainModule(path);
  const expectedSuffix = '/' + moduleName.replace(/\./g, '/') + '.hs';

  if (!path.endsWith(expectedSuffix)) {
    throw new Error(
      'Module ' + moduleName + ' must be stored as ' +
      moduleName.replace(/\./g, '/') + '.hs'
    );
  }

  return {
    moduleName: moduleName,
    sourcePath: path.slice(0, -expectedSuffix.length) || '/',
  };
}

function inferredMainModule(path) {
  if (path.endsWith('/Main.hs')) return 'Main';
  throw new Error('A Haskell file without a module declaration must be named Main.hs');
}

function markerFor(label, requestId) {
  operationSequence += 1;
  const safeRequestId = String(requestId === undefined ? 'request' : requestId)
    .replace(/[^A-Za-z0-9_]/g, '_');
  return '__SEBOOK_' + label + '_' + safeRequestId + '_' + operationSequence + '__';
}

function commandForMarker(marker) {
  return 'Prelude.putStrLn "' + marker + '"';
}

function sendInteractiveCommands(commands) {
  const input = commands.join('\n') + '\n';
  for (let index = 0; index < input.length; index += 1) {
    runtimeScope.Module._set_input_char(input.charCodeAt(index));
  }
}

// Cache compiler inputs, never evaluated results. MicroHs 0.16.6 translates
// its cached combinator expressions into fresh runtime values on every query.
// Inspect MEMFS itself: learner IO can change source without a host write.
// Large workspaces and symlinks fall back to the compiler's normal reload.
function snapshotWorkspace() {
  const fs = runtimeScope.Module.FS;
  const entries = [];
  let remaining = 1024 * 1024;
  let visited = 0;
  function visit(directory) {
    for (const name of fs.readdir(directory).sort()) {
      if (name === '.' || name === '..') continue;
      if (++visited > 128) return false;
      const path = directory + '/' + name;
      const stat = fs.lstat(path);
      if (fs.isDir(stat.mode)) {
        if (!visit(path)) return false;
      } else if (fs.isFile(stat.mode)) {
        remaining -= stat.size + path.length;
        if (remaining < 0) return false;
        entries.push([path, fs.readFile(path)]);
      } else return false;
    }
    return true;
  }
  try {
    return visit(WORKSPACE_ROOT) ? entries : null;
  } catch (error) {
    if (error instanceof fs.ErrnoError) return null;
    throw error;
  }
}

function sameWorkspace(left, right) {
  return left !== null && right !== null && left.length === right.length &&
    left.every(function (entry, index) {
      const [path, bytes] = entry;
      const [previousPath, previousBytes] = right[index];
      return path === previousPath && bytes.length === previousBytes.length &&
        bytes.every(function (byte, offset) { return byte === previousBytes[offset]; });
    });
}

function startOperation(message, settings) {
  const doneMarker = settings.doneMarker || markerFor('DONE', message.id);
  const scope = JSON.stringify([settings.sourcePath, settings.imports]);
  // Reuse a successful compilation only while its complete input is unchanged.
  // Otherwise reload retained imports once, rather than rebuilding the empty
  // environment followed by the same imported environment on every request.
  const reuseImports = scope === compiledScope;
  const workspace = snapshotWorkspace();
  const reuseCompilation = reuseImports && sameWorkspace(workspace, compiledWorkspace);
  const commands = [':set prompt=> '].concat(
    reuseImports ? [] : pendingCleanupCommands,
    reuseCompilation ? [] : [':set path=' + settings.sourcePath].concat(hasStartedOperation ? [':reload'] : []),
    reuseImports ? [] : settings.imports,
    settings.commands,
    // Setting a prompt is a REPL control command, so completion does not
    // compile and evaluate a second Haskell expression for every request.
    settings.inlineCompletion ? [] : [':set prompt=' + doneMarker]
  );
  const cleanupFiles = pendingCleanupFiles.filter(function (path) { return path !== settings.temporaryFile; });
  pendingCleanupCommands = settings.imports.map(function (line) { return ':delete ' + line; });
  pendingCleanupFiles = settings.temporaryFile ? [settings.temporaryFile] : [];
  hasStartedOperation = true;

  activeOperation = {
    id: message.id,
    kind: settings.kind,
    scope: scope,
    workspace: workspace,
    silent: Boolean(message.silent),
    commands: commands,
    doneMarker: doneMarker,
    promptCompletion: !settings.inlineCompletion,
    passMarker: settings.passMarker || null,
    failMarker: settings.failMarker || null,
    sawTestPass: false,
    sawTestFail: false,
    failed: false,
    isFinishing: false,
    rawStdout: '',
    rawStderr: '',
    stdoutLineBuffer: '',
    debug: settings.debug || null,
    mapDiagnostics: settings.mapDiagnostics || null,
    cleanupFiles: cleanupFiles,
    publishedDebugOutput: { stdout: '', stderr: '' },
  };

  sendInteractiveCommands(commands);
}

function startRun(message) {
  const path = normalizeWorkspacePath(message.path);
  checkAliasCycles(readWorkspaceFile(path), path);
  const descriptor = moduleDescriptor(path);
  const argumentText = Array.isArray(message.args)
    ? message.args.join(' ')
    : String(message.args || '').trim();
  const mainCommand = argumentText ? ':main ' + argumentText : ':main';

  startOperation(message, {
    kind: 'run',
    sourcePath: descriptor.sourcePath,
    imports: ['import ' + descriptor.moduleName],
    commands: [mainCommand],
  });
}

function interpreterInput(suppliedExpression) {
  const input = String(suppliedExpression || '').trim();
  if (!input) throw new Error('Enter a Haskell expression or :type followed by an expression.');
  if (/[\x00-\x1f\x7f]/.test(input)) {
    throw new Error('Interpreter expressions must fit on one line without control characters.');
  }
  const typeCommand = input.match(/^:(?:type|t)(?:\s+(.*))?$/);
  if (input.startsWith(':') && !typeCommand) {
    throw new Error('Only expressions and :type (:t) are supported. Edit definitions in the editor; files reload automatically.');
  }
  const expression = typeCommand ? (typeCommand[1] || '').trim() : input;
  if (!expression) throw new Error('Provide an expression after :type (:t).');
  return { expression: expression, inspectType: Boolean(typeCommand) };
}

function interpreterScope(path) {
  const source = readWorkspaceFile(path);
  const descriptor = moduleDescriptor(path);
  const body = sourceAfterLeadingHaskellTrivia(source);
  if (HASKELL_MODULE_PATTERN.test(body)) return { ...descriptor, source: source };

  // A headerless program implicitly exports only main. A private module gives
  // the interpreter access to its definitions without rewriting the editor file.
  if (!expressionScope || expressionScope.path !== path ||
      !ownsTemporaryFile(expressionScope.temporaryFile)) {
    let moduleName, temporaryFile;
    do {
      moduleName = 'SEBookExpressionScope' + (++operationSequence);
      temporaryFile = descriptor.sourcePath + '/' + moduleName + '.hs';
    } while (runtimeScope.Module.FS.analyzePath(temporaryFile).exists);
    expressionScope = { path: path, moduleName: moduleName, temporaryFile: temporaryFile };
  }
  const { moduleName, temporaryFile } = expressionScope;
  const insertion = source.length - body.length;
  return {
    moduleName: moduleName,
    sourcePath: descriptor.sourcePath,
    source: source.slice(0, insertion) + 'module ' + moduleName + ' where\n' + body,
    temporaryFile: temporaryFile,
    mapDiagnostics: function (text) {
      return text.replace(/"([^"\n]+\.hs)": line\s+(\d+)/g, function (match, file, line) {
        if (file !== temporaryFile && file !== moduleName + '.hs') return match;
        return '"' + path + '": line ' + Math.max(1, Number(line) - 1);
      });
    },
  };
}

function startEvaluate(message) {
  const input = interpreterInput(message.expression);
  const path = normalizeWorkspacePath(message.path);
  const scope = interpreterScope(path);
  if (!input.inspectType) {
    checkAliasCycles(scope.source, path, input.expression, {
      executeExpression: true,
      sourceLineOffset: scope.temporaryFile ? 1 : 0,
    });
  }
  if (scope.temporaryFile) writeTemporaryFile(scope.temporaryFile, scope.source);
  // `case` forces MicroHs's expression parser. Plain parenthesizing can still
  // be parsed as a top-level pattern binding; interactive bindings must not leak.
  const expressionCommand = 'case () of { () -> (' + input.expression + ') }';
  startOperation(message, {
    kind: 'evaluate',
    sourcePath: scope.sourcePath,
    imports: ['import ' + scope.moduleName],
    commands: [input.inspectType ? ':type (' + input.expression + ')' : expressionCommand],
    temporaryFile: scope.temporaryFile,
    mapDiagnostics: scope.mapDiagnostics,
  });
}

// The helper imports the learner qualified and owns its expected type scope.
// Empty defaults prevent Fractional/RealFrac-polymorphic declarations from
// defaulting to Double merely because typeOf demands a concrete instance.
function signatureHelper(descriptor, signature) {
  const key = JSON.stringify([descriptor.sourcePath, descriptor.moduleName, signature.name, signature.type]);
  if (!signatureScope || signatureScope.key !== key ||
      !ownsTemporaryFile(signatureScope.path)) {
    let moduleName, path;
    do {
      moduleName = 'SEBookSignatureCheck' + (++operationSequence);
      path = descriptor.sourcePath + '/' + moduleName + '.hs';
    } while (runtimeScope.Module.FS.analyzePath(path).exists);
    signatureScope = { key: key, moduleName: moduleName, path: path };
  }
  const { moduleName, path } = signatureScope;
  writeTemporaryFile(path, [
    'module ' + moduleName + ' (matchesSignature) where',
    'import Prelude',
    'import qualified Prelude as P',
    'import qualified Data.Typeable as T',
    'import qualified ' + descriptor.moduleName + ' as Learner',
    'default ()',
    'matchesSignature :: Bool',
    'matchesSignature = T.typeOf Learner.' + signature.name +
      ' P.== T.typeOf (P.undefined :: ' + signature.type + ')',
  ].join('\n') + '\n');
  return { moduleName: moduleName, path: path };
}

function startRunTest(message) {
  const path = normalizeWorkspacePath(message.path);
  const descriptor = moduleDescriptor(path);
  const suppliedExpression = message.expression !== undefined
    ? message.expression
    : message.code;
  const expression = String(suppliedExpression || '').trim();
  if (!expression) throw new Error('runTest requires a Boolean Haskell expression');
  if (/\r|\n/.test(expression)) {
    throw new Error('runTest Boolean expressions must fit on one line');
  }
  checkAliasCycles(readWorkspaceFile(path), path, expression);

  let helper = null;
  if (message.signature) {
    if (typeof message.signature.type !== 'string' || !message.signature.type.trim() ||
        /\r|\n/.test(message.signature.type)) {
      throw new Error('Signature checks require a one-line monomorphic expected type');
    }
    if (!runtimeScope.SEBookHaskellSignatures.hasDeclaration(readWorkspaceFile(path), message.signature)) {
      throw new Error('An explicit top-level declaration for ' + message.signature.name + ' is required');
    }
    helper = signatureHelper(descriptor, message.signature);
  }

  const passMarker = markerFor('TEST_PASS', message.id);
  const failMarker = markerFor('TEST_FAIL', message.id);
  const checkedExpression = helper ? '(' + expression + ') && ' + helper.moduleName + '.matchesSignature' : expression;
  const testCommand =
    'if (' + checkedExpression + ') then ' + commandForMarker(passMarker) +
    ' else ' + commandForMarker(failMarker);

  startOperation(message, {
    kind: 'test',
    passMarker: passMarker,
    failMarker: failMarker,
    sourcePath: descriptor.sourcePath,
    imports: [
      'import ' + descriptor.moduleName,
      ...(helper ? ['import qualified ' + helper.moduleName] : []),
    ],
    commands: [testCommand],
    temporaryFile: helper && helper.path,
  });
}

/**
 * GETRAW is MicroHs's existing browser readline primitive. It uses Asyncify
 * while waiting for _set_input_char; ordinary Haskell getLine reads MEMFS
 * stdin (EOF), and threadDelay blocks this browser build instead of yielding.
 * The probe demands exactly WHNF, as its caller already did; it never shows
 * arguments or traverses a lazy result merely to populate debugger variables.
 */
function debugHelperSource(marker) {
  return [
    'module SEBookDebug (probe, ($)) where',
    'import System.IO.Unsafe (unsafePerformIO)',
    'import System.IO (hPutStrLn, hFlush, stdout, stderr)',
    'foreign import ccall "GETRAW" getDebugCommand :: IO Int',
    'pause event site = do',
    '  hFlush stdout',
    '  hPutStrLn stderr (' + JSON.stringify(marker) + ' ++ event ++ ":" ++ show site)',
    '  hFlush stderr',
    '  _ <- getDebugCommand',
    '  return ()',
    'probe :: Int -> a -> a',
    'probe site value = unsafePerformIO (do',
    '  pause "call" site',
    '  value `seq` pause "return" site',
    '  return value)',
    '',
  ].join('\n');
}

function prepareDebugFiles(message) {
  const files = Object.assign({}, message.files || {});
  files[message.filename] = message.code;
  const sites = [];
  const sourceMaps = new Map();
  Object.keys(files).forEach(function (filename) {
    const path = normalizeWorkspacePath(filename);
    if (path.endsWith('/SEBookDebug.hs')) {
      throw new Error('The Haskell debugger reserves the module name SEBookDebug.');
    }
    const value = files[filename];
    const source = typeof value === 'string' ? value : value.content;
    if (!path.endsWith('.hs')) { writeWorkspaceFile(path, source); return; }
    const result = runtimeScope.SEBookHaskellInstrument.instrument(source, path, sites.length);
    sites.push.apply(sites, result.sites);
    sourceMaps.set(path, result.lineMap);
    writeWorkspaceFile(path, result.code);
  });
  return { sites: sites, sourceMaps: sourceMaps };
}

function checkAliasCycles(source, filename, expression, options = {}) {
  const result = runtimeScope.SEBookHaskellCycles.analyze(source, {
    filename, expression, executeExpression: Boolean(options.executeExpression),
  });
  if (result.blocked) {
    throw new Error(result.diagnostics.filter(item => item.severity === 'error')
      .map(function (item) {
        const line = item.line - (item.filename === filename ? options.sourceLineOffset || 0 : 0);
        return item.filename + ':' + line + ':' + item.column + ': ' + item.message;
      }).join('\n'));
  }
}

function startDebug(message) {
  checkAliasCycles(message.code, message.filename);
  const prepared = prepareDebugFiles(message);
  const sites = prepared.sites;
  if (!sites.length) throw new Error('No supported Haskell equations were found to debug.');
  const path = normalizeWorkspacePath(message.filename);
  const descriptor = moduleDescriptor(path);
  const marker = markerFor('DEBUG', message.id);
  const doneMarker = markerFor('DONE', message.id);
  writeWorkspaceFile(descriptor.sourcePath + '/SEBookDebug.hs', debugHelperSource(marker));
  const debug = new runtimeScope.SEBookHaskellDebug.HaskellDebugSession({
    sites: sites, marker: marker, options: message.options,
    breakpoints: message.breakpoints, watches: message.watches,
    send: function (payload) {
      if (payload.type === 'paused' && activeOperation && activeOperation.debug === debug) {
        flushDebugOutput(activeOperation, false);
      }
      postProtocolMessage(payload);
    },
    resume: function () {
      if (activeOperation && activeOperation.debug === debug && !debug.finished) {
        runtimeScope.Module._set_input_char(10);
      }
    },
  });
  debug.mapDiagnostics = function (text) {
    return text.replace(/("([^"\n]+\.hs)": line\s+)(\d+)/g, function (match, prefix, file, line) {
      const path = file.startsWith('/') ? file : descriptor.sourcePath + '/' + file;
      const segments = [];
      path.split('/').forEach(function (part) {
        if (part === '..') segments.pop();
        else if (part && part !== '.') segments.push(part);
      });
      const lineMap = prepared.sourceMaps.get('/' + segments.join('/'));
      return lineMap && lineMap[Number(line)] ? prefix + lineMap[Number(line)] : match;
    });
  };
  const args = Array.isArray(message.args) ? message.args.map(String) : [];
  const main = descriptor.moduleName + '.main';
  const entry = args.length
    ? 'SEBookEnvironment.withArgs ' + JSON.stringify(args) + ' (' + main + ')'
    : main;
  const imports = ['import ' + descriptor.moduleName];
  if (args.length) imports.push('import qualified System.Environment as SEBookEnvironment');
  startOperation(message, {
    kind: 'debug', debug: debug, doneMarker: doneMarker, inlineCompletion: true,
    sourcePath: descriptor.sourcePath,
    imports: imports,
    commands: [entry + ' >> ' + commandForMarker('\\n' + doneMarker)],
  });
}

function debugStreamText(lines) {
  const visible = lines.slice();
  while (visible.length && visible[0] === '') visible.shift();
  return visible.join('\n');
}

function flushDebugOutput(operation, final) {
  const split = splitStdoutAndDiagnostics(operation);
  const output = final ? normalizeOperationOutput(operation) : {
    stdout: debugStreamText(split.stdout),
    stderr: operation.debug.mapDiagnostics(debugStreamText(appendNonemptyOutput(split.stderr, operation.rawStderr))),
  };
  ['stdout', 'stderr'].forEach(function (channel) {
    const published = operation.publishedDebugOutput[channel];
    // Final normalization removes trailing blank lines. Text already delivered
    // during a pause is retained; it must never be replayed or withdrawn.
    if (!output[channel].startsWith(published)) return;
    const delta = output[channel].slice(published.length);
    if (delta) postProtocolMessage({ type: channel, text: delta });
    operation.publishedDebugOutput[channel] = output[channel];
  });
}

function finishOperationAtPrompt(operation) {
  if (operation.isFinishing) return;
  // Match the complete prompt line, not the marker echoed inside :set.
  const completed = operation.promptCompletion && operation.stdoutLineBuffer === operation.doneMarker;
  const failedDebug = operation.debug && operation.failed && bootOutput.endsWith('> ');
  if (!completed && !failedDebug) return;
  operation.isFinishing = true;
  deferRuntimeTask(function () {
    // Output arrives byte by byte. A learner's longer output line may have
    // temporarily matched the prompt before its remaining bytes arrived.
    if (completed && operation.stdoutLineBuffer !== operation.doneMarker) {
      operation.isFinishing = false;
      return;
    }
    finishOperation(operation);
  });
}

function startRunCode(message) {
  throw new Error('runCode is not supported by the Haskell tutorial backend');
}

function finishOperation(operation) {
  if (activeOperation !== operation) return;
  if (operation.debug) {
    operation.rawStderr += operation.debug.stderrBuffer;
    operation.debug.stderrBuffer = '';
  }
  const output = normalizeOperationOutput(operation);
  // MicroHs may read a helper while processing its queued :delete import.
  // Delete its file only after the following operation has completed cleanup
  // and reload; removing it at its own marker can strand the next command.
  operation.cleanupFiles.forEach(removeTemporaryFile);
  const testFailed = operation.kind === 'test' &&
    (!operation.sawTestPass || operation.sawTestFail);
  const exitCode = operation.failed || testFailed ? 1 : 0;
  compiledScope = operation.failed ? null : operation.scope;
  compiledWorkspace = operation.failed ? null : operation.workspace;

  if (operation.debug) flushDebugOutput(operation, true);
  if (!operation.debug && !operation.silent && output.stdout) {
    postProtocolMessage({ type: 'stdout', text: output.stdout });
  }
  if (!operation.debug && !operation.silent && output.stderr) {
    postProtocolMessage({ type: 'stderr', text: output.stderr });
  }

  if (operation.debug) {
    operation.debug.complete(exitCode, exitCode ? output.stderr || 'Haskell execution failed.' : undefined, Boolean(output.stderr));
  } else postProtocolMessage({
    type: 'run_done',
    id: operation.id,
    exitCode: exitCode,
    stdout: output.stdout,
    stderr: output.stderr,
  });
  activeOperation = null;
  processNextMessage();
}

function normalizeOperationOutput(operation) {
  const output = splitStdoutAndDiagnostics(operation);
  const stderr = appendNonemptyOutput(output.stderr, operation.rawStderr);
  const normalized = { stdout: normalizeLines(output.stdout), stderr: normalizeLines(stderr) };
  if (operation.debug) normalized.stderr = operation.debug.mapDiagnostics(normalized.stderr);
  if (operation.mapDiagnostics) normalized.stderr = operation.mapDiagnostics(normalized.stderr);
  return normalized;
}

function splitStdoutAndDiagnostics(operation) {
  const stdoutLines = [];
  const stderrLines = [];
  let isDiagnostic = false;
  let canMatchBareFirstCommand = true;

  operation.rawStdout.replace(/\r/g, '').split('\n').forEach(function (line) {
    const parsedLine = removeInteractiveCommandEcho(
      line,
      operation.commands,
      canMatchBareFirstCommand
    );
    if (line !== '') canMatchBareFirstCommand = false;
    if (parsedLine.wasCommand) isDiagnostic = false;
    if (parsedLine.skip) return;

    const visibleLine = parsedLine.text;
    if (isInfrastructureLine(visibleLine, operation)) return;
    if (containsRuntimeFailure(visibleLine)) {
      operation.failed = true;
      isDiagnostic = true;
    }
    (isDiagnostic ? stderrLines : stdoutLines).push(visibleLine);
  });

  return { stdout: stdoutLines, stderr: stderrLines };
}

function removeInteractiveCommandEcho(line, commands, allowBareFirstCommand) {
  if (allowBareFirstCommand && line === commands[0]) {
    return { text: '', skip: true, wasCommand: true };
  }
  for (let index = 0; index < commands.length; index += 1) {
    const echoedCommand = '> ' + commands[index];
    if (line === echoedCommand) return { text: '', skip: true, wasCommand: true };
    if (line.endsWith(echoedCommand)) {
      return {
        text: line.slice(0, -echoedCommand.length),
        skip: false,
        wasCommand: true,
      };
    }
  }
  return { text: line, skip: false, wasCommand: false };
}

function isInfrastructureLine(line, operation) {
  const trimmedLine = line.trim();
  return trimmedLine === operation.doneMarker ||
    (operation.passMarker && trimmedLine === operation.passMarker) ||
    (operation.failMarker && trimmedLine === operation.failMarker) ||
    /^loaded\s+\S+\s+\(.+\)$/.test(trimmedLine) ||
    trimmedLine === '>';
}

function appendNonemptyOutput(lines, text) {
  const appendedLines = lines.slice();
  if (text) appendedLines.push.apply(appendedLines, text.replace(/\r/g, '').split('\n'));
  return appendedLines;
}

function normalizeLines(lines) {
  const normalizedLines = lines.slice();
  while (normalizedLines.length > 0 && normalizedLines[0] === '') normalizedLines.shift();
  while (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1] === '') {
    normalizedLines.pop();
  }
  return normalizedLines.length > 0 ? normalizedLines.join('\n') + '\n' : '';
}

function writeFileMessage(message) {
  try {
    const path = normalizeWorkspacePath(message.path);
    temporarySources.delete(path);
    writeWorkspaceFile(path, message.content || '');
    postProtocolMessage({ type: 'write_ok', id: message.id });
  } catch (error) {
    postProtocolMessage({ type: 'write_error', id: message.id, message: error.message });
  }
  processNextMessage();
}

function readFileMessage(message) {
  try {
    const path = normalizeWorkspacePath(message.path);
    const content = readWorkspaceFile(path);
    postProtocolMessage({ type: 'read_ok', id: message.id, content: content });
  } catch (error) {
    postProtocolMessage({ type: 'read_error', id: message.id, message: error.message });
  }
  processNextMessage();
}

function processNextMessage() {
  if (!isRuntimeReady || hasRuntimeFailed || activeOperation || pendingMessages.length === 0) {
    return;
  }

  const message = pendingMessages.shift();
  try {
    if (message.type === 'write') writeFileMessage(message);
    else if (message.type === 'read') readFileMessage(message);
    else if (message.type === 'run') startRun(message);
    else if (message.type === 'evaluate') startEvaluate(message);
    else if (message.type === 'start') startDebug(message);
    else if (message.type === 'runTest') startRunTest(message);
    else if (message.type === 'runCode') startRunCode(message);
    else rejectMessage(message, 'Unknown Haskell worker message: ' + message.type);
  } catch (error) {
    rejectMessage(message, error.message || String(error));
    processNextMessage();
  }
}

function interruptRuntime(message) {
  if (isRuntimeReady && runtimeScope.Module._set_input_char) {
    runtimeScope.Module._set_input_char(3);
  }
  postProtocolMessage({ type: 'interrupt_ok', id: message.id });
}

registerProtocolMessageHandler(function (message) {
  if (['command', 'breakpoints', 'watches'].includes(message.type)) {
    if (activeOperation && activeOperation.debug) activeOperation.debug.handleMessage(message);
    return;
  }
  if (message.type === 'interrupt') {
    interruptRuntime(message);
    return;
  }
  if (hasRuntimeFailed) {
    rejectMessage(message, 'MicroHs runtime is unavailable');
    return;
  }
  pendingMessages.push(message);
  processNextMessage();
});

if (!isWindowRuntime) {
  importScripts('/js/haskell/syntax.js');
  importScripts('/js/haskell/cycle-analysis.js');
  importScripts('/js/haskell/signature-checks.js');
  importScripts('/js/debugger/haskell/instrument.js', '/js/debugger/haskell/session.js');
}

postLoading('Loading Haskell runtime\u2026');

function configureMicroHsRuntime() {
  // Pinned Emscripten glue exposes Asyncify globally. Its 4 KiB default can
  // overflow when recursive Haskell probes suspend; size the continuation
  // before callMain allocates it, without changing the compiler/Wasm bundle.
  const continuation = runtimeScope.Asyncify;
  if (!continuation || continuation.StackSize !== 4096 || continuation.currData !== null) {
    throw new Error('Unexpected pinned MicroHs Asyncify state before main');
  }
  continuation.StackSize = 256 * 1024;

  // The pinned glue routes emscripten_sleep through this global hook. Preserve
  // its callback/error handling and real delays (including idle input polling);
  // only a zero-delay cooperative yield belongs on the runtime task queue.
  const scheduleTimer = runtimeScope.safeSetTimeout;
  const invokeCallback = runtimeScope.callUserCallback;
  if (typeof scheduleTimer !== 'function' || typeof invokeCallback !== 'function') {
    throw new Error('Unexpected pinned MicroHs scheduler before main');
  }
  runtimeScope.safeSetTimeout = function (callback, delay) {
    if (delay === 0) {
      deferRuntimeTask(function () { invokeCallback(callback); });
    } else {
      return scheduleTimer(callback, delay);
    }
  };
}

runtimeScope.Module = {
  arguments: RUNTIME_ARGUMENTS,
  onRuntimeInitialized: configureMicroHsRuntime,
  preRun: [function () {
    runtimeScope.Module.FS.init(
      function () { return null; },
      function (value) { appendRuntimeByte(value, 'stdout'); },
      function (value) { appendRuntimeByte(value, 'stderr'); }
    );
    runtimeScope.Module.FS.mkdirTree(WORKSPACE_ROOT);
    runtimeScope.Module.FS.chdir(WORKSPACE_ROOT);
  }],
  print: function (text) {
    appendRuntimeText(String(text) + '\n', 'stdout');
  },
  printErr: function (text) {
    appendRuntimeText(String(text) + '\n', 'stderr');
  },
  onAbort: function (reason) {
    failRuntime(reason || 'MicroHs aborted');
  },
};

function loadMicroHsBundle() {
  if (isWindowRuntime) {
    const runtimeScript = document.createElement('script');
    runtimeScript.src = MICROHS_BUNDLE_PATH;
    runtimeScript.async = true;
    runtimeScript.addEventListener('error', function () {
      failRuntime(new Error('Unable to load ' + MICROHS_BUNDLE_PATH));
    });
    document.head.appendChild(runtimeScript);
    return;
  }

  try {
    importScripts(MICROHS_BUNDLE_PATH);
  } catch (error) {
    failRuntime(error);
  }
}

if (isWindowRuntime) {
  runtimeScope.addEventListener('error', function (event) {
    failRuntime(event.error || event.message || 'Haskell runtime script error');
  });
  runtimeScope.addEventListener('unhandledrejection', function (event) {
    failRuntime(event.reason || 'Unhandled Haskell runtime rejection');
  });
}

loadMicroHsBundle();
