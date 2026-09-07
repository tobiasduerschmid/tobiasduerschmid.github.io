const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const { createPrologWorker } = require('./helpers/prolog-worker');

const repositoryRoot = path.resolve(__dirname, '../..');
const tutorials = Object.fromEntries(['prolog', 'prolog-search'].map(key => [
  key, yaml.load(fs.readFileSync(path.join(repositoryRoot, '_data/tutorials', key + '.yml'), 'utf8')),
]));

function workspacePath(filename) {
  return '/tutorial/' + filename.replace(/^\/tutorial\//, '');
}

function exerciseFiles(step, solution) {
  return new Map([...step.files, ...(solution ? step.solution.files : [])]
    .map(file => [workspacePath(file.path), file.content]));
}

async function grade(step, files) {
  const worker = createPrologWorker();
  for (const [filename, content] of files) {
    await worker.request({ type: 'write', path: filename, content });
  }
  const program = files.get(workspacePath(step.run_file || step.open_file || step.files[0].path));
  assert.equal(typeof program, 'string', 'the exercise must supply its declared entry file');
  const results = [];
  for (const gate of step.tests) {
    worker.messages.length = 0;
    let result;
    try {
      result = await worker.request({ type: 'runTest', program, code: gate.command });
    } catch (error) {
      // The browser uses the same host-termination policy when learner search
      // cannot finish. Exhaustion is a failed gate, never a finite-failure proof.
      if (error.code !== 'PROLOG_EXECUTION_TIMEOUT') throw error;
      results.push({ description: gate.description, passed: false, errors: error.message });
      break;
    }
    results.push({
      description: gate.description,
      passed: result.exitCode === 0,
      errors: worker.messages.filter(message => message.type === 'stderr').map(message => message.text).join(''),
    });
  }
  return results;
}

for (const [key, tutorial] of Object.entries(tutorials)) {
  for (const [index, step] of tutorial.steps.entries()) {
    test(`${key} step ${index + 1}: the intended solution passes every published gate`, async () => {
      assert.ok(step.tests?.length > 0, 'each authored exercise must have a gate');
      assert.ok(step.solution?.files?.length > 0, 'each gate must have an instructor solution');
      const results = await grade(step, exerciseFiles(step, true));
      assert.ok(results.every(result => result.passed), JSON.stringify(results.filter(result => !result.passed), null, 2));
    });

    test(`${key} step ${index + 1}: the incomplete starter cannot pass the exercise`, async () => {
      const results = await grade(step, exerciseFiles(step, false));
      assert.ok(results.some(result => !result.passed), 'the starter must require meaningful work before progression');
    });
  }
}

// These independent programs exercise the declared relation contracts rather
// than reproducing the instructor solutions. They guard against both false
// rejection of a valid approach and acceptance of common near-misses.
function stepForPredicate(key, predicate) {
  const marker = predicate + '(';
  const step = tutorials[key].steps.find(candidate => candidate.tests.some(gate => gate.command.includes(marker)));
  assert.ok(step, `${predicate} must have a published course exercise`);
  return step;
}

async function gradeProgram(key, predicate, program) {
  const step = stepForPredicate(key, predicate);
  return grade(step, new Map([[workspacePath(step.run_file), program]]));
}

const familyFacts = 'parent(tom,bob). parent(bob,ann). parent(bob,pat). parent(ann,lena).';

test('the grandparent gate accepts a child-first join and rejects unrelated intermediate people', async () => {
  const valid = await gradeProgram('prolog', 'grandparent', familyFacts + '\ngrandparent(G,C) :- parent(P,C), parent(G,P).');
  assert.ok(valid.every(result => result.passed), JSON.stringify(valid));
  const wrong = await gradeProgram('prolog', 'grandparent', familyFacts + '\ngrandparent(G,C) :- parent(G,_), parent(_,C).');
  assert.ok(wrong.some(result => !result.passed), 'two unrelated parent facts are not a grandparent proof');
});

test('the species gate rejects equality of entire pets and hardcoded known species', async () => {
  for (const program of [
    'same_species(Pet, Pet).',
    'same_species(pet(dog,_), pet(dog,_)). same_species(pet(cat,_), pet(cat,_)).',
  ]) {
    const results = await gradeProgram('prolog', 'same_species', program);
    assert.ok(results.some(result => !result.passed), `reject the incomplete relation: ${program}`);
  }
});

test('the recursive membership gate rejects a cut that silently discards later proofs', async () => {
  const results = await gradeProgram('prolog', 'list_member', `
    list_member(Item, [Item|_]) :- !.
    list_member(Item, [_|Tail]) :- list_member(Item, Tail).
  `);
  assert.ok(results.some(result => !result.passed), 'membership must retain each occurrence, including duplicates');
});

test('the count gate accepts a tail accumulator and rejects exclusion of the exact limit', async () => {
  const valid = await gradeProgram('prolog-search', 'count_short', `
    count_short(List, Limit, Count) :- count_from(List, Limit, 0, Count).
    count_from([], _, Total, Total).
    count_from([X|Xs], Limit, SoFar, Count) :-
        (X =< Limit -> Next is SoFar + 1 ; Next = SoFar),
        count_from(Xs, Limit, Next, Count).
  `);
  assert.ok(valid.every(result => result.passed), JSON.stringify(valid));
  const wrong = await gradeProgram('prolog-search', 'count_short', `
    count_short([], _, 0).
    count_short([X|Xs], Limit, Count) :-
        count_short(Xs, Limit, TailCount),
        (X < Limit -> Count is TailCount + 1 ; Count = TailCount).
  `);
  assert.ok(wrong.some(result => !result.passed), 'the exact duration limit is eligible');
});

test('the removal gate rejects an empty-input success that also preserves the original list', async () => {
  const results = await gradeProgram('prolog-search', 'remove_one', `
    remove_one(_, [], []).
    remove_one(Item, [Item|Tail], Tail).
    remove_one(Item, [Head|Tail], [Head|Rest]) :- remove_one(Item, Tail, Rest).
  `);
  assert.ok(results.some(result => !result.passed), 'exactly one occurrence must be removed');
});

test('the interleave gate accepts append-based construction and rejects a dropped remaining suffix', async () => {
  const valid = await gradeProgram('prolog-search', 'interleave', `
    :- use_module(library(lists)).
    interleave([], Ys, Ys).
    interleave([X|Xs], [], [X|Xs]).
    interleave([X|Xs], [Y|Ys], Output) :-
        interleave(Xs, Ys, Rest), append([X,Y], Rest, Output).
  `);
  assert.ok(valid.every(result => result.passed), JSON.stringify(valid));
  const wrong = await gradeProgram('prolog-search', 'interleave', `
    interleave([], _, []).
    interleave(_, [], []).
    interleave([X|Xs], [Y|Ys], [X,Y|Rest]) :- interleave(Xs, Ys, Rest).
  `);
  assert.ok(wrong.some(result => !result.passed), 'unequal inputs must retain all unmatched elements');
});

async function gradeGameGuestCandidate(eligibilityGoal) {
  const step = stepForPredicate('prolog', 'game_guest');
  const files = exerciseFiles(step, false);
  const entry = workspacePath(step.run_file);
  const starter = files.get(entry);
  // Reuse the authored knowledge base, including the unrelated family. Only
  // replace the learner's inert placeholder; its variable names/spacing vary.
  const placeholder = /^game_guest\([^)]*\)\s*:-\s*fail\s*\./m;
  assert.match(starter, placeholder, 'the candidate fixture needs the game_guest starter placeholder');
  files.set(entry, starter.replace(placeholder, `
    game_guest(Guest, Game) :-
        favorites(Guest, GuestGames),
        list_member(Game, GuestGames),
        favorites(tom, HostGames),
        list_member(Game, HostGames),
        ${eligibilityGoal}.
  `));
  return grade(step, files);
}

