const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { openPlayerSettings, seekNarration, setSiteTheme, serveAudioRanges } = require('./helpers/narration-player');
const { WALL_SKIPPED, stageTextProblems, crowdedBoxes, stageContrastProblems, stagePaint } = require('./helpers/video-narration-stage');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = loadStory('scrum');
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/scrum_quizzes.yml'), 'utf8'));
const lesson = loadRegistry('video').scrum;
const timing = require('../_data/explainers/scrum_timing.json');
const url = '/SEBook/process/scrum.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const questionsOf = id => (quizzes[id] ? quizzes[id].questions || [quizzes[id]] : []);
const shownPanels = (scene, cue) => cue.show || scene.show;
const cueTime = (sceneIndex, cueIndex, fraction = 0.5) => {
  const cue = timing.scenes[sceneIndex].cues[cueIndex];
  return cue.start + (cue.end - cue.start) * fraction;
};

const seek = (page, time) => seekNarration(player(page), time);
const theme = setSiteTheme;

test('each cue shows its panels on one screen named by the cue\'s visual', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
  await openPlayerSettings(animation);
  await expect(animation.getByRole('combobox', { name: 'Code language' })).toHaveCount(0);
  for (const [sceneIndex, scene] of story.scenes.entries()) {
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, cueTime(sceneIndex, cueIndex));
      const label = `${scene.id} ${cueIndex + 1}`;
      await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
      const screen = animation.getByRole('group', { name: cue.visual, exact: true });
      await expect(screen, label).toBeVisible();
      const shown = shownPanels(scene, cue);
      for (const panel of ['slide', 'diagram', 'animation']) {
        await expect(screen.locator(`[data-vn-panel="${panel}"]`), `${label}: ${panel}`).toBeVisible({ visible: shown.includes(panel) });
      }
      if (shown.includes('slide')) {
        const slide = story.slides[cue.slide || scene.slide];
        const items = screen.locator('[data-vn-panel="slide"]').locator('.vn-slide-item, tbody tr');
        await expect(items, label).toHaveCount(cue.slide_reveal || slide.items.length);
        const focused = screen.locator('[data-vn-panel="slide"] [aria-current="true"]');
        if (cue.slide_focus) {
          const item = slide.items.find(entry => entry.id === cue.slide_focus);
          await expect(focused, label).toContainText(item.title || item.cells[0]);
        } else {
          await expect(focused, label).toHaveCount(0);
        }
      }
      if (shown.includes('diagram')) {
        const diagram = story.diagrams[cue.diagram || scene.diagram];
        await expect(screen.getByRole('region', { name: diagram.label }).locator('svg'), label).toBeVisible();
      }
      await expect(animation.locator('.nja-player > .nja-takeaway'), label).toBeVisible({ visible: !cue.prediction });
    }
  }
  expect(errors).toEqual([]);
});

test('every scene keeps the Scrum roadmap visible and marks only its actual part', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: lesson.parts_label });
    await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
});

test('each part in the part strip jumps to the start of its first scene', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const position = animation.getByRole('slider', { name: 'Narration position' });
  // The roadmap must already work before playback, on the opening scene.
  for (const part of lesson.parts) {
    const index = story.scenes.findIndex(scene => scene.part === part);
    await animation.locator('.nja-scene:visible').getByRole('button', { name: `${part}: jump to its start` }).click();
    await expect(animation.getByRole('heading', { name: story.scenes[index].title, exact: true })).toBeVisible();
    await expect.poll(async () => Number(await position.inputValue())).toBeCloseTo(timing.scenes[index].start, 0);
  }
});

test('the opening scene previews clickable Theory scenes without marking one current', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const outline = animation.getByRole('list', { name: 'Scenes in Theory', exact: true });
  await expect(outline).toBeVisible();
  await expect(outline.getByRole('button')).toHaveText(['Empiricism', 'Inspect and adapt']);
  await expect(outline.locator('[aria-current="step"]')).toHaveCount(0);
  await outline.getByRole('button', { name: 'Empiricism: jump to its start', exact: true }).click();
  await expect(animation.getByRole('heading', { name: story.scenes[1].title, exact: true })).toBeVisible();
  await expect(animation.getByRole('list', { name: 'Scenes in Theory', exact: true }).locator('[aria-current="step"]')).toHaveText('Empiricism');
});

