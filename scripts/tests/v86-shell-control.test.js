const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const jsVm = require('node:vm');
const zlib = require('node:zlib');
const { V86 } = require('../../assets/v86/libv86.js');

const root = path.resolve(__dirname, '../..');
const asset = name => ({ url: path.join(root, name) });
const prompt = /(?:^|\n)(?:root@)?tutorial:[^\n]*[#\$] $/;

function startTerminal(coldBoot) {
  const startup = coldBoot ? {
    bzimage: asset('vm/dist/bzImage'),
    initrd: asset('vm/dist/rootfs.cpio.gz'),
  } : {
    initial_state: { buffer: Uint8Array.from(zlib.gunzipSync(
      fs.readFileSync(path.join(root, 'vm/dist/state.bin.gz')))).buffer },
  };
  const vm = new V86({
    wasm_path: path.join(root, 'assets/v86/v86.wasm'),
    memory_size: 192 * 1024 * 1024, vga_memory_size: 2 * 1024 * 1024,
    bios: asset('assets/v86/seabios.bin'), vga_bios: asset('assets/v86/vgabios.bin'),
    ...startup, cmdline: 'console=ttyS0 rw quiet', autostart: true,
    disable_keyboard: true, disable_mouse: true, disable_speaker: true,
    screen_dummy: true, virtio_console: true, filesystem: {},
  });
  let output = '';
  let check = () => {};
  vm.add_listener('serial0-output-byte', byte => {
    output += String.fromCharCode(byte);
    check();
  });
  vm.add_listener('emulator-started', () => {
    if (!coldBoot) vm.serial0_send('\n');
  });
  function waitFor(pattern, timeout = 10_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        check = () => {};
        reject(new Error(`Expected ${pattern}; terminal output: ${JSON.stringify(output.slice(-2000))}`));
      }, timeout);
      check = () => {
        const text = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
        if (!pattern.test(text)) return;
        clearTimeout(timer);
        check = () => {};
        resolve(text);
      };
      check();
    });
  }
  return {
    vm, waitFor,
    readOutput() { return output; },
    send(input, pattern = prompt) {
      output = '';
      const result = waitFor(pattern);
      vm.serial0_send(input);
      return result;
    },
  };
}

function waitForGitState(emulator, pattern) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      emulator.remove_listener('virtio-console0-output-bytes', onBytes);
      reject(new Error(`Expected a Git notification matching ${pattern}`));
    }, 10_000);
    function onBytes(bytes) {
      buffer += Buffer.from(bytes).toString('utf8');
      let end;
      while ((end = buffer.indexOf('\n')) !== -1) {
        const [kind, , payload] = buffer.slice(0, end).trim().split(' ');
        buffer = buffer.slice(end + 1);
        if (kind !== 'G' || !pattern.test(Buffer.from(payload, 'base64').toString('utf8'))) continue;
        clearTimeout(timer);
        emulator.remove_listener('virtio-console0-output-bytes', onBytes);
        resolve();
        return;
      }
    }
    emulator.add_listener('virtio-console0-output-bytes', onBytes);
  });
}

for (const coldBoot of [false, true]) {
  test(`Git refresh leaves terminal output and history alone (${coldBoot ? 'cold boot' : 'snapshot'})`, { timeout: 120_000 }, async t => {
    const terminal = startTerminal(coldBoot);
    t.after(() => terminal.vm.destroy());
    await terminal.waitFor(prompt, 90_000);
    const sandbox = { document: { cookie: '' }, TextEncoder, TextDecoder, btoa, atob, setTimeout, clearTimeout };
    sandbox.window = sandbox;
    jsVm.runInNewContext(fs.readFileSync(path.join(root, 'js/tutorial-code.js'), 'utf8'), sandbox);
    const tutorial = new sandbox.TutorialCode({}, {
      backend: 'v86', gitGraphPath: '/tutorial/myproject',
      setupCommands: ['git init -q /tutorial/myproject'],
    });
    tutorial.emulator = terminal.vm;
    tutorial.booted = true;
    await tutorial._setupFilesystem();

    const first = await terminal.send('cd /tutorial/myproject; echo first-command\n');
    const notification = waitForGitState(terminal.vm, /\?\? graph-update\.txt/);
    const second = await terminal.send('echo second-command; touch graph-update.txt\n');
    await notification;
    const jobs = await terminal.send(' jobs\n');
    assert.doesNotMatch(first + second + jobs, /\[\d+\]|__gg_/, 'Git refresh must not produce job notices or appear in jobs');

    // Background graph work must not consume input or insert commands into
    // Readline history while the learner navigates it or edits a partial line.
    await terminal.send('\x1b[A', /touch graph-update\.txt$/);
    const historyLine = terminal.readOutput();
    await tutorial._dumpGitState();
    assert.equal(terminal.readOutput(), historyLine, 'Background refresh must not redraw or overwrite recalled input');
    const recalled = await terminal.send('\x1b[A\n');
    assert.match(recalled, /\nfirst-command\n/);
    await terminal.send('echo typed-', /echo typed-$/);
    const partialLine = terminal.readOutput();
    await tutorial._dumpGitState();
    assert.equal(terminal.readOutput(), partialLine, 'Background refresh must not interrupt partial input');
    const typed = await terminal.send('through-refresh\n');
    assert.match(typed, /\ntyped-through-refresh\n/);
    assert.doesNotMatch(recalled + typed, /\[\d+\]|__gg_/);

    await terminal.send('yes "Still running"\n', /\nStill running\n/);
    await terminal.send('\x03');
    assert.match(await terminal.send('echo interrupted\n'), /\ninterrupted\n/);

    // Learner-owned background jobs remain visible and controllable.
    await terminal.send(' sleep 60 & learner_pid=$!\n');
    assert.match(await terminal.send(' jobs\n'), /Running\s+sleep 60/);
    await terminal.send(' kill "$learner_pid"; wait "$learner_pid" 2>/dev/null\n');
  });

  test(`shell interruption preserves work (${coldBoot ? 'cold boot' : 'snapshot'})`, { timeout: 120_000 }, async t => {
    const terminal = startTerminal(coldBoot);
    t.after(() => terminal.vm.destroy());
    const boot = await terminal.waitFor(prompt, 90_000);
    assert.doesNotMatch(boot, /Initramfs unpacking failed|Kernel panic/);
    await terminal.send("printf 'saved work\\n' > /tutorial/control-work.txt\n");

    // Exercise interruption both before and after the supervisor restarts Bash.
    for (let attempt = 0; attempt < 2; attempt++) {
      await terminal.send('yes "Still running"\n', /\nStill running\n/);
      await terminal.send('\x03');
      await terminal.send('cat\n', /cat\n/);
      await terminal.send('hello\n', /hello\n/);
      await terminal.send('\x04');
      const saved = await terminal.send('cat /tutorial/control-work.txt\n');
      assert.match(saved, /\nsaved work\n/);
      if (attempt === 0) await terminal.send('exit\n');
    }
  });
}
