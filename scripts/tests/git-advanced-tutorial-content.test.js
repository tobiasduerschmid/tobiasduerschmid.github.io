const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/git-advanced.yml'), 'utf8'));

// The browser VM ships GNU sed; BSD sed needs an explicit empty suffix after -i.
function gnuSedShim(root) {
  if (spawnSync('sed', ['--version'], { encoding: 'utf8' }).status === 0) return null;
  const systemSed = spawnSync('bash', ['-c', 'command -v sed'], { encoding: 'utf8' }).stdout.trim();
  const dir = path.join(root, 'bin');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'sed'), [
    '#!/bin/bash',
    'args=()',
    'for a in "$@"; do if [ "$a" = "-i" ]; then args+=("-i" ""); else args+=("$a"); fi; done',
    `exec ${systemSed} "\${args[@]}"`,
    '',
  ].join('\n'), { mode: 0o755 });
  return dir;
}

// Runs the tutorial's setup scripts, its checks, and a learner's instructed
// commands against real, isolated Git repositories. /tutorial is the VM's
// mount point; the native test maps it to a temporary directory.
function workspace(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-advanced-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const shim = gnuSedShim(root);
  const env = { ...process.env, HOME: root, GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', GIT_EDITOR: 'true',
    LC_ALL: 'C', PATH: shim ? `${shim}:${process.env.PATH}` : process.env.PATH };
  for (const name of ['VISUAL', 'EDITOR', 'GIT_SEQUENCE_EDITOR']) delete env[name];
  const map = value => value.replaceAll('/tutorial', root);
  function run(command, cwd = 'myproject') {
    return spawnSync('bash', ['-c', map(command)], {
      cwd: path.join(root, cwd), env, encoding: 'utf8', timeout: 15000,
    });
  }
  function execute(command, cwd) {
    const result = run(command, cwd);
    assert.equal(result.status, 0, `${command}\n${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  }
  function edit(file, change) {
    const target = path.join(root, 'myproject', file);
    const before = fs.readFileSync(target, 'utf8');
    const after = change(before);
    assert.notEqual(after, before, `expected the learner's edit to change ${file}`);
    fs.writeFileSync(target, after);
  }
  function setup(step) {
    const commands = step === 0 ? tutorial.setup_commands : tutorial.steps[step - 1].setup_commands;
    execute((commands || []).join('\n'), '');
  }
  function grades(step) {
    return tutorial.steps[step - 1].tests.map(check => ({
      description: check.description, passed: run(check.command, '').status === 0,
    }));
  }
  return { root, run, execute, edit, setup, grades };
}

function culpritOf(bisectOutput) {
  return bisectOutput.match(/^([0-9a-f]{40}) is the first bad commit/m)[1];
}

const bisectAbsolute = `git bisect run sh -c "grep -q 'return x if x >= 0 else -x' calculator.py"`;

// What a learner types for each step, following its instructions. Commands
// the instructions present as conflict-free run through execute(), so an
// unannounced conflict fails the test.
const learnerSteps = {
  1: w => w.execute('git switch -q --detach HEAD~1 && git switch -q main'),
  2: w => w.execute([
    'git switch -q --detach HEAD',
    'echo "# experimental note" >> calculator.py',
    'git commit -qam "Experimental: add note in detached HEAD"',
    'git switch -q main',
    "git branch rescued-work 'HEAD@{1}'",
  ].join(' && ')),
  3: w => w.execute('git branch parent-of-main main~1 && echo "hello world" | git hash-object -w --stdin'),
  4: w => {
    w.execute([
      'git stash -q',
      'git switch -q -c hotfix-divide-zero',
      `printf '\\ndef safe_divide(a, b):\\n    if b == 0:\\n        raise ValueError("Cannot divide by zero")\\n    return a / b\\n' >> calculator.py`,
      'git commit -qam "Hotfix: add safe_divide to prevent zero-division errors"',
      'git switch -q main',
      'git merge -q hotfix-divide-zero --no-edit',
      'git branch -q -d hotfix-divide-zero',
      'git stash pop -q',
    ].join(' && '));
    w.edit('calculator.py', source => source.replace('    # TODO: add input validation\n',
      '    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):\n        raise TypeError("Arguments must be numbers")\n'));
    w.execute('git commit -qam "Add power function with input validation"');
  },
  5: w => {
    w.execute('git switch -q main && git cherry-pick experimental');
    w.edit('calculator.py', source => source.replace('def add(a, b): return a + b\n',
      'def add(a, b):\n    """Return the sum of two numbers."""\n    return a + b\n'));
    w.execute('git commit -qam "Document add function" && git switch -q experimental');
    w.edit('calculator.py', source => source.replace('def add(a, b): return a + b\n',
      'def add(a, b): return a + b  # simple addition\n'));
    w.execute('git commit -qam "Inline comment on add" && git switch -q main');
    assert.notEqual(w.run('git cherry-pick experimental').status, 0, 'Task 3 is meant to conflict');
    w.edit('calculator.py', source => source.replace(/<<<<<<< [\s\S]*?>>>>>>> [^\n]*\n/,
      'def add(a, b):\n    """Return the sum of two numbers."""\n    return a + b  # simple addition\n'));
    w.execute('git add calculator.py && git cherry-pick --continue');
  },
  6: w => w.execute([
    "short=$(git blame calculator.py | awk '/def clip/ { print $1; exit }')",
    'git rev-parse "$short" >> .git-blame-ignore-revs',
    'git config blame.ignoreRevsFile .git-blame-ignore-revs',
    'git add .git-blame-ignore-revs',
    'git commit -qm "Ignore CI formatter commit in blame"',
  ].join(' && ')),
  7: w => {
    const culprit = culpritOf(w.execute(`git bisect start HEAD HEAD~5 && ${bisectAbsolute}; git bisect reset`));
    assert.equal(w.execute(`git log -1 --format=%s ${culprit}`), 'Simplify absolute return path');
    w.edit('calculator.py', source =>
      source.replace(/(def absolute\(x\):\n    """[^\n]*"""\n    )return x\n/, '$1return abs(x)\n'));
    w.execute(`git commit -qam "Fix: restore negation in absolute (regressed in ${culprit.slice(0, 7)})"`);
  },
  8: w => {
    w.execute('git switch -q feature-sqrt && git rebase main');
    w.execute('git switch -q main && git merge -q feature-sqrt && git branch -q -d feature-sqrt');
    w.execute("git switch -q -c feature-trailer main~1 && echo '# end-of-module trailer' >> calculator.py && git commit -qam 'Add trailer comment at end of file'");
    assert.notEqual(w.run('git rebase main').status, 0, 'Task 3 is meant to conflict');
    assert.match(fs.readFileSync(path.join(w.root, 'myproject/calculator.py'), 'utf8'),
      /<<<<<<< [^\n]*\n[\s\S]*def square_root[\s\S]*\n=======\n# end-of-module trailer\n>>>>>>> /,
      'Task 3 says the conflict is between square_root and the trailer');
    w.edit('calculator.py', source => source.replace(/^(<<<<<<< .*|=======|>>>>>>> .*)\n/gm, ''));
    w.execute('git add calculator.py && git rebase --continue && git switch -q main && git branch -q -D feature-trailer');
  },
  9: w => w.execute([
    `GIT_SEQUENCE_EDITOR="sed -i '2,4s/^pick/squash/'" git rebase -i HEAD~4`,
    'git commit -q --amend -m "Refactor: cleanup notes in calculator.py"',
    'echo SECRET_API_KEY=oops > secrets.env',
    'git add secrets.env',
    'git commit -qm "Accidentally add secret (should be dropped)"',
    "echo 'def placeholder(): pass' >> calculator.py",
    'git commit -qam "Add placeholder function"',
    `GIT_SEQUENCE_EDITOR="sed -i '1s/^pick/drop/'" git rebase -i HEAD~2`,
    "git branch secret-backup $(git reflog | grep -m1 'Accidentally add secret' | awk '{ print $1 }')",
    `GIT_SEQUENCE_EDITOR="sed -i '2s/^pick/reword/'" GIT_EDITOR="sed -i '1s/.*/Add placeholder for upcoming helpers/'" git rebase -i HEAD~2`,
  ].join(' && ')),
  10: w => w.execute([
    'git switch -q main',
    'git merge --squash feature-stats',
    'git commit -qm "Add descriptive statistics module (mean, variance, stddev)"',
    'git branch -q -D feature-stats',
  ].join(' && ')),
  11: w => w.execute('git revert HEAD --no-edit'),
  12: w => w.execute([
    'git switch -q main',
    'git submodule add -q /tutorial/math-utils.git vendor/math-utils',
    'git commit -qm "Add math-utils submodule at v0.1.0"',
    'cd /tutorial && git clone -q --recursive myproject colleague-clone',
  ].join(' && ')),
  13: w => w.execute([
    '/tutorial/publish-math-utils-v0.2.sh',
    'cd /tutorial/myproject/vendor/math-utils && git fetch -q && git checkout -q origin/HEAD',
    'cd /tutorial/myproject && git add vendor/math-utils && git commit -qm "Bump math-utils to v0.2.0 (adds quadruple)"',
    'cd /tutorial/colleague-clone && git pull -q && git submodule update --init --recursive -q',
  ].join(' && ')),
  14: w => {
    w.execute("printf '\\ndef halve(x):\\n    return x / 2\\n' >> vendor/math-utils/utils.py");
    w.execute('git add utils.py && git commit -qm "Add halve helper"', 'myproject/vendor/math-utils');
    assert.notEqual(w.run('git push', 'myproject/vendor/math-utils').status, 0, 'Task 3 predicts a detached-HEAD push failure');
    w.execute('git switch -q -c update-halve && git push -q -u origin update-halve', 'myproject/vendor/math-utils');
    w.execute('git add vendor/math-utils && git commit -qm "Bump math-utils: add halve helper"');
  },
  15: w => {
    const culprit = culpritOf(w.execute(`git stash -q && git bisect start HEAD HEAD~5 && ${bisectAbsolute}; git bisect reset`));
    assert.equal(w.execute(`git log -1 --format=%s ${culprit}`), 'Capstone: simplify absolute return path');
    w.execute('git switch -q -c capstone-fix');
    w.edit('calculator.py', source => source.replace('return x  # simplification', 'return abs(x)'));
    w.execute("git commit -qam WIP && echo '# wip' >> calculator.py && git commit -qam 'WIP 2'");
    w.edit('calculator.py', source => source.replace('# wip\n', ''));
    w.execute([
      "git commit -qam 'WIP 3'",
      'git switch -q main',
      'git merge --squash capstone-fix',
      'git commit -qm "Fix: restore negation in absolute"',
      'git branch -q -D capstone-fix',
      'git stash pop -q',
    ].join(' && '));
  },
};

test('every step needs learner work, and its instructed commands pass the checks without unannounced conflicts', t => {
  const w = workspace(t);
  w.setup(0);
  assert.equal(Object.keys(learnerSteps).length, tutorial.steps.length);
  for (let step = 1; step <= tutorial.steps.length; step++) {
    w.setup(step);
    assert.ok(w.grades(step).some(result => !result.passed), `Step ${step} must not pass before the learner acts`);
    learnerSteps[step](w);
    assert.deepEqual(w.grades(step).filter(result => !result.passed), [], `Step ${step} checks after the instructed work`);
  }
});

test('global setup makes Git open nano, not busybox vi', t => {
  const w = workspace(t);
  w.setup(0);
  assert.equal(w.execute('git config --global core.editor'), 'nano');
});

test('the revert step plants its bad rename even though main never had divide()', t => {
  const w = workspace(t);
  w.setup(0);
  w.setup(11);
  assert.equal(w.execute('git log -1 --format=%s'), 'Refactor: rename divide → div (BROKE imports)');
  assert.match(w.execute('cat calculator.py'), /^def div\(a, b\)/m);
});

test('the capstone plants its regression whatever form the Step 7 repair took', async t => {
  const repairs = {
    'an abs() call': 'def absolute(x):\n    return abs(x)\n',
    'an if/else branch': 'def absolute(x):\n    if x < 0:\n        return -x\n    return x\n',
    'a broken definition plus an appended repair':
      'def absolute(x):\n    return x\n\ndef clip(x, lo, hi):\n    return x\n\ndef absolute(x):\n    return x if x >= 0 else -x\n',
  };
  for (const [name, source] of Object.entries(repairs)) {
    await t.test(name, st => {
      const w = workspace(st);
      w.setup(0);
      fs.writeFileSync(path.join(w.root, 'myproject/calculator.py'), `"""A simple calculator module."""\n${source}`);
      w.execute('git commit -qam "Learner repair"');
      w.setup(15);
      const committed = w.execute('git show HEAD:calculator.py');
      assert.equal(committed.match(/^def absolute/gm).length, 1);
      assert.match(committed, /return x {2}# simplification/);
      assert.match(w.execute('git show "HEAD^{/^Capstone: simplify absolute}~1:calculator.py"'), /return x if x >= 0 else -x/);
    });
  }
});

test('hints use conditions the v86 runtime can evaluate, with content titles', () => {
  for (const [index, step] of tutorial.steps.entries()) {
    for (const check of step.tests || []) {
      for (const hint of check.hints || []) {
        const where = `Step ${index + 1}, "${check.description}"`;
        // v86 steps have no output panel, so output_* conditions see an empty string.
        assert.doesNotMatch(hint.condition || '', /^output_/, where);
        // code_* and source_* conditions read the open editor file.
        if (/^(code|source)_/.test(hint.condition || '')) assert.ok(step.open_file, where);
        assert.doesNotMatch(hint.title || '', /^Layer \d/, where);
      }
    }
  }
});

test('the correct option is not singled out by length or formatting', () => {
  let singleAnswer = 0;
  let longest = 0;
  const formatted = option => /`|\*/.test(String(option));
  for (const [index, step] of tutorial.steps.entries()) {
    for (const question of step.quiz?.questions || []) {
      const keys = question.correct_indices || (Number.isInteger(question.correct_index) ? [question.correct_index] : []);
      if (!question.options || keys.length === 0) continue;
      const distractors = question.options.filter((_, i) => !keys.includes(i));
      if (keys.every(i => formatted(question.options[i]))) {
        assert.ok(distractors.some(formatted), `Step ${index + 1}: only the key uses formatting in "${question.question}"`);
      }
      if (question.correct_indices) continue;
      const lengths = question.options.map(option => String(option).trim().length);
      singleAnswer += 1;
      if (lengths[keys[0]] > Math.max(...distractors.map(option => String(option).trim().length))) longest += 1;
    }
  }
  // Chance is about one in four for four options; both extremes are tells.
  assert.ok(longest / singleAnswer >= 0.1 && longest / singleAnswer <= 0.4,
    `the key is the longest option in ${longest} of ${singleAnswer} single-answer questions`);
});
