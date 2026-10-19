'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../../js/uml-analyzer-python.js');

const service = `
class Service:
    def use(self):
        pass
    def close(self):
        pass
`;

function diagram(source) {
  const result = global.analyzePythonSources({ 'example.py': service + source });
  assert.deepEqual(result.errors, []);
  return result.sequenceDiagram;
}

function messages(output) {
  return output.split('\n').filter(line => line.includes(' -> '));
}

test('an unbound field receiver cannot reuse a same-named independent object', () => {
  const output = diagram(`
class Client:
    resource: Service
    def run(self):
        self.resource.use()
        self.resource.close()
client_resource = Service()
client = Client()
client.run()
client_resource.use()
`);
  const calls = messages(output);
  const fieldReceiver = calls.find(line => /^client -> .*: use\(\)$/.test(line)).split(' -> ')[1].split(':')[0];
  assert.notEqual(fieldReceiver, 'client_resource');
  assert.ok(calls.includes('client -> ' + fieldReceiver + ': close()'), 'the same field keeps its symbolic receiver');
  assert.ok(calls.includes('Main -> client_resource: use()'), 'the independent object keeps its own identity');
});

test('an unbound typed parameter cannot reuse a same-named independent object', () => {
  const output = diagram(`
class Client:
    def run(self, resource: Service):
        resource.use()
client_resource = Service()
client = Client()
client.run(external)
client_resource.use()
`);
  const calls = messages(output);
  assert.equal(calls.filter(line => /^client -> .*: use\(\)$/.test(line)).length, 1);
  assert.ok(!calls.includes('client -> client_resource: use()'));
  assert.ok(calls.includes('Main -> client_resource: use()'));
});

test('computed receivers cannot reuse a user variable or another factory result', () => {
  const output = diagram(`
class Factory:
    def get(self) -> Service:
        return Service()
factory = Factory()
factory_get_result = Service()
factory.get().use()
factory.get().use()
factory_get_result.close()
`);
  const calls = messages(output);
  const receivers = calls.filter(line => /^Main -> .*: use\(\)$/.test(line))
    .map(line => line.split(' -> ')[1].split(':')[0]);
  assert.equal(receivers.length, 2);
  assert.equal(new Set(receivers).size, 2, 'separate results do not prove a shared identity');
  assert.ok(!receivers.includes('factory_get_result'));
  assert.ok(calls.includes('Main -> factory_get_result: close()'));
});

test('branch-merged fields keep a distinct symbolic receiver from a same-named object', () => {
  const output = diagram(`
class Client:
    def __init__(self, resource: Service):
        self.resource = resource
    def run(self):
        pass
a = Service()
b = Service()
client_resource = Service()
client = Client(a)
if flag:
    client.resource = b
client.resource.use()
client.resource.close()
client_resource.use()
`);
  const calls = messages(output);
  const receiver = calls.find(line => line.endsWith(': close()')).split(' -> ')[1].split(':')[0];
  assert.ok(!['a', 'b', 'client_resource'].includes(receiver));
  assert.ok(calls.includes('Main -> ' + receiver + ': use()'));
  assert.ok(calls.includes('Main -> client_resource: use()'));
});

test('a field and an unbound parameter with the same role name are distinct receivers', () => {
  const calls = messages(diagram(`
class Client:
    resource: Service
    def run(self, resource: Service):
        self.resource.use()
        resource.close()
client = Client()
client.run(external)
`));
  const use = calls.find(line => line.endsWith(': use()'));
  const close = calls.find(line => line.endsWith(': close()'));
  assert.ok(use && close);
  assert.notEqual(use.split(':')[0], close.split(':')[0]);
});

test('symbolic identities are reserved before their first rendered message', () => {
  const calls = messages(diagram(`
class Client:
    def __init__(self, resource: Service):
        self.saved = resource
    def run(self):
        self.saved.use()
client = Client(external)
client_resource = Service()
client.run()
client_resource.close()
`));
  const useReceiver = calls.find(line => line.endsWith(': use()')).split(' -> ')[1].split(':')[0];
  const closeReceiver = calls.find(line => line.endsWith(': close()')).split(' -> ')[1].split(':')[0];
  assert.notEqual(useReceiver, closeReceiver);
});

