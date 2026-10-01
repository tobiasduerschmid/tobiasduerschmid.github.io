const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

// Real Tau interpreter and debugger; only the browser Worker transport differs.
function debuggerWorker(t, config) {
  const runtime = new Worker(`
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    const { parentPort, workerData } = require('node:worker_threads');
    const context = vm.createContext({ console: { log() {} }, setTimeout, clearTimeout,
      postMessage: message => parentPort.postMessage(message),
      importScripts(...urls) {
        for (const url of urls) vm.runInContext(fs.readFileSync(path.join(workerData.root, url), 'utf8'), context);
      }
    });
    context.self = context;
    vm.runInContext(fs.readFileSync(path.join(workerData.root, 'js/debugger/prolog/runtime.js'), 'utf8'), context);
    parentPort.on('message', data => context.onmessage({ data }));
  `, { eval: true, workerData: { root: path.resolve(__dirname, '../..') } });
  t.after(() => runtime.terminate());
  const messages = [];
  const pending = [];
  const waiting = [];
  runtime.on('message', message => {
    messages.push(message);
    if (!['paused', 'debugComplete'].includes(message.type)) return;
    if (waiting.length) waiting.shift().resolve(message);
    else pending.push(message);
  });
  runtime.on('error', error => { for (const waiter of waiting.splice(0)) waiter.reject(error); });
  const next = () => {
    if (pending.length) return Promise.resolve(pending.shift());
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The debugger did not settle within its test deadline')), 3000);
      waiting.push({ resolve: message => { clearTimeout(timeout); resolve(message); }, reject });
    });
  };
  runtime.postMessage({ type: 'start', filename: '/tutorial/main.pl', ...config });
  return { messages, next, send: message => runtime.postMessage(message),
    async command(command) { runtime.postMessage({ type: 'command', command }); return next(); } };
}

async function finish(worker, command = 2) {
  const snapshots = [];
  let message = await worker.next();
  for (let count = 0; count < 200; count++) {
    snapshots.push(...(message.snapshots || []));
    if (message.type === 'debugComplete') return { message, snapshots };
    message = await worker.command(command);
  }
  assert.fail('A finite sample should finish within 200 debugger pauses');
}

