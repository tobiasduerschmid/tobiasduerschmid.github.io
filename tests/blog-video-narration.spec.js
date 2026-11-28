const { test, expect } = require('@playwright/test');
const { loadLesson, ROOT } = require('../scripts/narration/source');
const { openPlayerSettings, seekNarration, serveAudioRanges, setSiteTheme } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

for (const [topic, slug, photoDescription] of [
  ['blog_ai_usage', 'how-should-i-use-ai-as-a-college-student', /^Student working on a computer/],
  ['blog_study_tips', 'evidence-based-study-tips-for-college-students', /^Students working on a laptop/],
]) {
  test(`${slug}: one click on the photo plays the animation on the article page`, async ({ page }) => {
    const { story } = loadLesson(topic);
    await serveAudioRanges(page, story.audio);
    await page.goto(`/blog/${slug}/`);
    const articleUrl = page.url();
    const photo = page.getByRole('img', { name: photoDescription });
    const playOnPhoto = page.getByRole('button', { name: 'Play animated article', exact: true });
    const player = page.getByRole('region', { name: 'Animated article', exact: true });
    await expect(photo).toBeVisible();
    await expect(playOnPhoto).toBeVisible();
    await expect(player).toBeHidden();
    const [photoBox, buttonBox] = await Promise.all([photo.boundingBox(), playOnPhoto.boundingBox()]);
    expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(photoBox.x + photoBox.width / 2, 0);
    expect(buttonBox.y + buttonBox.height / 2).toBeCloseTo(photoBox.y + photoBox.height / 2, 0);
    await a11yCheckpoint(page, `${slug} video cover`, { include: '[data-blog-video-cover]', feature: 'blog-video-narration' });

    await playOnPhoto.click();

    await expect(page).toHaveURL(articleUrl);
    await expect(photo).toBeHidden();
    await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeFocused();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
    const art = player.frameLocator('iframe[title$=" animation"]');
    await expect(art.getByText(story.scenes[0].essay_beats[0].title, { exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Previous section', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Next section', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Closed captions (CC)' })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
    await expect(player.getByText('Study tools', { exact: true })).toBeHidden();
    await expect(player.getByText(story.scenes[0].takeaway, { exact: true })).toBeHidden();
    await expect(player.getByText(/^Tip: turn your phone sideways/)).toBeHidden();
    await player.getByRole('button', { name: 'Player settings' }).click();
    await expect(player.getByRole('combobox', { name: 'Section', exact: true }).getByRole('option')).toHaveCount(story.scenes.length);
    await a11yCheckpoint(page, `${slug} inline animation`, { include: `#${topic}-video`, feature: 'blog-video-narration' });
  });

  test(`${slug}: the standalone video plays synced artwork and captions`, async ({ page }) => {
    const { story } = loadLesson(topic);
    const timing = require(`${ROOT}/_data/explainers/${topic}_timing.json`);
    await serveAudioRanges(page, story.audio);
    await page.goto(`/blog/${slug}/`);
    const articleImage = await page.getByRole('img', { name: photoDescription }).getAttribute('src');
    const reader = page.getByRole('region', { name: 'Audio player' });
    const readAloud = await reader.locator('audio source').getAttribute('src');
    const readerTime = () => reader.locator('audio').evaluate(audio => audio.currentTime);
    await reader.getByRole('button', { name: 'Next section', exact: true }).click();
    await expect.poll(readerTime).toBeCloseTo(timing.scenes[1].start, 1);
    await reader.getByRole('button', { name: 'Previous section', exact: true }).click();
    await expect.poll(readerTime).toBeCloseTo(0, 1);
    await page.getByRole('link', { name: 'Watch the animated article' }).click();

    const player = page.getByRole('region', { name: 'Animated article', exact: true });
    const thumbnail = player.locator('.vn-animation-cover');
    await expect(thumbnail).toHaveAttribute('src', articleImage);
    await expect(thumbnail).toBeVisible();
    const videoSpeech = await player.locator('audio source').getAttribute('src');
    expect(new URL(videoSpeech, page.url()).pathname).toBe(new URL(readAloud, page.url()).pathname);
    await player.getByRole('button', { name: 'Play video', exact: true }).click();
    await expect(thumbnail).toBeHidden();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
    await player.getByRole('button', { name: 'Pause narration' }).click();

    const scenes = player.getByRole('combobox', { name: 'Section', exact: true });
    await openPlayerSettings(player);
    await expect(scenes.getByRole('option')).toHaveCount(story.scenes.length);
    const chapterIndex = story.scenes.length - 2;
    await scenes.selectOption(String(chapterIndex));
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(timing.scenes[chapterIndex].start, 1);
    await expect(player.getByRole('region', { name: 'Narration' })).toHaveText(story.scenes[chapterIndex].cues[0].text);
    const art = player.frameLocator('iframe[title$=" animation"]');
    await expect(art.getByText(story.scenes[chapterIndex].essay_beats[0].title, { exact: true })).toBeVisible();
    await a11yCheckpoint(page, `${slug} video`, { include: `#${topic}-video`, feature: 'blog-video-narration' });
  });

  test(`${slug}: the full text of each illustration fits its double-speed reading time`, async ({ page }) => {
    const { story, lesson } = loadLesson(topic);
    const timing = require(`${ROOT}/_data/explainers/${topic}_timing.json`);
    const beats = story.scenes.flatMap((scene, i) => scene.essay_beats.map(beat => ({
      title: beat.title, start: timing.scenes[i].cues[beat.from - 1].start, end: timing.scenes[i].cues[beat.to - 1].end,
    })));
    await page.goto(lesson.animation.page);
    await page.waitForFunction(() => Boolean(window.VideoNarrationStage));
    const overBudget = await page.evaluate(async beats => {
      await window.VideoNarrationStage.ready;
      const counts = (picture, selectors) => [...picture.querySelectorAll(selectors)]
        .map(node => node.textContent.trim().split(/\s+/u).length).reduce((total, words) => total + words, 0);
      const failures = [];
      for (const { title, start, end } of beats) {
        window.VideoNarrationStage.seek(end - 0.2);
        const picture = document.querySelector('#stage .be-picture');
        if (picture?.querySelector('.be-title')?.textContent !== title) throw new Error(`Missing slide: ${title}`);
        const shared = counts(picture, '.be-title,.be-subtitle,.be-signal,.be-prop-label,.be-prop-detail');
        const words = shared + Math.max(counts(picture, '.be-figure text'), counts(picture, '.be-figure-label'));
        const seconds = (end - start) / 2;
        if (1 + words / 3 > seconds) failures.push({ title, words, seconds });
      }
      return failures;
    }, beats);
    expect(overBudget).toEqual([]);
  });
}

test('changing the article theme preserves the illustrated reader’s facial colors', async ({ page }) => {
  const { story } = loadLesson('blog_ai_usage');
  await serveAudioRanges(page, story.audio);
  await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
  const player = page.getByRole('region', { name: 'Animated article', exact: true });
  await setSiteTheme(page, false);
  await page.getByRole('button', { name: 'Play animated article', exact: true }).click();
  await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
  await seekNarration(player, 1);
  const art = player.frameLocator('iframe[title$=" animation"]');
  const stage = art.locator('#stage');
  const head = art.locator('[data-art-part="head"]');
  await expect(head).toBeVisible();
  const faceColors = () => head.evaluate(group => Array.from(group.children, shape => {
    const { fill, stroke } = getComputedStyle(shape);
    return fill === 'none' ? stroke : fill;
  }));
  const lightFace = await faceColors();
  const lightBackground = await stage.evaluate(node => getComputedStyle(node).backgroundColor);

  await setSiteTheme(page, true);
  await expect(stage).not.toHaveCSS('background-color', lightBackground);
  expect(await faceColors()).toEqual(lightFace);
});

test('the Big-O answer stays fully visible for at least three seconds at double speed', async ({ page }) => {
  const { story } = loadLesson('blog_study_tips');
  const timing = require('../_data/explainers/blog_study_tips_timing.json');
  const index = story.scenes.findIndex(scene => scene.essay_beats.some(beat => beat.figure === 'study-big-o'));
  const beat = story.scenes[index].essay_beats.find(beat => beat.figure === 'study-big-o');
  const end = timing.scenes[index].cues[beat.to - 1].end;
  await serveAudioRanges(page, story.audio);
  await page.goto('/blog/evidence-based-study-tips-for-college-students/video/');
  const player = page.getByRole('region', { name: 'Animated article', exact: true });
  const answer = player.frameLocator('iframe[title$=" animation"]').getByText('6 visits · O(n)', { exact: true });
  for (const time of [end - 6.05, end - 0.1]) {
    await seekNarration(player, time);
    await expect(answer).toBeVisible();
    await expect.poll(() => answer.evaluate(node => {
      for (let part = node; part; part = part.parentElement) {
        if (Number(getComputedStyle(part).opacity) < 0.99) return false;
      }
      return true;
    })).toBe(true);
  }
});

test('the inline animation and article read-aloud yield to the most recently played track', async ({ page }) => {
  const { story } = loadLesson('blog_study_tips');
  await serveAudioRanges(page, story.audio);
  await page.goto('/blog/evidence-based-study-tips-for-college-students/');
  const reader = page.getByRole('region', { name: 'Audio player' });
  const readerAudio = reader.locator('audio');
  const playerAudio = page.getByRole('region', { name: 'Animated article', exact: true }).locator('audio');

  await reader.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(readerAudio).toHaveJSProperty('paused', false);
  await page.getByRole('button', { name: 'Play animated article', exact: true }).click();
  await expect(readerAudio).toHaveJSProperty('paused', true);
  await expect(playerAudio).toHaveJSProperty('paused', false);
  await reader.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(playerAudio).toHaveJSProperty('paused', true);
  await expect(readerAudio).toHaveJSProperty('paused', false);
});

test('portrait playback keeps graphic labels readable on a 320px screen', async ({ page }) => {
  const { story } = loadLesson('blog_study_tips');
  await serveAudioRanges(page, story.audio);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/blog/evidence-based-study-tips-for-college-students/');

  await page.getByRole('button', { name: 'Play animated article', exact: true }).press('Enter');

  const player = page.getByRole('region', { name: 'Animated article', exact: true });
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeInViewport();
  const frame = player.locator('iframe[title$=" animation"]');
  const firstLabel = story.scenes[0].essay_beats[0].items[0].label;
  const label = frame.contentFrame().getByText(firstLabel, { exact: true });
  await expect(label).toBeVisible();
  expect((await frame.boundingBox()).width).toBeLessThanOrEqual((await player.boundingBox()).width);
  const renderedFont = await label.evaluate(element => parseFloat(getComputedStyle(element).fontSize)
    * element.getBoundingClientRect().height / element.offsetHeight);
  expect(renderedFont).toBeGreaterThanOrEqual(16);
});

for (const [device, viewport, touch] of [
  ['desktop', { width: 1280, height: 720 }, false],
  ['phone', { width: 390, height: 844 }, true],
]) {
  test.describe(`Article captions on ${device}`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch });

    test('large captions leave the complete illustration visible inline and in fullscreen', async ({ page }) => {
      const { story } = loadLesson('blog_study_tips');
      const timing = require('../_data/explainers/blog_study_tips_timing.json');
      await serveAudioRanges(page, story.audio);
      await page.goto('/blog/evidence-based-study-tips-for-college-students/video/');
      const player = page.getByRole('region', { name: 'Animated article', exact: true });
      const picture = player.locator('iframe[title$=" animation"]');
      const captions = player.getByRole('region', { name: 'Narration', exact: true });
      await openPlayerSettings(player);
      await player.getByLabel('Caption size').selectOption({ label: '200%' });
      await player.getByRole('button', { name: 'Close settings' }).click();
      // Use a multiline spoken cue on a slide with a takeaway along its lower edge.
      const sceneIndex = story.scenes.findIndex(scene => scene.id === 'desirable-difficulties-embrace-the-struggle');
      const scene = story.scenes[sceneIndex];
      const beat = scene.essay_beats.find(beat => beat.signal);
      const cueIndex = beat.to - 1;
      await player.getByRole('slider', { name: 'Narration position' }).fill(String(timing.scenes[sceneIndex].cues[cueIndex].end - 0.3));
      await expect(captions).toHaveText(scene.cues[cueIndex].text);
      await expect(picture.contentFrame().getByText(beat.signal.text, { exact: true })).toBeVisible();

      async function expectClearPicture() {
        await expect(picture).toBeVisible();
        await expect(captions).toBeVisible();
        await expect.poll(async () => {
          const [art, cc] = await Promise.all([picture.boundingBox(), captions.boundingBox()]);
          if (!art || !cc) return false;
          // The phone may rotate the video surface within the portrait viewport.
          return art.y + art.height <= cc.y + 1 || cc.y + cc.height <= art.y + 1
            || art.x + art.width <= cc.x + 1 || cc.x + cc.width <= art.x + 1;
        }).toBe(true);
      }
      await expectClearPicture();
      await player.getByRole('button', { name: 'Enter full screen' }).click();
      await expectClearPicture();
      await player.getByRole('button', { name: 'Closed captions (CC)' }).click();
      await expect(captions).toBeHidden();
      await expect(picture).toBeInViewport({ ratio: 0.99 });
    });
  });
}

test.describe('article with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('the featured photo and standalone watch link are available', async ({ page }) => {
    await page.goto('/blog/evidence-based-study-tips-for-college-students/');
    await expect(page.getByRole('img', { name: /^Students working on a laptop/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play animated article', exact: true })).toBeHidden();
    await page.getByRole('link', { name: 'Watch the animated article' }).click();
    await expect(page.getByRole('link', { name: 'Read the original article' })).toBeVisible();
  });
});
