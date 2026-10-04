// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint, auditInteractiveState } = require('./a11y-helpers');

const TUTORIAL = '/SEBook/tools/python-tutorial.html#lists';
const EMBEDS = [
  {
    key: 'shared_slots',
    step: 'Step 6: Lists of References',
    output: '[[0, 1], [2]]\n[0, 1]',
    hasMemberReferences: true
  },
  {
    key: 'member_sharing',
    step: 'Step 7: Objects & Member References',
    output: "['final']\n['draft', 'review']",
    hasMemberReferences: true
  },
  {
    key: 'class_attributes',
    step: 'Step 8: Class Objects & Instance Attributes',
    output: "['map']\n['atlas']",
    hasMemberReferences: true
  },
  {
    key: 'shallow_copy',
    step: 'Step 9: Aliases, Shallow Copies, and Deep Copies',
    output: "[['draft', 'review'], ['draft', 'review']]\n[['draft', 'review'], ['draft', 'review']]\n[['draft', 'private'], ['draft', 'private']]",
    hasMemberReferences: true
  },
  {
    key: 'identity_equality',
    step: 'Step 10: Identity and Value Equality',
    output: "True\nFalse\nTrue\n['draft', 'review']\n['draft']",
    hasMemberReferences: false
  },
  {
    key: 'parameter_rebinding',
    step: 'Step 11: Function Calls and Mutable Defaults',
    output: "['draft', 'review']\n['final']",
    hasMemberReferences: false
  },
  {
    key: 'mutable_default',
    step: 'Step 11: Function Calls and Mutable Defaults',
    output: "['red', 'blue']\n['red', 'blue']\nTrue",
    hasMemberReferences: false
  },
  {
    key: 'loop_rebinding',
    step: 'Step 14: Loops',
    output: "[['draft'], ['review']]\n[]",
    hasMemberReferences: true
  }
];
// The example key is the public tutorial embedding contract; accessible roles
// identify the mounted widget without coupling behavior to its teaching title.
const labFor = (page, example = EMBEDS[0]) => page.getByRole('region', {
  name: /^Object reference lab:/
}).and(page.locator('[data-object-reference-example="' + example.key + '"]'));
const labButton = (lab, name) => lab.getByRole('button', { name, exact: true });
const listsStep = page => page.getByRole('button', { name: 'Step 6: Lists of References', exact: true });

async function openLists(page) {
  await page.goto(TUTORIAL);
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  await expect(listsStep(page)).toHaveAttribute('aria-current', 'step');
  const lab = labFor(page);
  await expect(labButton(lab, 'Forward')).toBeEnabled();
  return lab;
}

async function advanceToEnd(lab) {
  const forward = labButton(lab, 'Forward');
  for (let step = 0; step < 100 && await forward.isEnabled(); step++) {
    await forward.click();
  }
  await expect(forward).toBeDisabled();
  await expect(lab.getByRole('status')).toContainText('End of execution');
}

async function expectPaintedReferenceArrows(lab) {
  const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
  await expect(diagram.getByRole('button', { name: /^Follow / }).first()).toBeVisible();
  // SVG paths are part of the visible arrow contract. Checking labels alone
  // would miss a failed renderer that leaves reference buttons disconnected.
  await expect.poll(() => diagram.evaluate(region => {
    const references = region.querySelectorAll('[data-reference-target]');
    const paths = [...region.querySelectorAll('.orl-reference-edge')];
    const bounds = region.getBoundingClientRect();
    return references.length > 0 && paths.length === references.length && paths.every(path => {
      const style = getComputedStyle(path);
      const rect = path.getBoundingClientRect();
      return path.getTotalLength() > 0 && style.stroke !== 'none'
        && parseFloat(style.strokeWidth) > 0 && Number(style.opacity) > 0
        && style.visibility === 'visible' && style.markerEnd !== 'none'
        && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
        && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
    });
  }), { message: 'every member reference must have a painted arrow inside the diagram' }).toBe(true);
}

function pageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  return errors;
}

