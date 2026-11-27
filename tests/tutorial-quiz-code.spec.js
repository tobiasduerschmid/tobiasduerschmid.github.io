// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');
const { luminance, paletteOf, textContrast, contrast } = require('./print-helpers');

const tutorial = loadTutorialConfig('uml-class-diagram-python');
const timerIndex = tutorial.steps[0].quiz.questions.findIndex(question => question.question.includes('class Timer:'));

async function checkCodeBox(page, { print = false } = {}) {
  const code = page.getByRole('code').filter({ hasText: 'class Timer:' });
  await expect(code).toBeVisible();
  const keyword = code.getByText('class', { exact: true });
  await expect(keyword).toBeVisible();
  const style = await code.evaluate(el => {
    const codeStyle = getComputedStyle(el);
    const boxStyle = getComputedStyle(el.closest('pre'));
    return { background: codeStyle.backgroundColor, boxBackground: boxStyle.backgroundColor,
      border: parseFloat(boxStyle.borderTopWidth), color: codeStyle.color };
  });
  expect(style.background).toBe('rgba(0, 0, 0, 0)');
  expect(style.boxBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.border).toBeGreaterThan(0);
  if (!print) expect(await keyword.evaluate(el => getComputedStyle(el).color)).not.toBe(style.color);
  return code;
}

test('tutorial quiz code is highlighted in the main page and popout without text backdrops', async ({ page }) => {
  test.setTimeout(120_000);
  // Keep authored question order so the screenshot's Timer question is reached deterministically.
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  await page.goto('/SEBook/tools/uml-class-diagram-python.html?instructor-mode=true');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  await page.getByRole('button', { name: /^Next →$/ }).click();
  for (let index = 0; index < timerIndex; index++) {
    await page.getByRole('radio').first().click();
    await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  await checkCodeBox(page);
  await a11yCheckpoint(page, 'Tutorial quiz code light', { include: '.tvm-quiz-panel' });
  await page.getByRole('code').filter({ hasText: 'class Timer:' }).screenshot({ path: test.info().outputPath('quiz-light.png') });
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await checkCodeBox(page);
  await a11yCheckpoint(page, 'Tutorial quiz code dark', { include: '.tvm-quiz-panel' });
  await page.getByRole('code').filter({ hasText: 'class Timer:' }).screenshot({ path: test.info().outputPath('quiz-dark.png') });
  await page.getByRole('button', { name: /Back to Step/ }).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open instructions in separate window' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: /^Next →$/ }).click();
  for (let index = 0; index < timerIndex; index++) {
    await popup.getByRole('radio').first().click();
    await popup.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  await checkCodeBox(popup);
  await popup.setViewportSize({ width: 320, height: 700 });
  await checkCodeBox(popup);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const dark of [false, true]) {
    await popup.emulateMedia({ media: 'screen' });
    await popup.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await expect.poll(() => popup.evaluate(() => document.documentElement.classList.contains('dark-mode'))).toBe(dark);
    await popup.emulateMedia({ media: 'print' });
    const printed = await checkCodeBox(popup, { print: true });
    expect(luminance((await paletteOf(printed)).background), 'code prints on a light surface').toBeGreaterThanOrEqual(0.35);
    // Both ordinary text and highlighted tokens must remain readable with or
    // without printed backgrounds, regardless of the saved screen theme.
    for (const token of [printed, ...await printed.locator('span').all()]) {
      expect(await textContrast(token), 'printed code contrast').toBeGreaterThanOrEqual(4.5);
      expect(contrast((await paletteOf(token)).text, [255, 255, 255]), 'code contrast on white paper').toBeGreaterThanOrEqual(4.5);
    }
  }
  await popup.close();
});
