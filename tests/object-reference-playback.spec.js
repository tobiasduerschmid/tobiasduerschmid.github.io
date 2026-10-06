// @ts-check
const { test, expect } = require('@playwright/test');

const CHAPTER = '/SEBook/tools/python.html';
const action = (lab, name) => lab.getByRole('button', { name, exact: true });

async function example(page, title) {
  await page.goto(CHAPTER);
  const lab = page.getByRole('region', { name: 'Object reference lab: ' + title, exact: true });
  await expect(action(lab, 'Forward')).toBeEnabled();
  return lab;
}

test('Forward, Back, and Play visit statements rather than function declaration stops', async ({ page }) => {
  const lab = await example(page, 'Mutation, local assignment, and a return');
  const status = lab.getByRole('status');
  await action(lab, 'Forward').click();
  await expect(status).toContainText('Before first statement');
  await action(lab, 'Forward').click();
  await expect(status).toContainText('Line 6'); // draft = ["draft"] has executed.
  await action(lab, 'Forward').click();
  await expect(status).toContainText('Line 7'); // revise(draft) has bound its argument.
  await lab.getByText('Reference details', { exact: true }).click();
  const details = lab.locator('.orl-details'); // Public text alternative for the diagram.
  await expect(details).toContainText(/labels\s*→\s*o\d+/);
  const text = await details.innerText();
  const draft = text.match(/draft\s*→\s*(o\d+)/);
  const labels = text.match(/labels\s*→\s*(o\d+)/);
  expect(draft).not.toBeNull();
  expect(labels).not.toBeNull();
  expect(labels[1]).toBe(draft[1]);

  await action(lab, 'Back').click();
  await expect(status).toContainText('Line 6');
  await action(lab, 'Back').click();
  await expect(status).toContainText('Before first statement');
  await action(lab, 'Back').click();
  await expect(status).toContainText('Before execution');
  await expect(action(lab, 'Back')).toBeDisabled();

  // Control playback time rather than waiting for a wall-clock interval.
  await page.clock.install();
  await action(lab, 'Play').click();
  await page.clock.runFor(1600);
  await expect(status).toContainText('Before first statement');
  await action(lab, 'Pause').click();
});

test('class declaration scaffolding is skipped but executable class state remains visible', async ({ page }) => {
  const lab = await example(page, 'Which list does each instance find?');
  await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText('Before first statement');
  await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText('Line 2'); // items = [] is now a class attribute.
  await lab.getByText('Reference details', { exact: true }).click();
  await expect(lab.locator('.orl-details')).toContainText(/class Shelf;.*items → o\d+/);
  await action(lab, 'Back').click();
  await expect(lab.getByRole('status')).toContainText('Before first statement');
});

test('edited definitions execute, called bodies are stepped, and a definition error is retained', async ({ page }) => {
  test.setTimeout(150_000);
  const lab = await example(page, 'Mutation, local assignment, and a return');
  const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
  await editor.fill([
    'def unused():',
    '    return [99]',
    'class Box:',
    '    def __init__(self):',
    '        self.items = []',
    'box = Box()',
    'print(box.items)',
    'class Broken(missing_base):',
    '    pass'
  ].join('\n'));

  await expect(action(lab, 'Forward')).toBeEnabled({ timeout: 120_000 });
  await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText('Before first statement');
  await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText('Line 6'); // Box() has entered __init__ and bound self.
  for (let count = 0; count < 20 && await action(lab, 'Forward').isEnabled(); count += 1) {
    await action(lab, 'Forward').click();
  }
  await expect(action(lab, 'Forward')).toBeDisabled();
  await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[]');
  await expect(lab.getByRole('alert')).toContainText('NameError');
  await action(lab, 'Back').click();
  await expect(lab.getByRole('status')).toContainText('Execution stopped with an error');
});