test('separate calls with unbound parameters do not imply one shared object', () => {
  const calls = messages(diagram(`
class Client:
    def run(self, resource: Service):
        resource.use()
        resource.close()
client = Client()
client.run(first_external)
client.run(second_external)
`));
  const receivers = calls.filter(line => line.endsWith(': use()')).map(line => line.split(':')[0]);
  assert.equal(receivers.length, 2);
  assert.notEqual(receivers[0], receivers[1]);
  assert.deepEqual(calls.filter(line => line.endsWith(': close()')).map(line => line.split(':')[0]), receivers);
});

for (const annotationSite of ['class', 'initializer', 'injected parameter']) {
  test(`${annotationSite} collection annotations describe iterable elements, not scalar receivers`, () => {
    const declaration = annotationSite === 'class' ? '    resources: list[Service]'
      : annotationSite === 'initializer' ? '    def __init__(self):\n        self.resources: list[Service] = []'
        : '    def __init__(self, resources: list[Service]):\n        self.resources = resources';
    const calls = messages(diagram(`
class Client:
${declaration}
    def run(self):
        self.resources.use()
        for resource in self.resources:
            resource.close()
client = Client(${annotationSite === 'injected parameter' ? '[]' : ''})
client.run()
`));
    assert.ok(!calls.some(line => line.endsWith(': use()')));
    assert.equal(calls.filter(line => /^client -> .*: close\(\)$/.test(line)).length, 1);
  });
}

test('a user variable named Main does not reuse the module entry lifeline', () => {
  const calls = messages(diagram(`
Main = Service()
Main.use()
`));
  assert.equal(calls.length, 1);
  assert.ok(!calls.includes('Main -> Main: use()'));
});

test('calls on constructed receivers keep the identity of the created object', () => {
  const output = diagram('Service().use()\nService().close()\n');
  const created = output.split('\n').filter(line => line.startsWith('create ')).map(line => line.slice(7));
  const receivers = messages(output).map(line => line.split(' -> ')[1].split(':')[0]);
  assert.equal(created.length, 2);
  assert.equal(new Set(created).size, 2);
  assert.deepEqual(receivers, created);
});

for (const transfer of ['', 'return', 'raise ValueError()']) {
  test(`finally cleanup follows ${transfer || 'normal completion'} before leaving a method`, () => {
    const output = diagram(`
class Client:
    def run(self, resource: Service):
        try:
            resource.use()
            ${transfer || 'pass'}
        finally:
            resource.close()
        resource.use()
resource = Service()
client = Client()
client.run(resource)
`);
    assert.deepEqual(messages(output), [
      'Main -> client: run(resource)', 'client -> resource: use()',
      'client -> resource: close()', ...(!transfer ? ['client -> resource: use()'] : []),
    ]);
  });
}

test('try else calls belong to normal completion and finally follows both outcomes', () => {
  const output = diagram(`
resource = Service()
try:
    resource.use()
except ValueError:
    resource.close()
else:
    resource.use()
finally:
    resource.close()
`);
  const lines = output.split('\n');
  const handler = lines.findIndex(line => line.startsWith('else [except'));
  assert.deepEqual(messages(lines.slice(0, handler).join('\n')), [
    'Main -> resource: use()', 'Main -> resource: use()', 'Main -> resource: close()',
  ]);
  assert.deepEqual(messages(lines.slice(handler).join('\n')), [
    'Main -> resource: close()', 'Main -> resource: close()',
  ]);
});

test('a finalizer return overrides a pending continue and prevents a loop recheck', () => {
  const output = diagram(`
class Client:
    def ready(self) -> bool:
        return True
    def run(self, resource: Service):
        while self.ready():
            try:
                continue
            finally:
                resource.close()
                return
resource = Service()
client = Client()
client.run(resource)
`);
  assert.equal(messages(output).filter(line => line === 'client -> client: ready()').length, 1);
  assert.ok(messages(output).includes('client -> resource: close()'));
});

test('a guard return keeps subsequent calls on the continuing branch', () => {
  const output = diagram(`
class Client:
    def run(self, resource: Service, stop: bool):
        if stop:
            return
        resource.use()
resource = Service()
client = Client()
client.run(resource, flag)
`);
  assert.match(output, /(?:opt \[not \(stop\)\]|else \[else\])[\s\S]*client -> resource: use\(\)[\s\S]*end/);
});

