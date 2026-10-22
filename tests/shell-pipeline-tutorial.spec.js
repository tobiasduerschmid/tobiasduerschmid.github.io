const { test, expect } = require('@playwright/test');
const { a11yCheckpoint, auditInteractiveState } = require('./a11y-helpers');

const TUTORIAL_URL = '/SEBook/tools/shell-pipeline-tutorial.html';
const COUNT_COMMAND = 'cut -f3 access.tsv | sort | uniq -c';
const REWRITE_COMMAND = "cut -f3 access.tsv | sed 's/\\.html$/.htm/'";
const FAILURE_COMMAND = "awk '$2 == \"GET\" && $4 >= 400 { print $3 }' access.tsv | sort | uniq";

function tutorialControls(page) {
  return {
    command: page.getByRole('textbox', { name: 'Shell command', exact: true }),
    fileEditor: page.getByRole('textbox', { name: /code editor\./ }),
    run: page.getByRole('button', { name: /^▶\s+Run$/ }),
    stop: page.getByRole('button', { name: /Stop$/, exact: false }),
    check: page.getByRole('button', { name: /Test My Work/ }),
    next: page.getByRole('button', { name: /^Next →/ }),
    output: page.getByRole('region', { name: 'Program output', exact: true }),
  };
}

async function openTutorial(page) {
  await page.goto(TUTORIAL_URL);
  await expect(page.getByRole('heading', { name: 'Request Counts', exact: true })).toBeVisible();
  await expect(tutorialControls(page).fileEditor).toBeVisible();
  await expect(tutorialControls(page).run).toBeEnabled();
  await expect(tutorialControls(page).command).toBeEditable();
}

async function runCommand(page, command) {
  const controls = tutorialControls(page);
  await controls.command.fill(command);
  await controls.run.click();
  await expect(controls.run).toBeEnabled();
}

async function checkCommand(page, command, { passed = 4, total = 4 } = {}) {
  const controls = tutorialControls(page);
  await controls.command.fill(command);
  await controls.check.click();
  const summary = passed === total
    ? page.getByText(`✅ All ${total} tests passed!`, { exact: true })
    : page.getByText(new RegExp(`^${passed}\\s*/\\s*${total} tests passed$`));
  await expect(summary).toBeVisible();
}

async function nextStep(page, number) {
  await tutorialControls(page).next.click();
  await expect(page.getByRole('button', { name: new RegExp(`^Step ${number}:`) }))
    .toHaveAttribute('aria-current', 'step');
}

async function editInputFile(page, content) {
  await tutorialControls(page).fileEditor.focus();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(content);
}

test('students can skip every check and access a solution on every step', async ({ page }) => {
  await openTutorial(page);
  const solution = page.getByRole('link', { name: 'Solution', exact: true });
  await expect(solution).toBeVisible();
  await nextStep(page, 2);
  await expect(solution).toBeVisible();
  await nextStep(page, 3);
  await expect(solution).toBeVisible();
  await solution.click();
  await expect(tutorialControls(page).command).not.toHaveValue('');
});

test('students run their own quoted pipelines through the tutorial output panel', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openTutorial(page);

  await runCommand(page, "printf 'Beta\\nalpha\\nBeta\\n' | tr '[:upper:]' '[:lower:]' | sort | uniq -c | awk '{print $2 \":\" $1}'");

  await expect(tutorialControls(page).output).toContainText('alpha:1\nbeta:2\n');
  await expect(tutorialControls(page).run).toBeFocused();
  expect(errors, 'a shell pipeline must not cause an uncaught browser error').toEqual([]);
  await a11yCheckpoint(page, 'shell pipeline tutorial output', { feature: 'shell-pipeline-tutorial' });
});

test('students can consult cut, grep, sed, and awk manuals from the command field', async ({ page }) => {
  await openTutorial(page);

  await runCommand(page, 'man cut; man grep; man sed; man awk');

  const output = tutorialControls(page).output;
  await expect(output).toContainText('cut -f LIST [-d CHAR] [FILE]...');
  await expect(output).toContainText('grep [OPTION]... PATTERN [FILE]...');
  await expect(output).toContainText("sed [OPTION]... 'SCRIPT' [FILE]...");
  await expect(output).toContainText("awk [OPTION]... 'PATTERN { ACTION }' [FILE]...");
  await expect(output).toContainText('OPTIONS');
});

test('redirections and tee process intermediate files within a command sequence', async ({ page }) => {
  await openTutorial(page);

  await runCommand(page, "printf 'pear\\napple\\n' > fruit.txt; printf 'pear\\n' >> fruit.txt; sort fruit.txt | uniq -c | tee counts.txt; wc -l < fruit.txt");

  await expect(tutorialControls(page).output).toContainText(/1 apple\s+2 pear\s+3/);
});

test('a shell error is visible and the next command still executes', async ({ page }) => {
  await openTutorial(page);
  await runCommand(page, 'cat missing-lab-file.txt');
  await expect(tutorialControls(page).output).toContainText('missing-lab-file.txt');
  await expect(tutorialControls(page).output).toContainText(/(?:exit|code).*1/i);

  await runCommand(page, "printf 'Recovered\\n'");

  await expect(tutorialControls(page).output).toContainText('Recovered\n');
  await expect(tutorialControls(page).output).not.toContainText('missing-lab-file.txt');
});

