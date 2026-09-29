const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

// Exercise the shipped VM through its interactive shell so the same startup
// configuration and terminal behavior used by learners are part of the check.
async function runTerminalCommand(page, command) {
  return page.evaluate(async (shellCommand) => {
    const tutorial = window._tutorial;
    await tutorial._runSilent(':');
    return new Promise((resolve) => {
      let output = '';
      const capture = (byte) => {
        output += String.fromCharCode(byte);
        if (byte === 10 && /\n__MAN_EXIT__=\d+\r?\n/.test(output)) {
          tutorial.emulator.remove_listener('serial0-output-byte', capture);
          // Normalize terminal styling, including the overstrikes used by man.
          resolve(output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/.\x08/g, ''));
        }
      };
      tutorial.emulator.add_listener('serial0-output-byte', capture);
      tutorial.sendCommand(`${shellCommand}; printf '\\n__MAN_EXIT__=%s\\n' "$?"`);
    });
  }, command);
}

// xterm renders to canvas; its public buffer API exposes the same text that
// learners can read and scroll through without depending on renderer markup.
async function terminalText(page) {
  return page.evaluate(() => {
    const buffer = window._tutorial.term.buffer.active;
    return Array.from({ length: buffer.length }, (_, index) =>
      buffer.getLine(index).translateToString(true)).join('\n');
  });
}

function nonAsciiSequences(text) {
  return [...new Set(text.match(/[^\x00-\x7f]+/g) || [])];
}

test.describe('Linux tutorial manual pages', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/tools/shell-tutorial');
    await waitForTutorialReady(page, {
      readySelector: '.tvm-terminal-container',
      bootTimeout: 90_000,
    });
  });

  for (const { command, heading, content } of [
    { command: 'man date', heading: 'DATE(1)', content: /(?:print|display) or set[\s\S]*date and time/i },
    { command: 'man echo', heading: 'ECHO(1)', content: /display a line of text/i },
    { command: 'man chmod', heading: 'CHMOD(1)', content: /change file mode bits/i },
    { command: 'man 1 date', heading: 'DATE(1)', content: /(?:print|display) or set[\s\S]*date and time/i },
  ]) {
    test(`${command} displays its manual and returns to the shell`, async ({ page }) => {
      const output = await runTerminalCommand(page, command);
      expect(output).toContain(heading);
      expect(output).toMatch(/\bNAME\b/);
      expect(output).toMatch(/\bSYNOPSIS\b/);
      expect(output).toMatch(content);
      expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
    });
  }

  test('manual pages can be piped into another command and remain readable in scrollback', async ({ page }) => {
    const output = await runTerminalCommand(page, '(set -o pipefail; man date | cat)');
    expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
    await expect.poll(() => terminalText(page)).toContain('DATE(1)');
    await expect.poll(() => terminalText(page)).toMatch(/date - (?:print|display) or set/);
  });

  test('an unknown manual reports the missing page and fails', async ({ page }) => {
    const output = await runTerminalCommand(page, 'man tutorial-no-such-command');
    expect(output).toMatch(/(?:no (?:manual|entry)|not found).*tutorial-no-such-command/i);
    expect(output).toMatch(/__MAN_EXIT__=[1-9]\d*\r?\n/);
  });

  for (const { family, pages } of [
    {
      family: 'shell tools',
      pages: [
        ['man grep', 'GREP(1)'],
        ['man sed', 'SED(1)'],
        ['man awk', 'GAWK(1)'],
        ['man find', 'FIND(1)'],
        ['man diff', 'DIFF(1)'],
        ['man bash', 'BASH(1)'],
        ['man test', 'TEST(1)'],
        ["man '['", 'TEST(1)'],
      ],
    },
    {
      family: 'Git commands and ignore files',
      pages: [
        ['man git', 'GIT(1)'],
        ['man git-commit', 'GIT-COMMIT(1)'],
        ['man git-rebase', 'GIT-REBASE(1)'],
        ['man 5 gitignore', 'GITIGNORE(5)'],
        ['git help gitignore', 'GITIGNORE(5)'],
        ['git help commit', 'GIT-COMMIT(1)'],
      ],
    },
    { family: 'Make', pages: [['man make', 'MAKE(1)']] },
  ]) {
    test(`local manuals document ${family}`, async ({ page }) => {
      for (const [command, heading] of pages) {
        await test.step(command, async () => {
          // Large references such as Bash need only a readable excerpt to
          // establish coverage; head also keeps serial transfer bounded.
          const output = await runTerminalCommand(page, `${command} | head -40`);
          expect(output).toContain(heading);
          expect(output).toMatch(/\bNAME\b/);
          expect(output).toMatch(/\bSYNOPSIS\b/);
          expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
        });
      }
    });
  }

  test('Bash builtins have their own local reference pages', async ({ page }) => {
    for (const builtin of ['cd', 'set', 'export', 'local', 'return', 'exit',
      'source', 'read', 'shift', 'break', 'continue', 'help', 'type']) {
      await test.step(`man ${builtin}`, async () => {
        const output = await runTerminalCommand(page, `man ${builtin}`);
        expect(output).toMatch(new RegExp(`\\n\\s+${builtin} - `));
        expect(output).toMatch(/\bNAME\b/);
        expect(output).toMatch(/\bSYNOPSIS\b/);
        expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
      });
    }
  });

  test('git status --help displays readable status descriptions without mojibake', async ({ page }) => {
    const output = await runTerminalCommand(page, 'git status --help');
    expect(output).toContain('GIT-STATUS(1)');
    expect(output).toContain('M = modified');
    // The VM serial terminal needs portable ASCII for manual punctuation.
    expect(nonAsciiSequences(output)).toEqual([]);
    expect(output).toMatch(/__MAN_EXIT__=0\r?\n/);
    await expect.poll(() => terminalText(page)).toContain('M = modified');
    await expect.poll(async () => nonAsciiSequences(await terminalText(page))).toEqual([]);
  });
});
