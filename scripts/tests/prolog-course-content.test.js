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
    test(`${key} step ${index + 1}: the intended solution passes every published check`, async () => {
      assert.ok(step.tests?.length > 0, 'each authored exercise must have a diagnostic check');
      assert.ok(step.solution?.files?.length > 0, 'each exercise must have an instructor solution');
      const results = await grade(step, exerciseFiles(step, true));
      assert.ok(results.every(result => result.passed), JSON.stringify(results.filter(result => !result.passed), null, 2));
    });

    test(`${key} step ${index + 1}: the incomplete starter cannot pass the exercise`, async () => {
      const results = await grade(step, exerciseFiles(step, false));
      assert.ok(results.some(result => !result.passed), 'the starter must require meaningful work before earning a pass');
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

const schedule = `
  scheduled(puzzles,morning). scheduled(robots,noon). scheduled(music,evening).
  closed_slot(morning). cancelled(music).
`;
const audioFormats = `
  recorded_format(rain,audio(44100,stereo)). recorded_format(bell,audio(48000,mono)).
  recorded_format(bell,audio(44100,stereo)). recorded_format(hum,audio(22050,mono)).
  device_format(headphones,audio(44100,stereo)). device_format(speaker,audio(48000,mono)).
  device_format(phone,audio(22050,mono)).
  device_format(mono_speaker,audio(44100,mono)).
`;
const soundPacks = `
  includes(release,readme). includes(release,pads). includes(release,beats).
  includes(beats,noise). includes(beats,kick). includes(pads,noise). includes(noise,hiss).
`;
const prerequisites = `
  prerequisite(intro, structures).
  prerequisite(structures, systems).
  prerequisite(structures, discrete).
  prerequisite(systems, languages).
  track_goal(software,languages). track_goal(theory,discrete).
  needed_for(Course,Track) :- track_goal(Track,Target), needed_before(Course,Target).
`;
const routeMap = `
  path(gate,cafe). path(gate,stage). path(gate,gallery).
  path(cafe,garden). path(stage,garden). path(gallery,garden). path(garden,exit).
  closed(stage).
`;

const replacementCandidates = [
  {
    name: 'fact checks accept the specified relationships in another order', predicate: 'cue', passes: true,
    program: 'cue(hum,right). cue(bell,left). cue(rain,left). cue(bell,right).',
  },
  {
    name: 'fact checks reject duplicated proofs even when the relationship set is correct', predicate: 'cue', passes: false,
    program: 'cue(rain,left). cue(bell,right). cue(bell,left). cue(hum,right). cue(bell,left).',
  },
  {
    name: 'unification accepts format matching in the rule body', predicate: 'same_format', passes: true,
    program: 'same_format(clip(_,First),clip(_,Second)) :- First = audio(Rate,Channels), Second = audio(Rate,Channels).',
  },
  {
    name: 'unification rejects requiring identical clip names', predicate: 'same_format', passes: false,
    program: 'same_format(clip(Name,audio(R,C)),clip(Name,audio(R,C))).',
  },
  {
    name: 'unification rejects ignoring the sample rate', predicate: 'same_format', passes: false,
    program: 'same_format(clip(_,audio(_,C)),clip(_,audio(_,C))).',
  },
  {
    name: 'joined rules accept device-first lookup', predicate: 'playable_on', passes: true,
    program: audioFormats + '\nplayable_on(C,D) :- device_format(D,F), recorded_format(C,F).',
  },
  {
    name: 'joined rules reject independently chosen formats', predicate: 'playable_on', passes: false,
    program: audioFormats + '\nplayable_on(C,D) :- device_format(D,_), recorded_format(C,_).',
  },
  {
    name: 'joined rules reject matching rates while ignoring channel layouts', predicate: 'playable_on', passes: false,
    program: audioFormats + '\nplayable_on(C,D) :- device_format(D,audio(R,_)), recorded_format(C,audio(R,_)).',
  },
  {
    name: 'proof-order checks accept an equivalent helper decomposition', predicate: 'two_layers', passes: true,
    program: soundPacks + '\ntwo_layers(P,I) :- includes(P,M), next_layer(M,I). next_layer(M,I) :- includes(M,I).',
  },
  {
    name: 'proof-order checks reject reversed body order despite the same relation', predicate: 'two_layers', passes: false,
    program: soundPacks + '\ntwo_layers(P,I) :- includes(M,I), includes(P,M).',
  },
  {
    name: 'proof-order checks reject retaining only the first proof', predicate: 'two_layers', passes: false,
    program: soundPacks + '\ntwo_layers(P,I) :- includes(P,M), includes(M,I), !.',
  },
  {
    name: 'ground negation accepts independently ordered exclusions', predicate: 'available', passes: true,
    program: schedule + '\navailable(D) :- scheduled(D,S), not(cancelled(D)), not(closed_slot(S)).',
  },
  {
    name: 'ground negation accepts repeated proofs of the same eligible demo', predicate: 'available', passes: true,
    program: schedule + `
      available(D) :- scheduled(D,S), not(cancelled(D)), not(closed_slot(S)).
      available(D) :- scheduled(D,S), not(cancelled(D)), not(closed_slot(S)).
    `,
  },
  {
    name: 'ground negation rejects filtering before candidate generation', predicate: 'available', passes: false,
    program: schedule + '\navailable(D) :- not(closed_slot(S)), not(cancelled(D)), scheduled(D,S).',
  },
  {
    name: 'ground negation rejects checking a demo instead of its slot', predicate: 'available', passes: false,
    program: schedule + '\navailable(D) :- scheduled(D,_), not(cancelled(D)), not(closed_slot(D)).',
  },
  {
    name: 'recursive reachability accepts recursion toward the source', predicate: 'needed_before', passes: true,
    program: prerequisites + `
      needed_before(A,B) :- prerequisite(A,B).
      needed_before(A,B) :- prerequisite(Middle,B), needed_before(A,Middle).
    `,
  },
  {
    name: 'recursive reachability rejects a two-edge-only shortcut', predicate: 'needed_before', passes: false,
    program: prerequisites + `
      needed_before(A,B) :- prerequisite(A,B).
      needed_before(A,B) :- prerequisite(A,Middle), prerequisite(Middle,B).
    `,
  },
  {
    name: 'track prerequisites accept repeated proofs of a required course', predicate: 'needed_for', passes: true,
    program: prerequisites + `
      needed_before(A,B) :- prerequisite(A,B).
      needed_before(A,B) :- prerequisite(A,Middle), needed_before(Middle,B).
      needed_for(Course,Track) :- track_goal(Track,Target), needed_before(Course,Target).
    `,
  },
  {
    name: 'list patterns accept separate head-tail decomposition', predicate: 'first_two', passes: true,
    program: `
      first_two([A|Tail], A, B) :- Tail = [B|_].
      drop_two([_|Tail], Rest) :- Tail = [_|Rest].
    `,
  },
  {
    name: 'list patterns accept redundant proofs when only the matched values are specified', predicate: 'first_two', passes: true,
    program: `
      first_two([A,B|_], A, B).
      first_two([A,B|_], A, B).
      drop_two([_,_|Rest], Rest).
      drop_two([_,_|Rest], Rest).
    `,
  },
  {
    name: 'list patterns reject keeping the second item in the remainder', predicate: 'drop_two', passes: false,
    program: `
      first_two([A,B|_], A, B).
      drop_two([_|Rest], Rest).
    `,
  },
  {
    name: 'list patterns reject a later pair even when the correct pair is also produced', predicate: 'first_two', passes: false,
    program: `
      first_two([A,B|_], A, B).
      first_two([_|Tail], A, B) :- first_two(Tail, A, B).
      drop_two([_,_|Rest], Rest).
    `,
  },
  {
    name: 'list patterns reject extra suffixes alongside the correct remainder', predicate: 'drop_two', passes: false,
    program: `
      first_two([A,B|_], A, B).
      drop_two([_,_|Rest], Rest).
      drop_two([_|Tail], Rest) :- drop_two(Tail, Rest).
    `,
  },
  {
    name: 'list construction accepts append-based pair construction', predicate: 'double_each', passes: true,
    program: `
      :- use_module(library(lists)).
      double_each([], []).
      double_each([X|Xs], Result) :- double_each(Xs, Rest), append([X,X], Rest, Result).
    `,
  },
  {
    name: 'list construction rejects duplicating the whole list', predicate: 'double_each', passes: false,
    program: ':- use_module(library(lists)). double_each(List,Result) :- append(List,List,Result).',
  },
  {
    name: 'positional removal accepts a split-based relation', predicate: 'claim_badge', passes: true,
    program: `
      :- use_module(library(lists)).
      offered(leaf). offered(stone).
      claim_badge(Input, ticket(Item), Output) :-
        append(Prefix, [Item|Tail], Input), offered(Item), append(Prefix, Tail, Output).
    `,
  },
  {
    name: 'positional removal rejects an implicit otherwise that loses later proofs', predicate: 'claim_badge', passes: false,
    program: `
      offered(leaf). offered(stone).
      claim_badge([Item|Tail],ticket(Item),Tail) :- offered(Item).
      claim_badge([Head|Tail],Ticket,[Head|Rest]) :- not(offered(Head)), claim_badge(Tail,Ticket,Rest).
    `,
  },
  {
    name: 'positional removal rejects the unchanged list from empty-base success', predicate: 'claim_badge', passes: false,
    program: `
      offered(leaf). offered(stone).
      claim_badge([],none,[]).
      claim_badge([Item|Tail],ticket(Item),Tail) :- offered(Item).
      claim_badge([Head|Tail],Ticket,[Head|Rest]) :- claim_badge(Tail,Ticket,Rest).
    `,
  },
  {
    name: 'positional removal rejects awarding an unoffered badge', predicate: 'claim_badge', passes: false,
    program: `
      offered(leaf). offered(stone).
      claim_badge([Item|Tail],ticket(Item),Tail).
      claim_badge([Head|Tail],Ticket,[Head|Rest]) :- claim_badge(Tail,Ticket,Rest).
    `,
  },
  {
    name: 'adjacent-run checks accept equality in the clause body', predicate: 'collapse', passes: true,
    program: String.raw`
      collapse([], []).
      collapse([X], [X]).
      collapse([X,Y|Tail], Result) :- X = Y, collapse([Y|Tail], Result).
      collapse([X,Y|Tail], [X|Rest]) :- X \= Y, collapse([Y|Tail], Rest).
    `,
  },
  {
    name: 'adjacent-run checks reject globally sorted deduplication', predicate: 'collapse', passes: false,
    program: ':- use_module(library(lists)). collapse(Input,Output) :- sort(Input,Output).',
  },
  {
    name: 'adjacent-run checks reject overlapping equal and unequal cases', predicate: 'collapse', passes: false,
    program: `
      collapse([], []).
      collapse([X], [X]).
      collapse([X,X|Tail], Result) :- collapse([X|Tail], Result).
      collapse([X,Y|Tail], [X|Rest]) :- collapse([Y|Tail], Rest).
    `,
  },
  {
    name: 'accumulator checks accept an equivalent library-based relation', predicate: 'reverse_into', passes: true,
    program: `
      :- use_module(library(lists)).
      reverse_list(List,Result) :- reverse_into(List,[],Result).
      reverse_into(List,Accumulator,Result) :- reverse(List,Reversed), append(Reversed,Accumulator,Result).
    `,
  },
  {
    name: 'accumulator checks reject discarding a nonempty suffix', predicate: 'reverse_into', passes: false,
    program: ':- use_module(library(lists)). reverse_list(L,R) :- reverse(L,R). reverse_into(L,_,R) :- reverse(L,R).',
  },
  {
    name: 'interleaving accepts swapping list roles on each recursive call', predicate: 'weave', passes: true,
    program: 'weave([],Ys,Ys). weave([X|Xs],Ys,[X|Rest]) :- weave(Ys,Xs,Rest).',
  },
  {
    name: 'interleaving rejects overlapping empty cases that duplicate proofs', predicate: 'weave', passes: false,
    program: `
      weave([],Ys,Ys).
      weave(Xs,[],Xs).
      weave([X|Xs],[Y|Ys],[X,Y|Rest]) :- weave(Xs,Ys,Rest).
    `,
  },
  {
    name: 'interleaving rejects discarding an unmatched suffix', predicate: 'weave', passes: false,
    program: `
      weave([],_,[]).
      weave([_|_],[],[]).
      weave([X|Xs],[Y|Ys],[X,Y|Rest]) :- weave(Xs,Ys,Rest).
    `,
  },
  {
    name: 'last-occurrence checks accept a deterministic membership branch', predicate: 'keep_last', passes: true,
    program: `
      :- use_module(library(lists)).
      keep_last([],[]).
      keep_last([H|T],Result) :- keep_last(T,Rest), (member(H,T) -> Result = Rest ; Result = [H|Rest]).
    `,
  },
  {
    name: 'last-occurrence checks reject sorted unique values', predicate: 'keep_last', passes: false,
    program: ':- use_module(library(lists)). keep_last(Input,Output) :- sort(Input,Output).',
  },
  {
    name: 'open-route checks accept complete-route filtering after a bounded path search', predicate: 'open_route', passes: true,
    program: routeMap + `
      open_route(A,B,Stops) :- route(A,B,Stops), all_open(Stops).
      route(A,B,[B]) :- path(A,B).
      route(A,B,[M|Rest]) :- path(A,M), route(M,B,Rest).
      all_open([]).
      all_open([H|T]) :- not(closed(H)), all_open(T).
    `,
  },
  {
    name: 'open-route checks reject checking only the destination for closure', predicate: 'open_route', passes: false,
    program: routeMap + `
      open_route(A,B,Stops) :- route(A,B,Stops), not(closed(B)).
      route(A,B,[B]) :- path(A,B).
      route(A,B,[M|Rest]) :- path(A,M), route(M,B,Rest).
    `,
  },
  {
    name: 'open-route checks accept repeated proofs without adding a different route', predicate: 'open_route', passes: true,
    program: routeMap + `
      open_route(A,B,[B]) :- path(A,B), not(closed(B)).
      open_route(A,B,[B]) :- path(A,B), not(closed(B)).
      open_route(A,B,[M|Rest]) :- path(A,M), not(closed(M)), open_route(M,B,Rest).
    `,
  },
];

for (const candidate of replacementCandidates) {
  test('the replacement ' + candidate.name, async () => {
    const results = await gradeProgram('prolog', candidate.predicate, candidate.program);
    assert.equal(results.every(result => result.passed), candidate.passes, JSON.stringify(results, null, 2));
  });
}

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