test('the animated stage builds every scene and poses the narration\'s picture', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  const animation = player(page);
  const panel = animation.locator('[data-vn-panel="animation"]');
  // The stage built every scene: a misspelled word mark would have rejected it.
  await expect(panel).toHaveClass(/is-ready/, { timeout: 30000 });
  // Without motion, each animated cue rests on the picture its speech built.
  await animation.getByRole('button', { name: 'Player settings' }).click();
  await animation.getByRole('checkbox', { name: 'Animate visuals' }).uncheck();
  for (const [sceneIndex, scene] of story.scenes.entries()) {
    for (const [cueIndex, cue] of scene.cues.entries()) {
      if (!shownPanels(scene, cue).includes('animation')) continue;
      await seek(page, cueTime(sceneIndex, cueIndex));
      const label = `${scene.id} ${cueIndex + 1}`;
      await expect(panel, label).toBeVisible();
      const expected = timing.scenes[sceneIndex].cues[cueIndex].end - 0.3;
      await expect.poll(() => page.frame({ url: /video-narration/ }).evaluate(() => {
        const visible = [...document.querySelectorAll('#stage .scene')].filter(scene => Number(getComputedStyle(scene).opacity) > 0.9);
        return visible.length;
      }), label).toBeGreaterThan(0);
      const posed = await page.frame({ url: /video-narration/ }).evaluate(() => document.getAnimations()[0]?.currentTime / 1000);
      expect(posed, label).toBeCloseTo(expected, 1);
    }
  }
});

test('no cue\'s picture overlaps its words or leaves the stage', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/assets/video-narration/scrum.html');
  await page.evaluate(() => window.VideoNarrationStage.ready);
  const found = {};
  for (const [sceneIndex, scene] of story.scenes.entries()) {
    for (const [cueIndex] of scene.cues.entries()) {
      const id = `${scene.id}-${cueIndex + 1}`;
      await page.evaluate((time) => window.VideoNarrationStage.seek(time), timing.scenes[sceneIndex].cues[cueIndex].end - 0.3);
      const problems = await page.evaluate(stageTextProblems);
      if (problems.length) found[id] = problems;
    }
  }
  expect(found).toEqual({});
});

