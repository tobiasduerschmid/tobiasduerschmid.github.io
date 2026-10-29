const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = yaml.load(readFileSync(require.resolve('../_data/explainers/scrum.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/scrum_quizzes.yml'), 'utf8'));
const lesson = yaml.load(readFileSync(require.resolve('../_data/video_narrations.yml'), 'utf8')).scrum;
const timing = require('../_data/explainers/scrum_timing.json');
const url = '/SEBook/process/scrum.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const questionsOf = id => (quizzes[id] ? quizzes[id].questions || [quizzes[id]] : []);
const shownPanels = (scene, cue) => cue.show || scene.show;
const cueTime = (sceneIndex, cueIndex, fraction = 0.5) => {
  const cue = timing.scenes[sceneIndex].cues[cueIndex];
  return cue.start + (cue.end - cue.start) * fraction;
};

async function seek(page, time) {
  const animation = player(page);
  await animation.getByRole('slider', { name: 'Narration position' }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}
async function theme(page, dark) {
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  if (await toggle.isChecked() !== dark) await toggle.press('Space');
  // Colors cross-fade between themes; measure contrast only once they have settled.
  await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== 'running'));
}
// WEBrick may answer a conditional MP3 range request with 304 instead of the
// bytes Chromium needs after seeking; drop validators from range requests.
async function serveAudioRanges(page) {
  await page.route(`**${story.audio}`, route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
}

test('each cue shows its panels on one screen named by the cue\'s visual', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
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

test('each scene names its part of Scrum', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: lesson.parts_label });
    if (!scene.part) {
      await expect(parts).toHaveCount(0);
      continue;
    }
    await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part);
  }
});

test('each part in the part strip jumps to the start of its first scene', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const position = animation.getByRole('slider', { name: 'Narration position' });
  await seek(page, cueTime(1, 0));
  for (const part of lesson.parts) {
    const index = story.scenes.findIndex(scene => scene.part === part);
    await animation.locator('.nja-scene:visible').getByRole('button', { name: `${part}: jump to its start` }).click();
    await expect(animation.getByRole('heading', { name: story.scenes[index].title, exact: true })).toBeVisible();
    await expect.poll(async () => Number(await position.inputValue())).toBeCloseTo(timing.scenes[index].start, 0);
  }
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

// Finds text that another piece's text overlaps, text that a piece drawn after
// it covers, and text outside the stage, in the pose the stage shows now.
function stageTextProblems() {
  const stageNode = document.getElementById('stage');
  const stage = stageNode.getBoundingClientRect();
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const pieceOf = (node) => {
    let n = node;
    while (n.parentElement && !n.parentElement.matches('.scene, .sk-body')) n = n.parentElement;
    return n.parentElement ? n : null;
  };
  const texts = [];
  const walker = document.createTreeWalker(stageNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const piece = node.textContent.trim() && shown(node.parentElement) && pieceOf(node.parentElement);
    if (!piece) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const box of range.getClientRects()) {
      if (box.width > 2 && box.height > 2) texts.push({ piece, text: node.textContent.trim().slice(0, 28), box });
    }
  }
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const painted = (piece) => {
    const style = getComputedStyle(piece);
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || [...piece.querySelectorAll('*')].some(shown);
  };
  const problems = new Set();
  texts.forEach((a, i) => {
    if (a.box.left < stage.left - 2 || a.box.right > stage.right + 2 || a.box.top < stage.top - 2 || a.box.bottom > stage.bottom + 2) problems.add(`off stage: ${a.text}`);
    for (const b of texts.slice(i + 1)) {
      if (a.piece !== b.piece && !a.piece.contains(b.piece) && !b.piece.contains(a.piece) && overlap(a.box, b.box) > 30) problems.add(`text on text: ${a.text} / ${b.text}`);
    }
  });
  for (const scene of stageNode.querySelectorAll('.scene')) {
    if (!shown(scene)) continue;
    const pieces = [...scene.children].flatMap((child) => (child.matches('.sk-body') ? [...child.children] : [child])).filter((piece) => shown(piece) && painted(piece) && !piece.matches('.confetti-layer, .sk-overlay'));
    pieces.forEach((cover, i) => {
      const box = cover.getBoundingClientRect();
      for (const t of texts) {
        const index = pieces.indexOf(t.piece);
        // Even one hidden letter counts; the floor ignores the empty corner of a
        // rotated sticker's bounding box.
        if (index >= 0 && index < i && overlap(t.box, box) > Math.max(30, 0.04 * t.box.width * t.box.height)) problems.add(`covered: ${t.text} by ${cover.className}`);
      }
    });
  }
  return [...problems];
}

