// @ts-check
//
// v86 + gdb smoke regression — verifies the image rebuild from
// vm/build-rootfs.sh ships gdb AND that the resulting kernel survives a
// real ptrace session.
//
// What this test guards against (one named behavior per partition):
//
//   1. Boot panic        — adding the `gdb` Alpine package (+ its musl
//                          dependency tree) bloats the rootfs by ~10 MB.
//                          If the VM's memory budget or the kernel's
//                          mount-time module discovery breaks, v86 prints
//                          "Kernel panic - not syncing: …" to ttyS0 and
//                          never reaches a shell prompt.
//
//   2. gdb installed      — sanity-check that the rebuilt image actually
//                          contains the binary. A passing first
//                          assertion + a failing second one means
//                          someone forgot to rerun build-rootfs.sh.
//
//   3. ptrace doesn't panic — gdb is the first thing in this image that
//                          uses PTRACE_ATTACH. Some emulated CPUs (v86
//                          is i486-class with deliberate gaps) have
//                          tripped kernel BUG_ON()s in the past when
//                          PTRACE writes touch unsupported registers.
//                          Running gdb against /bin/echo through the
//                          --batch flag is the smallest test that
//                          actually traps in/out of ptrace at least once.
//
// Design notes (per .agents/skills/test-design/SKILL.md):
//   - Each oracle pins a specific string from real output, not "no
//     errors thrown".
//   - Waits are observable conditions (toMatch / toContain), never
//     waitForTimeout.
//   - The serial-output buffer is attached via addInitScript so the
//     listener exists before the VM boots — boot-time panics would
//     otherwise happen before we could see them.
//   - The page-console stream is also captured: v86 sometimes mirrors
//     hard kernel oopses to the JS console for visibility.

const { test, expect } = require('@playwright/test');

const TUTORIAL_URL = '/SEBook/tools/c-tutorial';
const VM_BOOT_TIMEOUT = 90_000;
const CMD_OUTPUT_TIMEOUT = 15_000;

// Linux kernel-panic / BUG / Oops markers. Real kernel uses these exact
// strings; matching is case-sensitive on "Kernel panic" but loose on the
// rest because dmesg-style output varies.
const PANIC_PATTERNS = [
  /Kernel panic - not syncing/,
  /------------\[ cut here \]------------/,
  /\bOops:\s/,
  /BUG:\s+kernel/,
  /VFS:\s+Unable\s+to\s+mount\s+root/,
];

function assertNoPanic(text, source) {
  for (const re of PANIC_PATTERNS) {
    expect(text, `unexpected ${re} in ${source}`).not.toMatch(re);
  }
}

test.describe.serial('v86 gdb image smoke', () => {
  test('boots with gdb installed and survives a gdb ptrace session without kernel panic', async ({ browser }) => {
    const page = await browser.newPage();
    try {
      // Install the serial0 listener BEFORE navigation. window._tutorial
      // is constructed lazily during page setup, so we poll briefly until
      // its emulator is wired up, then attach.
      await page.addInitScript(() => {
        window.__test_serialOut = '';
        const attach = () => {
          const t = window._tutorial;
          if (!t || !t.emulator || typeof t.emulator.add_listener !== 'function') {
            return setTimeout(attach, 30);
          }
          t.emulator.add_listener('serial0-output-byte', b => {
            window.__test_serialOut += String.fromCharCode(b);
          });
        };
        attach();
      });

      // Page console / pageerror catches kernel diagnostics the runtime
      // chooses to surface to JS (rare but has happened) and any JS-side
      // crashes that would mask the real cause.
      /** @type {string[]} */
      const consoleLines = [];
      page.on('console', msg => consoleLines.push(msg.text()));
      page.on('pageerror', err => consoleLines.push('pageerror: ' + err.message));

      await page.goto(TUTORIAL_URL);

      // Behaviour 1: VM reaches a shell prompt within the boot budget.
      // The bashrc in vm/overlay configures the prompt to end with `# `
      // or `$ `; we wait for either at the end of a line.
      await page.waitForFunction(
        () => /[#$]\s*$/m.test(window.__test_serialOut || ''),
        null,
        { timeout: VM_BOOT_TIMEOUT },
      );
      const bootCapture = await page.evaluate(() => window.__test_serialOut);
      assertNoPanic(bootCapture, 'serial output during boot');
      assertNoPanic(consoleLines.join('\n'), 'page console during boot');

      // Behaviour 2: gdb is installed. A "command not found" here means
      // the image hasn't been rebuilt with the `gdb` apk package yet —
      // surface that diagnostic loudly so the failure isn't read as a
      // panic regression.
      await sendInVM(page, 'gdb --version\n');
      await page.waitForFunction(
        () => /(GNU gdb|command not found|: not found)/i.test(window.__test_serialOut || ''),
        null,
        { timeout: CMD_OUTPUT_TIMEOUT },
      );
      const afterVersion = await page.evaluate(() => window.__test_serialOut);
      expect(
        afterVersion,
        'gdb is missing from the rootfs — rerun vm/build-rootfs.sh so the `gdb` apk package is included',
      ).toMatch(/GNU gdb/i);

      // Behaviour 3: a real ptrace session under gdb completes. --batch
      // forces gdb to exit after the script; -ex run starts the inferior
      // (/bin/echo, which always exists on Alpine); we wait for either
      // the program's stdout or gdb's "exited normally" status.
      await sendInVM(page, 'gdb -q -batch -ex run --args /bin/echo gdb-ptrace-ok\n');
      await page.waitForFunction(
        () => /(gdb-ptrace-ok|exited normally)/.test(window.__test_serialOut || ''),
        null,
        { timeout: CMD_OUTPUT_TIMEOUT },
      );
      const afterPtrace = await page.evaluate(() => window.__test_serialOut);
      assertNoPanic(afterPtrace, 'serial output after gdb ptrace run');
      assertNoPanic(consoleLines.join('\n'), 'page console after gdb ptrace run');
    } finally {
      await page.close();
    }
  });
});

/**
 * Type a command into the v86 terminal via the emulator's serial0 input.
 * This is the same channel the user's keystrokes ride on, so the test
 * exercises the real shell stack — bash → tcc → kernel — not a stubbed
 * shortcut.
 */
async function sendInVM(page, text) {
  await page.evaluate((s) => {
    const e = window._tutorial && window._tutorial.emulator;
    if (e && typeof e.serial0_send === 'function') e.serial0_send(s);
  }, text);
}
