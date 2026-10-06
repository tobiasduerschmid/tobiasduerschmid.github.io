const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const yaml = require('js-yaml');

const tutorial = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/git.yml'), 'utf8'));

// Exercise the authored shell checks against real, isolated Git repositories.
// /tutorial is the browser VM's mount point; the native test uses a temp directory.
function workspace(t) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-lesson-')));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: path.join(root, 'gitconfig'),
    GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat',
    GIT_EDITOR: 'true', LC_ALL: 'C' };
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
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
  function write(name, content) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  function grades(number) {
    return tutorial.steps[number - 1].tests.map(check => ({
      description: check.description, passed: run(check.command).status === 0,
    }));
  }
  execute('git config --global user.name Test; git config --global user.email test@example.invalid; git config --global init.defaultBranch main', '');
  execute('git init -q myproject', '');
  return { root, run, execute, write, grades };
}

function expectPasses(grades) {
  assert.deepEqual(grades.filter(result => !result.passed), []);
}

function expectRejected(grades, reason) {
  assert.ok(grades.some(result => !result.passed), reason);
}

test('global Git setup works before a repository exists', t => {
  const w = workspace(t);
  for (const command of tutorial.setup_commands.filter(command => command.startsWith('git config'))) {
    w.execute(command, '');
  }
});

test('a message mentioning power does not substitute for committed source', t => {
  const w = workspace(t);
  w.write('myproject/hero_registry.py', 'def recruit(name, power): return {}\n');
  w.execute('git add . && git commit -qm initial');
  w.execute('git commit --allow-empty -qm "power upgrade"');
  w.write('myproject/hero_registry.py', 'def power_up(hero, multiplier): return hero\n');
  expectRejected(w.grades(3), 'Uncommitted power_up must not receive completion credit');
  w.execute('git add . && git commit -qm "Boost squad strength"');
  expectPasses(w.grades(3));
});

test('ignore checks reject commented patterns and accept equivalent working patterns', t => {
  const w = workspace(t);
  w.write('myproject/.gitignore', '# __pycache__/\n# .env\n# *.pyc\n# *.log\n');
  w.execute('git add .gitignore && git commit -qm ignore');
  expectRejected(w.grades(6), 'Comments do not ignore any files');
  w.write('myproject/.gitignore', '__pycache__/\n.env\n**/*.pyc\n**/*.log\n');
  w.execute('git add .gitignore && git commit -qm rules');
  expectPasses(w.grades(6));
  w.write('myproject/.gitignore', '__pycache__/\n.env\n**/*.pyc\n');
  w.execute('git add .gitignore && git commit -qm "omit logs"');
  expectRejected(w.grades(6), 'The task also requires ignoring log files');
});

test('the cleanup capstone requires preserving scratch and restoring the complete tracked file', t => {
  const w = workspace(t);
  w.write('myproject/broken.py', 'def broken_function():\n    return 42\n');
  w.write('myproject/.gitignore', '*.log\n');
  w.execute('git add . && git commit -qm baseline');
  w.write('myproject/.gitignore', '*.log\nscratch.py\n');
  w.execute('git add .gitignore && git commit -qm rules');
  expectRejected(w.grades(8), 'Deleting scratch.py is not unstaging it while keeping it');
  w.write('myproject/scratch.py', '# keep this experiment\n');
  expectPasses(w.grades(8));
  w.execute('git rm -q broken.py && git commit -qm "delete rather than restore"');
  expectRejected(w.grades(8), 'A missing broken.py must not pass a negative grep');
});

test('conflict preparation requires actual competing source on the feature branch', t => {
  const w = workspace(t);
  w.write('myproject/hero_registry.py', 'def recruit(name, power): return {}\n');
  w.execute('git add . && git commit -qm "initial recruit" && git branch update-recruit');
  expectRejected(w.grades(11), 'An inherited message is not a safety-protocol change');
});

test('staging a conflict resolution does not mean the merge is committed', t => {
  const w = workspace(t);
  w.write('myproject/hero_registry.py', 'def recruit(name, power):\n    return {}\n');
  w.execute('git add . && git commit -qm initial && git switch -qc update-recruit');
  w.write('myproject/hero_registry.py', 'def recruit(name, power):\n    if not isinstance(name, str): raise TypeError()\n    return {}\n');
  w.execute('git add . && git commit -qm safety && git switch -q main');
  w.write('myproject/hero_registry.py', 'def recruit(name, power):\n    print(name)\n    return {}\n');
  w.execute('git add . && git commit -qm logging');
  assert.equal(w.run('git merge update-recruit --no-edit').status, 1);
  w.write('myproject/hero_registry.py', 'def recruit(name, power):\n    if not isinstance(name, str): raise TypeError()\n    print(name)\n    return {}\n');
  w.execute('git add hero_registry.py');
  expectRejected(w.grades(12), 'MERGE_HEAD still exists until the merge commit is made');
  w.execute('git commit -qm "Combine validation and logging"');
  expectPasses(w.grades(12));
});

test('all model solutions run in order and leave valid committed Python', t => {
  const w = workspace(t);
  // Step 1 creates its own repository.
  fs.rmSync(path.join(w.root, 'myproject'), { recursive: true });
  let cwd = '';
  for (let i = 0; i < tutorial.steps.length; i++) {
    const step = tutorial.steps[i];
    for (const file of step.files || []) w.write(file.path, file.content);
    if (step.setup_commands) w.execute(`set -e\n${step.setup_commands.join('\n')}`, cwd);
    if (step.step_dir) cwd = step.step_dir.replace('/tutorial/', '');
    for (const file of step.solution?.files || []) w.write(file.path, file.content);
    if (step.solution?.commands) {
      w.execute(`set -e\n${step.solution.commands.join('\n')}\npwd > '${w.root}/cwd'`, cwd);
      cwd = fs.readFileSync(path.join(w.root, 'cwd'), 'utf8').trim().slice(w.root.length + 1);
    }
    expectPasses(w.grades(i + 1));
    if ([11, 14].includes(i)) {
      w.execute('python3 -c "import ast; ast.parse(open(\'hero_registry.py\').read())"');
      assert.equal(w.execute('git status --porcelain'), '', `Step ${i + 1} must finish clean`);
    }
  }
  // A remote-tracking ref is cached: it can still equal HEAD after another push.
  w.execute('git pull --ff-only && git commit --allow-empty -qm teammate && git push', 'colleague-copy');
  expectRejected(w.grades(15), 'A stale origin/main must not prove the current remote is integrated');
});