// Finds painted boxes (cards, badges, notes, panels, chips, days) closer than
// a small gap to another box without one containing the other, in the pose
// the stage shows now. Stickers, stamps, arrows, and structures built from
// touching parts (a temple, a balance, a loop) sit over or against artwork
// on purpose and are left out.
function crowdedBoxes() {
  const GAP = 4;
  const SKIPPED = '.sticker, .stamp, .kinetic, .confetti-layer, .sk-overlay, .sk-arrow, .sk-bracket, .sk-frame, .sk-slot, .sk-loop, .sk-loop-dot, .sk-loop-label, .sk-dot, .sk-wave, .sk-ball, .sk-person, .sk-roof, .sk-base, .sk-pillar, .sk-balance-post, .sk-balance-beam, .sk-topic';
  const stageNode = document.getElementById('stage');
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const painted = (node) => {
    const style = getComputedStyle(node);
    return style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0;
  };
  const name = (node) => `${node.classList[0]} "${node.textContent.trim().slice(0, 20)}"`;
  const crowded = [];
  for (const scene of stageNode.querySelectorAll('.scene')) {
    if (!shown(scene)) continue;
    const boxes = [...scene.children].flatMap((child) => (child.matches('.sk-body') ? [...child.children] : [child]))
      .filter((piece) => !piece.matches(SKIPPED) && shown(piece) && painted(piece))
      .map((piece) => ({ piece, box: piece.getBoundingClientRect() }));
    boxes.forEach((a, i) => {
      for (const b of boxes.slice(i + 1)) {
        const inside = (outer, inner) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1 && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
        if (inside(a.box, b.box) || inside(b.box, a.box)) continue;
        const dx = Math.max(b.box.left - a.box.right, a.box.left - b.box.right);
        const dy = Math.max(b.box.top - a.box.bottom, a.box.top - b.box.bottom);
        if (dx < GAP && dy < GAP) crowded.push(`${name(a.piece)} / ${name(b.piece)}`);
      }
    });
  }
  return crowded;
}
// END crowdedBoxes

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

// Finds stage text below 4.5:1 against what is painted behind it, in the pose
// the stage shows now. A translucent fill is blended over the wall's color; a
// gradient counts as its first color stop.
function stageContrastProblems() {
  const stageNode = document.getElementById('stage');
  const parse = (value) => (value.match(/rgba?\(([^)]+)\)/) || [])[1]?.split(',').map(Number);
  // The wall's own color, from the stage's --bg token.
  const wall = (() => {
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(stageNode).getPropertyValue('--bg');
    stageNode.append(probe);
    const color = parse(getComputedStyle(probe).color);
    probe.remove();
    return color;
  })();
  const luminance = ([r, g, b]) => [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const over = (top, bottom) => {
    const alpha = top[3] ?? 1;
    return [0, 1, 2].map((i) => top[i] * alpha + bottom[i] * (1 - alpha));
  };
  const shown = (node) => {
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const behind = (node) => {
    const fills = [];
    for (let n = node; n && n !== stageNode; n = n.parentElement) {
      const style = getComputedStyle(n);
      // The bottom gradient layer is the fill; a layer with transparent stops is only marks on top.
      const layers = style.backgroundImage.split(/,\s*(?=(?:linear|radial|repeating)-gradient)/);
      const base = layers[layers.length - 1];
      const image = base.includes('gradient') && !base.includes('rgba(0, 0, 0, 0)') ? parse(base) : null;
      const color = parse(style.backgroundColor);
      const fill = image || (color && (color[3] ?? 1) > 0 ? color : null);
      if (fill) {
        fills.push(fill);
        if ((fill[3] ?? 1) >= 1) break;
      }
    }
    return fills.reduceRight((under, fill) => over(fill, under), wall);
  };
  const problems = new Set();
  const walker = document.createTreeWalker(stageNode, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const element = node.parentElement;
    if (!node.textContent.trim() || !shown(element) || element.closest('.confetti-layer')) continue;
    const text = over(parse(getComputedStyle(element).color), behind(element));
    const [light, dark] = [luminance(text), luminance(behind(element))].sort((a, b) => b - a);
    const ratio = (light + 0.05) / (dark + 0.05);
    if (ratio < 4.5) problems.add(`${node.textContent.trim().slice(0, 28)}: ${ratio.toFixed(2)}`);
  }
  return [...problems];
}

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

// Every stage element's painted colors, in document order: what the viewer
// sees, without the pixel noise a GPU-rasterized screenshot carries.
function stagePaint() {
  const props = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'outlineColor', 'fill', 'stroke'];
  return [...document.querySelectorAll('#stage *')].map((node, index) => {
    const style = getComputedStyle(node);
    return `${index} ${node.getAttribute('class') || node.tagName}: ${props.map((prop) => style[prop]).join(' ')}`;
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
      const crowded = (await page.evaluate(crowdedBoxes)).filter((pair) => !(intended[id] && intended[id].test(pair)));
      if (crowded.length) found[id] = crowded;
    }
  }
  expect(found).toEqual({});
});