test('the game-night gate accepts shared-game checks before the descendant check', async () => {
  const results = await gradeGameGuestCandidate('ancestor(tom, Guest)');
  assert.ok(results.every(result => result.passed), JSON.stringify(results));
});

test('the game-night gate rejects treating every child as a descendant of the host', async () => {
  const results = await gradeGameGuestCandidate('parent(_, Guest)');
  assert.ok(results.some(result => !result.passed), 'an unrelated child sharing a favorite game is still ineligible');
});

test('the duration gate rejects a fixed limit that ignores the query argument', async () => {
  const step = stepForPredicate('prolog-search', 'fits_slot');
  const files = exerciseFiles(step, true);
  const entry = workspacePath(step.run_file);
  // Keep the authored durations and correct slot arithmetic, replacing just
  // the duration relationship with the plausible hardcoded-example shortcut.
  const solution = files.get(entry);
  const rule = /^fits_slot\([^)]*\)\s*:-[\s\S]*?\./m;
  assert.match(solution, rule, 'the fixture must supply the fits_slot relation');
  files.set(entry, solution.replace(rule, 'fits_slot(Track, _) :- minutes(Track, Minutes), Minutes =< 3.'));
  const results = await grade(step, files);
  assert.ok(results.some(result => !result.passed), 'eligibility must change when the supplied limit changes');
});
