const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTree } = require('../../js/tutorial-file-tree.js');

function child(node, name) {
  const found = node.children.find(entry => entry.name === name);
  assert.ok(found, `${node.path || '(root)'} should contain ${name}`);
  return found;
}

test('buildTree nests services/opc/partners/glamping_co.py under three folders', () => {
  const root = buildTree(['services/opc/partners/glamping_co.py', 'scenario.py']);

  const services = child(root, 'services');
  const opc = child(services, 'opc');
  const partners = child(opc, 'partners');
  const file = child(partners, 'glamping_co.py');

  assert.deepEqual(
    [services, opc, partners].map(folder => [folder.type, folder.path]),
    [['folder', 'services'], ['folder', 'services/opc'], ['folder', 'services/opc/partners']],
  );
  assert.equal(file.type, 'file');
  assert.equal(file.path, 'services/opc/partners/glamping_co.py', 'a file node keeps the exact path it opens');
  assert.deepEqual(file.children, []);
});

test('folders sort before files, each group alphabetically', () => {
  const root = buildTree([
    'scenario.py', 'README.md', 'notes.md', 'services/opc/orders.py',
    'deploy/broker.toml', 'infra/bus.py', 'infra/__init__.py',
  ]);

  assert.deepEqual(root.children.map(entry => entry.name),
    ['deploy', 'infra', 'services', 'notes.md', 'README.md', 'scenario.py']);
  assert.deepEqual(child(root, 'infra').children.map(entry => entry.name), ['__init__.py', 'bus.py']);
});

test('a path listed twice appears once', () => {
  const root = buildTree(['infra/bus.py', 'infra/bus.py']);
  assert.equal(child(root, 'infra').children.length, 1);
});
