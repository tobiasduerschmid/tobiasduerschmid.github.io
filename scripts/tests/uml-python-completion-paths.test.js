'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');

const resource = `
class Resource:
    def use(self): pass
    def close(self): pass
    def finish(self): pass
    def ready(self) -> bool: return True
`;

function messages(source) {
  const result = global.analyzePythonSources({ 'main.py': resource + source });
  assert.deepEqual(result.errors, []);
  const path = [];
  const calls = [];
  for (const line of result.sequenceDiagram.split('\n')) {
    if (/^(alt|opt|loop) /.test(line)) path.push(line);
    else if (line.startsWith('else')) path[path.length - 1] = line;
    else if (line === 'end') path.pop();
    else if (line.includes(' -> ')) calls.push({ text: line, path: path.slice() });
  }
  return calls;
}

test('a conditional return inside try still guards continuation after cleanup', () => {
  const calls = messages(`
class Client:
    def run(self, resource: Resource, stop: bool):
        try:
            if stop:
                return
        finally:
            resource.close()
        resource.use()
r = Resource()
c = Client()
c.run(r, flag)
`);
  const continuation = calls.filter(call => call.text === 'c -> r: use()');
  assert.equal(continuation.length, 1);
  assert.ok(continuation[0].path.includes('else [else]'), 'only the non-returning path reaches use()');
  assert.equal(calls.filter(call => call.text === 'c -> r: close()').length, 2, 'both completions execute cleanup');
});

test('nested finalizers run in order on both return and continuing paths', () => {
  const calls = messages(`
class Client:
    def run(self, resource: Resource, stop: bool):
        try:
            try:
                if stop:
                    return
            finally:
                resource.close()
        finally:
            resource.finish()
        resource.use()
r = Resource()
c = Client()
c.run(r, flag)
`);
  const resourceCalls = calls.filter(call => call.text.startsWith('c -> r:'));
  assert.deepEqual(resourceCalls.map(call => call.text), [
    'c -> r: close()', 'c -> r: finish()',
    'c -> r: close()', 'c -> r: finish()', 'c -> r: use()'
  ]);
  assert.ok(resourceCalls[4].path.includes('else [else]'));
});

test('finally uses each handler outcome binding instead of dropping differing aliases', () => {
  const calls = messages(`
a = Resource()
b = Resource()
resource = a
try:
    a.use()
except ValueError:
    resource = b
finally:
    resource.close()
`);
  const closes = calls.filter(call => call.text.endsWith(': close()'));
  assert.deepEqual(closes.map(call => call.text), ['Main -> a: close()', 'Main -> b: close()']);
  assert.ok(closes[0].path.includes('alt [try]'));
  assert.ok(closes[1].path.includes('else [except ValueError]'));
});

test('returning branch heap effects remain possible when control returns to the caller', () => {
  const calls = messages(`
class Client:
    def __init__(self, resource: Resource):
        self.resource = resource
    def replace(self, a: Resource, b: Resource, stop: bool):
        if stop:
            self.resource = b
            return
        self.resource = a
a = Resource()
b = Resource()
c = Client(a)
c.replace(a, b, flag)
c.resource.use()
`);
  const uses = calls.filter(call => call.text.endsWith(': use()'));
  assert.equal(uses.length, 1, 'a same-type uncertain field remains callable');
  assert.doesNotMatch(uses[0].text, /^Main -> (?:a|b):/, 'neither branch provides a definite post-call identity');
});

test('break and continue run cleanup while only continue rechecks the loop guard', () => {
  const calls = messages(`
r = Resource()
while r.ready():
    try:
        if stop:
            break
        continue
    finally:
        r.close()
    r.use()
`);
  assert.ok(!calls.some(call => call.text === 'Main -> r: use()'));
  const rechecks = calls.filter(call => call.text === 'Main -> r: ready()');
  assert.equal(rechecks.length, 2);
  assert.ok(rechecks[1].path.includes('else [else]'), 'the breaking path cannot recheck');
  assert.equal(calls.filter(call => call.text === 'Main -> r: close()').length, 2);
});

test('a finalizer continue replaces a pending break before the loop recheck', () => {
  const calls = messages(`
r = Resource()
while r.ready():
    try:
        break
    finally:
        r.close()
        continue
    r.use()
`);
  assert.deepEqual(calls.map(call => call.text), [
    'Main -> r: ready()', 'Main -> r: close()', 'Main -> r: ready()'
  ]);
});

test('a return in inner cleanup replaces a raise while outer cleanup still runs', () => {
  const calls = messages(`
class Client:
    def run(self, resource: Resource):
        try:
            try:
                raise ValueError()
            finally:
                resource.close()
                return
        finally:
            resource.finish()
        resource.use()
r = Resource()
c = Client()
c.run(r)
`);
  assert.deepEqual(calls.map(call => call.text), [
    'Main -> c: run(r)', 'c -> r: close()', 'c -> r: finish()'
  ]);
});

test('excessive completion paths report a limit without publishing a partial sequence', () => {
  const conditions = Array.from({ length: 24 }, (_, index) =>
    `    if flag${index}:\n        selected${index} = a\n    else:\n        selected${index} = b\n`).join('');
  const result = global.analyzePythonSources({ 'main.py': resource + `
a = Resource()
b = Resource()
try:
${conditions}finally:
    a.close()
` });

  assert.match(result.classDiagram, /class Resource/);
  assert.equal(result.sequenceDiagram, '', 'a limit must not leave a convincing incomplete sequence');
  assert.ok(result.errors.some(error => /sequence inference limit/i.test(error)));
});

for (const [loop, transfer] of [
  ['while flag:', 'return'],
  ['for item in items:', 'return'],
  ['while flag:', 'raise ValueError()'],
]) {
  test(`${transfer} from ${loop.split(' ')[0]} preserves cleanup while only zero iterations reach continuation`, () => {
    const calls = messages(`
class Client:
    def run(self, resource: Resource, flag: bool, items: list):
        try:
            ${loop}
                resource.finish()
                ${transfer}
        finally:
            resource.close()
        resource.use()
r = Resource()
c = Client()
c.run(r, flag, items)
`);
    const continuation = calls.filter(call => call.text === 'c -> r: use()');
    assert.equal(continuation.length, 1);
    assert.ok(continuation[0].path.some(guard => /zero iterations/.test(guard)));
    assert.equal(calls.filter(call => call.text === 'c -> r: close()').length, 2);
    assert.equal(calls.filter(call => call.text === 'c -> r: finish()').length, 1);
  });
}

test('a break path reaches continuation while a return path still exits after finally', () => {
  const calls = messages(`
class Client:
    def run(self, resource: Resource, flag: bool, stop: bool):
        try:
            while flag:
                if stop:
                    return
                break
        finally:
            resource.close()
        resource.use()
r = Resource()
c = Client()
c.run(r, flag, stop)
`);
  const continuations = calls.filter(call => call.text === 'c -> r: use()');
  assert.equal(continuations.length, 2, 'break and zero iterations both continue');
  assert.ok(continuations.every(call => !call.path.some(guard => /return from loop/.test(guard))));
  assert.equal(calls.filter(call => call.text === 'c -> r: close()').length, 3);
});
