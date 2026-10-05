// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady, setTutorialFileContent, stepButton, expectActiveStep } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

for (const slug of ['haskell', 'haskell-functions', 'haskell-data']) {
  test(`${slug} keeps each lesson's Main.hs through navigation and reload`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/SEBook/tools/${slug}-tutorial?autosave=true`);
    await waitForTutorialReady(page, { bootTimeout: 90_000 });
    const readCode = () => page.evaluate(() => window._tutorial.editor.getValue());
    const firstDraft = '-- first lesson draft\nmain = print 101\n';
    const secondDraft = '-- second lesson draft\nmain = print 202\n';
    expect(await setTutorialFileContent(page, 'Main.hs', firstDraft)).toBe(true);
    await stepButton(page, 1).click();
    await expectActiveStep(page, 1);
    expect(await readCode()).not.toBe(firstDraft);
    expect(await setTutorialFileContent(page, 'Main.hs', secondDraft)).toBe(true);
    await stepButton(page, 0).click();
    await expectActiveStep(page, 0);
    await expect.poll(readCode).toBe(firstDraft);
    await page.reload();
    await waitForTutorialReady(page, { bootTimeout: 90_000 });
    await expect.poll(readCode).toBe(firstDraft);
    await stepButton(page, 1).click();
    await expectActiveStep(page, 1);
    await expect.poll(readCode).toBe(secondDraft);
    await a11yCheckpoint(page, `${slug} restored draft`, { feature: 'tutorial-drafts' });
    expect(errors).toEqual([]);
  });
}