for (const dark of [false, true]) {
  test(`every cue's text keeps 4.5:1 contrast in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto('/assets/video-narration/scrum.html');
    await page.evaluate((isDark) => document.documentElement.classList.toggle('dark-mode', isDark), dark);
    await page.evaluate(() => window.VideoNarrationStage.ready);
    const found = {};
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      for (const [cueIndex] of scene.cues.entries()) {
        await page.evaluate((time) => window.VideoNarrationStage.seek(time), timing.scenes[sceneIndex].cues[cueIndex].end - 0.3);
        const problems = await page.evaluate(stageContrastProblems);
        if (problems.length) found[`${scene.id}-${cueIndex + 1}`] = problems;
      }
    }
    expect(found).toEqual({});
  });
}

// Switching theme after the stage is built must paint exactly the colors a
// stage built in that theme paints. Firefox's rounded-surface repaint copies colors
// into inline styles, so it runs here too (forced), or Chromium would never
// exercise the path where a theme switch can leave stale colors behind.
for (const [from, to] of [['light', 'dark'], ['dark', 'light']]) {
  test(`switching from ${from} to ${to} mode while watching any cue paints it like a fresh ${to} video`, async ({ browser }) => {
    test.setTimeout(180000);
    const stageIn = async (theme) => {
      const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
      const page = await context.newPage();
      await page.goto('/assets/video-narration/scrum.html');
      await page.evaluate(() => window.VideoNarrationStage.ready);
      await page.evaluate((dark) => {
        document.documentElement.classList.toggle('dark-mode', dark);
        window.SongRoundedSurfaces.prepare(document.getElementById('stage'), { force: true });
      }, theme === 'dark');
      return { page, context };
    };
    const setTheme = (page, theme) => page.evaluate((dark) => document.documentElement.classList.toggle('dark-mode', dark), theme === 'dark');
    const poseAt = (page, time) => page.evaluate((t) => window.VideoNarrationStage.seek(t), time);
    const switched = await stageIn(from);
    const fresh = await stageIn(to);
    const differing = [];
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      for (const [cueIndex] of scene.cues.entries()) {
        const time = timing.scenes[sceneIndex].cues[cueIndex].end - 0.3;
        // The viewer is watching this cue in one theme and switches to the other.
        await poseAt(switched.page, time);
        await setTheme(switched.page, to);
        await poseAt(fresh.page, time);
        const [a, b] = await Promise.all([switched, fresh].map(({ page }) => page.evaluate(stagePaint)));
        const first = a.findIndex((paint, i) => paint !== b[i]);
        if (first >= 0) differing.push(`${scene.id}-${cueIndex + 1}: ${a[first]} / ${b[first]}`);
        await setTheme(switched.page, from);
      }
    }
    await Promise.all([switched, fresh].map(({ context }) => context.close()));
    expect(differing).toEqual([]);
  });
}

// The Scrum kit's figures and scenery also sit against the artwork on purpose.
const SCRUM_SKIPPED = `${WALL_SKIPPED}, .sk-wave, .sk-ball, .sk-person`;

test('every cue keeps a visible gap between its cards, badges, and panels', async ({ page }) => {
  test.setTimeout(120000);
  // The top story is held up in front of the board, below the column headings.
  const intended = { 'product_backlog-2': /^sk-column .* \/ us-card / };
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/assets/video-narration/scrum.html');
  await page.evaluate(() => window.VideoNarrationStage.ready);
  const found = {};
  for (const [sceneIndex, scene] of story.scenes.entries()) {
    for (const [cueIndex] of scene.cues.entries()) {
      const id = `${scene.id}-${cueIndex + 1}`;
      await page.evaluate((time) => window.VideoNarrationStage.seek(time), timing.scenes[sceneIndex].cues[cueIndex].end - 0.3);
      const crowded = (await page.evaluate(crowdedBoxes, SCRUM_SKIPPED)).filter((pair) => !(intended[id] && intended[id].test(pair)));
      if (crowded.length) found[id] = crowded;
    }
  }
  expect(found).toEqual({});
});

for (const speed of [1, 2]) {
  test(`narration at ${speed}x holds the final picture after speech before each check, and a section without one plays on`, async ({ page }) => {
    test.setTimeout(240000);
    await serveAudioRanges(page, story.audio);
    await page.addInitScript(() => {
      const pause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function recordPause() {
        if (window.pausedAt === null) window.pausedAt = this.currentTime;
        return pause.call(this);
      };
    });
    await page.goto(url);
    const animation = player(page);
    // Load the audio before selecting a speed; loading resets the media rate.
    await seek(page, timing.scenes[0].cues.at(-1).speech_end - 0.5);
    await animation.getByRole('button', { name: 'Player settings' }).click();
    await animation.getByRole('combobox', { name: 'Speed', exact: true }).selectOption(String(speed));
    await animation.getByRole('button', { name: 'Player settings' }).click();
    for (const [index, scene] of story.scenes.entries()) {
      const end = timing.scenes[index].end;
      const speechEnd = timing.scenes[index].cues.at(-1).speech_end;
      await seek(page, speechEnd - 0.5);
      await page.evaluate(() => { window.pausedAt = null; });
      await animation.getByRole('button', { name: 'Play narration' }).click();
      await expect(animation.locator('audio')).toHaveJSProperty('playbackRate', speed);
      const questions = questionsOf(scene.id);
      if (!questions.length) {
        // No check: the next section starts and keeps playing, and focus stays put.
        await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
        await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeFocused();
        await animation.getByRole('button', { name: 'Pause narration' }).click();
        continue;
      }
      const kind = questions.length > 1 ? 'Summary quiz' : 'Knowledge check';
      const quiz = animation.getByRole('region', { name: `${index + 1}. ${scene.label} — ${kind}`, exact: true });
      await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime),
        { intervals: [50, 100] }).toBeGreaterThan(speechEnd + 0.75);
      await expect(animation.getByRole('group', { name: scene.cues.at(-1).visual, exact: true })).toBeVisible();
      await expect(quiz).toBeHidden();
      await expect(quiz).toBeVisible();
      const pausedAt = await page.evaluate(() => window.pausedAt);
      expect(pausedAt - speechEnd, `${scene.id}: time to inspect the picture after the last word`).toBeGreaterThanOrEqual(2);
      expect(pausedAt, `${scene.id}: stops before the next section's speech`).toBeLessThan(end - 0.1);
      await expect(animation.locator('audio')).toHaveJSProperty('paused', true);
      for (const question of questions) {
        await expect(quiz.getByText(question.question, { exact: true })).toBeVisible();
        await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
        await expect(quiz.getByText(question.explanation, { exact: true })).toBeVisible();
        if (question !== questions.at(-1)) await quiz.getByRole('button', { name: /^Next/ }).click();
      }
      if (questions.length > 1) await quiz.getByRole('button', { name: 'See Results' }).click();
      await quiz.getByRole('button', { name: index + 1 < story.scenes.length ? 'Continue narration' : 'Continue to song' }).click();
      await expect(quiz).toBeHidden();
      if (index + 1 < story.scenes.length) {
        await animation.getByRole('button', { name: 'Pause narration' }).click();
        await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
      }
    }
  });
}

