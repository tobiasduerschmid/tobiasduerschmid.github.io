const assert = require('node:assert/strict');
const test = require('node:test');
const { createPrologWorker } = require('./helpers/prolog-worker');

async function checkGoal(program, goal) {
  const worker = createPrologWorker();
  const result = await worker.request({
    type: 'runTest', program,
    code: `assert((await __query(${JSON.stringify(goal)})).length === 1, 'The required Prolog relation must hold');`,
  });
  assert.equal(result.exitCode, 0, worker.messages.filter(message => message.type === 'stderr').map(message => message.text).join(''));
}

test('single-token programs are interpreted as source without an implicit URL fetch', async () => {
  await checkGoal('ready.', 'ready');
});

test('facts and rules enumerate substitutions in clause and left-to-right goal order', async () => {
  await checkGoal(`
    parent(tom, bob). parent(tom, liz). parent(bob, ann).
    grandparent(X, Z) :- parent(X, Y), parent(Y, Z).
  `, 'findall(X, parent(tom, X), [bob,liz]), grandparent(tom,ann), (parent(liz,ann); parent(bob,ann))');
});

test('the course two-clause jump relation preserves repeated proofs in its answer stream', async () => {
  await checkGoal(`
    step(c,e). step(b,c). step(b,d). step(a,c). step(a,b).
    jump(X,Y) :- step(X,Y).
    jump(X,Y) :- step(X,Z), step(Z,Y).
  `, 'findall(Out,jump(a,Out),[c,b,e,c,d]), findall(X,jump(X,d),[b,a])');
});

test('compound terms, shared variables, anonymous variables and identity follow Prolog semantics', async () => {
  await checkGoal('', String.raw`
    pair(X,X) = pair(tea,tea), X == tea,
    pair(_,_) = pair(tea,coffee),
    \+ (pair(Y,Y) = pair(tea,coffee)),
    \+ (Z == tea), Z = tea, Z == tea,
    tea \= coffee, f(tea) \= f(tea,coffee)
  `);
});

test('arithmetic evaluation, numeric equality and comparisons remain distinct from unification', async () => {
  await checkGoal('', String.raw`
    T = 2+3, T \== 5, N is T, N =:= 5, N > 4, N =< 5,
    \+ (5 = 5.0), 5 =:= 5.0, R is 7 mod 3, R == 1
  `);
});

test('recursive list predicates work forward and backward, including empty lists', async () => {
  await checkGoal(`
    join([], Ys, Ys).
    join([X|Xs], Ys, [X|Zs]) :- join(Xs, Ys, Zs).
    total([], 0).
    total([N|Ns], Sum) :- total(Ns, Tail), Sum is N + Tail.
  `, 'join([], [], []), join([a,b],[c],[a,b,c]), findall(pair(X,Y),join(X,Y,[a,b]),[pair([],[a,b]),pair([a],[b]),pair([a,b],[])]), total([2,3,4],9)');
});

test('course not/1 and ISO negation fail finitely without enumerating a complement', async () => {
  await checkGoal('enrolled(ana). enrolled(bo). passed(ana).', String.raw`
    not(passed(bo)), \+ passed(bo),
    findall(X,(enrolled(X),not(passed(X))),[bo]),
    findall(X,(not(passed(X)),enrolled(X)),[]),
    not(not(enrolled(ana)))
  `);
});

test('cut commits alternatives in its own predicate while preserving caller alternatives', async () => {
  await checkGoal(`
    pick(a). pick(b).
    first(X) :- pick(X), !.
    first(fallback).
    outer(X) :- first(X).
    outer(outside).
  `, 'findall(X,outer(X),[a,outside])');
});

test('the lists library supports course aggregation, permutation and generate-and-test tasks', async () => {
  await checkGoal(':- use_module(library(lists)).', `
    findall(X,member(X,[a,b,a]),[a,b,a]), sort([b,a,b],[a,b]),
    append([a],[b],[a,b]), reverse([a,b],[b,a]), sum_list([2,3,4],9),
    findall(P,(permutation([1,2,3],P),P=[2|_]),Ps), sort(Ps,[[2,1,3],[2,3,1]])
  `);
});

test('query syntax, unknown predicates and arithmetic instantiation errors fail the grade', async () => {
  for (const goal of ['parent(', 'unknown_predicate', 'X is Y+1']) {
    const worker = createPrologWorker();
    const result = await worker.request({ type: 'runTest', program: '', code: `await __query(${JSON.stringify(goal)});` });
    assert.equal(result.exitCode, 1, `${goal} must fail rather than become an empty result list`);
    assert.ok(worker.messages.some(message => message.type === 'stderr'), `${goal} must explain the failure`);
  }
});

test('a grade accepts a complete set of 100 answers but rejects a truncated set of 101', async () => {
  for (const count of [100, 101]) {
    const worker = createPrologWorker();
    const program = Array.from({ length: count }, (_, index) => `item(${index}).`).join('\n');
    const result = await worker.request({ type: 'runTest', program, code: 'assert((await __query("item(X)")).length === 100);' });
    assert.equal(result.exitCode, count === 100 ? 0 : 1, `${count} answers must not be mistaken for a complete set of 100`);
  }
});

test('a nonterminating proof fails the grade and a later valid program still runs', async () => {
  const worker = createPrologWorker();
  const result = await worker.request({ type: 'runTest', program: 'loop :- loop.', code: 'assert((await __query("loop")).length === 0);' });
  assert.equal(result.exitCode, 1, 'inference exhaustion must never count as finite failure');
  assert.ok(worker.messages.some(message => message.type === 'stderr' && /Inference limit/.test(message.text)));
  const recovery = await worker.request({ type: 'runTest', program: 'ready.', code: 'assert((await __query("ready")).length === 1);' });
  assert.equal(recovery.exitCode, 0);
});

test('sequential queries support explicit await and legacy author commands', async () => {
  const worker = createPrologWorker();
  const result = await worker.request({ type: 'runTest', program: 'item(a). item(b).', code: `
    const first = await __query('item(a)');
    const all = __query('item(X)');
    assert(first.length === 1 && all.length === 2);
  ` });
  assert.equal(result.exitCode, 0);
});

test('test write output is flushed in its own run and cannot leak into the next query', async () => {
  const worker = createPrologWorker();
  await worker.request({ type: 'runTest', program: '', code: 'await __query("write(test_output)");' });
  assert.ok(worker.messages.some(message => message.type === 'stdout' && message.text === 'test_output'));
  worker.messages.length = 0;
  await worker.request({ type: 'write', path: '/tutorial/main.pl', content: 'ready.' });
  const result = await worker.request({ type: 'run', path: '/tutorial/main.pl', query: 'ready' });
  assert.equal(result.exitCode, 0);
  assert.ok(worker.messages.some(message => message.type === 'stdout' && /true/.test(message.text)));
  assert.ok(worker.messages.every(message => !message.text || !message.text.includes('test_output')));
});
