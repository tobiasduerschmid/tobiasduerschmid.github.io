const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const tutorial = yaml.load(fs.readFileSync(path.join(root, '_data/tutorials/java-cs131.yml'), 'utf8'));
const workerSource = fs.readFileSync(path.join(root, 'js/java-worker.js'), 'utf8');

// Exercise the worker's public message protocol. The VM deadline bounds faulty
// learner loops; only the worker's boot-notification timer is unnecessary here.
function createJavaWorker() {
  const messages = [];
  const context = vm.createContext({
    postMessage: message => messages.push(message),
    setTimeout: () => {},
  });
  vm.runInContext('var self = globalThis;', context);
  vm.runInContext(workerSource, context);
  let nextId = 1;

  function request(message) {
    const id = nextId++;
    messages.length = 0;
    context.pendingMessage = { data: { ...message, id } };
    vm.runInContext('onmessage(pendingMessage)', context, { timeout: 2_000 });
    const result = messages.find(entry => entry.id === id);
    assert.ok(result, `Java worker must answer ${message.type}`);
    return {
      ...result,
      diagnostic: messages.filter(entry => entry.type === 'stderr').map(entry => entry.text).join(''),
    };
  }

  return {
    write(files) {
      for (const file of files) {
        assert.equal(request({ type: 'write', path: '/tutorial/' + file.path, content: file.content }).type, 'write_ok');
      }
    },
    run(file) { return request({ type: 'run', path: '/tutorial/' + file }); },
    check(command) { return request({ type: 'runCode', code: command, silent: false }); },
  };
}

function checkResults(worker, step) {
  return step.tests.map(check => ({
    description: check.description,
    ...worker.check(check.command),
  }));
}

function expectPassingChecks(worker, step) {
  for (const result of checkResults(worker, step)) {
    assert.equal(result.exitCode, 0, `${step.title}: ${result.description}\n${result.diagnostic}`);
  }
}

for (const step of tutorial.steps) {
  test(`${step.title}: runnable starter leaves assessed work unfinished`, () => {
    const worker = createJavaWorker();
    worker.write(step.files);
    const run = worker.run(step.run_file);
    assert.equal(run.exitCode, 0, run.diagnostic);
    assert.ok(checkResults(worker, step).some(result => result.exitCode !== 0), 'The starter must not earn a completed exercise');
  });

  test(`${step.title}: reference solution satisfies the authored behavioral contract`, () => {
    const worker = createJavaWorker();
    worker.write(step.solution.files);
    const run = worker.run(step.run_file);
    assert.equal(run.exitCode, 0, run.diagnostic);
    expectPassingChecks(worker, step);
  });
}

test('solutions remain executable with drafts from earlier lessons in the workspace', () => {
  const worker = createJavaWorker();
  for (const step of tutorial.steps) {
    worker.write(step.files);
    worker.write(step.solution.files);
    const run = worker.run(step.run_file);
    assert.equal(run.exitCode, 0, `${step.title}\n${run.diagnostic}`);
    expectPassingChecks(worker, step);
  }
});

// These are alternate learner implementations of the declared public methods,
// not mutations of the worker. A solution's internal refactoring is immaterial:
// replace just the assessed method body while retaining the supplied scaffold.
function withMethodBody(step, owner, method, body) {
  let replaced = false;
  const files = step.solution.files.map(file => {
    const syntax = file.content.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
      token => token.replace(/[^\n]/g, ' '));
    const ownerPattern = new RegExp('\\bclass\\s+' + owner + '\\b');
    const ownerStart = syntax.search(ownerPattern);
    if (ownerStart < 0) return file;
    const methodPattern = new RegExp('\\b' + method + '\\s*\\([^)]*\\)\\s*\\{', 'g');
    methodPattern.lastIndex = ownerStart;
    const match = methodPattern.exec(syntax);
    assert.ok(match, `Missing exercise method ${owner}.${method}`);
    const opening = methodPattern.lastIndex - 1;
    let closing = opening + 1;
    let depth = 1;
    for (; closing < syntax.length && depth > 0; closing++) {
      if (syntax[closing] === '{') depth++;
      if (syntax[closing] === '}') depth--;
    }
    assert.equal(depth, 0, `Unclosed exercise method ${owner}.${method}`);
    replaced = true;
    return { ...file, content: file.content.slice(0, opening + 1) + '\n' + body + '\n' + file.content.slice(closing - 1) };
  });
  assert.ok(replaced, `Missing exercise class ${owner}`);
  return files;
}

