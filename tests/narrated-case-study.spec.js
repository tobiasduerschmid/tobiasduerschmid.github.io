const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const cases = [
  { topic: 'therac25', slug: 'therac-25' },
  { topic: 'cloudflare2019', slug: 'cloudflare-2019' },
];
const decisionName = (scene, index) => `${index + 1}. ${scene.label} — Choose the next action`;

async function readThroughScene(study, scene) {
  await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(scene.cues[0].text);
  for (const cue of scene.cues.slice(1)) {
    await study.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(cue.text);
  }
}

for (const { topic, slug } of cases) {
  test.describe(topic, () => {
    let story;
    let decisionIndex;
    test.beforeAll(() => {
      story = loadStory(topic);
      decisionIndex = story.scenes.findIndex((scene, index) => scene.checkpoint && index < story.scenes.length - 1);
      expect(decisionIndex, 'the investigation needs a decision before revealing further evidence').toBeGreaterThanOrEqual(0);
    });
    const url = `/SEBook/development_practices/${slug}.html`;
    const caseStudy = page => page.getByRole('region', { name: story.title, exact: true });
    const auditScope = { include: `#${topic}-case-study`, feature: 'narrated-case-study' };

    test('silent investigation waits for a decision, gives specific feedback, and permits retry before continuing', async ({ page }) => {
      test.setTimeout(120000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const study = caseStudy(page);
      const scene = story.scenes[decisionIndex];
      const question = scene.checkpoint;
      const followingScene = story.scenes[decisionIndex + 1];
      await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(decisionIndex));
      await readThroughScene(study, scene);
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeHidden();
      await study.getByRole('button', { name: 'Choose next action', exact: true }).click();
      const decision = study.getByRole('region', { name: decisionName(scene, decisionIndex), exact: true });
      await expect(decision.getByRole('heading')).toBeFocused();
      await a11yCheckpoint(page, 'case study decision', auditScope);

      const wrongIndex = question.options.findIndex((_, index) => index !== question.correct_index);
      await decision.getByRole('radio', { name: question.options[wrongIndex] }).click();
      await expect(decision.getByText(question.option_feedback[wrongIndex], { exact: true })).toBeVisible();
      await expect(decision.getByText(question.explanation, { exact: true })).toBeVisible();
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeHidden();
      await a11yCheckpoint(page, 'case study incorrect feedback', auditScope);
      await decision.getByRole('button', { name: 'See Results' }).click();
      await decision.getByRole('button', { name: 'Try Again' }).click();
      await expect(decision.getByText(question.explanation, { exact: true })).toBeHidden();
      await decision.getByRole('radio', { name: question.options[question.correct_index] }).click();
      await decision.getByRole('button', { name: 'See Results' }).click();
      await decision.getByRole('button', { name: 'Continue to next evidence' }).click();
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeVisible();
      await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeEnabled();
      expect(errors, 'silent study must not raise browser errors').toEqual([]);
    });

    test('review navigation reconstructs each cue without requiring earlier decisions or audio', async ({ page }) => {
      await page.goto(url);
      const study = caseStudy(page);
      // Reverse order catches state left behind by a later scene as well as forward navigation.
      for (let index = story.scenes.length - 1; index >= 0; index--) {
        const scene = story.scenes[index];
        await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(index));
        await expect(study.getByRole('heading', { name: scene.title, exact: true })).toBeVisible();
        for (const [cueIndex, cue] of scene.cues.entries()) {
          if (cueIndex > 0) await study.getByRole('button', { name: 'Next step', exact: true }).click();
          const diagram = story.diagrams[cue.diagram || scene.diagram];
          await expect(study.getByRole('img', { name: diagram.label, exact: true })).toBeVisible();
          await expect(study.getByRole('region', { name: 'Current narration' })).toHaveText(cue.text);
        }
        const nextAction = scene.checkpoint ? 'Choose next action'
          : index < story.scenes.length - 1 ? 'Next scene' : 'Finish case study';
        // Step navigation and the media transport both offer "Next scene".
        await expect(study.locator('.case-step-controls').getByRole('button', { name: nextAction, exact: true })).toBeVisible();
        await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeEnabled();
      }
    });

    test('narration stops at a prediction until the learner explicitly reveals the next evidence', async ({ page }) => {
      const timing = JSON.parse(readFileSync(path.join(__dirname, `../_data/explainers/${topic}_timing.json`), 'utf8'));
      await page.goto(url);
      const study = caseStudy(page);
      await study.getByRole('slider', { name: 'Narration position' }).fill((timing.scenes[decisionIndex].end - 0.2).toFixed(2));
      await study.getByRole('button', { name: 'Play narration', exact: true }).click();
      const decision = study.getByRole('region', { name: decisionName(story.scenes[decisionIndex], decisionIndex), exact: true });
      await expect(decision).toBeVisible();
      await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeDisabled();
      await expect(study.getByRole('heading', { name: story.scenes[decisionIndex + 1].title, exact: true })).toBeHidden();
      await decision.getByRole('button', { name: 'Skip decision and reveal next evidence' }).click();
      await expect(study.getByRole('heading', { name: story.scenes[decisionIndex + 1].title, exact: true })).toBeVisible();
      await expect(study.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
      await study.getByRole('button', { name: 'Pause narration', exact: true }).click();
    });

    for (const theme of ['light', 'dark']) {
      test(`diagram and decision remain readable and accessible at a narrow viewport in ${theme} mode`, async ({ page }) => {
        test.setTimeout(120000);
        await page.goto(url);
        const darkMode = page.getByRole('checkbox', { name: 'Toggle dark mode' });
        if (await darkMode.isChecked() !== (theme === 'dark')) await darkMode.press('Space');
        await expect(darkMode).toBeChecked({ checked: theme === 'dark' });
        await page.setViewportSize({ width: 320, height: 800 });
        const study = caseStudy(page);
        await expect(study.getByRole('button', { name: 'Next step', exact: true })).toBeVisible();
        const textSizes = await study.evaluate(element => {
          const paragraphSize = parseFloat(getComputedStyle(element.querySelector('p')).fontSize);
          const buttons = [...element.querySelectorAll('button')].filter(button => button.getClientRects().length);
          return { paragraphSize, buttonSizes: buttons.map(button => parseFloat(getComputedStyle(button).fontSize)), width: element.getBoundingClientRect().width };
        });
        expect(textSizes.width, 'story must fit within the narrow page').toBeLessThanOrEqual(320);
        for (const size of textSizes.buttonSizes) expect(size).toBeGreaterThanOrEqual(textSizes.paragraphSize);
        await a11yCheckpoint(page, 'narrow case study diagram', auditScope);
        await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(decisionIndex));
        await readThroughScene(study, story.scenes[decisionIndex]);
        await study.getByRole('button', { name: 'Choose next action', exact: true }).click();
        await a11yCheckpoint(page, 'narrow case study decision', auditScope);
      });
    }

    test('the full case is readable without JavaScript and prints its otherwise concealed answers', async ({ browser, baseURL }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
      const page = await context.newPage();
      await page.goto(url);
      const study = caseStudy(page);
      const cueCount = story.scenes.reduce((count, scene) => count + scene.cues.length, 0);
      await expect(study.getByRole('img')).toHaveCount(cueCount);
      for (const [index, scene] of story.scenes.entries()) {
        const readingScene = study.getByRole('region', { name: `${index + 1}. ${scene.title}`, exact: true });
        await expect(readingScene.getByText(scene.cues[0].text, { exact: true })).toBeVisible();
      }
      const decisionScenes = story.scenes.filter(scene => scene.checkpoint);
      for (const scene of decisionScenes) {
        const decision = study.getByRole('region', { name: `Decision for ${scene.label}`, exact: true });
        await expect(decision.getByText(scene.checkpoint.explanation, { exact: true })).toBeHidden();
      }
      await page.emulateMedia({ media: 'print' });
      for (const scene of decisionScenes) {
        const decision = study.getByRole('region', { name: `Decision for ${scene.label}`, exact: true });
        await expect(decision.getByText(scene.checkpoint.explanation, { exact: true })).toBeVisible();
      }
      await context.close();
    });
  });
}
