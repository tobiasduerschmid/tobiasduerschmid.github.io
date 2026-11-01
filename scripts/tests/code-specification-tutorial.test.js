const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join} = require('node:path');
const {spawnSync} = require('node:child_process');
const yaml = require('js-yaml');

const tutorial = yaml.load(readFileSync(join(__dirname, '../../_data/tutorials/code-specification.yml'), 'utf8'));
const step = key => tutorial.steps.find(item => item.key === key);
const original = step('handover').files.find(file => file.path === 'rover_reference.py').content;
const whole = step('whole-contract').llm;
const solution = step('whole-contract').solution.files[0].content;

async function check(source, exercise = whole) {
  const {checkProgram} = await import('../../js/browser-llm/checks.mjs');
  const result = spawnSync('python3', ['-c', checkProgram(source, exercise)], {encoding: 'utf8', timeout: 5000});
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('undefined helpers fail even when the original helpers exist from an earlier Python run', async t => {
  const candidates = [
    ['omitted helper definitions', readFileSync(join(__dirname, '../../tests/fixtures/rover-undefined-helpers.py'), 'utf8')],
    ['borrowing a previous controller', 'def navigate(commands):\n    return previous_navigate(commands)']
  ];
  const {checkProgram} = await import('../../js/browser-llm/checks.mjs');
  const {specificationFeedback} = await import('../../js/browser-llm/specification-exercise.mjs');
  for (const [name, candidate] of candidates) await t.test(name, () => {
    // The prior controller would pass every check if the candidate could
    // borrow it. Only the replacement's own definitions may be used.
    const script = original + '\nprevious_navigate = navigate\n' + checkProgram(candidate, whole);
    const execution = spawnSync('python3', ['-c', script], {encoding: 'utf8', timeout: 5000});
    assert.ifError(execution.error);
    assert.equal(execution.status, 0, execution.stderr);
    const result = JSON.parse(execution.stdout);
    assert.equal(result.status, 'runtime');
    assert.match(specificationFeedback(result), /did not pass/i);
    assert.ok(!JSON.stringify(result).includes('turn_heading'), 'Hidden execution details must stay private');
  });
});

test('the substantial original and independent algorithms satisfy the same rover checks', async t => {
  assert.ok(original.trim().split('\n').length >= 100, 'The reading task must supply at least 100 lines of source');
  const alternatives = {
    original,
    'instructor solution': solution,
    'complex coordinates and rotations': `
def navigate(commands):
    position, direction = 0j, 1+0j
    history = []
    headings = {1j: 'N', 1+0j: 'E', -1j: 'S', -1+0j: 'W'}
    walls = {2+1j, 2+2j, 2+3j}
    for letter in commands:
        command = letter.upper()
        before = (position, direction)
        if command == 'X':
            position, direction = 0j, 1+0j
            history = []
        elif command == 'U':
            if history:
                position, direction = history.pop()
        elif command == 'L' or command == 'R':
            direction *= 1j if command == 'L' else -1j
            history.append(before)
        elif command == 'F':
            target = position + direction
            if 0 <= target.real <= 4 and 0 <= target.imag <= 4 and target not in walls:
                history.append(before)
                position = target
    return (int(position.real), int(position.imag), headings[direction])
`,
    'replay retained actions after undo': `
def navigate(commands):
    actions = []
    rotations = {'L': dict(zip('NESW', 'WNES')), 'R': dict(zip('NESW', 'ESWN'))}
    movements = {'N': (0, 1), 'E': (1, 0), 'S': (0, -1), 'W': (-1, 0)}
    def apply(state, action):
        x, y, heading = state
        if action in rotations:
            return (x, y, rotations[action][heading])
        dx, dy = movements[heading]
        target = (x + dx, y + dy)
        if not (0 <= target[0] < 5 and 0 <= target[1] < 5) or target in ((2, 1), (2, 2), (2, 3)):
            return state
        return (target[0], target[1], heading)
    state = (0, 0, 'E')
    for letter in commands:
        command = letter.upper()
        if command == 'X':
            actions = []
            state = (0, 0, 'E')
        elif command == 'U':
            if actions:
                actions.pop()
                state = (0, 0, 'E')
                for action in actions:
                    state = apply(state, action)
        elif command in ('F', 'L', 'R'):
            changed = apply(state, command)
            if changed != state:
                actions.append(command)
                state = changed
    return state
`
  };
  for (const [name, source] of Object.entries(alternatives)) {
    await t.test(name, async () => assert.deepEqual(await check(source), {status: 'checked', failed: []}));
  }
});

test('rover checks detect plausible rule changes through behavior', async t => {
  const mutations = [
    ['turning sign reversed', '("N", "E", "S", "W")', '("N", "W", "S", "E")', 'ordering'],
    ['north decreases y', '"N": (0, 1)', '"N": (0, -1)', 'boundaries'],
    ['upper border off by one', 'GRID_SIZE = 5', 'GRID_SIZE = 6', 'boundaries'],
    ['lower border excluded', '0 <= x < GRID_SIZE', '0 < x < GRID_SIZE', 'ordering'],
    ['first wall missing', '{(2, 1), (2, 2), (2, 3)}', '{(2, 2), (2, 3)}', 'boundaries'],
    ['middle wall missing', '{(2, 1), (2, 2), (2, 3)}', '{(2, 1), (2, 3)}', 'boundaries'],
    ['last wall missing', '{(2, 1), (2, 2), (2, 3)}', '{(2, 1), (2, 2)}', 'boundaries'],
    ['obstacles ignored', 'if position in WALLS:', 'if False:', 'boundaries'],
    ['case-sensitive commands', 'command = command.upper()', 'command = command', 'input-contract'],
    ['space resets the rover', 'command = command.upper()', 'if command == " ":\n        return reset_session(history)\n    command = command.upper()', 'input-contract'],
    ['blocked forward consumes undo', 'if candidate != state:', 'if True:', 'ordering'],
    ['turns are not undoable', 'if candidate != state:', 'if candidate != state and command == "F":', 'ordering'],
    ['undo changes position only', 'return history.pop()', 'saved = history.pop()\n        return (saved[0], saved[1], state[2])', 'ordering'],
    ['undo does not remove history', 'return history.pop()', 'return history[-1]', 'ordering'],
    ['undo adds another history entry', 'return history.pop()', 'saved = history.pop()\n        history.append(state)\n        return saved', 'ordering'],
    ['empty undo changes state', 'if history:\n        return history.pop()\n    return state', 'if history:\n        return history.pop()\n    return (1, 0, "E")', 'ordering'],
    ['reset keeps old history', 'history.clear()', 'pass', 'ordering'],
    ['reset changes the initial heading', 'return START', 'return (0, 0, "N")', 'ordering'],
    ['history leaks across calls', 'history = []', 'history = globals().setdefault("_saved_history", [])', 'mutation'],
    ['printing during calls', 'state = START\n    history = []', 'print("debug")\n    state = START\n    history = []', 'output-contract']
  ];
  for (const [name, before, after, category] of mutations) {
    await t.test(name, async () => {
      assert.ok(original.includes(before), 'Mutation must reach the intended rule');
      const result = await check(original.replace(before, after));
      assert.equal(result.status, 'checked', 'An incidental execution error is not a detected behavioral mismatch');
      assert.ok(result.failed.includes(category), `${name}: expected ${category}, got ${result.failed}`);
    });
  }
  const additionalMutations = {
    'ignored characters consume undo': [original.replace(
      'return apply_action(state, command, history)\n    return state',
      'return apply_action(state, command, history)\n    history.append(state)\n    return state'), 'ordering'],
    'list returned instead of tuple': [original.replace(/return state\s*$/, 'return list(state)\n'), 'output-contract'],
    'last state reused by the next empty call': [original + `
_navigate_once = navigate
_last = (0, 0, 'E')
def navigate(commands):
    global _last
    if commands:
        _last = _navigate_once(commands)
    return _last
`, 'mutation']
  };
  for (const [name, [source, category]] of Object.entries(additionalMutations)) {
    await t.test(name, async () => {
      const result = await check(source);
      assert.equal(result.status, 'checked');
      assert.ok(result.failed.includes(category), `${name}: expected ${category}, got ${result.failed}`);
    });
  }
});

test('helper checks cover every valid turn and accept a different algorithm', async () => {
  const exercise = step('function-contract').llm;
  const helper = step('function-contract').solution.files[0].content;
  const lookup = `
def turn_heading(heading, command):
    turns = {'N': ('W', 'E'), 'E': ('N', 'S'), 'S': ('E', 'W'), 'W': ('S', 'N')}
    return turns[heading][command == 'R']
`;
  for (const source of [original, helper, lookup]) {
    assert.deepEqual(await check(source, exercise), {status: 'checked', failed: []});
  }
  for (const source of [
    helper.replace("1 if command == 'R' else -1", "-1 if command == 'R' else 1"),
    helper.replace('(headings.index(heading) + offset) % 4', 'min(3, max(0, headings.index(heading) + offset))'),
    helper.replace("headings = 'NESW'", "print('debug')\n    headings = 'NESW'"),
    'def turn_heading(heading, command):\n    return heading'
  ]) {
    const result = await check(source, exercise);
    assert.equal(result.status, 'checked');
    assert.ok(result.failed.length > 0);
  }
});

test('main missions share the same checks and draft while the helper has its own draft', async () => {
  assert.equal(tutorial.progress_version, 2, 'The changed curriculum must not reuse earlier completion state');
  for (const key of ['handover', 'evidence', 'whole-contract', 'regression-review']) {
    assert.deepEqual(step(key).llm.checks, whole.checks);
    assert.equal(step(key).llm.draft_id, 'rover-main');
  }
  assert.equal(step('function-contract').llm.draft_id, 'rover-turn');
  const review = step('regression-review');
  assert.deepEqual(await check(review.solution.files[0].content, review.llm), {status: 'checked', failed: []});
  const instructorContract = step('whole-contract').solution.explanation.split('\n\n')[0];
  assert.ok(instructorContract.length <= 1200, 'The complete instructor prose must fit the learner field');
});

test('fixed demonstrations execute the originals and the transfer answer follows its source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sebook-contract-'));
  try {
    for (const item of tutorial.steps) {
      for (const file of item.files) writeFileSync(join(dir, file.path), file.content);
      const result = spawnSync('python3', [item.run_file], {cwd: dir, encoding: 'utf8', timeout: 5000});
      assert.equal(result.status, 0, `${item.title}: ${result.stderr}`);
      assert.ok(result.stdout.trim(), `${item.title}: Run must show the supplied demonstration`);
      if (item.key === 'handover') assert.ok(result.stdout.includes("Final state: (1, 1, 'N')"));
      if (item.key === 'function-contract') assert.ok(result.stdout.includes('Heading N, command L: W'));
      if (item.key === 'independent-transfer') assert.ok(result.stdout.includes("(['Moths', 'Rockets'], 0)"));
    }
    const result = spawnSync('python3', ['-c', `
from queue_reference import admit_groups
assert admit_groups([], 0) == ([], 0)
assert admit_groups([('a', 0), ('a', -1), ('a', 1)], 1) == (['a'], 0)
assert admit_groups([('A', 1), ('a', 1), ('A', 1)], 3) == (['A', 'a'], 1)
assert admit_groups([('a', 4), ('b', 2), ('a', 1)], 3) == (['b', 'a'], 0)
requests = [('z', 1)]
chosen, remaining = admit_groups(requests, 2)
chosen.append('x')
assert requests == [('z', 1)]
assert admit_groups(requests, 2) == (['z'], 1)
`], {cwd: dir, encoding: 'utf8', timeout: 5000});
    assert.equal(result.status, 0, result.stderr);
  } finally {rmSync(dir, {recursive: true, force: true});}
});

