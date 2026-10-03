const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function workspaceAPI() {
  const context = { window: {}, structuredClone, AbortController };
  vm.runInNewContext(fs.readFileSync('js/smalltalk/protocol.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/smalltalk/workspace.js', 'utf8'), context);
  return context.window.SEBookSmalltalk;
}
test('draft identity is semantic and remains independent of accepted source', () => {
  const api = workspaceAPI();
  const a = { kind: 'method', className: 'Counter', selector: 'value', side: 'instance', protocol: 'old' };
  const b = { ...a, protocol: 'new' };
  assert.equal(api.entityKey(a), api.entityKey(b));
  assert.equal(api.entityKey(a), api.entityKey({ ...a, packageName: 'Moved' }));
  assert.notEqual(api.entityKey(a), api.entityKey({ ...a, side: 'class' }));
});
const program = { version: 1, stepKey: 'drafts', revision: 3, files: [{ path: '/example.st', kind: 'source', format: 'filein', content: 'accepted' }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
const target = { kind: 'method', className: 'Counter', side: 'instance', selector: 'value' };
async function draftWorkspace() {
  const api = workspaceAPI();
  const runtime = { subscribe: () => () => {}, openSession: async () => ({ role: 'live', sessionId: 'test', revision: 3 }), loadProgram: async () => {}, stopSession: () => {} };
  return api.Workspace.create({ runtime, program });
}
test('editing and reverting a draft never changes accepted files or revision', async () => {
  const workspace = await draftWorkspace();
  workspace.setDraft({ target, baseRevision: 3, source: 'unfinished ^ )' });
  assert.equal(workspace.snapshot().revision, 3);
  assert.equal(workspace.snapshot().files[0].content, 'accepted');
  assert.equal(workspace.getDrafts()[0].source, 'unfinished ^ )');
  workspace.revertDraft(target);
  assert.equal(workspace.getDrafts().length, 0);
  assert.equal(workspace.snapshot().files[0].content, 'accepted');
});
test('snapshots and drafts cannot be changed through caller-owned references', async () => {
  const workspace = await draftWorkspace();
  const draft = { target: { ...target }, baseRevision: 3, source: 'value ^ 2' };
  workspace.setDraft(draft); draft.source = 'mutated';
  workspace.snapshot().files[0].content = 'mutated';
  workspace.getDrafts()[0].source = 'mutated';
  assert.equal(workspace.snapshot().files[0].content, 'accepted');
  assert.equal(workspace.getDrafts()[0].source, 'value ^ 2');
});
test('a stale mutation rejects before transport and preserves its draft', async () => {
  const workspace = await draftWorkspace();
  workspace.setDraft({ target, baseRevision: 2, source: 'value ^ 9' });
  await assert.rejects(workspace.commit({ baseRevision: 2, action: 'acceptMethod', params: { target, source: 'value ^ 9' } }), { code: 'STALE_REVISION' });
  assert.equal(workspace.snapshot().revision, 3);
  assert.equal(workspace.getDrafts()[0].source, 'value ^ 9');
});
test('an observer failure cannot interrupt accepted state or other subscribers', async () => {
  const workspace = await draftWorkspace();
  let notified = false;
  workspace.subscribe(() => { throw new Error('view failure'); });
  workspace.subscribe(() => { notified = true; });
  assert.doesNotThrow(() => workspace.setDraft({ target, baseRevision: 3, source: 'value ^ 2' }));
  assert.equal(notified, true);
  assert.equal(workspace.getDrafts()[0].source, 'value ^ 2');
});
