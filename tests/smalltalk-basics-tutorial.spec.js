const { test, expect: standardExpect } = require('@playwright/test');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');
const expect = standardExpect.configure({ timeout: 30000 });
const route = '/SEBook/tools/smalltalk-basics-tutorial';
const source = page => page.getByRole('region', { name: 'Method source', exact: true });
test.setTimeout(180000);

async function openMission(page, key) {
  await page.goto(route + '#' + key);
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
}

async function typeCode(page, input, code) {
  await input.focus();
  await selectAllInMonaco(input);
  await input.press('Backspace');
  await expect(input).toHaveValue('');
  await page.keyboard.insertText(code);
  await expect(input).toHaveValue(code);
}

async function evaluate(page, code, answer) {
  await page.getByRole('button', { name: 'Live terminal', exact: true }).click();
  await typeCode(page, page.getByRole('textbox', { name: /Smalltalk expression/ }), code);
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(answer);
}

test('the live scoring mission updates the same inspected player after Accept', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await openMission(page, 'messages-and-results-v1');
  await evaluate(page, "'arcade' asUppercase", 'ARCADE');
  await page.getByRole('button', { name: 'Step 2: Live Objects', exact: true }).click();
  await expect(source(page)).toContainText('points + 1');
  await evaluate(page, 'player := SEBookArcadeScore new', 'a SEBookArcadeScore');
  await evaluate(page, 'player win', 'a SEBookArcadeScore');
  await evaluate(page, 'player value', '1');
  await evaluate(page, 'player', 'a SEBookArcadeScore');
  await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
  const object = page.getByRole('region', { name: 'Result object', exact: true });
  await expect(object.getByRole('term')).toHaveText('points');
  await expect(object.getByRole('definition').getByText('1', { exact: true })).toBeVisible();

  await typeCode(page, page.getByRole('textbox', { name: /^Smalltalk method source/ }),
    'win points := points + 10. ^ self');
  await source(page).getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(source(page)).toContainText('Accepted source');
  await evaluate(page, 'player win', 'a SEBookArcadeScore');
  await evaluate(page, 'player value', '11');
  const refresh = object.getByRole('button', { name: 'Refresh Result object', exact: true });
  await refresh.focus();
  await refresh.press('Enter');
  await expect(object.getByRole('definition').getByText('11', { exact: true })).toBeVisible();
  await expect(refresh).toBeFocused();
  await a11yCheckpoint(page, 'arcade-retained-player', { feature: 'smalltalk-basics' });
  expect(errors, 'The live mission must not raise page errors').toEqual([]);
});

test('the Boolean mission opens real system source and supports the documented search path', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openMission(page, 'boolean-objects-v1');
  await expect(source(page)).toContainText('value');
  await expect(page.getByRole('listbox', { name: 'Classes', exact: true })
    .getByRole('option', { name: 'True', exact: true, selected: true })).toHaveCount(1);
  await evaluate(page, 'false ifTrue: [1 / 0]', 'nil');
  await evaluate(page, 'true ifTrue: [6 * 7]', '42');

  const classes = page.getByRole('region', { name: 'Classes', exact: true });
  await classes.getByLabel('Search classes', { exact: true }).filter({ visible: true }).click();
  await classes.getByRole('searchbox', { name: 'Search classes', exact: true }).fill('False');
  await classes.getByRole('button', { name: 'Search', exact: true }).click();
  await classes.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'False' });
  await expect(source(page)).toContainText('Boolean subclass: #False');
  await expect(source(page)).not.toHaveAttribute('aria-busy', 'true');
  await page.getByRole('listbox', { name: 'Protocols', exact: true }).selectOption({ label: '*' });
  await expect(source(page)).not.toHaveAttribute('aria-busy', 'true');
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'ifTrue:' });
  await expect(source(page)).toContainText('^nil');
  await a11yCheckpoint(page, 'arcade-boolean-source', { feature: 'smalltalk-basics' });
  const darkMode = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
  await darkMode.focus();
  await darkMode.press('Space');
  await expect(darkMode).toBeChecked();
  // The shared layout marks an animated theme transition. Let it finish before
  // axe's two-theme audit changes the theme again and samples contrast.
  await expect(page.locator('html')).not.toHaveClass(/dark-mode-transition/);
  await page.setViewportSize({ width: 320, height: 800 });
  await a11yCheckpoint(page, 'arcade-boolean-mobile-dark', { feature: 'smalltalk-basics' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    'The lesson must reflow at 320px without horizontal page scrolling').toBe(true);
  expect(errors, 'System-source browsing must not raise page errors').toEqual([]);
});

test('the subclass mission makes an override observable through inherited behavior and checks', async ({ page }) => {
  await openMission(page, 'bonus-subclass-v1');
  await expect(source(page)).toContainText('SEBookArcadeScore subclass: #SEBookBonusScore');
  const classes = page.getByRole('listbox', { name: 'Classes', exact: true });
  const methods = page.getByRole('listbox', { name: 'Methods', exact: true });
  await classes.selectOption({ label: 'SEBookArcadeScore' });
  await expect(source(page)).toContainText('Object subclass: #SEBookArcadeScore');
  await methods.selectOption({ label: 'win' });
  await expect(source(page)).toContainText('self pointsPerWin');
  await page.getByRole('button', { name: 'Lesson code', exact: true }).click();
  await expect(source(page)).toContainText('SEBookArcadeScore subclass: #SEBookBonusScore');
  await methods.selectOption({ label: 'pointsPerWin' });
  await expect(source(page)).toContainText('SEBookBonusScore >> pointsPerWin');
  await expect(source(page)).toContainText('^ 10');
  await typeCode(page, page.getByRole('textbox', { name: /^Smalltalk method source/ }), 'pointsPerWin ^ 20');
  await source(page).getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(source(page)).toContainText('Accepted source');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText('Result: 20');
  await page.getByRole('button', { name: /Test My Work/ }).click();
  const results = page.getByRole('region', { name: 'Smalltalk check results', exact: true });
  await expect(results).toContainText('All 2 tests passed!', { timeout: 120000 });
  await evaluate(page, 'probe := SEBookBonusScore new. probe win. probe win. probe value = 40', 'true');
  await evaluate(page, 'probe := SEBookBonusScore new. probe win. probe win. probe value = 40', 'true');
  await a11yCheckpoint(page, 'arcade-subclass-checks', { feature: 'smalltalk-basics' });
});

test('the tutorial appears in the automatic index and all four missions have a printable view', async ({ page }) => {
  await page.goto('/SEBook/tutorials');
  await expect(page.getByRole('link', { name: 'Smalltalk in 30 Minutes', exact: true })).toHaveAttribute('href', route);
  await page.goto(route + '/print');
  for (const title of ['Messages and Results', 'Live Objects', 'Boolean Objects', 'Subclasses and Specialization']) {
    await expect(page.getByRole('heading', { name: new RegExp(title) })).toBeVisible();
  }
  await page.emulateMedia({ media: 'print' });
  await a11yCheckpoint(page, 'arcade-print', { feature: 'smalltalk-basics' });
});
