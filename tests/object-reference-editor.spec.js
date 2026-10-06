// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

async function openLab(page) {
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Mutation, local assignment, and a return', exact: true });
  await expect(lab.getByRole('button', { name: 'Forward', exact: true })).toBeEnabled();
  return lab;
}

test('the editable source carries execution position, preserves selection, and invalidates on editing', async ({ page }) => {
  const lab = await openLab(page);
  const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
  await expect(lab.getByRole('textbox')).toHaveCount(1);
  await expect(lab.getByText('Execution position', { exact: true })).toHaveCount(0);
  const original = await editor.inputValue();
  await editor.focus();
  await editor.evaluate(input => input.setSelectionRange(4, 10));
  await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  // These visual hooks identify the current source line and gutter marker,
  // both of which must be inside the editable panel, not a second code view.
  const panel = lab.locator('.orl-code-panel');
  await expect(panel.locator('.orl-source-line.is-current')).toHaveText('draft = ["draft"]');
  await expect(panel.locator('.orl-line-number.is-current')).toHaveText('6');
  expect(await editor.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([4, 10]);
  await expect(editor).toHaveValue(original);
  await lab.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(panel.locator('.is-current')).toHaveCount(0);

  await editor.focus();
  await editor.press('ControlOrMeta+End');
  await editor.press('End');
  await editor.press('Space');
  await expect(lab.getByRole('button', { name: 'Forward', exact: true })).toBeDisabled();
  await expect(lab.getByRole('status')).toContainText('Code changed');
  await expect(panel.locator('.is-current')).toHaveCount(0);
  await editor.press('ControlOrMeta+z');
  await expect(editor).toHaveValue(original);
  await editor.press('Tab');
  await expect(lab.getByText('Reference details', { exact: true }), 'Tab must leave the editor without stopping on its decorative syntax layer').toBeFocused();
  await lab.getByRole('button', { name: 'Restore original code', exact: true }).click();
  await expect(editor).toHaveValue(original);
  await expect(lab.getByRole('button', { name: 'Forward', exact: true })).toBeEnabled();
});

for (const dark of [false, true]) {
  test(`Python syntax remains aligned and readable in ${dark ? 'dark' : 'light'} mode at narrow widths`, async ({ page }) => {
    const lab = await openLab(page);
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await page.setViewportSize({ width: 390, height: 844 });
    const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
    const source = '# a comment\ndef build():\n    text = """<b>literal</b>\nsecond line"""\n    return [0xFF, 12.5, "' + 'long '.repeat(50) + '"]\n\nprint(build())\n' + '# more\n'.repeat(25);
    await editor.fill(source);
    const panel = lab.locator('.orl-code-panel');
    await expect(panel.locator('.orl-syntax-keyword').first()).toHaveText('def');
    await expect(panel.locator('.orl-syntax-comment').first()).toHaveText('# a comment');
    await expect(panel.locator('.orl-syntax-string').first()).toContainText('<b>literal</b>');
    await expect(panel.locator('.orl-syntax-number').first()).toHaveText('0xFF');
    await expect(panel.locator('b')).toHaveCount(0); // Source is always text, never markup.
    await expect(editor).toHaveValue(source);
    await expect(lab.locator('.orl-print-source')).toHaveText(source);

    // Alignment is the visible contract of a native input with syntax: a
    // scrolled glyph and its caret must retain the same origin and metrics.
    await editor.evaluate(input => { input.scrollTop = 135; input.scrollLeft = 75; input.dispatchEvent(new Event('scroll')); });
    const geometry = await panel.evaluate(host => {
      const input = host.querySelector('textarea');
      const mirror = host.querySelector('.orl-highlighted-source');
      const inputStyle = getComputedStyle(input);
      const mirrorStyle = getComputedStyle(mirror);
      const inputBox = input.getBoundingClientRect();
      const mirrorBox = mirror.getBoundingClientRect();
      return {
        x: mirrorBox.left - (inputBox.left - input.scrollLeft),
        y: mirrorBox.top - (inputBox.top - input.scrollTop),
        metrics: ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft']
          .filter(key => inputStyle[key] !== mirrorStyle[key]),
        wrappedLines: Array.from(host.querySelectorAll('.orl-source-line'))
          .filter(line => Math.abs(line.getBoundingClientRect().height - parseFloat(inputStyle.lineHeight)) > 1).length,
        overflow: document.documentElement.scrollWidth - innerWidth
      };
    });
    expect(Math.abs(geometry.x)).toBeLessThan(1);
    expect(Math.abs(geometry.y)).toBeLessThan(1);
    expect(geometry.metrics).toEqual([]);
    expect(geometry.wrappedLines, 'line numbers, the marker, and the caret must stay aligned').toBe(0);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await a11yCheckpoint(page, 'reference editor ' + (dark ? 'dark' : 'light'), {
      feature: 'object-reference-lab', include: '.object-reference-lab'
    });
  });
}

test('forced colors retains native editable text and the execution marker', async ({ page }) => {
  const lab = await openLab(page);
  await page.emulateMedia({ forcedColors: 'active' });
  const editor = lab.getByRole('textbox', { name: 'Python code', exact: true });
  await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(editor).toBeEditable();
  const color = await editor.evaluate(input => getComputedStyle(input).webkitTextFillColor);
  expect(color).not.toBe('rgba(0, 0, 0, 0)');
  await expect(lab.locator('.orl-line-number.is-current')).toHaveText('6');
});