test('learner workspaces contain original readings, fixed demonstrations, and persistent prose notes', () => {
  const references = new Map([
    ['rover_reference.py', original],
    ['queue_reference.py', step('independent-transfer').files.find(file => file.path === 'queue_reference.py').content]
  ]);
  for (const item of tutorial.steps) {
    const notes = item.files.find(file => file.path === 'field_notes.md');
    assert.equal(notes?.persistent, true, `${item.title}: prose evidence must survive a step reset`);
    assert.ok(item.files.some(file => file.path === item.run_file), `${item.title}: fixed demonstration must be supplied`);
    for (const file of item.files.filter(file => file.path.endsWith('.py'))) {
      assert.ok(references.has(file.path) || file.path === item.run_file,
        `${item.title}: ${file.path} must be a reading or fixed demonstration, not an implementation task`);
      if (references.has(file.path)) assert.equal(file.content, references.get(file.path));
    }
  }
});

test('generation receives student prose and an interface, never the original or hidden checks', async () => {
  const {generationMessages} = await import('../../js/browser-llm/prompts.mjs');
  for (const item of tutorial.steps.filter(item => item.llm)) {
    assert.equal(item.llm.mode, 'specification', 'Learners submit prose without applying generated code');
    assert.equal(item.llm.specification, '', 'The learner must start with their own prose');
    assert.equal(item.llm.file, 'rover_reference.py', 'The original supplies the source snapshot for specification mode');
    assert.equal(item.files.find(file => file.path === item.llm.file)?.content, original);
    assert.equal(item.tests, undefined, 'Hidden commands must not become ordinary learner-visible tests');
    const prompt = JSON.stringify(generationMessages('My independently written specification.', item.llm.interface));
    assert.ok(!prompt.includes('WALLS ='));
    assert.ok(!prompt.includes('subject['));
    for (const group of item.llm.checks) assert.ok(!prompt.includes(JSON.stringify(group.command).slice(1, -1)));
  }
  assert.equal(step('independent-transfer').llm, undefined, 'The transfer task must not offer generation');
});