const attempts = [
  {
    key: 'static-types', owner: 'StaticTypes', method: 'canReserve',
    wrong: [
      ['excludes an exact budget', 'return credits > cost;'],
      ['accepts insufficient credits', 'return true;'],
      ['treats zero credits as always insufficient', 'return credits > 0;'],
    ],
    correct: ['return !(credits < cost);', 'if (cost > credits) return false; return true;'],
  },
  {
    key: 'reference-aliases', owner: 'ReferenceCopies', method: 'snapshot',
    wrong: [
      ['returns an alias', 'return source;'],
      ['allocates without copying elements', 'return new int[source.length];'],
      ['copies only the first element', 'int[] result = new int[source.length]; if (source.length > 0) result[0] = source[0]; return result;'],
    ],
    correct: [
      'int[] result = new int[source.length]; int i = source.length; while (i > 0) { i--; result[i] = source[i]; } return result;',
      'int[] result = new int[source.length]; int i = 0; for (int value : source) { result[i] = value; i++; } return result;',
    ],
  },
  {
    key: 'parameter-values', owner: 'ParameterValues', method: 'award',
    wrong: [
      ['rebinds instead of mutating the shared object', 'int previous = badge.points; badge = new PointsBadge(previous + delta); return previous;'],
      ['returns the updated value', 'badge.points += delta; return badge.points;'],
      ['reports the old value without changing the badge', 'return badge.points;'],
    ],
    correct: [
      'badge.points += delta; return badge.points - delta;',
      'int before = badge.points; badge.points += delta; return before;',
    ],
  },
  {
    key: 'identity-equality', owner: 'LabelSearch', method: 'countLabel',
    wrong: [
      ['compares object identity', 'int count = 0; for (String label : labels) if (label == target) count++; return count;'],
      ['counts only the first match', 'for (String label : labels) if (label.equals(target)) return 1; return 0;'],
      ['ignores case', 'int count = 0; for (String label : labels) if (label.equalsIgnoreCase(target)) count++; return count;'],
    ],
    correct: [
      'int count = 0; for (int i = 0; i < labels.length; i++) if (target.equals(labels[i])) count++; return count;',
      'int count = 0; int i = labels.length; while (i > 0) { i--; count += labels[i].equals(target) ? 1 : 0; } return count;',
    ],
  },
  {
    key: 'short-circuit', owner: 'SafeLookup', method: 'hasOpening',
    wrong: [
      ['dereferences absent input', 'return index >= 0 && index < slots.length && slots[index] > 0;'],
      ['accepts zero availability', 'return slots != null && index >= 0 && index < slots.length && slots[index] >= 0;'],
      ['changes availability while checking it', 'if (slots == null || index < 0 || index >= slots.length) return false; slots[index] = 1; return true;'],
    ],
    correct: [
      'if (slots == null) return false; if (index < 0 || index >= slots.length) return false; return slots[index] > 0;',
      'if (index < 0 || slots == null) return false; return index < slots.length && slots[index] > 0;',
    ],
  },
  {
    key: 'interface-contracts', owner: 'InterfaceClient', method: 'total',
    wrong: [
      ['returns only the first cost', 'return entries.length == 0 ? 0 : entries[0].cost();'],
      ['counts objects instead of their costs', 'return entries.length;'],
      ['rejects unfamiliar implementations', 'int sum = 0; for (Admission entry : entries) if (entry instanceof SingleAdmission || entry instanceof PairAdmission) sum += entry.cost(); return sum;'],
    ],
    correct: [
      'int sum = 0; for (int i = 0; i < entries.length; i++) sum += entries[i].cost(); return sum;',
      'int result = 0; int i = entries.length; while (i > 0) { i--; result += entries[i].cost(); } return result;',
    ],
  },
  {
    key: 'method-dispatch', owner: 'WeekendEntry', method: 'price',
    wrong: [
      ['omits the base price', 'return extra;'],
      ['omits the additional fee', 'return super.price();'],
      ['changes the fee on every query', 'return super.price() + extra++;'],
    ],
    correct: ['return extra + super.price();', 'int amount = super.price(); amount += extra; return amount;'],
  },
  {
    key: 'checked-casts', owner: 'CheckedTypes', method: 'bonusOf',
    wrong: [
      ['casts every input without a guard', 'return ((BonusToken) item).bonus();'],
      ['ignores recognized tokens', 'return 0;'],
      ['hardcodes one token value', 'return item instanceof BonusToken ? 9 : 0;'],
    ],
    correct: [
      'if (!(item instanceof BonusToken)) return 0; BonusToken token = (BonusToken) item; return token.bonus();',
      'return item instanceof BonusToken ? ((BonusToken) item).bonus() : 0;',
    ],
  },
  {
    key: 'parametric-types', owner: 'TypedShelf', method: 'exchange',
    wrong: [
      ['returns the replacement', 'item = next; return item;'],
      ['does not store the replacement', 'return item;'],
      ['discards the previous value', 'item = next; return null;'],
    ],
    correct: ['T old = get(); this.item = next; return old;', 'T old = this.item; this.item = next; return old;'],
  },
  {
    key: 'iterator-state', owner: 'IteratorClient', method: 'sum',
    wrong: [
      ['leaves the cursor untouched', 'return 0;'],
      ['consumes only one remaining element', 'return cursor.hasNext() ? cursor.next() : 0;'],
      ['counts elements instead of summing them', 'int count = 0; while (cursor.hasNext()) { cursor.next(); count++; } return count;'],
    ],
    correct: [
      'int total = 0; for (; cursor.hasNext(); ) total += cursor.next(); return total;',
      'int result = 0; while (true) { if (!cursor.hasNext()) return result; int value = cursor.next(); result = result + value; }',
    ],
  },
  {
    key: 'exception-flow', owner: 'ExceptionFlow', method: 'quote',
    wrong: [
      ['cleans up only on success', 'try { int result = validate(seats); completed++; return result; } catch (IllegalArgumentException problem) { return -1; }'],
      ['replaces every result with recovery', 'completed++; return -1;'],
      ['overwrites the result in finally', 'try { return validate(seats); } catch (IllegalArgumentException problem) { return -1; } finally { completed++; return 0; }'],
    ],
    correct: [
      'int result; try { result = validate(seats); } catch (IllegalArgumentException problem) { result = -1; } finally { completed += 1; } return result;',
      'try { int answer = validate(seats); return answer; } catch (IllegalArgumentException problem) { return -1; } finally { completed = completed + 1; }',
    ],
  },
  {
    key: 'semantic-integration', owner: 'SessionSummary', method: 'minutesFor',
    wrong: [
      ['compares label identity', 'int total = 0; for (SessionItem item : items) if (item != null && item.label() == wanted) total += item.minutes(); return total;'],
      ['dereferences absent sessions', 'int total = 0; for (SessionItem item : items) if (item.label().equals(wanted)) total += item.minutes(); return total;'],
      ['counts matches instead of duration', 'int total = 0; for (SessionItem item : items) if (item != null && item.label().equals(wanted)) total++; return total;'],
    ],
    correct: [
      'int total = 0; for (int i = 0; i < items.length; i++) { SessionItem item = items[i]; if (item == null) continue; if (wanted.equals(item.label())) total += item.minutes(); } return total;',
      'int total = 0; int i = items.length; while (i > 0) { i--; SessionItem item = items[i]; if (item != null) { if (item.label().equals(wanted)) total = total + item.minutes(); } } return total;',
    ],
  },
];

for (const attempt of attempts) {
  const step = tutorial.steps.find(candidate => candidate.key === attempt.key);
  assert.ok(step, `Missing exercise ${attempt.key}`);

  for (const [reason, body] of attempt.wrong) {
    test(`${step.title}: rejects a solution that ${reason}`, () => {
      const worker = createJavaWorker();
      worker.write(withMethodBody(step, attempt.owner, attempt.method, body));
      assert.ok(checkResults(worker, step).some(result => result.exitCode !== 0), reason);
    });
  }

  for (const [index, body] of attempt.correct.entries()) {
    test(`${step.title}: accepts equivalent implementation ${index + 1}`, () => {
      const worker = createJavaWorker();
      worker.write(withMethodBody(step, attempt.owner, attempt.method, body));
      expectPassingChecks(worker, step);
    });
  }
}