test('eight instruction labs offer editable code and complete reference playback in their lessons', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = pageErrors(page);
  await openLists(page);
  for (const example of EMBEDS) {
    await test.step(example.step, async () => {
      const step = page.getByRole('button', { name: example.step, exact: true });
      await step.click();
      await expect(step).toHaveAttribute('aria-current', 'step');
      const lab = labFor(page, example);
      await expect(lab).toHaveAccessibleName(/^Object reference lab: .+/);
      await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeVisible();
      await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
      await expect(labButton(lab, 'Back')).toBeDisabled();
      await labButton(lab, 'Forward').click();
      await expect(lab.getByRole('status')).toContainText(/Step 2 of \d+/);
      await labButton(lab, 'Back').click();
      await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
      await expect(labButton(lab, 'Back')).toBeDisabled();
      await advanceToEnd(lab);
      await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText(example.output);
      if (example.hasMemberReferences) await expectPaintedReferenceArrows(lab);
    });
  }
  expect(errors, 'inline labs must not break the tutorial runtime').toEqual([]);
});

test('the populated member lab fits narrow instructions and remains accessible in dark mode', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = pageErrors(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/SEBook/tools/python-tutorial.html#members');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  const memberExample = EMBEDS.find(example => example.key === 'member_sharing');
  const lab = labFor(page, memberExample);
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeVisible();
  await expect(labButton(lab, 'Forward')).toBeEnabled();
  await advanceToEnd(lab);
  await expectPaintedReferenceArrows(lab);
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText(memberExample.output);
  await labButton(lab, 'Restore original code').focus();
  await page.keyboard.press('Tab');
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toBeFocused();
  const measurements = await lab.evaluate(region => ({
    viewport: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    width: region.getBoundingClientRect().width,
    instructionWidth: region.closest('.tvm-step-content-wrap').clientWidth,
    paragraphSize: parseFloat(getComputedStyle(region.closest('.tvm-step-content').querySelector('p')).fontSize),
    smallestText: Math.min(...[...region.querySelectorAll('button, textarea, .orl-reference-name, .orl-object-title')]
      .filter(node => node.getClientRects().length)
      .map(node => parseFloat(getComputedStyle(node).fontSize)))
  }));
  expect(measurements.pageWidth).toBeLessThanOrEqual(measurements.viewport + 1);
  expect(measurements.width).toBeLessThanOrEqual(measurements.viewport);
  expect(measurements.width).toBeLessThanOrEqual(measurements.instructionWidth);
  expect(measurements.smallestText).toBeGreaterThanOrEqual(Math.max(16, measurements.paragraphSize));
  await auditInteractiveState(page, 'Populated member lab in 320-pixel tutorial instructions', {
    include: '[data-object-reference-example]'
  });
  expect(errors, 'narrow instruction panes must retain a working reference diagram').toEqual([]);
});

test('leaving a playing instruction lab restores a paused example on return', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = pageErrors(page);
  const lab = await openLists(page);
  await labButton(lab, 'Play').click();
  await expect(labButton(lab, 'Pause')).toBeVisible();

  await page.getByRole('button', { name: 'Step 1: Hello, Python!', exact: true }).click();
  await expect(lab).toHaveCount(0);
  await listsStep(page).click();
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
  await expect(labButton(lab, 'Play')).toBeVisible();
  await expect(labButton(lab, 'Back')).toBeDisabled();
  await labButton(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText(/Step 2 of \d+/);
  expect(errors, 'returning to an instruction lab must leave its controls usable').toEqual([]);
});

test('leaving a running instruction lab permits a fresh trace on return', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = pageErrors(page);
  const lab = await openLists(page);
  const editor = lab.getByLabel('Python code', { exact: true });
  // A blocking built-in keeps the worker active until navigation cancels it.
  await expect(editor).toBeVisible();
  await editor.fill('import time\ntime.sleep(60)');

  await expect(lab.getByRole('status')).toContainText('Recording execution', { timeout: 90_000 });
  await expect(lab.getByRole('status')).toContainText(/Code changed|Loading|Recording/);

  await page.getByRole('button', { name: 'Step 1: Hello, Python!', exact: true }).click();
  await expect(lab).toHaveCount(0);
  await listsStep(page).click();
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
  await expect(editor).toHaveValue(/board = \[row, row\]/);
  await expect(labButton(lab, 'Stop')).toHaveCount(0);
  await expect(editor).toBeVisible();
  await editor.fill('samples = [7]\nprint(samples)');

  await expect(labButton(lab, 'Forward')).toBeEnabled({ timeout: 90_000 });
  // This journey verifies worker disposal/restart, independently of playback's
  // real-time interval (covered by the dedicated playback tests).
  await advanceToEnd(lab);
  await expect(lab.getByLabel('Program output', { exact: true })).toHaveText('[7]');
  expect(errors, 'a disposed worker must not interfere with a newly mounted lab').toEqual([]);
});

