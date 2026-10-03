const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function api() {
  const context = { window: { SEBookSmalltalk: {} }, structuredClone };
  for (const name of ['protocol', 'fresh-runner', 'progress', 'tutorial-adapter']) vm.runInNewContext(fs.readFileSync('js/smalltalk/' + name + '.js', 'utf8'), context);
  return context.window.SEBookSmalltalk;
}
const program = (stepKey = 'counter') => ({ version: 1, stepKey, revision: 4,
  files: [{ path: 'Counter.st', kind: 'source', format: 'filein', content: 'starter' }],
  changes: { version: 1, source: 'native generated definitions and removal output', entries: [
    { entity: { kind: 'method', className: 'Counter', side: 'class', selector: 'obsolete' }, before: 'obsolete ^ 1', after: null },
  ] }, runCommand: 'Counter run' });
const draft = () => ({ target: { kind: 'method', className: 'Counter', side: 'instance', selector: 'increment', protocol: 'accessing' }, baseRevision: 4, source: 'increment ^ ) invalidSource' });
const workspace = (p = program(), drafts = [draft()]) => ({ snapshot: () => p, getDrafts: () => drafts });
const json = value => JSON.parse(JSON.stringify(value));

test('reload restores accepted code separately from an invalid draft', () => {
  const a = api(); const acceptedChanges = program().changes.source; const invalidSource = draft().source;
  const encoded = a.encodeProgress(workspace(), null);
  const restored = a.decodeProgress(encoded, program(), {});
  assert.equal(restored.program.changes.source, acceptedChanges);
  assert.equal(restored.drafts[0].source, invalidSource);
  assert.deepEqual(json(restored.program.changes.entries), program().changes.entries);
  assert.deepEqual(json(restored.warnings), []);
});
test('save preserves other stable step keys and does not mutate the previous record', () => {
  const a = api(); const previous = a.encodeProgress(workspace(program('other')), null); const before = json(previous);
  const encoded = a.encodeProgress(workspace(), previous);
  assert.deepEqual(json(previous), before);
  assert.deepEqual(Object.keys(encoded.steps).sort(), ['counter', 'other']);
  assert.equal(a.decodeProgress(encoded, program('other'), {}).program.stepKey, 'other');
});
test('generated source files survive independently of declared starter paths', () => {
  const a = api(); const accepted = program(); accepted.files.push({ path: 'Generated.st', kind: 'source', format: 'filein', content: 'generated native source' });
  const decoded = a.decodeProgress(a.encodeProgress(workspace(accepted), null), program(), {});
  assert.equal(decoded.program.files[1].content, 'generated native source');
});
test('only source, revision and drafts serialize, never live runtime state or native handles', () => {
  const a = api(); const accepted = { ...program(), image: 'image bytes', handles: ['handle'], checkpoint: 'private', undoHistory: ['old image'] };
  accepted.changes.entries[0].entity.handle = 'private handle';
  const dirtyDraft = { ...draft(), liveObject: { handle: 'private' } };
  const encoded = json(a.encodeProgress(workspace(accepted, [dirtyDraft]), null));
  assert.deepEqual(Object.keys(encoded.steps.counter.program).sort(), ['changes', 'files', 'revision', 'runCommand', 'stepKey', 'version']);
  assert.deepEqual(Object.keys(encoded.steps.counter.drafts[0]).sort(), ['baseRevision', 'source', 'target']);
  assert.equal(JSON.stringify(encoded).includes('private'), false);
});
test('legacy changed files migrate as unaccepted drafts without replacing starter or adding completion credit', () => {
  const a = api(); const starter = program(); starter.changes = { version: 1, source: '', entries: [] }; starter.revision = 0;
  const decoded = a.decodeProgress(null, starter, { 'Counter.st': { content: ') invalid legacy file' }, 'other-step.st': { content: 'elsewhere' } });
  assert.equal(decoded.program.files[0].content, 'starter');
  assert.equal(decoded.program.changes.source, '');
  assert.deepEqual(json(decoded.drafts), [{ target: { kind: 'file', path: 'Counter.st' }, baseRevision: 0, source: ') invalid legacy file' }]);
  assert.equal('stepsPassed' in decoded, false);
});
for (const [name, change] of [
  ['unsupported version', value => { value.version = 99; }],
  ['invalid revision', value => { value.steps.counter.program.revision = -1; }],
  ['wrong step identity', value => { value.steps.counter.program.stepKey = 'other'; }],
  ['escaping source path', value => { value.steps.counter.program.files[0].path = '../outside.st'; }],
  ['invalid change bundle', value => { value.steps.counter.program.changes.version = 2; }],
]) test(name + ' falls back to starter but retains recoverable drafts with a warning', () => {
  const a = api(); const value = json(a.encodeProgress(workspace(), null)); change(value);
  const starter = program(); starter.revision = 0; starter.changes = { version: 1, source: '', entries: [] };
  const restored = a.decodeProgress(value, starter, {});
  assert.equal(restored.program.revision, 0);
  assert.equal(restored.program.changes.source, '');
  assert.equal(restored.drafts[0].source, draft().source);
  assert.ok(restored.warnings.length > 0);
});
test('malformed drafts are reported without dropping the other valid draft', () => {
  const a = api(); const value = json(a.encodeProgress(workspace(), null));
  value.steps.counter.drafts.push({ ...draft(), baseRevision: -1 }, { ...draft(), target: { kind: 'unknown' } });
  const restored = a.decodeProgress(value, program(), {});
  assert.equal(restored.drafts.length, 1); assert.equal(restored.drafts[0].source, draft().source);
  assert.ok(restored.warnings.length > 0);
});
test('an absent step restores its starter while other saved steps remain independent', () => {
  const a = api(); const value = a.encodeProgress(workspace(program('other')), null);
  const restored = a.decodeProgress(value, program(), {});
  assert.equal(restored.program.stepKey, 'counter'); assert.equal(restored.drafts.length, 0);
});
test('current authored Run entry is used after restoration of accepted source', () => {
  const a = api(); const value = a.encodeProgress(workspace(), null); const starter = program(); starter.runCommand = null;
  assert.equal(a.decodeProgress(value, starter, {}).program.runCommand, null);
});
test('saving another step cannot promote an unsupported prior record into accepted code', () => {
  const a = api(); const previous = json(a.encodeProgress(workspace(program('other')), null)); previous.version = 99;
  previous.steps.other.program.image = 'private image'; previous.steps.other.drafts[0].target.handle = 'private handle';
  const saved = a.encodeProgress(workspace(), previous);
  const starter = program('other'); starter.changes = { version: 1, source: '', entries: [] };
  const decoded = a.decodeProgress(saved, starter, {});
  assert.equal(decoded.program.changes.source, '');
  assert.equal(decoded.drafts[0].source, draft().source);
  assert.ok(decoded.warnings.length > 0);
  assert.equal(JSON.stringify(saved).includes('private'), false);
});
test('unvisited valid records also strip runtime extras while preserving their accepted code', () => {
  const a = api(); const previous = json(a.encodeProgress(workspace(program('other')), null));
  previous.steps.other.checkpoint = 'private checkpoint'; previous.steps.other.program.files[0].handle = 'private handle';
  const saved = a.encodeProgress(workspace(), previous);
  assert.equal(saved.steps.other.program.changes.source, program().changes.source);
  assert.equal(JSON.stringify(saved).includes('private'), false);
});

