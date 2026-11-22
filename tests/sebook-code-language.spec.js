const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const classChapter = '/SEBook/uml_class_diagram.html';
const observerChapter = '/SEBook/designpatterns/observer.html';
const tab = (scope, name) => scope.getByRole('tab', { name, exact: true });

async function trackVerticalPosition(locator) {
  await locator.evaluate(element => {
    const start = element.getBoundingClientRect().top;
    let maximumShift = 0;
    let frame;
    let afterLayout;
    function sample() {
      // ResizeObserver runs after animation callbacks but before paint. Sample
      // in the next task so unfinished layout is not mistaken for a visible jump.
      afterLayout = setTimeout(() => {
        maximumShift = Math.max(maximumShift, Math.abs(element.getBoundingClientRect().top - start));
        frame = requestAnimationFrame(sample);
      }, 0);
    }
    frame = requestAnimationFrame(sample);
    window.stopPositionTracking = () => {
      cancelAnimationFrame(frame);
      clearTimeout(afterLayout);
      return maximumShift;
    };
  });
}

for (const { width, input, nativeAnchoring = true } of [
  { width: 1280, input: 'pointer', nativeAnchoring: false },
  { width: 1280, input: 'pointer' },
  { width: 1280, input: 'keyboard' },
  { width: 390, input: 'pointer' }
]) {
  test(`language changes keep the current example in place (${width}px, ${input}, native anchoring ${nativeAnchoring})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(classChapter);
    // Exercise browsers/settings where native scroll anchoring cannot help,
    // as well as its interaction with the site's own position preservation.
    if (!nativeAnchoring) await page.addStyleTag({ content: 'html { overflow-anchor: none; }' });
    const lab = page.getByRole('region', { name: 'UML code lab: One reference or a collection', exact: true });
    const tabs = lab.getByRole('tablist');
    await expect(page.getByRole('textbox', { name: /Python code/ })).toHaveCount(4);
    await expect(page.getByText('Diagram updated.', { exact: true })).toHaveCount(4);
    // A learner's longer draft above the current example makes the height
    // difference substantial even when the initial diagram sets a minimum.
    const earlierLab = page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
    const earlierEditor = earlierLab.getByRole('textbox', { name: /Python code/ });
    await earlierEditor.focus();
    await earlierEditor.press('ControlOrMeta+Home');
    await page.keyboard.insertText('# Notes in a longer draft\n'.repeat(40));
    await expect.poll(async () => (await earlierLab.boundingBox()).height).toBeGreaterThan(1000);
    await expect(page.getByText('Diagram updated.', { exact: true })).toHaveCount(4);
    await tabs.evaluate(element => window.scrollBy({
      top: element.getBoundingClientRect().top - 240, behavior: 'instant'
    }));
    if (input === 'keyboard') await tab(tabs, 'Python').focus();
    const before = (await tabs.boundingBox()).y;
    await trackVerticalPosition(tabs);
    if (input === 'keyboard') await tab(tabs, 'Python').press('ArrowRight');
    else await tab(tabs, 'Java').click();
    await expectLanguage(page, 'Java');
    await expect(page.getByText('Diagram updated.', { exact: true })).toHaveCount(4);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(async () => Math.abs((await tabs.boundingBox()).y - before)).toBeLessThan(1);
    expect(await page.evaluate(() => window.stopPositionTracking()), 'No intermediate vertical jump').toBeLessThan(1);
    await expect(tab(tabs, 'Java')).toBeFocused();

    // Shrinking the code above the same selector must preserve position too.
    await tab(tabs, 'Python').click();
    await expectLanguage(page, 'Python');
    await expect(page.getByText('Diagram updated.', { exact: true })).toHaveCount(4);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(async () => Math.abs((await tabs.boundingBox()).y - before)).toBeLessThan(1);

    // Position preservation must not trap the reader when they scroll onward.
    await page.mouse.move(width - 30, 500);
    await page.mouse.wheel(0, 300);
    await expect.poll(async () => (await tabs.boundingBox()).y).toBeLessThan(before - 200);
  });
}

async function expectLanguage(page, name) {
  const selectors = page.getByRole('tablist').filter({ has: tab(page, name) });
  await expect(selectors).not.toHaveCount(0);
  await expect(selectors.getByRole('tab', { selected: true })).toHaveText(Array(await selectors.count()).fill(name));
}

test('one choice applies to every example, survives navigation, and preserves unsupported preferences', async ({ page }) => {
  await page.goto(classChapter);
  await expectLanguage(page, 'Python');
  await tab(page.getByRole('tablist', { name: 'Simple class code language' }), 'C++').click();
  await expectLanguage(page, 'C++');
  await page.reload();
  await expectLanguage(page, 'C++');

  await page.goto('/SEBook/testing/goodtests.html');
  await expectLanguage(page, 'C++');
  await tab(page.getByRole('tablist', { name: 'Discount test code language' }), 'TypeScript (Node.js)').click();
  await expectLanguage(page, 'TypeScript (Node.js)');

  await page.goto(classChapter);
  const lab = page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
  await expect(tab(lab, 'TypeScript')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page.getByRole('tablist', { name: 'Simple class code language' }), 'TypeScript')).toHaveAttribute('aria-selected', 'true');
  await page.goto('/SEBook/development_practices/modern_code_review.html');
  await expectLanguage(page, 'Python');
  await page.goto('/SEBook/designpatterns/strategy.html');
  await expectLanguage(page, 'TypeScript');
});

test('Observer tabs and dropdowns share the preference without restarting narration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(observerChapter);
  const animation = page.getByRole('region', { name: 'Observer in a user interface', exact: true });
  const language = animation.getByRole('combobox', { name: 'Code language' });
  const tabs = page.getByRole('tablist', { name: 'Observer code language' });
  const position = animation.getByRole('slider', { name: 'Animation position' });
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await position.fill('120');
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(120, 1);
  await tab(tabs, 'Java').click();
  await expect(language).toHaveValue('java');
  await expect(position).toHaveValue('120');
  await language.selectOption('typescript');
  await expect(tab(tabs, 'TypeScript')).toHaveAttribute('aria-selected', 'true');
  await expect(position).toHaveValue('120');
  await animation.getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('typescript');
  await page.getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await page.getByRole('link', { name: 'Print view', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await page.goto(classChapter);
  await expectLanguage(page, 'C++');
  expect(errors).toEqual([]);
});

test('settings and storage deletion update open chapters and restore the default', async ({ page, context }) => {
  await page.goto('/SEBook/testing/goodtests.html');
  const settings = await context.newPage();
  await settings.goto('/settings/');
  const language = settings.getByRole('combobox', { name: 'SE Book code language' });
  await expect(language).toHaveValue('python');
  await language.selectOption('java');
  await expectLanguage(page, 'Java');
  await settings.reload();
  await expect(language).toHaveValue('java');
  await a11yCheckpoint(settings, 'shared code language setting', { feature: 'sebook-code-language' });

  const inventory = await context.newPage();
  await inventory.goto('/cookies/');
  const entry = inventory.getByRole('row').filter({ has: inventory.getByRole('cell', { name: 'sebook-code-language', exact: true }) });
  await expect(entry.getByText('set', { exact: true })).toBeVisible();
  await entry.getByRole('button', { name: 'Delete sebook-code-language', exact: true }).click();
  await expect(entry.getByText('not set', { exact: true })).toBeVisible();
  await expect(language).toHaveValue('python');
  await expectLanguage(page, 'Python');
  await page.reload();
  await expectLanguage(page, 'Python');
});
