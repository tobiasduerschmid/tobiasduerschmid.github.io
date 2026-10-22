const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(
  path.resolve(__dirname, '../../_data/tutorials/regex-python.yml'), 'utf8'));

// A fresh process and real temporary files isolate each submission. The authored
// setup and grading commands are the oracle; no browser or Python APIs are mocked.
const runner = String.raw`
import contextlib, io, json, os, pathlib, sys, tempfile
payload = json.load(sys.stdin)
sys.dont_write_bytecode = True
with tempfile.TemporaryDirectory(prefix="regex-python-grader-") as directory:
    root = pathlib.Path(directory)
    os.chdir(root)
    # Pyodide's module path does not automatically include its working folder.
    # The authored setup must make its own helper module importable.
    sys.path[:] = [entry for entry in sys.path if entry]
    step = payload["step"]
    for entry in step["files"]:
        target = root / entry["path"].removeprefix("/tutorial/")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(entry["content"].replace("/tutorial", directory))
    entry = root / step["run_file"].removeprefix("/tutorial/")
    entry.write_text(payload["source"].replace("/tutorial", directory))
    for command in payload["setup"]:
        exec(command.replace("/tutorial", directory), {"__name__": "__main__"})
    results = []
    for check in step["tests"]:
        result = {"description": check["description"], "passed": True}
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                exec(check["command"].replace("/tutorial", directory),
                     {"__name__": "__main__"})
        except Exception as error:
            result.update(passed=False, error=type(error).__name__, message=str(error))
        results.append(result)
    print(json.dumps(results))
`;

