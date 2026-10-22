// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const song = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/let_the_object_decide.yml'), 'utf8'));
const lines = new Map(song.sections.flatMap(section => section.lines).map(line => [line.id, line]));

// The absolute-time renderer is shared with the offline exporter. Inspect
// painted text (including ancestor opacity), since the artwork is aria-hidden
// and its equivalent accessible descriptions live outside the picture.
async function paintedText(page, text) {
  return page.getByTestId('song-picture').getByText(text, { exact: true }).evaluateAll(nodes => nodes.flatMap(node => {
    let opacity = 1;
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      opacity *= Number(style.opacity);
    }
    if (opacity < 0.95) return [];
    const rect = node.getBoundingClientRect();
    return [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
  }));
}

async function pose(page, time) {
  await page.evaluate(time => window.Timeline.seek(time), time);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/assets/song-player/let-the-object-decide.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
});

test('OOP renderer-only: a delivered message remains still and readable before disappearing', async ({ page }) => {
  const sent = lines.get('chorus-1-3').marks.send;
  await pose(page, sent + 0.85);
  const landed = await paintedText(page, 'brake()');
  // One method label and one message label; neither may fade during the hold.
  expect(landed).toHaveLength(2);
  await pose(page, sent + 1.8);
  expect(await paintedText(page, 'brake()')).toEqual(landed);
  await pose(page, sent + 2.3);
  expect(await paintedText(page, 'brake()')).toHaveLength(1);
  await pose(page, sent + 0.85);
  expect(await paintedText(page, 'brake()')).toEqual(landed);
});

test('OOP renderer-only: the Liskov attribution holds through the explanation and survives seeking', async ({ page }) => {
  const explanation = lines.get('bridge-10').start;
  for (const time of [explanation + 0.5, explanation + 2, explanation + 3.5, 20, explanation + 2]) {
    await pose(page, time);
    expect(await paintedText(page, 'Barbara Liskov')).toHaveLength(time === 20 ? 0 : 1);
  }
});

for (const dark of [false, true]) {
  test(`OOP renderer-only: teaching labels fit above captions in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    const picture = await page.getByTestId('song-picture').boundingBox();
    const scale = picture.width / 960;
    const samples = [
      [lines.get('intro-10').start + 0.5, 'Feature request: ambulances'],
      [lines.get('bridge-14').marks.delegate + 0.5, 'keep the promise'],
      [lines.get('verse-2-8').start + 0.6, 'HybridCar::brake'],
      [lines.get('quiz-2').answer_at + 0.7, 'top()'],
      [lines.get('final-chorus-2-8').marks.let + 0.6, 'use where it fits'],
    ];
    for (const [time, label] of samples) {
      await pose(page, time);
      const painted = await paintedText(page, label);
      expect(painted, label).toHaveLength(1);
      const box = painted[0];
      expect(box.x, label).toBeGreaterThanOrEqual(picture.x);
      expect(box.x + box.width, label).toBeLessThanOrEqual(picture.x + picture.width);
      expect(box.y + box.height, `${label} must clear the caption area`).toBeLessThanOrEqual(picture.y + 460 * scale);
    }
  });
}
