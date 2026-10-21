/**
 * Adapts the pinned basedpyright language server to UML member types.
 *
 * createClient({ workerURL?, timeoutMs? }) returns { infer(sources), dispose() }.
 * infer({ 'main.py': source }) resolves to
 * { 'main.py': { 'Outer.Inner': { attributes: { name: 'str' }, returns: { get: 'str' } } } }.
 * Unknown/Any types are omitted. Requests are serialized and source snapshots
 * stay in the worker's memory; learner code is never executed or uploaded.
 */
(function (global) {
  'use strict';

  const WORKER_PATH = '/js/vendor/browser-basedpyright/1.40.2/pyright.worker.js';
  const WORKER_SHA256 = '59e01c8e13db9ea4ce2107b6341915ed57987385fc5d116d85ec06dea7ea892b';
  const DEFAULT_TIMEOUT_MS = 30000;
  const CLASS_KIND = 5;
  const METHOD_KINDS = new Set([6, 12]);
  const ATTRIBUTE_KINDS = new Set([7, 8, 13, 14]);

  function knownType(type) {
    if (!type) return '';
    // Ignore words inside Literal strings when recognizing unresolved types.
    const typeNames = type.replace(/(['"])(?:\\.|(?!\1).)*\1/g, '');
    if (/\b(?:Unknown|Any|Unbound)\b|\w@/.test(typeNames)) return '';
    const trimmed = type.trim();
    // The checker may parenthesize a union to separate it from a signature.
    return /^\([^()]*\)$/.test(trimmed) ? trimmed.slice(1, -1) : trimmed;
  }

  function returnType(type) {
    if (type.startsWith('Overload[')) return '';
    // A property read has the getter's value type rather than a signature.
    if (!type.startsWith('(')) return knownType(type);
    let depth = 1;
    let quote = '';
    // Find the method's closing parameter list, not a nested Callable arrow.
    for (let index = 1; index < type.length; index++) {
      const character = type[index];
      if (quote) {
        if (character === '\\') index++;
        else if (character === quote) quote = '';
      } else if (character === "'" || character === '"') quote = character;
      else if (character === '(') depth++;
      else if (character === ')' && --depth === 0) {
        const result = type.slice(index + 1).match(/^\s*->\s*([\s\S]+)$/);
        return knownType(result && result[1]);
      }
    }
    return '';
  }

  function sourceURI(filename) {
    const segments = filename.replace(/\\/g, '/').split('/');
    if (segments.some(segment => segment === '..')) throw new Error('Python source filenames must stay inside the workspace.');
    return 'file:///sebook/' + segments.filter(segment => segment && segment !== '.').map(encodeURIComponent).join('/');
  }

  function collectClasses(symbols, parentPath = '') {
    const classes = [];
    for (const symbol of symbols || []) {
      if (symbol.kind !== CLASS_KIND) continue;
      const path = parentPath ? parentPath + '.' + symbol.name : symbol.name;
      const children = symbol.children || [];
      classes.push({ path, attributes: children.filter(child => ATTRIBUTE_KINDS.has(child.kind)),
        methods: children.filter(child => METHOD_KINDS.has(child.kind)) });
      classes.push(...collectClasses(children, path));
    }
    return classes;
  }

  function memberReadProbes(source, classes) {
    let prefix = '__sebook_uml_type_probe';
    while (source.includes(prefix)) prefix += '_';
    const lines = (source + '\n\n').split('\n');
    const revealName = prefix + '_reveal';
    lines.push('from typing import reveal_type as ' + revealName);
    const probes = [];
    classes.forEach((classInfo, index) => {
      const members = new Map();
      for (const member of classInfo.attributes) members.set(member.name, 'attributes');
      for (const member of classInfo.methods) members.set(member.name, 'returns');
      if (!members.size) return;
      lines.push('def ' + prefix + index + '(value: ' + classInfo.path + '):');
      for (const [name, kind] of members) {
        // A fresh receiver has no assignment-site narrowing. reveal_type
        // expands aliases too, so an alias cannot hide Any or Unknown.
        const line = lines.length;
        lines.push('    ' + revealName + '(value.' + name + ')');
        probes.push({ classPath: classInfo.path, name, kind, line });
      }
      lines.push('');
    });
    return { text: lines.join('\n'), probes };
  }

  async function verifiedWorkerURL(url, timeoutMs, controller) {
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error('Unable to load the Python type inference library.');
      const bytes = await response.arrayBuffer();
      const digest = await global.crypto.subtle.digest('SHA-256', bytes);
      const actual = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      if (actual !== WORKER_SHA256) throw new Error('Python type inference library integrity check failed.');
      return URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Python type inference library loading was cancelled or timed out.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  class TypeClient {
    constructor(options) {
      this.workerURL = options.workerURL || WORKER_PATH;
      this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
      this.workers = new Set();
      this.pending = new Map();
      this.pendingDiagnostics = new Map();
      this.documents = new Map();
      this.nextRequest = 1;
      this.version = 0;
      this.queue = Promise.resolve();
      this.ready = null;
      this.disposed = false;
      this.failure = null;
      this.blobURL = null;
      this.loaderAbort = new AbortController();
    }

    infer(sources) {
      // Snapshot immediately: editing while another request runs cannot mutate
      // the queued request or mix two workspaces' member types.
      const snapshot = Object.fromEntries(Object.entries(sources).map(([filename, source]) => [filename, String(source)]));
      const operation = this.queue.then(() => this.inferSnapshot(snapshot));
      this.queue = operation.catch(() => {});
      return operation;
    }

    async start() {
      if (this.disposed) throw new Error('Python type inference client has been disposed.');
      if (this.failure) throw this.failure;
      if (!this.ready) this.ready = this.initialize().catch(error => {
        this.fail(error);
        throw error;
      });
      return this.ready;
    }

    async initialize() {
      this.blobURL = await verifiedWorkerURL(this.workerURL, this.timeoutMs, this.loaderAbort);
      if (this.disposed) {
        URL.revokeObjectURL(this.blobURL);
        throw new Error('Python type inference client has been disposed.');
      }
      this.worker = this.spawnWorker();
      this.worker.onmessage = event => this.handleMessage(event.data);
      this.worker.postMessage({ type: 'browser/boot', mode: 'foreground' });
      await this.request('initialize', {
        processId: null,
        locale: 'en',
        rootUri: 'file:///sebook',
        workspaceFolders: [{ uri: 'file:///sebook', name: 'SEBook Python' }],
        capabilities: { textDocument: {
          documentSymbol: { hierarchicalDocumentSymbolSupport: true }
        } },
        initializationOptions: { files: {} }
      });
      this.notify('initialized', {});
    }

    spawnWorker() {
      const worker = new Worker(this.blobURL);
      this.workers.add(worker);
      worker.onerror = event => this.fail(new Error(event.message || 'Python type inference worker failed.'));
      worker.onmessageerror = () => this.fail(new Error('Python type inference worker returned an unreadable message.'));
      return worker;
    }

    handleMessage(message) {
      if (this.disposed || this.failure) return;
      if (message.type === 'browser/newWorker') {
        const worker = this.spawnWorker();
        worker.postMessage({ type: 'browser/boot', mode: 'background', initialData: message.initialData, port: message.port }, [message.port]);
        return;
      }
      if (message.method && message.id !== undefined) {
        const result = message.method === 'workspace/configuration' ? message.params.items.map(() => ({})) : null;
        this.worker.postMessage({ jsonrpc: '2.0', id: message.id, result });
        return;
      }
      if (message.method === 'textDocument/publishDiagnostics') {
        const diagnostics = this.pendingDiagnostics.get(message.params.uri);
        if (diagnostics && diagnostics.version === message.params.version) {
          clearTimeout(diagnostics.timer);
          this.pendingDiagnostics.delete(message.params.uri);
          diagnostics.resolve(message.params.diagnostics || []);
        }
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return; // Diagnostic/log notifications are not UML results.
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    }

    request(method, params) {
      if (this.failure) return Promise.reject(this.failure);
      const id = this.nextRequest++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => this.fail(new Error('Python type inference timed out.')), this.timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ jsonrpc: '2.0', id, method, params });
      });
    }

    notify(method, params) {
      this.worker.postMessage({ jsonrpc: '2.0', method, params });
    }

    updateDocument(uri, text) {
      const version = ++this.version;
      if (this.documents.has(uri)) {
        this.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text }] });
      } else {
        this.notify('pyright/createFile', { uri });
        this.notify('textDocument/didOpen', { textDocument: { uri, version, languageId: 'python', text } });
      }
      this.documents.set(uri, text);
      return version;
    }

    waitForDiagnostics(uri, version) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => this.fail(new Error('Python type inference timed out.')), this.timeoutMs);
        this.pendingDiagnostics.set(uri, { version, resolve, reject, timer });
      });
    }

    synchronizeSources(sources) {
      const current = new Set(Object.keys(sources).map(sourceURI));
      for (const uri of this.documents.keys()) {
        if (current.has(uri)) continue;
        this.notify('textDocument/didClose', { textDocument: { uri } });
        this.notify('pyright/deleteFile', { uri });
        this.documents.delete(uri);
      }
      for (const [filename, source] of Object.entries(sources)) this.updateDocument(sourceURI(filename), source);
    }

    async inferSnapshot(sources) {
      await this.start();
      this.synchronizeSources(sources);
      const files = [];
      for (const [filename, source] of Object.entries(sources)) {
        const uri = sourceURI(filename);
        const symbols = await this.request('textDocument/documentSymbol', { textDocument: { uri } });
        const classes = collectClasses(symbols);
        files.push({ filename, uri, classes, ...memberReadProbes(source, classes) });
      }
      // Load every snapshot before any semantic query, so imports see the
      // current supplied files rather than the preceding edit's contents.
      for (const file of files) {
        const version = this.updateDocument(file.uri, file.text);
        file.diagnostics = file.probes.length ? this.waitForDiagnostics(file.uri, version) : Promise.resolve([]);
      }
      const result = Object.create(null);
      // Attach every rejection handler now, including for later files whose
      // waiters can fail together when a worker is disposed or times out.
      const diagnostics = await Promise.all(files.map(file => file.diagnostics));
      files.forEach((file, index) => { result[file.filename] = this.readMemberTypes(file, diagnostics[index]); });
      return result;
    }

    readMemberTypes(file, diagnostics) {
      const classes = Object.create(null);
      for (const classInfo of file.classes) {
        classes[classInfo.path] = { attributes: Object.create(null), returns: Object.create(null) };
      }
      const revealed = new Map();
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity !== 3) continue;
        const match = diagnostic.message.match(/^Type of "value\.([^"]+)" is "([\s\S]+)"$/);
        if (match) revealed.set(diagnostic.range.start.line, { name: match[1], type: match[2] });
      }
      for (const probe of file.probes) {
        const value = revealed.get(probe.line);
        if (!value || value.name !== probe.name) continue;
        const type = probe.kind === 'returns' ? returnType(value.type)
          : /^(?:\(|Overload\[)/.test(value.type) ? '' : knownType(value.type);
        if (type) classes[probe.classPath][probe.kind][probe.name] = type;
      }
      return classes;
    }

    fail(error) {
      this.failure = error;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      for (const diagnostics of this.pendingDiagnostics.values()) {
        clearTimeout(diagnostics.timer);
        diagnostics.reject(error);
      }
      this.pendingDiagnostics.clear();
      this.stopWorkers();
    }

    stopWorkers() {
      this.loaderAbort.abort();
      for (const worker of this.workers) worker.terminate();
      this.workers.clear();
      if (this.blobURL) URL.revokeObjectURL(this.blobURL);
      this.blobURL = null;
    }

    dispose() {
      this.disposed = true;
      this.fail(new Error('Python type inference client has been disposed.'));
      this.documents.clear();
    }
  }

  const api = { createClient: (options = {}) => new TypeClient(options) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.UMLPythonTypes = api;
})(typeof self !== 'undefined' ? self : globalThis);
