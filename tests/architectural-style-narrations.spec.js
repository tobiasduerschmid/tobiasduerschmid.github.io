// The architectural-style video narrations (Publish-Subscribe, Layers, Pipes
// and Filters): every cue shows its stage named by its visual and rests on
// its picture; no picture overlaps, crowds, or leaves the stage; text keeps
// 4.5:1 on both blueprints; a theme switch repaints like a fresh video; and
// the player, quiz, and reading views stay accessible on desktop and phone.
const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { seekNarration, setSiteTheme, serveAudioRanges } = require('./helpers/narration-player');
const { WALL_SKIPPED, stageTextProblems, crowdedBoxes, stageContrastProblems, stagePaint } = require('./helpers/video-narration-stage');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

// Wires and pipes join the pieces they connect; tokens travel over them; a
// cross lies over what it strikes; a topic's channel runs under the cards that
// publish into it and subscribe from it; Mochi and the walkway's props sit on
// the walkway; a building's section lines frame its floors; and a speech
// bubble points at who speaks. These touch other pieces on purpose.
const ARCH_SKIPPED = `${WALL_SKIPPED}, .ak-wire, .ak-token, .ak-cross, .ak-topic, .sk-speech, .ps-robot, .ps-walk-prop, .pf-pipe, .ls-frame`;

const LESSONS = {
  publish_subscribe: {
    checkpoints: [['intro', 'lunch'], ['direct_calls', 'freeze'], ['topic', 'both_roles'], ['one_way', 'hurts_itself'], ['nobody_listens', 'silent'], ['summary', 'recap_costs']],
    mobile: [['topic', 'counter_joins'], ['nobody_listens', 'robustness']],
  },
  layered_style: {
    checkpoints: [['intro', 'jam'], ['stack', 'layers'], ['allowed', 'upward_cost'], ['callbacks', 'not_uses'], ['port', 'portability'], ['summary', 'recap_tradeoff']],
    mobile: [['stack', 'translate'], ['costs', 'bridge']],
  },
  pipes_and_filters: {
    checkpoints: [['intro', 'steps'], ['monolith', 'midnight'], ['filters', 'source_sink'], ['stream', 'seconds'], ['costs', 'errors'], ['summary', 'recap_rules']],
    mobile: [['alone', 'common_format'], ['order', 'order_matters']],
  },
};