test('different terminal exits in both branches leave following calls unreachable', () => {
  const output = diagram(`
class Client:
    def run(self, resource: Service, stop: bool):
        if stop:
            return
        else:
            raise ValueError()
        resource.use()
resource = Service()
client = Client()
client.run(resource, flag)
`);
  assert.ok(!messages(output).includes('client -> resource: use()'));
});

const client = `
class Client:
    def __init__(self, left: Service, right: Service):
        self.left = left
        self.right = right
    def run(self):
        self.left.use()
        self.right.use()
    def replace(self, replacement: Service):
        self.left = replacement
`;

test('injected fields retain the identities of two same-class arguments', () => {
  assert.deepEqual(messages(diagram(client + `
a = Service()
b = Service()
client = Client(a, b)
client.run()
`)), ['Main -> client: run()', 'client -> a: use()', 'client -> b: use()']);
});

test('field bindings belong to each owner and persist across method calls', () => {
  assert.deepEqual(messages(diagram(client + `
a = Service()
b = Service()
first = Client(a, b)
second = Client(b, a)
first.replace(b)
first.run()
second.run()
`)), [
    'Main -> first: replace(b)', 'Main -> first: run()',
    'first -> b: use()', 'first -> b: use()', 'Main -> second: run()',
    'second -> b: use()', 'second -> a: use()',
  ]);
});

test('aliases of fields and field arguments retain their object identities', () => {
  assert.deepEqual(messages(diagram(client + `
class User:
    def run(self, client: Client):
        alias = client.right
        alias.use()
        client.replace(client.right)
        client.left.use()
a = Service()
b = Service()
client = Client(a, b)
user = User()
user.run(client)
`)), [
    'Main -> user: run(client)', 'user -> b: use()',
    'user -> client: replace(client.right)', 'user -> b: use()',
  ]);
});

test('a scalar reassignment invalidates the former field receiver', () => {
  const output = diagram(client + `
a = Service()
b = Service()
client = Client(a, b)
client.left = 3
client.run()
`);
  assert.deepEqual(messages(output), ['Main -> client: run()', 'client -> b: use()']);
});

test('branch-specific field rebinding never picks an unrelated existing object', () => {
  const output = diagram(client + `
a = Service()
b = Service()
client = Client(a, b)
if flag:
    client.left = b
client.left.use()
`);
  assert.ok(!messages(output).some(line => /Main -> (a|b): use\(\)/.test(line)));
});

test('a factory result cannot reuse a previous receiver still referenced by an alias', () => {
  const output = diagram(`
class Factory:
    def make(self) -> Service:
        return Service()
s = Service()
old = s
factory = Factory()
s = factory.make()
s.use()
old.use()
`);
  const uses = messages(output).filter(line => line.endsWith(': use()'));
  assert.equal(uses.length, 2);
  assert.notEqual(uses[0], uses[1]);
  assert.equal(uses[1], 'Main -> s: use()');
});

test('supplied modules with equal class names keep distinct constructors and static calls', () => {
  const moduleSource = service + '    @staticmethod\n    def ping():\n        pass\n';
  const result = global.analyzePythonSources({
    'east.py': moduleSource,
    'west.py': moduleSource,
    'main.py': `
from east import Service as East
import west as other
a = East()
b = other.Service()
a.use()
b.close()
East.ping()
other.Service.ping()
`,
  });
  assert.deepEqual(result.errors, []);
  const calls = messages(result.sequenceDiagram);
  assert.equal(calls.length, 4);
  assert.equal(calls[0], 'Main -> a: use()');
  assert.equal(calls[1], 'Main -> b: close()');
  assert.notEqual(calls[2].split(':')[0], calls[3].split(':')[0]);
  const labels = result.sequenceDiagram.split('\n').filter(line => /^participant [ab]:/.test(line));
  assert.equal(new Set(labels.map(line => line.split(': ')[1])).size, 2);
});

test('a shadowed imported class is not treated as a constructor or static receiver', () => {
  const result = global.analyzePythonSources({
    'services.py': service,
    'main.py': `
from services import Service
class Client:
    def run(self, Service):
        value = Service()
        Service.use()
client = Client()
client.run(factory)
`,
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(messages(result.sequenceDiagram), ['Main -> client: run(factory)']);
  assert.ok(!/create client_value/.test(result.sequenceDiagram));
});