function grade(step, source) {
  const result = spawnSync('python3', ['-c', runner], {
    input: JSON.stringify({
      step, source,
      setup: [...(tutorial.setup_commands || []), ...(step.setup_commands || [])],
    }),
    encoding: 'utf8', timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function parser(pattern, value, matchMethod = 'fullmatch') {
  return `import re
pattern = ${JSON.stringify(pattern)}
def parse_file(path):
    result = []
    with open(path, encoding="utf-8") as source:
        for line in source:
            match = re.${matchMethod}(pattern, line.strip())
            if match:
                result.append(${value})
    return result
`;
}

// Independent submissions preserve the specified pattern/parse_file interface
// while varying equivalent regex notation and capture access.
const scoreValue = 'int(match["score"])';
const playerValue = '(match["name"], int(match["score"]))';
const submissions = {
  'filter_clips.py': {
    correct: [
      parser(String.raw`replay_\d{2,4}[.]txt`, 'match[0]'),
      parser(String.raw`replay_[0-9][0-9][0-9]?[0-9]?\.txt`, 'match.group()'),
    ],
    wrong: {
      'a wildcard dot accepts another separator': parser(String.raw`replay_\d{2,4}.txt`, 'match[0]'),
      'the lower bound admits one digit': parser(String.raw`replay_\d{1,4}\.txt`, 'match[0]'),
      'the upper bound admits five digits': parser(String.raw`replay_\d{2,5}\.txt`, 'match[0]'),
      'the lower bound excludes two digits': parser(String.raw`replay_\d{3,4}\.txt`, 'match[0]'),
      'the upper bound excludes four digits': parser(String.raw`replay_\d{2,3}\.txt`, 'match[0]'),
      'unbounded repetition ignores both limits': parser(String.raw`replay_\d+\.txt`, 'match[0]'),
      'an incomplete digit class excludes nine': parser(String.raw`replay_[0-8]{2,4}\.txt`, 'match[0]'),
      'leading zeroes are incorrectly excluded': parser(String.raw`replay_[1-9]\d{1,3}\.txt`, 'match[0]'),
      'search admits matching substrings': parser(String.raw`replay_\d{2,4}\.txt`, 'match[0]', 'search'),
    },
  },
  'read_scores.py': {
    correct: [
      parser(String.raw`score=(?P<score>[+-]?\d{1,})`, scoreValue),
      parser(String.raw`score=(?P<score>(?:\+|-|)[0-9]+)`, 'int(match.groupdict()["score"])'),
    ],
    wrong: {
      'strings are not parsed numbers': parser(String.raw`score=(?P<score>[+-]?\d+)`, 'match["score"]'),
      'one digit omits larger scores': parser(String.raw`score=(?P<score>[+-]?\d)`, scoreValue),
      'an incomplete digit class excludes nine': parser(String.raw`score=(?P<score>[+-]?[0-8]+)`, scoreValue),
      'unsigned scores omit both signs': parser(String.raw`score=(?P<score>\d+)`, scoreValue),
      'minus alone omits explicit positive scores': parser(String.raw`score=(?P<score>-?\d+)`, scoreValue),
      'mandatory signs omit unsigned scores': parser(String.raw`score=(?P<score>[+-]\d+)`, scoreValue),
      'multiple signs are accepted': parser(String.raw`score=(?P<score>[+-]{0,2}\d+)`, 'int(match["score"].lstrip("+-")) * (-1 if "-" in match["score"] else 1)'),
      'a missing number is treated as zero': parser(String.raw`score=(?P<score>[+-]?\d*)`, 'int(match["score"]) if match["score"] not in ("", "+", "-") else 0'),
      'spaces separate the sign and digits': parser(String.raw`score=(?P<score>[+-]? *\d+)`, 'int(match["score"].replace(" ", ""))'),
      'the capture excludes its sign': parser(String.raw`score=[+-]?(?P<score>\d+)`, scoreValue),
      'search accepts a score inside another record': parser(String.raw`score=(?P<score>[+-]?\d+)`, scoreValue, 'search'),
      'the capture includes the field label': parser(String.raw`(?P<score>score=[+-]?\d+)`, 'int(match["score"].split("=")[1])'),
      'an unnamed capture omits the score field': parser(String.raw`score=([+-]?\d+)`, 'int(match[1])'),
      'a different name omits the score field': parser(String.raw`score=(?P<points>[+-]?\d+)`, 'int(match["points"])'),
    },
  },
  'read_players.py': {
    correct: [
      parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7}) *: *(?P<score>[+-]?\d+)`, playerValue),
      parser(String.raw`(?P<name>[a-z][a-z_0-9]{1,7})\s*:\s*(?P<score>(?:\+|-|)[0-9]+)`, '(match.groupdict()["name"], int(match.groupdict()["score"]))'),
      // Defining score first verifies that field names, not capture positions,
      // are the learner-facing contract.
      parser(String.raw`(?=[a-z][a-z0-9_]{1,7}\s*:\s*(?P<score>[+-]?\d+)$)(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*[+-]?\d+`, '(match.group("name"), int(match.group("score")))'),
    ],
    wrong: {
      'uppercase letters are accepted': parser(String.raw`(?P<name>[A-Za-z][A-Za-z0-9_]{1,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'a digit or underscore may start the name': parser(String.raw`(?P<name>[a-z0-9_]{2,8})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'the lower bound admits a one-character name': parser(String.raw`(?P<name>[a-z][a-z0-9_]{0,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'the upper bound admits nine characters': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,8})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'the lower bound excludes two characters': parser(String.raw`(?P<name>[a-z][a-z0-9_]{2,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'the upper bound excludes eight characters': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,6})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'underscores are incorrectly excluded': parser(String.raw`(?P<name>[a-z][a-z0-9]{1,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'an incomplete letter class excludes z': parser(String.raw`(?P<name>[a-y][a-y0-9_]{1,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'an incomplete name digit class excludes nine': parser(String.raw`(?P<name>[a-z][a-z0-8_]{1,7})\s*:\s*(?P<score>[+-]?\d+)`, playerValue),
      'an incomplete score digit class excludes nine': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]?[0-8]+)`, playerValue),
      'unsigned scores omit both signs': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>\d+)`, playerValue),
      'minus alone omits explicit positive scores': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>-?\d+)`, playerValue),
      'mandatory signs omit unsigned scores': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]\d+)`, playerValue),
      'multiple signs are accepted': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]{0,2}\d+)`, '(match["name"], int(match["score"].lstrip("+-")) * (-1 if "-" in match["score"] else 1))'),
      'a missing number is treated as zero': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]?\d*)`, '(match["name"], int(match["score"]) if match["score"] not in ("", "+", "-") else 0)'),
      'spaces separate the sign and digits': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]? *\d+)`, '(match["name"], int(match["score"].replace(" ", "")))'),
      'the score capture excludes its sign': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*[+-]?(?P<score>\d+)`, playerValue),
      'separator spacing is treated as mandatory': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7}) :(?P<score>[+-]?\d+)`, playerValue),
      'score captures remain strings': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<score>[+-]?\d+)`, '(match["name"], match["score"])'),
      'the name capture includes the colon': parser(String.raw`(?P<name>[a-z][a-z0-9_]{1,7}\s*:)\s*(?P<score>[+-]?\d+)`, '(match["name"].strip().rstrip(":"), int(match["score"]))'),
      'unnamed captures omit both named fields': parser(String.raw`([a-z][a-z0-9_]{1,7})\s*:\s*([+-]?\d+)`, '(match[1], int(match[2]))'),
      'different names omit the required fields': parser(String.raw`(?P<player>[a-z][a-z0-9_]{1,7})\s*:\s*(?P<points>[+-]?\d+)`, '(match["player"], int(match["points"]))'),
    },
  },
};

test('Regex in Python stays a three-step lesson with one knowledge check per step', () => {
  assert.equal(tutorial.steps.length, 3);
  for (const step of tutorial.steps) {
    assert.equal(step.quiz.questions.length, 1, step.title);
  }
});

for (const step of tutorial.steps) {
  const filename = step.run_file.replace(/^\/tutorial\//, '');
  const reference = submissions[filename];
  const solution = step.solution.files.find(file => file.path.replace(/^\/tutorial\//, '') === filename).content;
  const starter = step.files.find(file => file.path.replace(/^\/tutorial\//, '') === filename).content;

  test(`${step.title}: published solution and equivalent patterns pass every criterion`, () => {
    for (const source of [solution, ...reference.correct]) {
      const results = grade(step, source);
      assert.deepEqual(results.filter(result => !result.passed), [], JSON.stringify(results));
    }
  });

  test(`${step.title}: incomplete and plausible incorrect submissions do not earn completion`, () => {
    for (const [name, source] of Object.entries({ starter, ...reference.wrong })) {
      const failures = grade(step, source).filter(result => !result.passed);
      assert.ok(failures.length, `${name} passed all criteria`);
      // Incorrect candidates above are executable; a broken test harness must
      // not masquerade as detecting their intended semantic mistake.
      for (const failure of failures) {
        assert.equal(failure.error, 'AssertionError', `${name}: ${JSON.stringify(failure)}`);
      }
    }
  });

  test(`${step.title}: partial progress is visible before a focused correction`, () => {
    const partial = grade(step, Object.values(reference.wrong)[0]);
    assert.ok(partial.some(result => result.passed), JSON.stringify(partial));
    assert.ok(partial.some(result => !result.passed), JSON.stringify(partial));
    assert.ok(grade(step, reference.correct[0]).every(result => result.passed));
  });

  test(`${step.title}: always reading the sample file cannot replace parsing the supplied path`, () => {
    const sample = step.files.find(file => file.path.endsWith('.txt')).path.replace(/^\/tutorial\//, '');
    const hardcoded = reference.correct[0].replace('open(path,', `open(${JSON.stringify(sample)},`);
    const failures = grade(step, hardcoded).filter(result => !result.passed);
    assert.ok(failures.length, 'Reading the sample instead of the supplied path passed every criterion');
    for (const failure of failures) assert.equal(failure.error, 'AssertionError', JSON.stringify(failure));
  });

  test(`${step.title}: sorting and removing duplicate records lose required file information`, () => {
    for (const replacement of ['sorted(result)', 'list(dict.fromkeys(result))']) {
      const source = reference.correct[0].replace('return result', `return ${replacement}`);
      const failures = grade(step, source).filter(result => !result.passed);
      assert.ok(failures.length, `${replacement} passed every criterion`);
      for (const failure of failures) assert.equal(failure.error, 'AssertionError', JSON.stringify(failure));
    }
  });
}
