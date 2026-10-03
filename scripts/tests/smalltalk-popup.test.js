const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const program = { version: 1, stepKey: 'popup', revision: 0, files: [], changes: { version: 1, source: '', entries: [] }, runCommand: null };
const target = { kind: 'method', className: 'Counter', side: 'instance', selector: 'value' };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function fixture(request = async () => ({})) {
  const context = { window: {}, structuredClone, AbortController, crypto: webcrypto, console };
  for (const file of ['protocol', 'workspace', 'popup', 'refactorings']) vm.runInNewContext(fs.readFileSync('js/smalltalk/' + file + '.js', 'utf8'), context);
  const api = context.window.SEBookSmalltalk;
  let generation = 0;
  const runtime = { subscribe: () => () => {}, openSession: async () => ({ sessionId: 'session-' + ++generation, revision: 0 }),
    loadProgram: async () => {}, stopSession() {}, request };
  const workspace = await api.Workspace.create({ runtime, program });
  const connections = [];
  async function connect() {
    const { port1, port2 } = new MessageChannel();
    const sessionId = 'connection-' + connections.length;
    const closed = deferred();
    const owner = api.PopupWorkspaceOwner.serve({ port: port1, sessionId, workspace, onClose: closed.resolve });
    const remote = await api.PopupWorkspace.connect({ port: port2, sessionId });
    connections.push({ owner, remote }); return { owner, remote, closed: closed.promise };
  }
  return { api, context, workspace, connect, close() { connections.forEach(({ owner, remote }) => { owner.close(); remote.dispose(); }); workspace.dispose(); } };
}
test('draft delivery precedes Accept and a stale transaction retains exact source', async () => {
  const f = await fixture();
  try {
    const { remote } = await f.connect();
    remote.setDraft({ target, baseRevision: 0, source: 'value ^ 99' });
    await assert.rejects(remote.commit({ baseRevision: -1, action: 'acceptMethod', params: { target, source: 'value ^ 99' } }), { code: 'STALE_REVISION' });
    assert.equal(f.workspace.getDrafts()[0].source, 'value ^ 99');
    assert.equal(remote.getDrafts()[0].source, 'value ^ 99');
  } finally { f.close(); }
});
test('late inspection roots are released by their closing connection only', async () => {
  const started = deferred(), finish = deferred(), released = deferred();
  const releases = [];
  const f = await fixture(async (session, operation, payload) => {
    if (operation === 'evaluate') return { value: { handle: payload.source, text: 'object', className: 'Object' } };
    if (operation === 'inspect') { started.resolve(); return finish.promise; }
    if (operation === 'releaseHandles') { releases.push({ handles: Array.from(payload.handles), sessionId: session.sessionId }); if (payload.handles.includes('late-slot')) released.resolve(); return {}; }
    return {};
  });
  try {
    const first = await f.connect(), second = await f.connect();
    await second.remote.evaluate('other-connection');
    const pending = first.remote.inspect('root', 0, 20); const rejected = assert.rejects(pending, { code: 'CANCELLED' });
    await started.promise; first.owner.close(); await rejected;
    finish.resolve({ className: 'Array', slots: [{ name: '1', value: { handle: 'late-slot' } }], nextOffset: null });
    await released.promise;
    assert.deepEqual(releases, [{ handles: ['late-slot'], sessionId: 'session-1' }]);
    assert.equal((await second.remote.evaluate('still-live')).value.handle, 'still-live');
  } finally { f.close(); }
});
test('closing during native Prepare cancels the late token without canceling another connection', async () => {
  const started = deferred(), finish = deferred(), canceled = deferred(); const tokens = [];
  const f = await fixture(async (session, operation, payload) => {
    if (operation === 'prepareRefactoring' && payload.action === 'delayed') { started.resolve(); return finish.promise; }
    if (operation === 'prepareRefactoring') return { token: 'other-preview', baseRevision: 0 };
    if (operation === 'cancelRefactoring') { tokens.push(payload.token); canceled.resolve(); }
    return {};
  });
  try {
    const first = await f.connect(), second = await f.connect();
    await second.remote.refactoringQuery('prepareRefactoring', { action: 'other' });
    const pending = first.remote.refactoringQuery('prepareRefactoring', { action: 'delayed' });
    const rejected = assert.rejects(pending, { code: 'CANCELLED' });
    await started.promise; first.owner.close(); await rejected;
    finish.resolve({ token: 'late-preview', baseRevision: 0 }); await canceled.promise;
    assert.deepEqual(tokens, ['late-preview']);
  } finally { f.close(); }
});
test('queued cleanup uses the captured session after Restart, never a reused native token', async () => {
  const canceled = [], released = [];
  const f = await fixture(async (session, operation, payload) => {
    if (operation === 'evaluate') return { value: { handle: 'same-handle' } };
    if (operation === 'prepareRefactoring') return { token: 'same-token', baseRevision: 0 };
    if (operation === 'cancelRefactoring') canceled.push(session.sessionId);
    if (operation === 'releaseHandles') released.push(session.sessionId);
    return {};
  });
  try {
    const result = await f.workspace.evaluate('object');
    const refactorings = f.api.Refactorings.create(f.workspace);
    const preview = await refactorings.prepare({ action: 'renameMethod' });
    assert.equal(result.sessionId, 'session-1'); assert.equal(preview.sessionId, 'session-1');
    const restart = f.workspace.restart();
    const cancel = refactorings.cancel(preview);
    const release = f.workspace.releaseHandles([result.value.handle], { sessionId: result.sessionId });
    await Promise.all([restart, cancel, release]);
    assert.deepEqual(canceled, []); assert.deepEqual(released, []);
  } finally { f.close(); }
});
test('owner destruction settles every pending request and late replies cannot revive it', async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture(async () => { started.resolve(); return finish.promise; });
  try {
    const { remote } = await f.connect(); let disconnected = 0;
    remote.subscribe(event => { if (event.detail && event.detail.type === 'disconnected') disconnected++; });
    const first = remote.browse({ kind: 'packages', offset: 0, limit: 20 });
    const second = remote.browse({ kind: 'classes', offset: 0, limit: 20 });
    const firstRejected = assert.rejects(first, { code: 'CANCELLED' });
    const secondRejected = assert.rejects(second, { code: 'CANCELLED' });
    await started.promise;
    f.workspace.subscribe(event => { if (event.detail && event.detail.type === 'disposed') f.workspace.dispose(); });
    f.workspace.dispose(); f.workspace.dispose();
    await Promise.all([firstRejected, secondRejected]); finish.resolve({ items: [] });
    await assert.rejects(remote.browse({ kind: 'packages' }), { code: 'CANCELLED' });
    assert.equal(disconnected, 1);
  } finally { f.close(); }
});
test('owner events cannot replace a newer local draft while earlier edits are pending', async () => {
  const started = deferred(), finish = deferred(); let delayed = true;
  const f = await fixture(async () => { if (delayed) { delayed = false; started.resolve(); return finish.promise; } return { items: [] }; });
  try {
    const { remote } = await f.connect();
    const browsing = remote.browse({ kind: 'packages', offset: 0, limit: 20 }); await started.promise;
    remote.setDraft({ target, baseRevision: 0, source: 'value ^ 1' });
    remote.setDraft({ target, baseRevision: 0, source: 'value ^ 2' });
    const ownerEvent = deferred();
    const unsubscribe = remote.subscribe(event => { if (event.type === 'drafts') ownerEvent.resolve(); });
    f.workspace.setDraft({ target, baseRevision: 0, source: 'an unrelated older delivery' });
    await ownerEvent.promise; unsubscribe();
    assert.equal(remote.getDrafts()[0].source, 'value ^ 2');
    finish.resolve({ items: [] }); await browsing;
    await remote.browse({ kind: 'packages', offset: 0, limit: 20 });
    assert.equal(f.workspace.getDrafts()[0].source, 'value ^ 2');
    assert.equal(remote.getDrafts()[0].source, 'value ^ 2');
  } finally { f.close(); }
});
test('only the registered same-origin popup receives a current owner capability', async () => {
  const f = await fixture(); const listeners = new Map(), transferred = [];
  const popup = { closed: false, postMessage(message, origin, ports) { transferred.push({ message, port: ports[0] }); }, focus() {} };
  const window = f.context.window;
  Object.assign(window, { location: { pathname: '/fixture', origin: 'https://example.test' }, crypto: webcrypto,
    open: () => popup, addEventListener: (type, handler) => listeners.set(type, handler), BroadcastChannel: function () {} });
  Object.assign(f.context, { MessageChannel, BroadcastChannel: class { addEventListener() {} postMessage() {} },
    document: { activeElement: null, documentElement: { classList: { contains: () => false } } },
    sessionStorage: { getItem: () => null, setItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 0, setTimeout: () => 0 });
  vm.runInNewContext(fs.readFileSync('js/tutorial-popout-manager.js', 'utf8'), f.context);
  const manager = new window.TutorialPopoutManager({ hooks: { getSmalltalkWorkspace: () => f.workspace } });
  try {
    manager.init(); manager.detachPane('smalltalk', {});
    const data = { type: 'smalltalk-connect', role: 'pane:smalltalk', sessionId: manager.sessionId, nonce: 'popup-request' };
    const receive = listeners.get('message');
    receive({ data, source: popup, origin: 'https://other.test' });
    receive({ data, source: {}, origin: window.location.origin });
    receive({ data: { ...data, sessionId: 'stale-session' }, source: popup, origin: window.location.origin });
    assert.equal(transferred.length, 0);
    receive({ data, source: popup, origin: window.location.origin });
    assert.equal(transferred.length, 1);
    const remote = await f.api.PopupWorkspace.connect({ port: transferred[0].port, sessionId: transferred[0].message.sessionId });
    assert.equal(remote.snapshot().stepKey, 'popup');
    manager.disconnectSmalltalk();
    await assert.rejects(remote.browse({ kind: 'packages', offset: 0, limit: 20 }), { code: 'CANCELLED' });
    remote.dispose();
  } finally { manager.disconnectSmalltalk(); f.close(); }
});

for (const operation of ['evaluate', 'inspect']) test(`closing during ${operation} preserves received drafts without running queued Accept`, async () => {
  const started = deferred(), finish = deferred(); const operations = [];
  const f = await fixture(async (session, name) => {
    operations.push(name); started.resolve(); return finish.promise;
  });
  try {
    const connection = await f.connect(), remote = connection.remote;
    const pending = operation === 'evaluate' ? remote.evaluate('slow') : remote.inspect('object', 0, 20);
    const canceled = assert.rejects(pending, { code: 'CANCELLED' });
    await started.promise;
    remote.setDraft({ target, baseRevision: 0, source: 'value ^ 98' });
    const draft = { target, baseRevision: 0, source: 'value\n "😀 recover me"\n ^ 99' };
    remote.setDraft(draft);
    const accept = assert.rejects(remote.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: draft.source } }), { code: 'CANCELLED' });
    remote.dispose(); await connection.closed; await Promise.all([canceled, accept]);
    assert.deepEqual(structuredClone(f.workspace.getDrafts()), [draft]);
    finish.resolve(operation === 'evaluate' ? { value: null } : { slots: [] });
    // A fresh owner's query fences completion of its previously submitted work.
    await f.workspace.browse({ kind: 'packages', offset: 0, limit: 20 });
    assert.deepEqual(operations, [operation, 'browse']);
    assert.equal(f.workspace.snapshot().revision, 0);
    assert.deepEqual(structuredClone(f.workspace.getDrafts()), [draft]);
  } finally { finish.resolve({ slots: [], value: null }); f.close(); }
});

test('draft draining stops immediately if its observer disposes the owner', async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture(async () => { started.resolve(); return finish.promise; });
  try {
    const connection = await f.connect();
    const canceled = assert.rejects(connection.remote.evaluate('slow'), { code: 'CANCELLED' });
    await started.promise;
    const first = { target, baseRevision: 0, source: 'value ^ 1' };
    f.workspace.subscribe(event => { if (event.type === 'drafts') f.workspace.dispose(); });
    connection.remote.setDraft(first);
    connection.remote.setDraft({ target, baseRevision: 0, source: 'value ^ 2' });
    connection.remote.dispose(); await connection.closed; await canceled;
    assert.deepEqual(structuredClone(f.workspace.getDrafts()), [first]);
    finish.resolve({ value: null });
    await assert.rejects(f.workspace.browse({ kind: 'packages', offset: 0, limit: 20 }), { code: 'CANCELLED' });
    assert.deepEqual(structuredClone(f.workspace.getDrafts()), [first]);
  } finally { finish.resolve({ value: null }); f.close(); }
});