test('Stop cancels a running shell command and permits another run', async ({ page }) => {
  await openTutorial(page);
  const controls = tutorialControls(page);
  await controls.command.fill('sleep 100');
  await controls.run.click();
  await controls.stop.click();

  await expect(controls.output).toContainText(/stopped|cancelled/i);
  await expect(controls.run).toBeFocused();
  await runCommand(page, 'wc -l < access.tsv');
  await expect(controls.output).toContainText(/\b10\b/);
});

test('an alternative correct command passes the optional standard tests', async ({ page }) => {
  await openTutorial(page);
  await expect(tutorialControls(page).next).toBeEnabled();

  await checkCommand(page, "awk '{count[$3]++} END {for (path in count) print count[path], path}' access.tsv | sort -k2");

  await expect(tutorialControls(page).check).toBeFocused();
  await expect(tutorialControls(page).next).toBeEnabled();
  await nextStep(page, 2);
  await expect(page.getByRole('heading', { name: 'Path Suffixes', exact: true })).toBeVisible();
});

test('a canned answer passes the visible fixture but fails varied inputs', async ({ page }) => {
  await openTutorial(page);

  await checkCommand(page, "printf '2 /api/items\\n3 /index.html\\n2 /login\\n2 /missing.html\\n1 /styles.css\\n'", { passed: 1 });

  await expect(tutorialControls(page).next).toBeEnabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'All requests in the supplied log' })).toContainText('✓');
  await expect(page.getByRole('listitem').filter({ hasText: 'An empty input file' })).toContainText('✗');
});

test('Hints follow pipeline stages and ignore command names in comments', async ({ page }) => {
  await openTutorial(page);
  await checkCommand(page, 'cut -f3 "access.tsv" | uniq -c # sort', { passed: 2 });
  await page.getByRole('button', { name: 'Hints', exact: true }).click();
  await expect(page.getByText(/Neighbors in the stream/)).toBeVisible();

  await checkCommand(page, 'cut -f3 access.tsv | uniq -c | sort', { passed: 2 });
  await page.getByRole('button', { name: 'Hints', exact: true }).click();

  await expect(page.getByText(/The position of each stage/)).toBeVisible();
  await expect(page.getByText(/Neighbors in the stream/)).toHaveCount(0);
  await a11yCheckpoint(page, 'shell pipeline structural hints', { feature: 'shell-pipeline-tutorial' });
});

test('a correct output with a failing exit status does not pass a check', async ({ page }) => {
  await openTutorial(page);

  await checkCommand(page, `${COUNT_COMMAND}; exit 7`, { passed: 0 });

  await expect(tutorialControls(page).next).toBeEnabled();
});

test('editing a checked command removes its old pass while Next stays available', async ({ page }) => {
  await openTutorial(page);
  await checkCommand(page, COUNT_COMMAND);

  await tutorialControls(page).command.fill('cat access.tsv');

  await expect(page.getByText('✅ All 4 tests passed!', { exact: true })).toHaveCount(0);
  await expect(tutorialControls(page).next).toBeEnabled();
});

test('editing the command during checks discards the obsolete results', async ({ page }) => {
  await openTutorial(page);
  const controls = tutorialControls(page);
  // A real waiting shell command leaves time to edit while the worker is busy.
  await controls.command.fill(`sleep 1.5; ${COUNT_COMMAND}`);
  await controls.check.click();
  await expect(controls.stop).toBeEnabled();
  await controls.command.fill(COUNT_COMMAND);

  await expect(controls.output).toContainText(/command changed during the checks/);
  await expect(controls.next).toBeEnabled();
  await checkCommand(page, COUNT_COMMAND);
});

test('edited input drives Run while automatic checks use fresh files', async ({ page }) => {
  await openTutorial(page);
  const editedInput = '12:00\tGET\t/student-edit.html\t418\t1\n';
  await editInputFile(page, editedInput);
  await runCommand(page, 'cut -f3 access.tsv');
  await expect(tutorialControls(page).output).toContainText('/student-edit.html');

  await checkCommand(page, COUNT_COMMAND);
  await runCommand(page, 'cat access.tsv');

  await expect(tutorialControls(page).output).toContainText(editedInput);
});

test('each practice task starts with an empty command and completes through tutorial navigation', async ({ page }) => {
  await openTutorial(page);
  await expect(page.getByRole('button', { name: /^Step \d+:/ })).toHaveCount(3);
  await expect(tutorialControls(page).command).toHaveValue('');
  await checkCommand(page, COUNT_COMMAND);
  await nextStep(page, 2);
  await expect(tutorialControls(page).command).toHaveValue('');
  await checkCommand(page, REWRITE_COMMAND);
  await nextStep(page, 3);
  await expect(tutorialControls(page).command).toHaveValue('');
  await checkCommand(page, FAILURE_COMMAND, { passed: 5, total: 5 });

  await expect(page.getByRole('heading', { name: 'Failure Reports', exact: true })).toBeVisible();
  await expect(tutorialControls(page).next).toHaveCount(0);
});

