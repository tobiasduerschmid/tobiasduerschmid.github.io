// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

// "Meet Me One Level Up" as the live player draws it: the AI coding agent
// (js/song-video/coding-agent.js) sings in a library while it trains and in
// an office once it works (js/song-video/agent-campus.js), and the teaching
// pictures (js/song-video/agent-kit.js) tell each example in full.

const PLAYER = '/assets/song-player/meet-me-one-level-up.html';

// Times come from the storyboard's sung words, so a re-recorded take moves
// the checks with the choreography instead of silently testing other scenes.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/meet_me_one_level_up.yml'), 'utf8'));
const sections = new Map(storyboard.sections.map((section) => [section.id, section]));
const lines = storyboard.sections.flatMap((section) => section.lines);
const CHORUSES = ['chorus-1', 'chorus-2', 'chorus-3', 'final-chorus'];
const INFERENCE = sections.get('verse-3').lines[0].start;

async function seek(page, seconds) {
  await page.evaluate((time) => window.Timeline.seek(time), seconds);
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('the agent trains in the library and works in the office from verse 3', async ({ page }) => {
  const room = async () => page.evaluate(() => ({
    library: Number(getComputedStyle(document.querySelector('[data-testid="campus-library"]')).opacity),
    office: Number(getComputedStyle(document.querySelector('[data-testid="campus-office"]')).opacity),
  }));
  for (const time of [1, sections.get('verse-2').lines[0].start, INFERENCE - 2]) {
    await seek(page, time);
    expect(await room(), `the library at ${time}s`).toEqual({ library: 1, office: 0 });
  }
  for (const time of [INFERENCE + 2, sections.get('bridge').lines[0].start, storyboard.duration - 1]) {
    await seek(page, time);
    expect((await room()).office, `the office at ${time}s`).toBe(1);
  }
  // Seeking back restores the library exactly.
  await seek(page, 5);
  expect(await room()).toEqual({ library: 1, office: 0 });
});

test('the chorus is the same picture every time', async ({ page }) => {
  const pictures = [];
  for (const id of CHORUSES) {
    const [last] = sections.get(id).lines.slice(-1);
    await seek(page, last.end - 0.4);
    const levels = page.locator('.ak-levels');
    await expect(levels, `${id} shows the two levels`).toBeVisible();
    pictures.push(await levels.locator('.ak-levels-card, .ak-levels-floor-name').allInnerTexts());
  }
  for (const picture of pictures.slice(1)) expect(picture).toEqual(pictures[0]);
  expect(pictures[0].join(' ')).toMatch(/Requirements[\s\S]*Design[\s\S]*Tests/);
});

// Where a picture sits on the 960 × 540 stage, whatever size the player draws it.
async function stageBox(locator) {
  return locator.evaluate((node) => {
    const stage = document.querySelector('[data-testid="song-picture"] .stage');
    const S = stage.getBoundingClientRect();
    const scale = S.width / 960;
    const r = node.getBoundingClientRect();
    return { top: (r.top - S.top) / scale, bottom: (r.bottom - S.top) / scale };
  });
}

test('your hero rises with the agent on "meet me one level up"', async ({ page }) => {
  const hero = page.getByTestId('song-student-avatar');
  const agent = page.getByTestId('coding-agent');
  for (const id of ['c1-1', 'c2-1', 'c3-1', 'fc-1', 'outro-3']) {
    const { marks } = lines.find((line) => line.id === id);
    await seek(page, marks.meet + 0.05);
    await expect(hero, `${id}: your hero is there when "meet" is sung`).toBeVisible();
    const below = await stageBox(hero);
    await seek(page, marks.up + 0.6);
    await expect(hero).toBeVisible();
    const above = await stageBox(hero);
    expect(above.top, `${id}: your hero goes one level up`).toBeLessThan(below.top - 100);
    // …to the agent's level: the hero's laptop rests where the agent hovers.
    expect(Math.abs(above.bottom - (await stageBox(agent)).bottom), `${id}: your hero meets the agent there`).toBeLessThan(40);
  }
});

// The captions carry the sung words, so a label is worth its reading time
// only if it stays up for it: 1.5 s at least, and 0.6 s to find it plus
// 3 words a second (about 180 words a minute) to read it.
test('every label stays up long enough to read', async ({ page }) => {
  test.setTimeout(180_000);
  const STEP = 0.2;
  const spans = await page.evaluate(({ step, end }) => {
    const stage = document.querySelector('[data-testid="song-picture"] .stage');
    const opacity = (node) => {
      let o = 1;
      for (let n = node; n && n !== stage; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
        o *= Number(cs.opacity);
      }
      return o;
    };
    const seen = new Map();
    for (let t = 0; t <= end; t += step) {
      window.Timeline.seek(t);
      for (const node of stage.querySelectorAll('.ak-pill, .ak-bubble')) {
        if (opacity(node) < 0.6) continue;
        const span = seen.get(node) || { text: node.innerText.trim().replace(/\s+/g, ' '), first: t, last: t };
        span.last = t;
        seen.set(node, span);
      }
    }
    return [...seen.values()];
  }, { step: STEP, end: storyboard.duration });
  expect(spans.length, 'the song shows its labels').toBeGreaterThan(40);
  const tooShort = spans
    .filter(({ text, first, last }) => last - first + STEP < Math.max(1.5, 0.6 + text.split(' ').length / 3))
    .map(({ text, first, last }) => `"${text}" at ${first.toFixed(1)}s for ${(last - first + STEP).toFixed(1)}s`);
  expect(tooShort).toEqual([]);
});

test('each quiz answer stays hidden until it is sung', async ({ page }) => {
  const quiz = sections.get('quiz').lines;
  for (const [index, line] of quiz.entries()) {
    const card = page.locator('.ak-quiz').filter({ hasText: `Quiz ${index + 1} / ${quiz.length}` });
    const answer = card.locator('.ak-quiz-answer');
    await seek(page, line.pause_at - 0.05);
    await expect(card).toBeVisible();
    expect(await answer.evaluate((node) => Number(getComputedStyle(node).opacity)), `answer ${index + 1} before it is sung`).toBe(0);
    await seek(page, line.answer_at + 0.6);
    expect(await answer.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(1);
    await expect(answer).toHaveText(line.answer);
  }
});

test('no readable text is covered when a line has settled', async ({ page }) => {
  const problems = [];
  for (const line of lines) {
    const time = Math.max(line.start + 0.6, line.end - 0.35);
    await seek(page, time);
    const found = await page.evaluate(() => {
      const stage = document.querySelector('[data-testid="song-picture"] .stage') || document.querySelector('.stage');
      const S = stage.getBoundingClientRect();
      const scale = S.width / 960;
      const local = (r) => ({ l: (r.left - S.left) / scale, t: (r.top - S.top) / scale, r: (r.right - S.left) / scale, b: (r.bottom - S.top) / scale });
      const hit = (a, b, pad) => a.l < b.r - pad && b.l < a.r - pad && a.t < b.b - pad && b.t < a.b - pad;
      const opacity = (node) => {
        let o = 1;
        for (let n = node; n && n !== stage; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
          o *= Number(cs.opacity);
        }
        return o;
      };
      const PICTURE = '.ak-card, .ak-pill, .ak-bubble, .ak-mark, .ak-test, .ak-number-line, .ak-ladder-level, .ak-weights, .quiz-card, .badge, .ak-phases, .ak-levels-card, .ak-levels-code, .ak-levels-guess, .ak-levels-sure, .ak-levels-pin';
      const texts = [];
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const owner = node.parentElement;
        if (!node.textContent.trim() || !owner || owner.closest('.song-student-avatar') || opacity(owner) < 0.95) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].map(local).filter((r) => r.r - r.l > 1 && r.b - r.t > 1);
        if (rects.length) texts.push({ owner, rects, picture: owner.closest(PICTURE) || owner, text: node.textContent.trim() });
      }
      const pictures = [...stage.querySelectorAll(PICTURE)].filter((node) => opacity(node) >= 0.95);
      const out = [];
      for (const a of texts) {
        if (a.rects.some((r) => r.b > 462)) out.push(`"${a.text}" reaches into the captions`);
        for (const b of texts) {
          if (a === b || a.picture === b.picture) continue;
          if (a.rects.some((ra) => b.rects.some((rb) => hit(ra, rb, 1)))) out.push(`"${a.text}" overlaps "${b.text}"`);
        }
        for (const p of pictures) {
          const later = a.owner.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING;
          if (!later || p.contains(a.owner) || a.picture.contains(p)) continue;
          if (a.rects.some((r) => hit(r, local(p.getBoundingClientRect()), 2))) out.push(`"${a.text}" is covered by ${p.className.split(' ')[0]}`);
        }
      }
      return out;
    });
    for (const problem of found) problems.push(`${line.id} @${time.toFixed(2)}s: ${problem}`);
  }
  expect(problems).toEqual([]);
});