test('the video controls match the music player: skips, keys, captions, volume, settings, and the picture', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const audio = animation.locator('audio');
  const position = animation.getByRole('slider', { name: 'Narration position' });
  const video = animation.locator('[data-vn-video]');
  await seek(page, 100);
  await animation.getByRole('button', { name: 'Forward 5 seconds' }).click();
  await expect(position).toHaveValue('105');
  await animation.getByRole('button', { name: 'Back 5 seconds' }).click();
  await expect(position).toHaveValue('100');
  await position.focus();
  await page.keyboard.press('ArrowRight');
  await expect(position).toHaveValue('105');
  await page.keyboard.press('5');
  await expect.poll(async () => Number(await position.inputValue())).toBeCloseTo(timing.duration / 2, 1);
  await page.keyboard.press('0');
  await expect(position).toHaveValue('0');

  // Captions: C and the CC button hide and show them; their size follows the setting.
  const captions = animation.getByRole('region', { name: 'Narration', exact: true });
  const cc = animation.getByRole('button', { name: 'Closed captions (CC)' });
  // Like the music player's, shortcuts other than seeking leave sliders alone.
  await animation.getByRole('button', { name: 'Play video' }).focus();
  await page.keyboard.press('c');
  await expect(captions).toBeHidden();
  await expect(cc).toHaveAttribute('aria-pressed', 'false');
  await cc.click();
  await expect(captions).toBeVisible();
  const size = () => captions.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  const before = await size();
  await animation.getByRole('button', { name: 'Player settings' }).click();
  await animation.getByRole('combobox', { name: 'Caption size' }).selectOption('1.5');
  await expect.poll(size).toBeCloseTo(before * 1.5, 0);

  // Escape closes the settings and returns focus to their button; a focused
  // dropdown keeps Escape for its own picker, as in the music player.
  await animation.getByRole('checkbox', { name: 'Landscape in full screen' }).focus();
  await page.keyboard.press('Escape');
  await expect(animation.getByRole('region', { name: 'Player settings' })).toBeHidden();
  await expect(animation.getByRole('button', { name: 'Player settings' })).toBeFocused();

  await animation.getByRole('slider', { name: 'Volume' }).fill('40');
  await expect.poll(() => audio.evaluate(element => element.volume)).toBeCloseTo(0.4, 2);

  // The picture plays and pauses, like the transport's play button.
  await animation.getByRole('button', { name: 'Play video' }).click();
  await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeVisible();
  await animation.getByRole('button', { name: 'Pause video' }).click();
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await expect(video).toBeVisible();
});

test('full screen fills the display with the video, hides idle controls, and keeps checks inside', async ({ page }) => {
  test.setTimeout(60000);
  await serveAudioRanges(page, story.audio);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  const animation = player(page);
  const video = animation.locator('[data-vn-video]');
  await animation.getByRole('button', { name: 'Enter full screen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement && document.fullscreenElement.matches('[data-vn-video]'))).toBe(true);
  const box = await video.boundingBox();
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([1280, 800]);
  // The roadmap stays horizontal above the picture; captions and compact
  // controls overlay its lower edge rather than creating a sidebar.
  const picture = await animation.locator('[data-vn-panel="animation"]').boundingBox();
  expect(picture.width / picture.height).toBeCloseTo(16 / 9, 1);
  const controls = animation.locator('.vn-controls');
  // Segments and checkpoint targets share the overlay; the picture still
  // dominates the presentation while the controls are visible.
  expect((await controls.boundingBox()).height).toBeLessThan(box.height / 5);
  const navigation = await animation.getByRole('navigation', { name: 'Lesson sections' }).boundingBox();
  expect(navigation.y + navigation.height).toBeLessThanOrEqual(picture.y + 1);
  expect(picture.width).toBeGreaterThan(1280 * 0.85);

  await page.keyboard.press('k');
  await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeAttached();
  await expect(video).toHaveClass(/are-controls-hidden/, { timeout: 6000 });
  await expect(controls).toBeHidden();
  await page.mouse.move(400, 300);
  await page.mouse.move(420, 320);
  await expect(controls).toBeVisible();

  // A section's check opens inside the full-screen video.
  await animation.getByRole('button', { name: 'Pause narration' }).click();
  await seek(page, timing.scenes[1].end - 0.9);
  await animation.getByRole('button', { name: 'Play narration' }).click();
  const quiz = animation.getByRole('region', { name: `2. ${story.scenes[1].label} — Knowledge check`, exact: true });
  await expect(quiz).toBeVisible();
  expect(await quiz.evaluate(element => document.fullscreenElement.contains(element))).toBe(true);
  // The control bar steps aside while the check is open, giving the quiz its room.
  await expect(controls).toBeHidden();
  // A correct answer's confetti falls inside the full-screen video, the only part shown.
  const question = questionsOf(story.scenes[1].id)[0];
  await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement.querySelectorAll('.site-confetti-piece').length)).toBeGreaterThan(0);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBe(null);
});

