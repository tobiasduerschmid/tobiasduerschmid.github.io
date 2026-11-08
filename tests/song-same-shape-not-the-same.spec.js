// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

// "Same Shape, Not the Same" as the live player draws it: the marquee over
// the stage names the pattern of every verse, the pop quiz keeps all six
// answers on screen for every question, lighting the right one on its
// answer, and the intern is the viewer's own SE Gym hero.

const PLAYER = '/assets/song-player/same-shape-not-the-same.html';

// Times come from the storyboard, so a re-timed take moves the checks with
// the choreography instead of silently testing other scenes.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/same_shape_not_the_same.yml'), 'utf8'));
const sections = new Map(storyboard.sections.map((section) => [section.id, section]));
const middle = ({ start, end }) => (start + end) / 2;

const VERSES = [
  ['strategy', 'Strategy'], ['state', 'State'], ['adapter', 'Adapter'],
  ['facade', 'Façade'], ['observer', 'Observer'], ['mediator', 'Mediator'],
];
const OPTIONS = ['Strategy', 'State', 'Adapter', 'Façade', 'Observer', 'Mediator'];
const ANSWERS = [
  ['Adapter', 'Make it fit'], ['State', 'Depends where it’s at'], ['Observer', 'Ping the list'],
  ['Strategy', 'One job, a few ways'], ['Mediator', 'Rules in one hub'], ['Façade', 'A shortcut in'],
];

// Timeline.seek is the live player's public deterministic-frame API; the
// artwork has no interactive role, so stable test IDs name what is checked.
async function seek(page, seconds) {
  await page.evaluate((time) => window.Timeline.seek(time), seconds);
}

async function open(page) {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
}

for (const [sectionId, name] of VERSES) {
  test(`the marquee names ${name} through every line of its verse`, async ({ page }) => {
    await open(page);
    for (const line of sections.get(sectionId).lines) {
      await seek(page, middle(line));
      await expect(page.getByTestId('song-marquee'), `line ${line.id}`).toHaveText(name);
    }
  });
}

test('every quiz question shows all six answers, and lights the right one on its answer', async ({ page }) => {
  await open(page);
  const questions = sections.get('quiz').lines;
  expect(questions).toHaveLength(ANSWERS.length);
  const options = page.getByTestId('song-quiz-option');
  for (const [i, question] of questions.entries()) {
    const [answer, reason] = ANSWERS[i];
    // While the question is asked, before its answer: every option, none lit.
    await seek(page, (question.start + question.pause_at) / 2);
    await expect(options, question.id).toHaveText(OPTIONS);
    for (const option of await options.all()) await expect(option, question.id).toHaveCSS('opacity', '1');
    await expect(options.filter({ hasText: reason }), question.id).toHaveCount(0);
    // After the answer: still all six, with the answer's reason under it alone.
    await seek(page, question.answer_at + 0.6);
    await expect(options, question.id).toHaveText(OPTIONS.map((option) => (option === answer ? `${option}${reason}` : option)));
  }
});

const suit = '#BD1F6E';
const savedHero = (kind) => ({
  version: 1, kind,
  appearance: {
    skin: '#35241f', hairColor: '#66418c', eyebrowColor: '#3d2818', facialHairColor: '#b7bdc8',
    hairStyle: 'locs', eyeColor: '#3a5a7a', eyebrowStyle: 'arched', headStyle: 'broad',
    eyeShape: 'round', earShape: 'oval', eyelashStyle: 'none', noseShape: 'soft',
    mouthStyle: 'smile', blushStyle: 'natural', facialHair: 'none', faceFeature: 'none',
  },
  body: { type: 'average' },
  outfit: { style: 'hoodie', suit, capeOuter: '#5a158f', capeInner: '#FFD100', accessory: 'none', accessories: [], emblem: '' },
});
async function openAs(page, hero) {
  await page.addInitScript((saved) => localStorage.setItem('se-gym-hero-avatar', JSON.stringify(saved)), hero);
  await open(page);
}
const introLine = (n) => sections.get('intro').lines[n - 1];

test('the intern wears the saved SE Gym hero: their face and their outfit colour', async ({ page }) => {
  await openAs(page, savedHero('human'));
  // "Internship, week one": the intern is alone on stage.
  await seek(page, middle(sections.get('intro').lines[0]));
  const intern = page.getByTestId('oc-hero');
  await expect(intern.getByTestId('song-hero-head')).toHaveCount(1);
  await expect(intern).toHaveCSS('--oc-cloth', suit);
});

test('the Prof hero, as the intern, opens their mouth on the intern\'s words and closes it for the lead\'s', async ({ page }) => {
  await openAs(page, savedHero('tobias'));
  const intern = page.getByTestId('oc-hero');
  const food = introLine(1).marks.food + 0.1;
  await seek(page, food);
  // The worn head arrives after the first frame, so draw the moment again.
  await expect(intern.getByTestId('song-hero-head')).toHaveAttribute('data-hero-kind', 'tobias');
  await seek(page, food);
  const singing = intern.locator('.song-hero-singing-mouth');
  await expect(singing, '"food", the intern speaking').toBeVisible();
  await seek(page, introLine(5).marks.state + 0.1);
  await expect(singing, '"That\'s State", the lead speaking').toBeHidden();
});

// Routing ArchUML's connectors in the browser held the player's first frame
// back by over a second, so the build draws every view the storyboard lists.
test('the player page carries a drawing of every diagram in the storyboard', async ({ request }) => {
  const html = await (await request.get(PLAYER)).text();
  const data = html.match(/<script type="application\/json" id="song-diagrams">([\s\S]*?)<\/script>/);
  expect(data, 'the song-diagrams data block').not.toBeNull();
  const drawn = JSON.parse(data[1]);
  const views = Object.values(storyboard.diagrams);
  expect(drawn.map(({ kind, spec }) => ({ kind, spec }))).toEqual(views.map(({ kind, spec }) => ({ kind, spec })));
  for (const { spec, svg } of drawn) expect(svg, spec).toMatch(/^<svg[\s>]/);
});