for (const [topic, spec] of Object.entries(LESSONS)) {
  const story = loadStory(topic);
  const quizzes = yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}_quizzes.yml`), 'utf8'));
  const lesson = loadRegistry('video')[topic];
  const timing = require(`../_data/explainers/${topic}_timing.json`);
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
  // Each cue at rest: the picture its speech has built, just before the next cue.
  const restingPoses = story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, index) => ({
    id: `${scene.id}/${cue.id}`, time: timing.scenes[sceneIndex].cues[index].end - 0.3,
  })));

  async function openStage(page, dark = false) {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto(lesson.animation.page);
    await page.evaluate(isDark => document.documentElement.classList.toggle('dark-mode', isDark), dark);
    await page.evaluate(() => window.VideoNarrationStage.ready);
  }
  // Runs `check` on the stage page at every resting pose; returns the problems by cue.
  async function problemsAtRest(page, check, argument) {
    const found = {};
    for (const pose of restingPoses) {
      await page.evaluate(time => window.VideoNarrationStage.seek(time), pose.time);
      const problems = await page.evaluate(check, argument);
      if (problems.length) found[pose.id] = problems;
    }
    return found;
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
          // A prediction shows no takeaway, which would give the answer away.
          await expect(animation.locator('.nja-player > .nja-takeaway'), label).toBeVisible({ visible: !cue.prediction });
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
      // The frame loads once the screen nears the viewport, as it does for a reader scrolling to it.
      await panel.scrollIntoViewIfNeeded();
      // The stage built every scene: a misspelled word mark would have rejected it.
      await expect(panel).toHaveClass(/is-ready/, { timeout: 30000 });
      // Without motion, each cue rests on the picture its speech built.
      await animation.getByRole('button', { name: 'Player settings' }).click();
      await animation.getByRole('checkbox', { name: 'Animate visuals' }).uncheck();
      const stage = page.frame({ url: /video-narration/ });
      for (const [sceneIndex, scene] of story.scenes.entries()) {
        for (const [index, cue] of scene.cues.entries()) {
          const label = `${scene.id}/${cue.id}`;
          await seek(page, cueTime([sceneIndex, index]));
          await expect(panel, label).toBeVisible();
          await expect.poll(() => stage.evaluate(() => [...document.querySelectorAll('#stage .scene')]
            .filter(each => Number(getComputedStyle(each).opacity) > 0.9).length), label).toBeGreaterThan(0);
          const posed = await stage.evaluate(() => document.getAnimations()[0]?.currentTime / 1000);
          expect(posed, label).toBeCloseTo(timing.scenes[sceneIndex].cues[index].end - 0.3, 1);
        }
      }
    });

    test('no cue\'s picture overlaps its words or leaves the stage', async ({ page }) => {
      test.setTimeout(120000);
      await openStage(page);
      expect(await problemsAtRest(page, stageTextProblems)).toEqual({});
    });

    for (const dark of [false, true]) {
      test(`every cue's text keeps 4.5:1 contrast on the ${dark ? 'dark blueprint' : 'light whiteprint'}`, async ({ page }) => {
        test.setTimeout(120000);
        await openStage(page, dark);
        expect(await problemsAtRest(page, stageContrastProblems)).toEqual({});
      });
    }

    test('every cue keeps a visible gap between its cards, panels, and readouts', async ({ page }) => {
      test.setTimeout(120000);
      await openStage(page);
      expect(await problemsAtRest(page, crowdedBoxes, ARCH_SKIPPED)).toEqual({});
    });

    // Switching theme after the stage is built must paint exactly the colors a
    // stage built in that theme paints; the rounded-surface repaint is forced so
    // Chromium exercises the path where a switch could leave stale colors behind.
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

    for (const dark of [false, true]) {
      test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
        test.setTimeout(120000);
        const include = `#${topic}-video .nja-player`;
        await page.setViewportSize({ width: 1500, height: 1000 });
        await serveAudioRanges(page, story.audio);
        await page.goto(lesson.chapter);
        await setSiteTheme(page, dark);
        const animation = player(page);
        for (const [sceneId, cueId] of spec.checkpoints) {
          await seek(page, cueTime(cueIndex(sceneId, cueId)));
          await a11yCheckpoint(page, `${topic} ${sceneId}/${cueId} ${dark ? 'dark' : 'light'}`, { include, feature: 'architectural-style-narrations' });
          await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${sceneId}-${cueId}.png`) });
        }
        await page.setViewportSize({ width: 320, height: 850 });
        for (const [sceneId, cueId] of spec.mobile) {
          await seek(page, cueTime(cueIndex(sceneId, cueId)));
          await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
          await a11yCheckpoint(page, `${topic} mobile ${sceneId}/${cueId}`, { include, feature: 'architectural-style-narrations' });
        }
        // The knowledge check of the scene on screen, answered wrongly.
        await animation.getByRole('button', { name: 'Player settings' }).click();
        await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
        const question = questionsOf(spec.mobile.at(-1)[0])[0];
        const wrong = Number(Object.keys(question.option_feedback)[0]);
        await animation.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ }).getByRole('radio').filter({ hasText: question.options[wrong] }).click();
        await expect(animation.getByText(question.option_feedback[wrong].trim(), { exact: true })).toBeVisible();
        await a11yCheckpoint(page, `${topic} mobile incorrect answer`, { include, feature: 'architectural-style-narrations' });
        await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
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
        await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
      }
      await context.close();
    });

    test('reading view carries the theme and is accessible', async ({ page }) => {
      test.setTimeout(120000);
      await page.goto(lesson.chapter);
      await setSiteTheme(page, true);
      await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
      await a11yCheckpoint(page, `${topic} reader dark`, { include: '#main-content', feature: 'architectural-style-narrations' });
      await page.getByRole('button', { name: 'Dark mode' }).click();
      await a11yCheckpoint(page, `${topic} reader light`, { include: '#main-content', feature: 'architectural-style-narrations' });
      await page.setViewportSize({ width: 320, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  });
}
