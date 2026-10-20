'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const tutorials = Object.fromEntries(['class', 'sequence'].map(kind => [kind,
  yaml.load(fs.readFileSync(path.join(root, `_data/tutorials/uml-${kind}-diagram-python.yml`), 'utf8')),
]));

// Execute the published grading commands, with only Pyodide's /tutorial
// workspace mapped to an isolated native-Python temporary directory.
const runChecks = String.raw`
import contextlib, io, json, pathlib, sys
payload = json.load(sys.stdin)
for filename in pathlib.Path('.').rglob('*.py'):
    compile(filename.read_text(), str(filename), 'exec')
results = []
for check in payload['checks']:
    namespace = {'__name__': '__main__'}
    result = {'description': check['description'], 'passed': True}
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            for command in payload['setup'] + [check['command']]:
                exec(command, namespace)
    except BaseException as error:
        result.update(passed=False, error=type(error).__name__, message=str(error))
    results.append(result)
print(json.dumps(results))
`;

function lesson(kind, identity) {
  const step = typeof identity === 'number'
    ? tutorials[kind].steps[identity - 1]
    : tutorials[kind].steps.find(candidate => candidate.key === identity);
  assert.ok(step, `Missing ${kind} tutorial lesson: ${identity}`);
  return step;
}

function studentSource(kind, identity, version = 'solution') {
  const step = lesson(kind, identity);
  const files = version === 'solution' ? step.solution.files : step.files;
  return files.find(file => file.path.replace(/^\/tutorial\//, '') === step.open_file).content;
}

function replace(source, before, after) {
  assert.ok(source.includes(before), `Candidate fixture must still contain ${JSON.stringify(before)}`);
  return source.replace(before, after);
}

function grade(kind, identity, source = studentSource(kind, identity)) {
  const tutorial = tutorials[kind];
  const step = lesson(kind, identity);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'uml-python-grading-'));
  try {
    const files = [...step.files, ...step.solution.files, { path: step.open_file, content: source }];
    for (const file of files) {
      const destination = path.join(workspace, file.path.replace(/^\/tutorial\//, ''));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.content.replaceAll('/tutorial', workspace));
    }
    const payload = {
      setup: [...(tutorial.setup_commands || []), ...(step.setup_commands || [])],
      checks: step.tests,
    };
    const result = spawnSync('python3', ['-c', runChecks], {
      cwd: workspace,
      input: JSON.stringify(payload).replaceAll('/tutorial', workspace),
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

function accepts(kind, number, source) {
  assert.deepEqual(grade(kind, number, source).filter(check => !check.passed), []);
}

function rejects(kind, number, source) {
  const failures = grade(kind, number, source).filter(check => !check.passed);
  assert.ok(failures.length, 'The incorrect submission must fail an authored criterion');
  assert.ok(failures.every(check => check.error === 'AssertionError'),
    `An incidental execution error is not evidence that the intended mistake was caught: ${JSON.stringify(failures)}`);
}

for (const [kind, tutorial] of Object.entries(tutorials)) {
  tutorial.steps.forEach((step, index) => {
    if (step.tests) test(`${kind} step ${index + 1}: published solution passes every check`, () => {
      accepts(kind, index + 1);
    });
  });
}

for (const [kind, number] of [['sequence', 3], ['sequence', 4], ['sequence', 5], ['class', 'store-capstone']]) {
  test(`${kind} step ${number}: unfinished starter cannot complete the exercise`, () => {
    const results = grade(kind, number, studentSource(kind, number, 'starter'));
    assert.ok(results.some(check => !check.passed), 'Starter must leave work for the learner');
  });
}

test('sequence step 1 rejects notifying before sending the greeting', () => {
  rejects('sequence', 1, replace(studentSource('sequence', 1),
    'bot.send("Hello, world!")\n    channel.notify_members("Welcome")',
    'channel.notify_members("Welcome")\n    bot.send("Hello, world!")'));
});

test('sequence step 2 rejects overwriting the returned member count', () => {
  rejects('sequence', 2, replace(studentSource('sequence', 2),
    'count = bot.get_member_count()', 'count = bot.get_member_count()\n    count = 5'));
});

test('sequence step 2 accepts an intermediate notification message', () => {
  accepts('sequence', 2, replace(studentSource('sequence', 2),
    'channel.notify_members(f"{count} members online")',
    'notification = f"{count} members online"\n    channel.notify_members(notification)'));
});

test('sequence step 3 rejects sending before logging', () => {
  rejects('sequence', 3, replace(studentSource('sequence', 3),
    'self._log(message)\n        self.send(message)',
    'self.send(message)\n        self._log(message)'));
});

test('sequence step 3 accepts an intermediate message variable', () => {
  accepts('sequence', 3, replace(studentSource('sequence', 3),
    'self._log(message)\n        self.send(message)',
    'outgoing = message\n        self._log(outgoing)\n        self.send(outgoing)'));
});

test('sequence step 3 rejects passing the wrong message to send', () => {
  rejects('sequence', 3, replace(studentSource('sequence', 3),
    'self.send(message)', 'self.send("a different message")'));
});

test('sequence step 4 rejects broadcasting spam after blocking it', () => {
  rejects('sequence', 4, replace(studentSource('sequence', 4),
    'self._block(message)', 'self._block(message)\n            channel.broadcast(message)'));
});

test('sequence step 4 accepts reversed condition polarity with corresponding branches', () => {
  accepts('sequence', 4, replace(studentSource('sequence', 4),
    'if self._is_spam(message):\n            self._block(message)\n        else:\n            channel.broadcast(message)',
    'if not self._is_spam(message):\n            channel.broadcast(message)\n        else:\n            self._block(message)'));
});

test('sequence step 5 rejects iterating over an empty list instead of the messages', () => {
  rejects('sequence', 5, replace(studentSource('sequence', 5), 'for msg in messages:', 'for msg in []:'));
});

test('sequence step 5 rejects sending only the first message', () => {
  rejects('sequence', 5, replace(studentSource('sequence', 5), 'for msg in messages:', 'for msg in messages[:1]:'));
});

test('sequence step 5 rejects silently dropping repeated messages', () => {
  rejects('sequence', 5, replace(studentSource('sequence', 5),
    'for msg in messages:', 'for msg in dict.fromkeys(messages):'));
});

test('sequence step 5 accepts a renamed iteration variable', () => {
  accepts('sequence', 5, studentSource('sequence', 5).replaceAll('msg', 'message'));
});

test('sequence step 5 accepts a while loop sending every message', () => {
  accepts('sequence', 5, replace(studentSource('sequence', 5),
    'for msg in messages:\n            channel.send_to_all(msg)',
    'index = 0\n        while index < len(messages):\n            channel.send_to_all(messages[index])\n            index += 1'));
});

test('sequence capstone rejects a digest that broadcasts skipped posts', () => {
  rejects('sequence', 'moderated-broadcast', replace(studentSource('sequence', 'moderated-broadcast'),
    'self._log_skip(post)', 'self._log_skip(post)\n                channel.broadcast(post)'));
});

test('sequence capstone rejects starting the log after processing posts', () => {
  const source = replace(studentSource('sequence', 'moderated-broadcast'), '        self._log_start(count)\n', '');
  rejects('sequence', 'moderated-broadcast', replace(source,
    '                self._log_skip(post)', '                self._log_skip(post)\n        self._log_start(count)'));
});

test('sequence capstone accepts an intermediate subscriber-count variable', () => {
  accepts('sequence', 'moderated-broadcast', replace(studentSource('sequence', 'moderated-broadcast'),
    'self._log_start(count)', 'audience = count\n        self._log_start(audience)'));
});

test('sequence capstone rejects running the digest twice from main', () => {
  rejects('sequence', 'moderated-broadcast', replace(studentSource('sequence', 'moderated-broadcast'),
    'bot.run_digest(channel, posts)',
    'bot.run_digest(channel, posts)\n    bot.run_digest(channel, posts)'));
});

test('class capstone rejects an order that leaves purchased stock unchanged', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'), '        product.reduce_stock()\n', ''));
});

test('class capstone rejects charging for a product without retaining the item', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'), '        self.items.append(product)\n', ''));
});

test('class capstone rejects replacing the running total with the last price', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'), 'self.total += product.price', 'self.total = product.price'));
});

test('class capstone rejects silently dropping repeated product requests', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'),
    'for name in product_names:', 'for name in dict.fromkeys(product_names):'));
});