test('full screen on a phone keeps horizontal navigation and overlays captions on the picture', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(url);
  const animation = player(page);
  await animation.getByRole('button', { name: 'Enter full screen' }).click();
  const picture = await animation.locator('[data-vn-panel="animation"]').boundingBox();
  const controls = await animation.locator('.vn-controls').boundingBox();
  expect(picture.height).toBeGreaterThan(390 * 0.7);
  expect(controls.y).toBeGreaterThanOrEqual(0);
  expect(controls.y + controls.height).toBeLessThanOrEqual(390);
  const navigation = await animation.getByRole('navigation', { name: 'Lesson sections' }).boundingBox();
  expect(navigation.y + navigation.height).toBeLessThanOrEqual(picture.y + 1);
  const captions = animation.getByRole('region', { name: 'Narration', exact: true });
  const captionBox = await captions.boundingBox();
  expect(captionBox.y).toBeGreaterThan(picture.y);
  expect(captionBox.y).toBeLessThan(picture.y + picture.height);
  expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(controls.y);
  await animation.getByRole('button', { name: 'Closed captions (CC)', exact: true }).click();
  await expect(captions).toBeHidden();
  expect(await animation.locator('[data-vn-panel="animation"]').boundingBox()).toEqual(picture);
});

test('without element full screen (Safari on iPhone), full screen fills the viewport and Escape leaves it', async ({ page }) => {
  await page.addInitScript(() => {
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url);
  const animation = player(page);
  const video = animation.locator('[data-vn-video]');
  await animation.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(animation.getByRole('button', { name: 'Exit full screen' })).toBeVisible();
  expect(await video.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(animation.getByRole('navigation', { name: 'Lesson sections' })).toBeInViewport();
  await expect(animation.locator('[data-vn-panel="animation"]')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(animation.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
  expect((await video.boundingBox()).width).toBeLessThan(390);
});

test('the animated stage follows the site\'s light or dark mode as it changes', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  await expect(animation.locator('[data-vn-panel="animation"]')).toHaveClass(/is-ready/, { timeout: 30000 });
  const stage = page.frame({ url: /video-narration/ });
  const wall = () => stage.evaluate(() => getComputedStyle(document.getElementById('stage')).getPropertyValue('--bg').trim());
  await theme(page, false);
  await expect.poll(() => stage.evaluate(() => document.documentElement.classList.contains('dark-mode'))).toBe(false);
  const light = await wall();
  await theme(page, true);
  await expect.poll(() => stage.evaluate(() => document.documentElement.classList.contains('dark-mode'))).toBe(true);
  expect(await wall()).not.toBe(light);
});

for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
    const checkpoints = [['intro', 0], ['theory', 1], ['scrum_master', 3], ['increment', 3], ['inspect_adapt', 2], ['summary', 1]];
    for (const [id, cue] of checkpoints) {
      await seek(page, cueTime(sceneIndex(id), cue));
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#scrum-video .nja-player', feature: 'scrum-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const [id, cue] of [['theory', 1], ['inspect_adapt', 2], ['product_backlog', 0]]) {
      await seek(page, cueTime(sceneIndex(id), cue));
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#scrum-video .nja-player', feature: 'scrum-narration' });
    }
    await animation.getByRole('button', { name: 'Player settings' }).click();
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('product_backlog')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ }).getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#scrum-video .nja-player', feature: 'scrum-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, panel, and question without JavaScript', async ({ browser }) => {
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
        const shown = shownPanels(scene, cue);
        if (shown.includes('animation')) await expect(step.locator('.vn-animation-description')).toContainText(cue.visual);
        if (shown.includes('diagram')) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (shown.includes('slide')) {
          const slide = story.slides[cue.slide || scene.slide];
          await expect(step.locator('.vn-slide-heading')).toHaveText(slide.heading);
        }
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
  }
  await context.close();
});

test('reading view carries the theme, offers no code language, and is accessible', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveCount(0);
  await a11yCheckpoint(page, 'scrum reader dark', { include: '#main-content', feature: 'scrum-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'scrum reader light', { include: '#main-content', feature: 'scrum-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