test('detached instructions preserve independent labs when tutorial test results arrive', async ({ page }) => {
  test.setTimeout(120_000);
  await openLists(page);
  const parameterExample = EMBEDS.find(example => example.key === 'parameter_rebinding');
  const defaultExample = EMBEDS.find(example => example.key === 'mutable_default');
  await page.getByRole('button', { name: parameterExample.step, exact: true }).click();
  const popupOpened = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Open instructions in separate window$/ }).click();
  const popup = await popupOpened;
  const errors = pageErrors(popup);
  const lab = labFor(popup, parameterExample);
  const sibling = labFor(popup, defaultExample);
  await expect(labButton(lab, 'Forward')).toBeEnabled();
  await expect(labButton(sibling, 'Forward')).toBeEnabled();
  await labButton(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText(/Step 2 of \d+/);
  await labButton(lab, 'Back').click();
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
  const editor = lab.getByLabel('Python code', { exact: true });
  await expect(editor).toBeVisible();
  const original = await editor.inputValue();
  await editor.fill('channels = [[42]]\nprint(channels)');
  await labButton(sibling, 'Forward').click();
  await expect(sibling.getByRole('status')).toContainText(/Step 2 of \d+/);
  await popup.getByRole('button', { name: /Test My Work/ }).click();
  await expect(popup.getByRole('status').filter({ hasText: /tests passed/ })).toBeVisible({ timeout: 30_000 });
  await expect(editor).toHaveValue('channels = [[42]]\nprint(channels)');
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/, { timeout: 90_000 });
  await expect(sibling.getByRole('status')).toContainText(/Step 2 of \d+/);
  await popup.getByRole('button', { name: 'Step 1: Hello, Python!', exact: true }).click();
  await expect(lab).toHaveCount(0);
  await expect(sibling).toHaveCount(0);
  await popup.getByRole('button', { name: parameterExample.step, exact: true }).click();
  await expect(editor).toHaveValue(original);
  await expect(lab.getByRole('status')).toContainText(/Step 1 of \d+/);
  await expect(sibling.getByRole('status')).toContainText(/Step 1 of \d+/);
  await a11yCheckpoint(popup, 'Detached Python instruction lab', {
    feature: 'object-reference-lab', include: '[data-object-reference-example]'
  });
  expect(errors, 'the instructions popout must render its own functioning lab').toEqual([]);
});

test('tutorial autoprint waits for all eight complete lab traces before printing', async ({ page }) => {
  const errors = pageErrors(page);
  await page.emulateMedia({ media: 'print' });
  await page.addInitScript(examples => {
    // Observe the actual browser print boundary without opening a system dialog.
    window.print = () => {
      document.body.dataset.printedReferenceStates = String(examples.every(example => {
        const region = document.querySelector('[data-object-reference-example="' + example.key + '"]');
        const renderedText = region ? region.innerText : '';
        const diagrams = region ? Array.from(region.querySelectorAll('.orl-print-diagram')) : [];
        return region && /^Object reference lab: .+/.test(region.getAttribute('aria-label') || '')
          && renderedText.includes('End of execution')
          && renderedText.includes('Output:\n' + example.output)
          && diagrams.length > 0 && diagrams.every(diagram => {
            const ports = diagram.querySelectorAll('[data-reference-target]');
            const arrows = Array.from(diagram.querySelectorAll('.orl-reference-edge'));
            return diagram.getBoundingClientRect().width > 0 && arrows.length === ports.length
              && arrows.every(arrow => arrow.getTotalLength() > 0);
          });
      }));
    };
  }, EMBEDS);
  await page.goto('/SEBook/tools/python-tutorial/print.html?autoprint=1');
  await expect(page.locator('body')).toHaveAttribute('data-printed-reference-states', 'true');
  for (const example of EMBEDS) {
    const lab = labFor(page, example);
    await expect(lab).toContainText('End of execution');
    await expect(lab).toContainText(example.output);
    await expect(lab.getByRole('img').last()).toBeVisible();
    await expect(labButton(lab, 'Forward')).toBeHidden();
  }
  await a11yCheckpoint(page, 'All eight printable Python instruction labs', {
    feature: 'object-reference-lab', include: '[data-object-reference-example]', darkMode: false
  });
  expect(errors, 'autoprint must wait for the embedded reference states').toEqual([]);
});