function absoluteStarter(a) {
  return a.normalizeProgram({ stepKey: 'counter', files: [{ path: '/tutorial/Counter.st', content: 'starter', language: 'smalltalk' }] });
}
test('authored absolute legacy paths become canonical drafts and identify the original migrated key', () => {
  const a = api();
  const restored = a.decodeProgress(null, absoluteStarter(a), { '/tutorial/Counter.st': { content: ') original learner source' } });
  assert.deepEqual(json(restored.drafts), [{ target: { kind: 'file', path: 'Counter.st' }, baseRevision: 0, source: ') original learner source' }]);
  assert.deepEqual(json(restored.migratedLegacyFiles), { '/tutorial/Counter.st': ') original learner source' });
  const encoded = a.encodeProgress(workspace(restored.program, restored.drafts), null);
  assert.deepEqual(Object.keys(encoded.steps.counter).sort(), ['drafts', 'program']);
});
test('conflicting aliases prefer canonical text and preserve other versions with a named warning', () => {
  const a = api(); const files = { '/tutorial/Counter.st': { content: 'absolute edit' }, 'Counter.st': { content: 'canonical edit' }, './Counter.st': { content: 'canonical edit' } };
  const restored = a.decodeProgress(null, absoluteStarter(a), files);
  assert.equal(restored.drafts[0].source, 'canonical edit');
  assert.deepEqual(json(restored.migratedLegacyFiles), { 'Counter.st': 'canonical edit', './Counter.st': 'canonical edit' });
  assert.match(restored.warnings.join(' '), /Counter\.st/); assert.match(restored.warnings.join(' '), /\/tutorial\/Counter\.st/);
  assert.match(restored.warnings.join(' '), /original progress record for export/);
  const extension = a.encodeProgress(workspace(restored.program, restored.drafts), null);
  const reloaded = a.decodeProgress(extension, absoluteStarter(a), { '/tutorial/Counter.st': files['/tutorial/Counter.st'] });
  assert.equal(reloaded.drafts[0].source, 'canonical edit');
  assert.match(reloaded.warnings.join(' '), /\/tutorial\/Counter\.st/);
  assert.deepEqual(json(reloaded.migratedLegacyFiles), {});
});
test('alias selection without a canonical key is stable and unrelated or unsafe keys are not migrated', () => {
  const a = api(); const files = { '/tutorial/Counter.st': { content: 'absolute edit' }, './Counter.st': { content: 'relative edit' }, '../Counter.st': { content: 'unsafe' }, 'Elsewhere.st': { content: 'other step' } };
  const first = a.decodeProgress(null, absoluteStarter(a), files);
  const reversed = a.decodeProgress(null, absoluteStarter(a), Object.fromEntries(Object.entries(files).reverse()));
  assert.equal(first.drafts[0].source, 'relative edit'); assert.equal(reversed.drafts[0].source, first.drafts[0].source);
  assert.deepEqual(json(first.migratedLegacyFiles), { './Counter.st': 'relative edit' });
});
async function twoStepAdapter() {
  const a = api();
  // This double models only the Workspace's source/draft persistence boundary.
  // Native compilation, reset, and visible preference ownership are covered by
  // the real-image multi-step journey; no native response is simulated here.
  a.Workspace = { async create({ program, drafts }) {
    const savedDrafts = structuredClone(drafts);
    return { snapshot: () => structuredClone(program), getDrafts: () => structuredClone(savedDrafts),
      setDraft: value => savedDrafts.push(structuredClone(value)), subscribe: () => () => {}, dispose() {} };
  } };
  const adapter = new a.TutorialAdapter({}, { stop() {} }, () => {});
  const step = key => ({ key, files: [{ path: 'Counter.st', content: 'starter', language: 'smalltalk' }] });
  await adapter.loadStep(step('first'));
  adapter.getWorkspace().setDraft({ target: { kind: 'file', path: 'Counter.st' }, source: 'learner first draft', baseRevision: 0 });
  await adapter.loadStep(step('second'));
  return { a, adapter, step };
}
test('explicit deletion removes remembered steps from future serialization and revisits', async () => {
  const { adapter, step } = await twoStepAdapter();
  adapter.clearSavedProgress();
  assert.deepEqual(Object.keys(adapter.encodeProgress(null).steps), ['second']);
  await adapter.loadStep(step('first'));
  assert.deepEqual(json(adapter.getWorkspace().getDrafts()), []);
});
test('ordinary session retention preserves remembered work when no deletion is requested', async () => {
  const { adapter, step } = await twoStepAdapter();
  assert.equal(adapter.encodeProgress(null).steps.first.drafts[0].source, 'learner first draft');
  await adapter.loadStep(step('first'));
  assert.equal(adapter.getWorkspace().getDrafts()[0].source, 'learner first draft');
});
