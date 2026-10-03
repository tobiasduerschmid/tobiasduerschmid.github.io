const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('js/smalltalk/protocol.js', 'utf8'), { window });
const api = window.SEBookSmalltalk;
const query = { kind: 'variableReferences', target: { kind: 'class', className: 'Counter', side: 'instance' }, variable: { kind: 'instance', name: 'count' }, offset: 0, limit: 100 };
test('variable-reference queries carry an explicit binding descriptor and a separate result filter', () => {
  assert.doesNotThrow(() => api.validateOperation('browse', { ...query, search: 'increment' }));
  assert.doesNotThrow(() => api.validateOperation('browse', { ...query, variable: { kind: 'class', name: 'Count' } }));
});
for (const [label, patch] of [['missing variable', { variable: undefined }], ['invalid variable kind', { variable: { kind: 'temporary', name: 'count' } }], ['missing name', { variable: { kind: 'instance' } }], ['non-class target', { target: { kind: 'package', packageName: 'Example' } }]]) {
  test('variable-reference boundary rejects ' + label, () => assert.throws(() => api.validateOperation('browse', { ...query, ...patch }), error => error.code === 'PRECONDITION_FAILED'));
}
