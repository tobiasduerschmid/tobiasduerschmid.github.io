const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
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
    send(input, pattern = prompt) {
      output = '';
      const result = waitFor(pattern);
      vm.serial0_send(input);
      return result;
    },
  };
}

for (const coldBoot of [false, true]) {
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
