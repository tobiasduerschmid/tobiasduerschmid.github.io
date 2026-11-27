// The Test-Driven Development video narration: every cue shows its stage
// named by its visual and rests on its picture; in every code language the
// picture keeps its words apart, inside their cards, and on the stage; text
// keeps 4.5:1 on the light and the dark desk; a theme switch repaints like a
// fresh video; the stage draws the lesson's code (tdd_code.yml) in the
// viewer's language and follows the player's Code control; the notes' stills
// follow the notes' own language; and the player, quiz, and reading views
// stay accessible on desktop and phone.
const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { seekNarration, setSiteTheme, serveAudioRanges } = require('./helpers/narration-player');
const { WALL_SKIPPED, stageTextProblems, crowdedBoxes, stageContrastProblems, textSpillProblems, stagePaint } = require('./helpers/video-narration-stage');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const topic = 'tdd';
const story = loadStory(topic);
const lesson = loadRegistry('video')[topic];
const timing = require(`../_data/explainers/${topic}_timing.json`);
const quizzes = yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}_quizzes.yml`), 'utf8'));
const code = yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}_code.yml`), 'utf8'));
const LANGUAGES = Object.keys(code);
// Arrows join the pieces they point between, a balance's pans hang from its beam, and a
// backdrop illustration (the dinner table, the split machine, the safety net, the scale)
// holds the cards that lie on it.
const TDD_SKIPPED = `${WALL_SKIPPED}, .sk-balance-pan, .td-art--backdrop`;

const player = page => page.getByRole('region', { name: story.title, exact: true });
const questionsOf = id => (quizzes[id] ? quizzes[id].questions || [quizzes[id]] : []);
const seek = (page, time) => seekNarration(player(page), time);
const cueIndex = (sceneId, cueId) => {
  const scene = story.scenes.findIndex(each => each.id === sceneId);
  return [scene, story.scenes[scene].cues.findIndex(cue => cue.id === cueId)];
};
const cueTime = ([scene, cue], fraction = 0.5) => {
  const span = timing.scenes[scene].cues[cue];
  return span.start + (span.end - span.start) * fraction;
};
const restTime = ([scene, cue]) => timing.scenes[scene].cues[cue].end - 0.3;
// Each cue at rest: the picture its speech has built, just before the next cue.
const restingPoses = story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, index) => ({
  id: `${scene.id}/${cue.id}`, time: restTime([sceneIndex, index]),
})));
const CHECKPOINTS = [['intro', 'dinner'], ['starter', 'red'], ['triangulate', 'red2'], ['leftover', 'red3'], ['rules_red', 'liar'], ['summary', 'recap_consequences']];
const MOBILE = [['cycle', 'runner'], ['rules_green', 'on_green']];

/** The stage page, in `language` (data-code-language) and the given theme. */
async function openStage(page, { dark = false, language } = {}) {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(lesson.animation.page);
  await page.evaluate(isDark => document.documentElement.classList.toggle('dark-mode', isDark), dark);
  await page.evaluate(() => window.VideoNarrationStage.ready);
  if (language) await page.evaluate((chosen) => { document.getElementById('stage').dataset.codeLanguage = chosen; }, language);
}

/** Runs `check` on the stage page at every resting pose; returns the problems by cue. */
async function problemsAtRest(page, check, argument) {
  const found = {};
  for (const pose of restingPoses) {
    await page.evaluate(time => window.VideoNarrationStage.seek(time), pose.time);
    const problems = await page.evaluate(check, argument);
    if (problems.length) found[pose.id] = problems;
  }
  return found;
}

/** The lines of the visible code cards of `kind` ('tests' or 'code'), as shown. */
function visibleCard(kind) {
  const shown = node => node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const cards = [...document.querySelectorAll(`#stage .td-card--${kind} .td-card-variant`)].filter(shown);
  return cards.map(card => ({
    file: card.querySelector('.td-card-file').textContent,
    lines: [...card.querySelectorAll('.td-row')].filter(row => shown(row) && row.getBoundingClientRect().height > 1).map(row => row.textContent),
  }));
}

/** The visible runner status lines. */
function visibleStatus() {
  const shown = node => node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  return [...document.querySelectorAll('#stage .td-terminal-status')].filter(shown).map(line => line.textContent);
}

