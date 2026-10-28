const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(
  path.resolve(__dirname, '../../_data/tutorials/python-debugging.yml'), 'utf8'));

// Exercise the documented Python source-condition contract. Correctness is
// independently checked by python-debugging-graders.test.js; source profiles
// choose support only after a behavioral criterion fails.
function applicableHints(check, source) {
  const code = source.replace(/#.*$/gm, '');
  return check.hints.flatMap((hint, index) => {
    const condition = hint.condition.match(/^code_matches:\s*\/(.*)\/([a-z]*)$/);
    assert.ok(condition, 'Each support profile uses a valid explicit code condition');
    return new RegExp(condition[1], condition[2]).test(code) ? [index] : [];
  });
}

const profiles = {
  greet: {
    name: 'greet',
    partial: "def greet(names):\n    return 'Hello, ' + names[0] + '!'\n",
    developed: "def greet(names):\n    return ', '.join(['Hello', *names]) + '!'\n",
  },
  maze: {
    name: 'find_path',
    partial: 'def find_path(maze, max_steps):\n    start = (1, 1)\n    goal = (1, 3)\n    return [start, goal]\n',
    developed: 'def find_path(maze, max_steps):\n    return search_with_budget(maze, max_steps)\n',
  },
  load: {
    name: 'load_transactions',
    partial: 'def load_transactions(path):\n    return [row["type"].lstrip().upper() for row in read_rows(path)]\n',
    developed: 'def load_transactions(path):\n    return [make_transaction(row) for row in read_rows(path)]\n',
  },
  arithmetic: {
    name: 'apply_transaction',
    partial: 'def apply_transaction(balances, tx):\n    before = balances.get(tx.account, 0)\n    if tx.kind == "FEE":\n        after = before - tx.amount_cents\n    elif tx.kind == "REVERSAL":\n        after = before - tx.amount_cents\n    balances[tx.account] = after\n',
    developed: 'def apply_transaction(balances, tx):\n    sign = 1 if tx.kind in ("DEPOSIT", "REFUND", "REVERSAL") else -1\n    balances[tx.account] = balances.get(tx.account, 0) + sign * tx.amount_cents\n',
  },
  queue: {
    name: 'allocate_next',
    partial: 'def allocate_next(course_name, course):\n    while course.open_seats > 0 and course.waitlist:\n        student = sorted(course.waitlist)[0]\n        course.waitlist.remove(student)\n        course.enrolled.append(student)\n',
    developed: 'def allocate_next(course_name, course):\n    while course.open_seats > 0 and course.waitlist:\n        course.enrolled.append(course.waitlist.popleft())\n',
  },
  join: {
    name: '_handle_join',
    partial: 'def _handle_join(course, student):\n    course.waitlist.insert(0, student)\n',
    developed: 'def _handle_join(course, student):\n    target = course.enrolled if course.open_seats else course.waitlist\n    target.append(student)\n',
  },
  tag: {
    name: 'top_tag',
    partial: 'def top_tag(articles_path):\n    counts = Counter()\n    for tag in read_tags(articles_path):\n        counts[tag.upper()] += 1\n    return counts.most_common(1)[0][0].strip()\n',
    developed: 'def top_tag(articles_path):\n    counts = Counter(tag.strip().upper() for tag in read_tags(articles_path))\n    return max(counts, key=counts.get)\n',
  },
};

const cases = [
  [0, ['greet', 'greet', 'greet']],
  [2, ['maze', 'maze', 'maze', 'maze']],
  [3, ['load', 'load', 'arithmetic', 'load']],
  [5, ['queue', 'queue', 'queue', 'queue', 'join']],
  [7, ['tag', 'tag', 'tag']],
];

for (const [stepIndex, profileNames] of cases) {
  const step = tutorial.steps[stepIndex];
  const starter = step.files.map(file => file.content || '').join('\n');
  for (const [checkIndex, profileName] of profileNames.entries()) {
    const check = step.tests[checkIndex];
    const profile = profiles[profileName];
    test(`${step.title}: ${check.description} selects useful support for source states`, () => {
      assert.deepEqual(applicableHints(check, starter), [0], 'Untouched source gets orientation');
      assert.deepEqual(applicableHints(check, profile.partial), [1], 'Recognizable misconception gets a diagnostic comparison');
      assert.deepEqual(applicableHints(check, profile.developed), [2], 'Another approach gets an incomplete investigation scaffold');
      assert.deepEqual(applicableHints(check, ''), [0], 'Deleting the definition retains useful orientation');

      const unrelated = profile.partial.replace(`def ${profile.name}(`, 'def unrelated_example(');
      const commented = profile.partial.split('\n').map(line => '# ' + line).join('\n');
      for (const distraction of [unrelated, commented]) {
        assert.deepEqual(applicableHints(check, distraction), [0], 'Examples cannot replace a missing definition');
        assert.deepEqual(applicableHints(check, profile.developed + '\n' + distraction), [2],
          'A later helper or comment cannot turn a developed approach into a recognized misconception');
        assert.deepEqual(applicableHints(check, distraction + '\n' + profile.developed), [2],
          'An earlier helper or comment cannot turn a developed approach into a recognized misconception');
      }
    });
  }
}
