const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const source = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');

function createShellHarness(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-shell-profile-'));
  const profiles = path.join(root, 'profile.d');
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(profiles);
  fs.mkdirSync(workspace);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sandbox = { document: { cookie: '' }, TextEncoder, btoa };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({}, { backend: 'v86', ...options });
  const commands = [];
  tutorial._runSilent = async command => { commands.push(command); };
  tutorial._probeRPCDaemon = async () => false;

  function shell(script) {
    // The transport maps guest profile paths into the isolated test directory.
    // Clock and tty operations must never affect the host running this test.
    const result = spawnSync('bash', ['--noprofile', '--norc', '-c', [
      'date() { :; }; stty() { :; }',
      'cd() { if [ "$1" = /tutorial ]; then builtin cd "$TEST_WORKSPACE"; else builtin cd "$@"; fi; }',
      'set -o history',
      script.replaceAll('/etc/profile.d/', profiles + '/'),
    ].join('\n')], {
      cwd: workspace,
      env: { PATH: process.env.PATH, HOME: root, TEST_WORKSPACE: workspace, TEST_PROFILES: profiles },
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error || result.signal));
    return result.stdout;
  }
  return {
    tutorial, workspace, shell,
    apply() { shell(commands.splice(0).join('\n')); },
    restart(script) {
      return shell('for profile in "$TEST_PROFILES"/*.sh; do [ ! -r "$profile" ] || . "$profile"; done\n' + script);
    },
  };
}

test('a replacement shell restores command recording and its step directory without rerunning setup', async t => {
  const h = createShellHarness(t, { setupCommands: ['printf setup >> setup-runs.txt'] });
  const lesson = path.join(h.workspace, "lesson 'quoted' $name");
  fs.mkdirSync(lesson);
  await h.tutorial._setupFilesystem();
  await h.tutorial._updateUserCmdListener({ user_command_listener: 'cat >> recorded.txt' });
  await h.tutorial._runStepDir({ step_dir: lesson });
  h.apply();

  const output = h.restart([
    'pwd',
    'history -s "printf learner-command"',
    ' eval "$PROMPT_COMMAND"',
    ': #__SIL_test',
    ' eval "$PROMPT_COMMAND"',
    'printf "%s\\n" "$LANG" "$HISTCONTROL"',
  ].join('\n'));

  assert.equal(output, lesson + '\nC.UTF-8\nignoreboth\n');
  assert.equal(fs.readFileSync(path.join(lesson, 'recorded.txt'), 'utf8'), 'printf learner-command\n');
  assert.equal(fs.readFileSync(path.join(h.workspace, 'setup-runs.txt'), 'utf8'), 'setup');
});

test('a replacement shell uses the latest command listener, including disabling it', async t => {
  const h = createShellHarness(t);
  await h.tutorial._setupFilesystem();
  await h.tutorial._updateUserCmdListener({ user_command_listener: 'cat >> old.txt' });
  await h.tutorial._updateUserCmdListener({ user_command_listener: 'cat >> current.txt' });
  h.apply();
  h.restart('history -s "echo first"\n eval "$PROMPT_COMMAND"');
  assert.equal(fs.existsSync(path.join(h.workspace, 'old.txt')), false);
  assert.equal(fs.readFileSync(path.join(h.workspace, 'current.txt'), 'utf8'), 'echo first\n');

  await h.tutorial._updateUserCmdListener({});
  h.apply();
  h.restart('history -s "echo second"\n eval "$PROMPT_COMMAND"');
  assert.equal(fs.readFileSync(path.join(h.workspace, 'current.txt'), 'utf8'), 'echo first\n');
});

test('a replacement shell refreshes Git state after commands', async t => {
  const h = createShellHarness(t);
  const init = spawnSync('git', ['init', '-q', h.workspace], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stderr);
  h.tutorial.gitGraphPath = h.workspace;
  await h.tutorial._setupFilesystem();
  h.apply();
  fs.writeFileSync(path.join(h.workspace, 'after-restart.txt'), 'preserved work\n');

  h.restart('eval "$PROMPT_COMMAND"');

  const graph = fs.readFileSync(path.join(h.workspace, '.git/gitgraph_state'), 'utf8');
  assert.match(graph, /===STATUS===[\s\S]*\?\? after-restart\.txt/);
});

test('a cold boot excludes pre-supervisor VM caches and saves a safe replacement', async () => {
  const sandbox = { document: { cookie: '' }, indexedDB: {}, TextEncoder, btoa };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({}, {
    backend: 'v86', resetType: 'commands', tutorialId: 'shell-recovery-cache',
  });
  // Real pre-upgrade keys for this tutorial with no downloaded snapshot asset
  // validator. The records represent the old VM whose learner shell was PID 1.
  const oldPrefix = 'v86|5|shell-recovery-cache|192|state.bin.gz|1vxdm2a|';
  const records = new Map(['initial', 'step-entry'].map(kind => [
    oldPrefix + kind + '|0', { version: 5, format: 'raw', data: new Uint8Array([1]).buffer },
  ]));
  // Model only the IndexedDB get/put boundary; keep cache identity, version
  // validation, boot decisions, and snapshot packing in the real runtime.
  tutorial._openSnapshotDB = async () => ({
    transaction() {
      const tx = {
        objectStore() {
          return {
            get(key) {
              const request = { result: records.get(key) };
              queueMicrotask(() => request.onsuccess());
              return request;
            },
            put(record) {
              records.set(record.key, record);
              queueMicrotask(() => tx.oncomplete());
            },
          };
        },
      };
      return tx;
    },
  });
  let restoredOldVm = false;
  const newState = new Uint8Array([2]).buffer;
  tutorial.emulator = {
    restore_state: async () => { restoredOldVm = true; },
    save_state: async () => newState,
  };
  tutorial._runSilent = async () => {};

  await tutorial._setupFilesystem();

  assert.equal(restoredOldVm, false, 'cold boot must not resurrect the old PID 1 shell');
  assert.equal(await tutorial._loadCachedSnapshot('step-entry', 0), null);
  assert.deepEqual(await tutorial._loadCachedSnapshot('initial', 0), newState);
});