test('Prolog stepping reveals real bindings, nested calls and every backtracking answer', async t => {
  const worker = debuggerWorker(t, { code: 'edge(a,b).\nedge(a,c).\npath(X,Y) :- edge(X,Y).',
    query: 'path(a,Destination)', watches: ['X', 'pair(X,Y)', 'Destination'] });
  const { message, snapshots } = await finish(worker);
  assert.equal(message.exitCode, 0, JSON.stringify(worker.messages));
  const output = worker.messages.filter(message => message.type === 'stdout').map(message => message.text).join('');
  assert.match(output, /Destination = b/);
  assert.match(output, /Destination = c/);
  const body = snapshots.find(snapshot => snapshot.stack.some(frame => frame.function === 'path/2'));
  assert.ok(body, 'entering a rule must expose its real frame');
  const frame = body.stack.find(frame => frame.function === 'path/2');
  assert.equal(frame.line, 3, 'source locations point to the clause start');
  assert.equal(frame.locals.X.repr, 'a');
  assert.equal(body.watches.X.repr, 'a');
  assert.match(body.watches['pair(X,Y)'].repr, /^pair\(a,/);
  assert.ok(snapshots.some(snapshot => snapshot.line === 2 && snapshot.stack.at(-1).function === 'edge/2'),
    'the second fact alternative must retain its own source line: ' + JSON.stringify(snapshots));
  const matchedFact = snapshots.find(snapshot => snapshot.stack.at(-1).function === 'edge/2');
  assert.equal(matchedFact.stack.find(frame => frame.function === 'path/2').locals.Y.repr, 'b',
    'callee unification must also update the caller binding displayed in that snapshot');
  assert.equal(matchedFact.watches.Destination.repr, 'b', 'query watches stay available inside a clause');
});

test('Step Over skips a nested proof and Step Out returns to its caller', async t => {
  const code = 'main(X) :- inner(X), X = ok.\ninner(X) :- value(X).\nvalue(ok).';
  for (const operation of [3, 4]) {
    const worker = debuggerWorker(t, { code, query: 'main(X)' });
    await worker.next();
    let pause = await worker.command(2);
    if (operation === 4) pause = await worker.command(2);
    const origin = pause.snapshots.at(-1);
    const next = await worker.command(operation);
    assert.equal(next.type, 'paused', JSON.stringify(worker.messages));
    const target = next.snapshots.at(-1);
    assert.ok(operation === 3 ? target.depth <= origin.depth : target.depth < origin.depth,
      'stepping should stop according to the actual proof call depth');
    assert.ok(next.snapshots.some(snapshot => snapshot.stack.at(-1).function === 'value/1'),
      'skipped nested execution must remain available in history');
    assert.equal(target.stack.at(-1).locals.X.repr, 'ok');
  }
});

test('unbound query watches keep their names through clause renaming until a real binding changes', async t => {
  const worker = debuggerWorker(t, { code: 'answer(Y) :- inner(Y).\ninner(Z) :- Z = ok.',
    query: 'answer(X)', watches: ['X', 'pair(X,X)'] });
  const { message, snapshots } = await finish(worker);
  assert.equal(message.exitCode, 0);
  const unbound = snapshots.filter(snapshot => snapshot.watches.X.type === 'unbound');
  assert.ok(unbound.length >= 3, 'the query passes through multiple fresh clause scopes');
  for (const snapshot of unbound) {
    assert.equal(snapshot.watches.X.repr, 'X');
    assert.equal(snapshot.watches['pair(X,X)'].repr, 'pair(X,X)');
  }
  assert.ok(snapshots.some(snapshot => snapshot.watches.X.repr === 'ok'), 'actual binding remains observable');
});

test('quoted query atoms retain spaces and dots, and pure conditions use local Prolog bindings', async t => {
  const worker = debuggerWorker(t, { code: "value('hello . world').\nanswer(X) :- value(X), X = 'hello . world'.",
    query: "answer('hello . world')", watches: ["X == 'hello . world'"], breakpoints: [{ file: '/tutorial/main.pl', line: 2,
      condition: "X == 'hello . world'" }] });
  await worker.next();
  const pause = await worker.command(1);
  assert.equal(pause.type, 'paused');
  assert.equal(pause.snapshots.at(-1).stack.at(-1).locals.X.repr, "'hello . world'");
  assert.equal(pause.snapshots.at(-1).watches["X == 'hello . world'"].repr, 'true');
  worker.send({ type: 'breakpoints', changes: [{ op: 'remove', file: '/tutorial/main.pl', line: 2 }] });
  assert.equal((await worker.command(1)).exitCode, 0);
});

test('a false numeric breakpoint condition remains false in recorded history', async t => {
  const worker = debuggerWorker(t, { code: 'answer(X) :- X = 1.', query: 'answer(1)', watches: ['X > 2'],
    breakpoints: [{ file: '/tutorial/main.pl', line: 1, condition: 'X > 2' }] });
  await worker.next();
  const completed = await worker.command(1);
  assert.equal(completed.type, 'debugComplete');
  assert.ok(completed.snapshots.some(snapshot => snapshot.watches['X > 2'].repr === 'false'));
});

test('Continue respects a clause breakpoint and breakpoint changes while paused', async t => {
  const worker = debuggerWorker(t, { code: 'answer(X) :- first(X).\nfirst(X) :- second(X).\nsecond(ok).',
    query: 'answer(X)', breakpoints: [{ file: '/tutorial/main.pl', line: 2 }] });
  assert.equal((await worker.next()).type, 'paused');
  const stopped = await worker.command(1);
  assert.equal(stopped.type, 'paused');
  assert.equal(stopped.snapshots.at(-1).line, 2);
  worker.send({ type: 'breakpoints', changes: [{ op: 'remove', file: '/tutorial/main.pl', line: 2 }] });
  assert.equal((await worker.command(1)).type, 'debugComplete');
});

test('watch updates refresh the paused state without taking another inference', async t => {
  const worker = debuggerWorker(t, { code: 'answer(X) :- X = ok.', query: 'answer(Result)' });
  const initial = await worker.next();
  worker.send({ type: 'watches', watches: ['Result', 'Absent'] });
  const refreshed = await worker.command(6);
  assert.equal(refreshed.replace_last, true);
  assert.equal(refreshed.snapshots[0].call_id, initial.snapshots[0].call_id);
  assert.equal(refreshed.snapshots[0].watches.Result.type, 'unbound');
  assert.match(refreshed.snapshots[0].watches.Absent.error, /not in this scope/);
});

test('debugging preserves cut, negation, arithmetic and nested list-library searches', async t => {
  const worker = debuggerWorker(t, { code: `
    :- use_module(library(lists)).
    pick(a). pick(b).
    first(X) :- pick(X), !.
    first(fallback).
    outer(X) :- first(X).
    outer(outside).
  `, query: 'findall(X,outer(X),[a,outside]), not(pick(c)), N is 2+3, N =:= 5, member(b,[a,b])' });
  const { message } = await finish(worker, 1);
  assert.equal(message.exitCode, 0, JSON.stringify(worker.messages));
  assert.ok(worker.messages.some(message => message.type === 'stdout' && /N = 5/.test(message.text)));
});

test('invalid programs, invalid queries, unknown predicates and finite failure settle with errors', async t => {
  for (const config of [
    { code: 'broken(', query: 'broken' }, { code: 'ok.', query: 'broken(' },
    { code: 'ok.', query: 'missing' }, { code: 'ok.', query: 'fail' }, { code: 'ok.', query: '' },
  ]) {
    const worker = debuggerWorker(t, config);
    const { message } = await finish(worker, 1);
    assert.equal(message.exitCode, 1, JSON.stringify(config));
  }
});

test('a recursive nonterminating query is bounded by the debugger trace cap', async t => {
  const worker = debuggerWorker(t, { code: 'loop :- loop.', query: 'loop', options: { max_snapshots: 12 } });
  const { message } = await finish(worker, 1);
  assert.equal(message.exitCode, 1);
  assert.match(message.error, /trace limit/);
  assert.ok(worker.messages.some(message => message.type === 'capReached' && message.limit === 12));
});

test('debugging accepts exactly 100 answers but explicitly rejects a larger answer set', async t => {
  for (const count of [100, 101]) {
    const worker = debuggerWorker(t, { code: Array.from({ length: count }, (_, index) => `item(${index}).`).join('\n'),
      query: 'item(X)' });
    const { message } = await finish(worker, 1);
    assert.equal(message.exitCode, count === 100 ? 0 : 1);
    if (count === 101) assert.match(message.error, /Answer limit/);
  }
});
