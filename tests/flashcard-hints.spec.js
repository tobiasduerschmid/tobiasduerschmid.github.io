// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const SINGLETON_QUESTION = 'Why is the Singleton pattern controversial in modern practice?';
const SINGLETON_SELECTION = 'questions=flashcard:design_pattern_singleton:2';
const SOC_QUESTION = 'What is the difference between SoC and Information Hiding?';

// These real cards use prose-only hints. Compare the rendered disclosure to
// the authored card, so the test catches a missing/wrong serialization field.
function authoredHint(deckId, cardId) {
  const deck = yaml.load(fs.readFileSync(
    path.join(__dirname, '..', '_data', 'flashcards', `${deckId}.yml`), 'utf8',
  ));
  return deck.cards.find((card) => card.id === cardId).hint;
}

const SINGLETON_HINT = authoredHint('design_pattern_singleton', 2);
const SOC_HINT = authoredHint('design_principle_soc', 5);

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  // Keep the real decks in author order; no card data or rendering is mocked.
  await page.addInitScript(() => { Math.random = () => 0.999999; });
});

async function controlledHint(page, scope = page) {
  const button = scope.getByRole('button', { name: 'Hint', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const id = await button.getAttribute('aria-controls');
  expect(id, 'hint disclosure identifies its own content').toBeTruthy();
  // Resolve the accessibility relationship, without relying on generated IDs.
  const panel = page.locator(`[id="${id}"]`);
  await expect(panel).toHaveCount(1);
  await expect(panel).toBeHidden();
  return { button, panel };
}

async function gradeCard(scope, label = 'I got it right') {
  await scope.getByRole('button', { name: 'Show Answer', exact: true }).click();
  await scope.getByRole('button', { name: label, exact: true }).click();
}

test('chapter hints support a separate keyboard disclosure without changing progress or assessment', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/SEBook/designpatterns/singleton.html');
  const deck = page.getByRole('region', { name: 'Singleton Pattern Flashcards flashcards', exact: true });
  // The implementation-elements question is intentional basic retrieval.
  await expect(deck.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
  await gradeCard(deck);
  await expect(deck.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
  const { button, panel } = await controlledHint(page, deck);
  const progress = deck.getByRole('progressbar', { name: 'Flashcard progress' });
  await expect(progress).toHaveAttribute('aria-valuenow', '25');

  await button.focus();
  await button.press('Enter');
  const hideButton = deck.getByRole('button', { name: 'Hide Hint', exact: true });
  await expect(hideButton).toBeFocused();
  await expect(hideButton).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveText(SINGLETON_HINT);
  await expect(deck.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
  await expect(deck.getByRole('button', { name: 'I got it right', exact: true })).toHaveCount(0);
  await expect(progress).toHaveAttribute('aria-valuenow', '25');
  await a11yCheckpoint(page, 'chapter hint expanded', {
    feature: 'flashcard-hints', include: '.flashcard-hint-area', darkMode: true,
  });
  await hideButton.press('Space');
  await expect(panel).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(errors, 'chapter hint has no JavaScript errors').toEqual([]);
});

test('chapter review and restart close previously opened hints and retain explicit self-assessment scores', async ({ page }) => {
  await page.goto('/SEBook/designpatterns/singleton.html');
  const deck = page.getByRole('region', { name: 'Singleton Pattern Flashcards flashcards', exact: true });
  await gradeCard(deck);
  const { button, panel } = await controlledHint(page, deck);
  await button.click();
  await gradeCard(deck, 'I missed it');
  await expect(panel).toBeHidden();
  await gradeCard(deck);
  await gradeCard(deck);
  await expect(deck.getByText('Your Score: 3/4', { exact: true })).toBeVisible();
  await deck.getByRole('button', { name: 'Review Incorrect Cards', exact: true }).click();
  await expect(deck.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  await gradeCard(deck);
  await deck.getByRole('button', { name: 'Restart Workout', exact: true }).click();
  await gradeCard(deck);
  await expect(deck.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});

for (const plain of [false, true]) {
  test(`${plain ? 'plain' : 'normal'} direct flashcard hints do not reveal or grade answers and reset for review and restart`, async ({ page }) => {
    await page.goto(`/se-gym/?plain=${plain}&${SINGLETON_SELECTION}`);
    await expect(page.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
    const { button, panel } = await controlledHint(page);
    await button.focus();
    await button.press('Enter');
    await expect(panel).toBeVisible();
    const hideButton = page.getByRole('button', { name: 'Hide Hint', exact: true });
    await expect(hideButton).toBeFocused();
    await hideButton.press('Space');
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.press('Enter');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveText(SINGLETON_HINT);
    await expect(page.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I got it right', exact: true })).toHaveCount(0);
    await a11yCheckpoint(page, `${plain ? 'plain' : 'normal'} gym hint expanded`, {
      feature: 'flashcard-hints', include: '.flashcard-hint-area', darkMode: true,
    });
    await gradeCard(page, 'I got it wrong');
    await expect(page.getByText('Score: 0/1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review Incorrect', exact: true }).click();
    await controlledHint(page);
    await gradeCard(page);
    await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
    await controlledHint(page);
  });
}

test('plain Python retrieval card omits the Hint control and still reveals its answer', async ({ page }) => {
  await page.goto('/se-gym/?plain=true&questions=flashcard:python_syntax_generate:2');
  await expect(page.getByText('In Python, perform integer (floor) division of 7 by 2, getting 3 as the result (not 3.5).', {
    exact: true,
  })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show Answer', exact: true }).click();
  await expect(page.getByText('7 // 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I got it right', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
});

test('ordinary targeted practice resumes the same unanswered card with its hint closed', async ({ page }) => {
  await page.goto('/se-gym/');
  const activation = page.getByRole('checkbox', { name: 'Toggle personal gym activation' });
  await activation.focus();
  await activation.press('Space');
  await expect(activation).toBeChecked();
  await page.getByRole('button', {
    name: 'Start targeted practice for Singleton Pattern Flashcards', exact: true,
  }).click();
  await expect(page.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
  await gradeCard(page);
  await expect(page.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
  const { button } = await controlledHint(page);
  await button.click();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' }))
    .toHaveText('Saved workout: 1 of 4 completed.');
  await page.reload();
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
  await expect(page.getByText(SINGLETON_QUESTION, { exact: true })).toBeVisible();
  await controlledHint(page);
  await expect(page.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
});

for (const surface of ['chapter', 'gym']) {
  test(`${surface} master deck preserves the base card's optional hint`, async ({ page }) => {
    await page.goto(surface === 'chapter'
      ? '/SEBook/designprinciples/index.html'
      : '/se-gym/?flashcards=design_principles');
    const scope = surface === 'chapter'
      ? page.getByRole('region', { name: 'Design Principles Master Flashcards flashcards', exact: true })
      : page;
    await expect(scope.getByText('What is the Separation of Concerns (SoC) design principle?', { exact: true }))
      .toBeVisible();
    await expect(scope.getByRole('button', { name: 'Hint', exact: true })).toHaveCount(0);
    // The fifth SoC card is the first comparison targeted by this test.
    for (let card = 0; card < 4; card++) await gradeCard(scope);
    await expect(scope.getByText(SOC_QUESTION, { exact: true })).toBeVisible();
    const { button, panel } = await controlledHint(page, scope);
    await button.click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveText(SOC_HINT);
    await expect(scope.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
  });
}

test('combined course chapters give every hint a distinct controlled panel', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/SEBook/CS130.html');
  const repeatedDeck = page.getByRole('region', {
    name: 'Factory Method & Abstract Factory Flashcards flashcards', exact: true,
  });
  await expect(repeatedDeck.first()).toBeVisible();
  expect(await repeatedDeck.count(), 'course includes the same deck in multiple chapters').toBeGreaterThan(1);
  const buttons = page.getByRole('button', { name: 'Hint', exact: true, includeHidden: true });
  const controls = await buttons.evaluateAll((elements) => elements.map((button) => {
    const id = button.getAttribute('aria-controls');
    return {
      id,
      matches: Array.from(document.querySelectorAll('[id]')).filter((node) => node.id === id).length,
    };
  }));
  expect(controls.length, 'combined course renders authored hints').toBeGreaterThan(0);
  expect(new Set(controls.map(({ id }) => id)).size, 'duplicate deck inclusions must have distinct disclosure IDs')
    .toBe(controls.length);
  expect(controls.every(({ id, matches }) => id && matches === 1),
    'every disclosure controls exactly one panel').toBe(true);
});

for (const surface of ['chapter', 'plain gym']) {
  test(`${surface} hints remain readable at 320px and print as light study cues`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(surface === 'chapter'
      ? '/SEBook/designpatterns/singleton.html'
      : `/se-gym/?plain=true&${SINGLETON_SELECTION}`);
    const scope = surface === 'chapter'
      ? page.getByRole('region', { name: 'Singleton Pattern Flashcards flashcards', exact: true })
      : page;
    if (surface === 'chapter') await gradeCard(scope);
    const { button, panel } = await controlledHint(page, scope);
    await button.click();
    await expect(panel).toHaveText(SINGLETON_HINT);
    await a11yCheckpoint(page, `${surface} hint at 320px`, {
      feature: 'flashcard-hints', include: '.flashcard-hint-area', darkMode: true,
    });
    const area = panel.locator('..');
    for (const dark of [false, true]) {
      await page.evaluate((enabled) => document.documentElement.classList.toggle('dark-mode', enabled), dark);
      const sizing = await area.evaluate((element) => {
        const buttonElement = element.querySelector('button');
        const hintElement = element.querySelector('.flashcard-hint');
        const paragraph = hintElement.querySelector('p');
        const nodes = [element, buttonElement, hintElement];
        return {
          fits: nodes.every((node) => {
            const bounds = node.getBoundingClientRect();
            return bounds.left >= -1 && bounds.right <= innerWidth + 1
              && node.scrollWidth <= node.clientWidth + 1;
          }),
          inheritedFont: parseFloat(getComputedStyle(element).fontSize),
          buttonFont: parseFloat(getComputedStyle(buttonElement).fontSize),
          paragraphFont: parseFloat(getComputedStyle(paragraph).fontSize),
        };
      });
      expect(sizing.fits, `${surface} hint and button fit the ${dark ? 'dark' : 'light'} narrow viewport`).toBe(true);
      expect(sizing.paragraphFont).toBeGreaterThanOrEqual(Math.max(16, sizing.inheritedFont));
      expect(sizing.buttonFont).toBeGreaterThanOrEqual(sizing.paragraphFont);
      await area.screenshot({ path: testInfo.outputPath(`hint-${dark ? 'dark' : 'light'}-320.png`) });
    }
    await scope.getByRole('button', { name: 'Hide Hint', exact: true }).click();
    await expect(panel).toBeHidden();
    // A saved dark theme and a collapsed disclosure must not hide the print cue.
    await page.emulateMedia({ media: 'print' });
    await expect(area.getByRole('button', { name: 'Hint', exact: true, includeHidden: true }))
      .toHaveCSS('display', 'none');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveText(SINGLETON_HINT);
    const printColors = await panel.evaluate((element) => {
      const rgba = (value) => {
        const parts = value.match(/[\d.]+/g).map(Number);
        return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 };
      };
      const over = (foreground, background) => foreground.rgb.map((channel, index) =>
        channel * foreground.alpha + background[index] * (1 - foreground.alpha));
      const luminance = (rgb) => rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const paragraph = element.querySelector('p');
      const ancestors = [];
      for (let node = paragraph; node; node = node.parentElement) ancestors.unshift(node);
      // Transparent print surfaces compose over their ancestors and white paper.
      const background = ancestors.reduce((color, node) =>
        over(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
      const foreground = over(rgba(getComputedStyle(paragraph).color), background);
      const paper = luminance(background);
      const ink = luminance(foreground);
      return { paper, contrast: (Math.max(paper, ink) + 0.05) / (Math.min(paper, ink) + 0.05) };
    });
    expect(printColors.paper, 'print uses a light paper background').toBeGreaterThanOrEqual(0.9);
    expect(printColors.contrast, 'printed hint text meets AA contrast').toBeGreaterThanOrEqual(4.5);
    expect(await panel.evaluate((element) => getComputedStyle(element, '::before').content)).toContain('Hint');
    await area.screenshot({ path: testInfo.outputPath('hint-print-from-dark.png') });
  });
}