test('class capstone rejects silently skipping unknown products', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'),
    'raise ValueError(f"Unknown product: {name}")', 'continue'));
});

test('class capstone rejects silently skipping unavailable units', () => {
  rejects('class', 'store-capstone', replace(studentSource('class', 'store-capstone'),
    'raise ValueError(f"Insufficient stock for {name}")', 'continue'));
});

test('class capstone rejects consuming stock before the whole request is validated', () => {
  let source = replace(studentSource('class', 'store-capstone'),
    '        selected = []', '        order = Order(customer)\n        selected = []');
  source = replace(source, '            selected.append(product)', '            order.add_item(product)');
  source = replace(source,
    '        order = Order(customer)\n        for product in selected:\n            order.add_item(product)\n', '');
  rejects('class', 'store-capstone', source);
});

test('class capstone accepts equivalent stock and total updates', () => {
  const source = replace(studentSource('class', 'store-capstone'), 'self.stock -= 1', 'self.stock = self.stock - 1');
  accepts('class', 'store-capstone', replace(source, 'self.total += product.price', 'self.total = self.total + product.price'));
});

test('class capstone accepts an explicit loop for product lookup', () => {
  accepts('class', 'store-capstone', replace(studentSource('class', 'store-capstone'),
    '            product = next((p for p in self.products if p.name == name), None)',
    '            product = None\n            for candidate in self.products:\n                if candidate.name == name:\n                    product = candidate\n                    break'));
});

test('class capstone recognizes extracted Product progress without passing the unfinished architecture', () => {
  const solution = studentSource('class', 'store-capstone');
  const product = solution.slice(0, solution.indexOf('\n\nclass Customer:'));
  const results = grade('class', 'store-capstone', product + '\n\n' + studentSource('class', 'store-capstone', 'starter'));
  assert.equal(results[0].passed, true, 'A correct Product extraction earns its criterion');
  assert.ok(results.slice(1).some(check => !check.passed), 'The remaining responsibilities still need to be extracted');
});

test('the association example retains its arrow but loses multiplicity when only its attribute annotation is removed', () => {
  const context = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/uml-sequence-diagnostics.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/uml-constant-values.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/uml-return-summaries.js'), 'utf8'), context);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/uml-analyzer-python.js'), 'utf8'), context);
  const source = studentSource('class', 5);
  const original = context.analyzePythonSources({ 'enrollment.py': source });
  const unannotated = context.analyzePythonSources({
    'enrollment.py': replace(source, 'self.instructor: Instructor = instructor', 'self.instructor = instructor'),
  });
  assert.equal(original.errors.length, 0);
  assert.equal(unannotated.errors.length, 0);
  assert.match(original.classDiagram, /Course .*--> "1" Instructor/);
  assert.match(unannotated.classDiagram, /Course .*--> Instructor/);
  assert.doesNotMatch(unannotated.classDiagram, /Course .*--> "1" Instructor/);
});