test.describe(topic, () => {
  test('each cue shows the animated stage, named by the cue\'s visual, beside its words', async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await serveAudioRanges(page, story.audio);
    await page.goto(lesson.chapter);
    const animation = player(page);
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      for (const [index, cue] of scene.cues.entries()) {
        const label = `${scene.id}/${cue.id}`;
        await seek(page, cueTime([sceneIndex, index]));
        await expect(animation.getByRole('region', { name: 'Narration', exact: true }), label).toHaveText(cue.text);
        const screen = animation.getByRole('group', { name: cue.visual, exact: true });
        await expect(screen.locator('[data-vn-panel="animation"]'), label).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
  });

  test('the animated stage builds every scene and poses the narration\'s picture', async ({ page }) => {
    test.setTimeout(120000);
    await serveAudioRanges(page, story.audio);
    await page.goto(lesson.chapter);
    const animation = player(page);
    const panel = animation.locator('[data-vn-panel="animation"]');
    await panel.scrollIntoViewIfNeeded();
    // The stage built every scene: a misspelled word mark would have rejected it.
    await expect(panel).toHaveClass(/is-ready/, { timeout: 30000 });
    await animation.getByRole('button', { name: 'Player settings' }).click();
    await animation.getByRole('checkbox', { name: 'Animate visuals' }).uncheck();
    const stage = page.frame({ url: /video-narration/ });
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      for (const [index, cue] of scene.cues.entries()) {
        const label = `${scene.id}/${cue.id}`;
        await seek(page, cueTime([sceneIndex, index]));
        await expect.poll(() => stage.evaluate(() => [...document.querySelectorAll('#stage .scene')]
          .filter(each => Number(getComputedStyle(each).opacity) > 0.9).length), label).toBeGreaterThan(0);
        const posed = await stage.evaluate(() => document.getAnimations()[0]?.currentTime / 1000);
        expect(posed, label).toBeCloseTo(restTime([sceneIndex, index]), 1);
      }
    }
  });

  // Code cards and runner lines differ in height and width by language, so
  // every layout check runs in every language.
  for (const language of LANGUAGES) {
    test(`in ${language}, no cue's picture overlaps its words, crowds, or leaves the stage`, async ({ page }) => {
      test.setTimeout(180000);
      await openStage(page, { language });
      expect(await problemsAtRest(page, stageTextProblems)).toEqual({});
      expect(await problemsAtRest(page, crowdedBoxes, TDD_SKIPPED)).toEqual({});
    });

    test(`in ${language}, no words spill out of the card, tag, label, or terminal they are written on`, async ({ page }) => {
      test.setTimeout(120000);
      await openStage(page, { language });
      expect(await problemsAtRest(page, textSpillProblems)).toEqual({});
    });

    test(`in ${language}, the stage shows the lesson's code and runner lines for that language`, async ({ page }) => {
      const stageCode = code[language].stage;
      await openStage(page, { language });
      const poseAt = time => page.evaluate(t => window.VideoNarrationStage.seek(t), time);
      // The starter test, then the Fake It code that passes it.
      await poseAt(restTime(cueIndex('starter', 'first_test')));
      expect(await page.evaluate(visibleCard, 'tests')).toEqual([{ file: stageCode.files.tests, lines: stageCode.cards.test_one_person }]);
      await poseAt(restTime(cueIndex('starter', 'fake')));
      expect(await page.evaluate(visibleCard, 'code')).toEqual([{ file: stageCode.files.code, lines: stageCode.cards.fake_it }]);
      // Red because split does not exist yet, then green: the runner's own lines.
      await poseAt(restTime(cueIndex('starter', 'red')));
      expect(await page.evaluate(visibleStatus)).toEqual([stageCode.steps.s1_red.status]);
      await poseAt(restTime(cueIndex('leftover', 'red3')));
      expect(await page.evaluate(visibleStatus)).toEqual([stageCode.steps.s3_red.status]);
      // After the refactoring, the code card holds the refactored function.
      await poseAt(restTime(cueIndex('refactor', 'tidy')));
      expect(await page.evaluate(visibleCard, 'code')).toEqual([{ file: stageCode.files.code, lines: stageCode.cards.refactored }]);
    });
  }

  for (const dark of [false, true]) {
    test(`every cue's text keeps 4.5:1 contrast on the ${dark ? 'dark' : 'light'} desk`, async ({ page }) => {
      test.setTimeout(120000);
      await openStage(page, { dark });
      expect(await problemsAtRest(page, stageContrastProblems)).toEqual({});
    });
  }

  // The notes page copies the stage once per cue, so every copy must stay a
  // valid page: the illustrations carry no text (their labels are HTML beside
  // them, where contrast is checked) and no ids or paint servers that copies
  // would duplicate.
  test('every cue\'s illustrations can be copied: no text, ids, or paint servers in the art', async ({ page }) => {
    test.setTimeout(120000);
    await openStage(page);
    const artProblems = () => [...document.querySelectorAll('#stage .ta-art')].flatMap((art) => {
      const name = [...art.classList].find(each => each !== 'ta-art');
      const marked = [...art.querySelectorAll('text, defs, [id]')].map(node => `${name}: <${node.tagName}>${node.id ? ` #${node.id}` : ''}`);
      const painted = [...art.querySelectorAll('*')]
        .filter(node => /url\(/.test(`${getComputedStyle(node).fill} ${getComputedStyle(node).stroke}`))
        .map(node => `${name}: paint server on <${node.tagName}>`);
      return [...marked, ...painted];
    });
    expect(await problemsAtRest(page, artProblems)).toEqual({});
  });

  for (const [from, to] of [['light', 'dark'], ['dark', 'light']]) {
    test(`switching from ${from} to ${to} mode while watching any cue paints it like a fresh ${to} video`, async ({ browser }) => {
      test.setTimeout(180000);
      const stageIn = async (theme) => {
        const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
        const page = await context.newPage();
        await page.goto(lesson.animation.page);
        await page.evaluate(() => window.VideoNarrationStage.ready);
        await page.evaluate((dark) => {
          document.documentElement.classList.toggle('dark-mode', dark);
          window.SongRoundedSurfaces.prepare(document.getElementById('stage'), { force: true });
        }, theme === 'dark');
        return { page, context };
      };
      const setTheme = (page, theme) => page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), theme === 'dark');
      const poseAt = (page, time) => page.evaluate(t => window.VideoNarrationStage.seek(t), time);
      const switched = await stageIn(from);
      const fresh = await stageIn(to);
      const differing = [];
      for (const pose of restingPoses) {
        await poseAt(switched.page, pose.time);
        await setTheme(switched.page, to);
        await poseAt(fresh.page, pose.time);
        const [a, b] = await Promise.all([switched, fresh].map(({ page }) => page.evaluate(stagePaint)));
        const first = a.findIndex((paint, i) => paint !== b[i]);
        if (first >= 0) differing.push(`${pose.id}: ${a[first]} / ${b[first]}`);
        await setTheme(switched.page, from);
      }
      await Promise.all([switched, fresh].map(({ context }) => context.close()));
      expect(differing).toEqual([]);
    });
  }

  test('choosing a code language in the player redraws the stage\'s code in that language', async ({ page }) => {
    test.setTimeout(120000);
    await serveAudioRanges(page, story.audio);
    await page.goto(lesson.chapter);
    const animation = player(page);
    const panel = animation.locator('[data-vn-panel="animation"]');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-ready/, { timeout: 30000 });
    await seek(page, cueTime(cueIndex('starter', 'fake'), 0.95));
    const stage = page.frame({ url: /video-narration/ });
    const codeLanguage = animation.getByRole('combobox', { name: 'Code language' });
    for (const language of ['java', 'cpp', 'typescript', 'python']) {
      await codeLanguage.selectOption(language);
      await expect.poll(() => stage.evaluate(visibleCard, 'tests'), language).toEqual([
        { file: code[language].stage.files.tests, lines: code[language].stage.cards.test_one_person },
      ]);
    }
  });

  test('clicking a runner card in the picture switches the code to its language, without playing or skipping', async ({ page }) => {
    test.setTimeout(120000);
    await serveAudioRanges(page, story.audio);
    await page.goto(lesson.chapter);
    const animation = player(page);
    const panel = animation.locator('[data-vn-panel="animation"]');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveClass(/is-ready/, { timeout: 30000 });
    const at = restTime(cueIndex('cycle', 'runner'));
    await seek(page, at);
    // Seeking scrolls to the slider; the clicks go to the picture.
    await panel.scrollIntoViewIfNeeded();
    const stage = page.frame({ url: /video-narration/ });
    const frame = await animation.locator('iframe.vn-animation-frame').boundingBox();
    const audio = animation.locator('audio');
    await audio.evaluate((element) => {
      window.playsSeen = 0;
      element.addEventListener('play', () => { window.playsSeen += 1; });
    });
    const codeLanguage = animation.getByRole('combobox', { name: 'Code language' });
    // Two cards on the right, then two on the left: a click the picture did
    // not take would pause or play the video, and two quick ones on one side skip.
    for (const language of ['java', 'typescript', 'cpp', 'python']) {
      const card = await stage.evaluate((runner) => {
        const box = document.querySelector(`[data-code-runner="${runner}"]`).getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }, language);
      await page.mouse.click(frame.x + card.x, frame.y + card.y);
      await expect(codeLanguage).toHaveValue(language);
      await expect.poll(() => stage.evaluate(() => document.getElementById('stage').dataset.codeLanguage)).toBe(language);
    }
    // An unclaimed click toggles playback 300 ms later: past that, nothing has played.
    const clicked = await page.evaluate(() => performance.now());
    await expect.poll(() => page.evaluate(since => ({ settled: performance.now() - since > 400, plays: window.playsSeen }), clicked)).toEqual({ settled: true, plays: 0 });
    expect(await audio.evaluate(element => element.paused)).toBe(true);
    expect(await audio.evaluate(element => element.currentTime)).toBeCloseTo(at, 1);
  });

  test('the printable notes draw each still\'s code in the notes\' language', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(`${lesson.views}/notes/`);
    const row = page.locator('[data-vn-scene][data-vn-cue]').nth(story.scenes.slice(0, cueIndex('starter', 'first_test')[0]).reduce((n, scene) => n + scene.cues.length, 0));
    await expect(row.locator('.stage')).toHaveCount(1, { timeout: 30000 });
    const files = () => row.locator('.td-card--tests .td-card-variant').evaluateAll(cards => cards
      .filter(card => card.checkVisibility()).map(card => card.querySelector('.td-card-file').textContent));
    for (const language of ['cpp', 'java']) {
      await page.getByLabel('Code language for these notes').selectOption(language);
      await expect.poll(files, language).toEqual([code[language].stage.files.tests]);
    }
  });

  for (const dark of [false, true]) {
    test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
      test.setTimeout(120000);
      const include = `#${topic}-video .nja-player`;
      await page.setViewportSize({ width: 1500, height: 1000 });
      await serveAudioRanges(page, story.audio);
      await page.goto(lesson.chapter);
      await setSiteTheme(page, dark);
      const animation = player(page);
      for (const [sceneId, cueId] of CHECKPOINTS) {
        await seek(page, cueTime(cueIndex(sceneId, cueId)));
        await a11yCheckpoint(page, `${topic} ${sceneId}/${cueId} ${dark ? 'dark' : 'light'}`, { include, feature: 'tdd-narration' });
        await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${sceneId}-${cueId}.png`) });
      }
      await page.setViewportSize({ width: 320, height: 850 });
      for (const [sceneId, cueId] of MOBILE) {
        await seek(page, cueTime(cueIndex(sceneId, cueId)));
        await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        await a11yCheckpoint(page, `${topic} mobile ${sceneId}/${cueId}`, { include, feature: 'tdd-narration' });
      }
      // The knowledge check of the scene on screen, answered wrongly.
      await animation.getByRole('button', { name: 'Player settings' }).click();
      await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
      const question = questionsOf(MOBILE.at(-1)[0])[0];
      const wrong = Number(Object.keys(question.option_feedback)[0]);
      await animation.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ }).getByRole('radio').filter({ hasText: question.options[wrong] }).click();
      await expect(animation.getByText(question.option_feedback[wrong].trim(), { exact: true })).toBeVisible();
      await a11yCheckpoint(page, `${topic} mobile incorrect answer`, { include, feature: 'tdd-narration' });
    });
  }

  test('reading and print views include every step, picture description, and question without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
    for (const view of ['read', 'print']) {
      await page.goto(`${lesson.views}/${view}/`);
      await expect(page.locator('audio')).toHaveCount(0);
      await expect(page.locator('iframe')).toHaveCount(0);
      await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
      for (const scene of story.scenes) {
        for (const [index, cue] of scene.cues.entries()) {
          const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
          await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
          await expect(step.locator('.vn-animation-description')).toContainText(cue.visual);
        }
      }
      await expect(page.locator('.np-print-question')).toHaveCount(questions);
    }
    await context.close();
  });
});
