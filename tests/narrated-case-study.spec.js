const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');
const { openPlayerSettings } = require('./helpers/narration-player');

const cases = [
  { topic: 'therac25', url: '/SEBook/development_practices/therac-25.html' },
  { topic: 'cloudflare2019', url: '/SEBook/development_practices/cloudflare-2019.html' },
  { topic: 'huggingface2026', url: '/SEBook/systems/security.html' },
];
const decisionName = (scene, index) => `${index + 1}. ${scene.label} — Knowledge check`;

// Rendered narration offers playback; a text-only story offers no audio controls at all.
async function expectPlaybackAvailable(study, story) {
  const play = study.getByRole('button', { name: 'Play narration', exact: true });
  if (story.audio) await expect(play).toBeEnabled();
  else await expect(play).toHaveCount(0);
}

async function readThroughScene(study, scene) {
  await expect(study.getByRole('region', { name: 'Narration', exact: true })).toHaveText(scene.cues[0].text);
  for (const [index, cue] of scene.cues.entries()) {
    if (index === 0) continue;
    const action = scene.cues[index - 1].prediction ? 'Reveal explanation' : 'Next step';
    await study.getByRole('button', { name: action, exact: true }).click();
    await expect(study.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
  }
}

async function revealDecision(study, scene) {
  const prediction = study.getByRole('region', { name: 'Pause and predict', exact: true });
  await expect(prediction).toBeVisible();
  await expect(prediction.getByText(scene.cues.at(-1).text, { exact: true })).toBeVisible();
  await expect(study.getByRole('button', { name: 'Knowledge check', exact: true })).toBeDisabled();
  await prediction.getByRole('button', { name: 'Reveal explanation', exact: true }).click();
  await expect(prediction).toBeHidden();
}

for (const { topic, url } of cases) {
  test.describe(topic, () => {
    let story;
    let decisionIndex;
    test.beforeAll(() => {
      story = loadStory(topic);
      decisionIndex = story.scenes.findIndex((scene, index) => scene.checkpoint && index < story.scenes.length - 1);
      expect(decisionIndex, 'the investigation needs a decision before revealing further evidence').toBeGreaterThanOrEqual(0);
    });
    const caseStudy = page => page.getByRole('region', { name: story.title, exact: true });
    const auditScope = { include: `#${topic}-case-study`, feature: 'narrated-case-study' };

    test('silent investigation gives specific feedback and continues without a review screen', async ({ page }) => {
      test.setTimeout(120000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const study = caseStudy(page);
      const scene = story.scenes[decisionIndex];
      const question = scene.checkpoint;
      const followingScene = story.scenes[decisionIndex + 1];
      await openPlayerSettings(study);
      await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(decisionIndex));
      await readThroughScene(study, scene);
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeHidden();
      await revealDecision(study, scene);
      const decision = study.getByRole('region', { name: decisionName(scene, decisionIndex), exact: true });
      await expect(decision.getByRole('heading')).toBeFocused();
      await a11yCheckpoint(page, 'case study decision', auditScope);

      const wrongIndex = question.options.findIndex((_, index) => index !== question.correct_index);
      await decision.getByRole('radio', { name: question.options[wrongIndex] }).click();
      await expect(decision.getByText(question.option_feedback[wrongIndex], { exact: true })).toBeVisible();
      await expect(decision.getByText(question.explanation, { exact: true })).toBeVisible();
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeHidden();
      await a11yCheckpoint(page, 'case study incorrect feedback', auditScope);
      await expect(decision.getByRole('button', { name: 'See Results' })).toHaveCount(0);
      await decision.getByRole('button', { name: story.audio ? 'Continue narration' : 'Continue lesson' }).click();
      await expect(study.getByRole('heading', { name: followingScene.title, exact: true })).toBeVisible();
      await expectPlaybackAvailable(study, story);
      expect(errors, 'silent study must not raise browser errors').toEqual([]);
    });

    test('review navigation reconstructs each cue without requiring earlier decisions or audio', async ({ page }) => {
      await page.goto(url);
      const study = caseStudy(page);
      // Reverse order catches state left behind by a later scene as well as forward navigation.
      for (let index = story.scenes.length - 1; index >= 0; index--) {
        const scene = story.scenes[index];
        // Settings close once focus moves to another control, as in the music player.
        await openPlayerSettings(study);
        await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(index));
        await expect(study.getByRole('heading', { name: scene.title, exact: true })).toBeVisible();
        for (const [cueIndex, cue] of scene.cues.entries()) {
          if (cueIndex > 0) {
            const action = scene.cues[cueIndex - 1].prediction ? 'Reveal explanation' : 'Next step';
            await study.getByRole('button', { name: action, exact: true }).click();
          }
          const diagram = story.diagrams[cue.diagram || scene.diagram];
          await expect(study.getByRole('img', { name: diagram.label, exact: true })).toBeVisible();
          await expect(study.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
        }
        const nextAction = scene.checkpoint ? 'Knowledge check'
          : index < story.scenes.length - 1 ? 'Next scene' : 'Finish review';
        // Step navigation and the media transport both offer "Next scene".
        await expect(study.getByRole('group', { name: 'Step navigation', exact: true }).getByRole('button', { name: nextAction, exact: true })).toBeVisible();
        await expectPlaybackAvailable(study, story);
      }
    });

    test('narration stops at a prediction until the learner explicitly reveals the next evidence', async ({ page }) => {
      test.skip(!story.audio, 'a text-only story has no narration clock to stop');
      const timing = JSON.parse(readFileSync(path.join(__dirname, `../_data/explainers/${topic}_timing.json`), 'utf8'));
      await page.goto(url);
      const study = caseStudy(page);
      await study.getByRole('slider', { name: 'Narration position' }).fill((timing.scenes[decisionIndex].end - 0.2).toFixed(2));
      await study.getByRole('button', { name: 'Play narration', exact: true }).click();
      const decision = study.getByRole('region', { name: decisionName(story.scenes[decisionIndex], decisionIndex), exact: true });
      await expect(study.getByRole('region', { name: 'Pause and predict', exact: true })).toBeVisible();
      expect(await study.locator('audio').evaluate(audio => audio.paused)).toBe(true);
      await expect(decision).toBeHidden();
      await expect(study.getByRole('heading', { name: story.scenes[decisionIndex + 1].title, exact: true })).toBeHidden();
      await revealDecision(study, story.scenes[decisionIndex]);
      await expect(decision).toBeVisible();
      // The decision replaces the control bar until the learner answers or skips it.
      expect(await study.locator('audio').evaluate(audio => audio.paused)).toBe(true);
      await expect(study.getByRole('button', { name: 'Play narration', exact: true })).toBeHidden();
      await expect(study.getByRole('heading', { name: story.scenes[decisionIndex + 1].title, exact: true })).toBeHidden();
      await decision.getByRole('button', { name: 'Skip Knowledge Check' }).click();
      await expect(study.getByRole('heading', { name: story.scenes[decisionIndex + 1].title, exact: true })).toBeVisible();
      await expect(study.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
      await study.getByRole('button', { name: 'Pause narration', exact: true }).click();
    });

    test('full screen keeps step navigation and the narration, then returns to the page', async ({ page }) => {
      await page.goto(url);
      const study = caseStudy(page);
      await study.getByRole('button', { name: 'Enter full screen', exact: true }).press('Enter');
      const exit = study.getByRole('button', { name: 'Exit full screen', exact: true });
      await expect(exit).toBeFocused();
      const insideFullScreen = locator => locator.evaluate(element =>
        Boolean(document.fullscreenElement && document.fullscreenElement.contains(element)));
      expect(await insideFullScreen(study.getByRole('button', { name: 'Next step', exact: true }))).toBe(true);
      expect(await insideFullScreen(study.getByRole('region', { name: 'Narration', exact: true }))).toBe(true);
      await exit.click();
      await expect(study.getByRole('button', { name: 'Enter full screen', exact: true })).toBeFocused();
      expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    });

    test('printing opens the full transcript and its answers, then restores what the reader had open', async ({ page }) => {
      await page.goto(url);
      const study = caseStudy(page);
      await expect(study.getByRole('button', { name: 'Next step', exact: true })).toBeVisible();
      const readingScene = study.getByRole('region', { name: `1. ${story.scenes[0].title}`, exact: true });
      const decisionScene = story.scenes.find(scene => scene.checkpoint);
      const answer = study.getByRole('region', { name: `Decision for ${decisionScene.label}`, exact: true })
        .getByText(decisionScene.checkpoint.explanation, { exact: true });
      await expect(readingScene).toBeHidden();
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      await expect(readingScene).toBeVisible();
      await expect(answer).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await expect(readingScene).toBeHidden();
      await expect(answer).toBeHidden();
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
        await openPlayerSettings(study);
        await study.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(decisionIndex));
        await readThroughScene(study, story.scenes[decisionIndex]);
        await revealDecision(study, story.scenes[decisionIndex]);
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