test('narration stops inside the silence before each check, and a section without one plays on', async ({ page }) => {
  test.setTimeout(240000);
  await serveAudioRanges(page);
  await page.addInitScript(() => {
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function recordPause() {
      if (window.pausedAt === null) window.pausedAt = this.currentTime;
      return pause.call(this);
    };
  });
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    const end = timing.scenes[index].end;
    await seek(page, end - 0.9);
    await page.evaluate(() => { window.pausedAt = null; });
    await animation.getByRole('button', { name: 'Play narration' }).click();
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
    await expect(quiz).toBeVisible();
    expect(await page.evaluate(() => window.pausedAt), `${scene.id}: stops before the next section's speech`).toBeLessThan(end - 0.1);
    expect(await animation.locator('audio').evaluate(audio => audio.paused)).toBe(true);
    for (const question of questions) {
      await expect(quiz.getByText(question.question, { exact: true })).toBeVisible();
      await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
      await expect(quiz.getByText(question.explanation, { exact: true })).toBeVisible();
      if (question !== questions.at(-1)) await quiz.getByRole('button', { name: /^Next/ }).click();
    }
    await quiz.getByRole('button', { name: 'See Results' }).click();
    await quiz.getByRole('button', { name: index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review' }).click();
    await expect(quiz).toBeHidden();
    if (index + 1 < story.scenes.length) {
      await animation.getByRole('button', { name: 'Pause narration' }).click();
      await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
    }
  }
});

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

  // Escape closes the settings and returns focus to their button.
  await animation.getByRole('combobox', { name: 'Speed' }).focus();
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
  await serveAudioRanges(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  const animation = player(page);
  const video = animation.locator('[data-vn-video]');
  await animation.getByRole('button', { name: 'Enter full screen' }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement && document.fullscreenElement.matches('[data-vn-video]'))).toBe(true);
  const box = await video.boundingBox();
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([1280, 800]);
  // The picture letterboxes at 16:9, above captions and controls, and the
  // scene's header stays in view beside it, using the width a 16:10 screen spares.
  const picture = await animation.locator('[data-vn-panel="animation"]').boundingBox();
  expect(picture.width / picture.height).toBeCloseTo(16 / 9, 1);
  const controls = animation.locator('.vn-controls');
  expect(picture.y + picture.height).toBeLessThanOrEqual((await controls.boundingBox()).y);
  const heading = animation.getByRole('heading', { name: story.scenes[0].title, exact: true });
  await expect(heading).toBeVisible();
  expect((await heading.boundingBox()).x + (await heading.boundingBox()).width).toBeLessThanOrEqual(picture.x);
  expect(picture.width).toBeGreaterThan(1280 * 0.7);

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

test('full screen on a phone keeps the picture large, with the header and captions beside it', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(url);
  const animation = player(page);
  await animation.getByRole('button', { name: 'Enter full screen' }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  const picture = await animation.locator('[data-vn-panel="animation"]').boundingBox();
  const controls = await animation.locator('.vn-controls').boundingBox();
  expect(picture.height).toBeGreaterThan(390 * 0.55);
  expect(picture.y + picture.height).toBeLessThanOrEqual(controls.y + 1);
  const heading = await animation.getByRole('heading', { name: story.scenes[0].title, exact: true }).boundingBox();
  const captions = await animation.getByRole('region', { name: 'Narration', exact: true }).boundingBox();
  for (const side of [heading, captions]) expect(side.x + side.width).toBeLessThanOrEqual(picture.x + 1);
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
  await expect(animation.getByRole('heading', { name: story.scenes[0].title, exact: true })).toBeInViewport();
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
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
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
