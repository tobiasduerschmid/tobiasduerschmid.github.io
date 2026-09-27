// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const postUrl = '/blog/how-should-i-use-ai-as-a-college-student/';

test('hidden citations keep only the spacing needed by the surrounding text', async ({ page }) => {
  const citation = '<a class="citation" href="#source">(Source)</a>';
  const examples = [
    [`Alpha ${citation}.`, 'Alpha.'],
    [`Alpha ${citation}, beta.`, 'Alpha, beta.'],
    [`Alpha ${citation} beta.`, 'Alpha beta.'],
    [`Alpha ${citation}beta.`, 'Alpha beta.'],
    [`<em>Alpha </em>${citation}<strong>beta.</strong>`, 'Alpha beta.'],
    [`<em>Alpha </em>${citation}<strong>.</strong>`, 'Alpha.'],
    [`Alpha ${citation} ${citation}beta.`, 'Alpha beta.'],
    [`Alpha ${citation}${citation}.`, 'Alpha.'],
    [`Alpha ${citation}(aside).`, 'Alpha (aside).'],
    [`Alpha ${citation}\n beta.`, 'Alpha beta.'],
  ];
  await page.goto(postUrl);
  await page.setContent(`<link rel="stylesheet" href="/css/sebook-theme.css">
    <body class="blog-layout"><article class="blog-post-content">
      ${examples.map(([html]) => `<p>${html}</p>`).join('')}
    </article></body>`);
  const paragraphs = page.getByRole('paragraph');
  const originalText = await paragraphs.allInnerTexts();
  const links = page.getByRole('link');
  const originalLinkText = await links.allTextContents();
  await page.addScriptTag({ path: require('path').join(__dirname, '../js/blog-citation-spacing.js') });
  await expect(paragraphs).toHaveText(originalText, { useInnerText: true });
  // Separating spaces must stay outside the link's underline and click target.
  expect(await links.allTextContents()).toEqual(originalLinkText);

  await page.evaluate(() => document.documentElement.classList.add('blog-citations-disabled'));
  await expect(paragraphs).toHaveText(examples.map(([, expected]) => expected), { useInnerText: true });
  await page.evaluate(() => document.documentElement.classList.remove('blog-citations-disabled'));
  await expect(paragraphs).toHaveText(originalText, { useInnerText: true });
  expect(await links.allTextContents()).toEqual(originalLinkText);
});

for (const darkMode of [false, true]) {
  test(`readers can hide and restore citations and references in ${darkMode ? 'dark' : 'light'} mode`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'dark-mode', value: String(darkMode), url: baseURL }]);
    await page.goto(postUrl);

    const toggle = page.getByRole('checkbox', { name: 'Show citations', exact: true });
    const article = page.getByRole('article');
    const citationsAndSources = article.getByRole('link', { name: /^\(/ });
    const references = article.getByRole('heading', { name: 'References', exact: true });
    const referencesNav = page.getByRole('navigation').getByRole('link', { name: 'References', exact: true });
    const title = article.getByRole('heading', { level: 1 });
    const citedParagraph = article.getByRole('paragraph').filter({ hasText: 'Several studies point to a useful lesson' });
    const originalParagraph = await citedParagraph.innerText();

    await expect(toggle).toBeChecked();
    await expect(references).toBeVisible();
    await expect(referencesNav).toBeVisible();
    const sourceCount = await citationsAndSources.count();
    expect(sourceCount).toBeGreaterThan(0);

    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).not.toBeChecked();
    await expect(citationsAndSources).toHaveCount(0);
    await expect(references).toBeHidden();
    await expect(referencesNav).toBeHidden();
    await expect(title).toBeVisible();
    await expect(citedParagraph).toHaveText(/AI\./, { useInnerText: true });
    expect(await citedParagraph.innerText()).not.toMatch(/\s+[.,;:!?]/);
    await a11yCheckpoint(page, `blog citations hidden (${darkMode ? 'dark' : 'light'})`, { include: ['article', 'nav'] });

    await page.reload();
    await expect(toggle).not.toBeChecked();
    await expect(citationsAndSources).toHaveCount(0);
    await expect(references).toBeHidden();
    expect(await citedParagraph.innerText()).not.toMatch(/\s+[.,;:!?]/);

    await page.emulateMedia({ media: 'print' });
    await expect(citationsAndSources).toHaveCount(0);
    await expect(references).toBeHidden();
    expect(await citedParagraph.innerText()).not.toMatch(/\s+[.,;:!?]/);
    await page.emulateMedia({ media: 'screen' });

    await page.locator('label').filter({ has: toggle }).click();
    await expect(toggle).toBeChecked();
    await expect(citationsAndSources).toHaveCount(sourceCount);
    await expect(references).toBeVisible();
    await expect(referencesNav).toBeVisible();
    await expect(citedParagraph).toHaveText(originalParagraph, { useInnerText: true });
    await a11yCheckpoint(page, `blog citations restored (${darkMode ? 'dark' : 'light'})`, { include: ['article', 'nav'] });
  });
}

test('blog citation preference can be managed in settings and cleared in browser storage', async ({ page }) => {
  await page.goto('/settings/');
  const setting = page.getByRole('checkbox', { name: 'Show blog citations', exact: true });
  await expect(setting).toBeChecked();
  await page.locator('label').filter({ has: setting }).click();
  await expect(setting).not.toBeChecked();

  await page.goto(postUrl);
  await expect(page.getByRole('checkbox', { name: 'Show citations', exact: true })).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'References', exact: true })).toBeHidden();
  await page.goto('/blog/evidence-based-study-tips-for-college-students/');
  await expect(page.getByRole('checkbox', { name: 'Show citations', exact: true })).not.toBeChecked();
  await expect(page.getByRole('heading', { name: 'References', exact: true })).toBeHidden();

  await page.goto('/settings/');
  await expect(setting).not.toBeChecked();
  await page.goto('/cookies/');
  await page.getByRole('button', { name: 'Delete blog-show-citations', exact: true }).click();
  await page.goto(postUrl);
  await expect(page.getByRole('checkbox', { name: 'Show citations', exact: true })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'References', exact: true })).toBeVisible();
});