test('a transforming command must preserve the supplied input file', async ({ page }) => {
  await openTutorial(page);
  await checkCommand(page, COUNT_COMMAND);
  await nextStep(page, 2);

  await checkCommand(page, `${REWRITE_COMMAND}; printf 'changed\\n' > access.tsv`, { passed: 0 });

  await expect(tutorialControls(page).next).toBeEnabled();
  await expect(tutorialControls(page).output).toContainText(/input file was changed or removed/i);
});

test('command drafts including empty text survive navigation and reload and reset only their step', async ({ page }) => {
  await openTutorial(page);
  await checkCommand(page, COUNT_COMMAND);
  await nextStep(page, 2);
  await tutorialControls(page).command.fill(REWRITE_COMMAND);
  await tutorialControls(page).command.fill('');
  await page.reload();
  await expect(tutorialControls(page).run).toBeEnabled();
  await expect(tutorialControls(page).command).toHaveValue('');

  await page.getByRole('button', { name: /^Step 1:/ }).click();
  await expect(tutorialControls(page).command).toHaveValue(COUNT_COMMAND);
  await page.getByRole('button', { name: /^Step 2:/ }).click();
  await expect(tutorialControls(page).command).toHaveValue('');

  await tutorialControls(page).command.fill(REWRITE_COMMAND);
  await page.getByRole('link', { name: 'Reset Current Step', exact: true }).click();
  const confirmation = page.getByRole('dialog');
  await confirmation.getByRole('button', { name: 'Reset step', exact: true }).click();
  await expect(tutorialControls(page).command).toHaveValue('');
  await page.reload();
  await expect(tutorialControls(page).run).toBeEnabled();
  await expect(tutorialControls(page).command).toHaveValue('');
  await page.getByRole('button', { name: /^Step 1:/ }).click();
  await expect(tutorialControls(page).command).toHaveValue(COUNT_COMMAND);
});

test('the command field sits between the file editor and output and supports the Run shortcut', async ({ page }) => {
  await openTutorial(page);
  const controls = tutorialControls(page);
  const editor = await controls.fileEditor.boundingBox();
  const command = await controls.command.boundingBox();
  const output = await controls.output.boundingBox();
  expect(editor, 'the input-file editor is visible').not.toBeNull();
  expect(command, 'the shell command field is visible').not.toBeNull();
  expect(output, 'the output panel is visible').not.toBeNull();
  expect(command.y, 'the shell command comes after the file editor').toBeGreaterThanOrEqual(editor.y + editor.height);
  expect(command.y + command.height, 'the shell command comes before output').toBeLessThanOrEqual(output.y);

  await controls.command.fill("printf 'Keyboard run\\n'");
  await controls.command.press('ControlOrMeta+Enter');

  await expect(controls.output).toContainText('Keyboard run\n');
  await expect(controls.command).toBeFocused();
  await controls.command.press('Tab');
  await expect(controls.command).not.toBeFocused();
});

test('the tutorial and completed feedback have no automatic accessibility violations in either theme', async ({ page }) => {
  await openTutorial(page);
  await checkCommand(page, COUNT_COMMAND);

  await auditInteractiveState(page, 'shell pipeline tutorial successful checks');
  const sizes = await tutorialControls(page).command.evaluate((element) => ({
    command: parseFloat(getComputedStyle(element).fontSize),
    paragraph: parseFloat(getComputedStyle(document.querySelector('.tvm-step-content p')).fontSize),
  }));
  expect(sizes.command, 'shell commands must be at least as readable as tutorial paragraphs').toBeGreaterThanOrEqual(sizes.paragraph);
});

test('the command field reflows at 320 pixels with increased text spacing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openTutorial(page);
  const command = tutorialControls(page).command;
  await page.addStyleTag({ content: 'textarea { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }' });
  await command.scrollIntoViewIfNeeded();

  const bounds = await command.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  await runCommand(page, "printf 'Mobile run\\n'");
  await expect(tutorialControls(page).output).toContainText('Mobile run\n');
});

test('the print view leaves commands empty and includes manuals in light mode', async ({ page }) => {
  await page.goto('/SEBook/tools/shell-pipeline-tutorial/print.html');
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });

  await expect(page.getByRole('heading', { name: /Request Counts/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Path Suffixes/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Failure Reports/ })).toBeVisible();
  await expect(page.getByRole('code').filter({ hasText: /^$/ })).toHaveCount(3);
  await expect(page.getByText('cut -f LIST [-d CHAR] [FILE]...', { exact: false })).toBeVisible();
  await expect(page.getByText('grep [OPTION]... PATTERN [FILE]...', { exact: false })).toBeVisible();
  await expect(page.getByText("sed [OPTION]... 'SCRIPT' [FILE]...", { exact: false })).toBeVisible();
  await expect(page.getByText("awk [OPTION]... 'PATTERN { ACTION }' [FILE]...", { exact: false })).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
