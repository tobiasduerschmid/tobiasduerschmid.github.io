// The printable notes of every video narration (docs/video-narration.md,
// "Printable notes"), checked on the page that the notes PDF is printed from.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');

const data = file => yaml.load(readFileSync(require.resolve(`../_data/${file}`), 'utf8'));
// Rendered text: emphasis markers gone, typographic apostrophes and quotes plain.
const plain = text => text.replace(/\*\*/g, '').replace(/[’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
// A Letter page inside the notes' print margins, at CSS's 96 pixels per inch.
const INCH = 96;
const LETTER = { width: (8.5 - 2 * 0.5) * INCH, height: (11 - 0.4 - 0.55) * INCH };

for (const [topic, lesson] of Object.entries(data('video_narrations.yml'))) {
  const story = data(`explainers/${topic}.yml`);
  const notes = data(`explainers/${topic}_notes.yml`);
  const cues = story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, cueIndex) => ({
    cue, points: notes[`${scene.id}-${cueIndex + 1}`], heading: `${sceneIndex + 1}.${cueIndex + 1} ${cue.step}`,
  })));
  const notesUrl = `${lesson.views}/notes/`;

  test(`${topic} notes: every cue's picture beside its key points`, async ({ page }) => {
    await page.goto(notesUrl);
    await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
    for (const { cue, points, heading } of cues) {
      const row = page.getByRole('region', { name: heading, exact: true });
      const picture = row.getByRole('img');
      await expect(picture).toHaveAttribute('alt', cue.visual);
      expect(await picture.evaluate(image => image.complete && image.naturalWidth > 0), `${heading}: picture loads`).toBe(true);
      expect((await row.getByRole('listitem').allTextContents()).map(plain), heading).toEqual(points.map(plain));
    }
    await a11yCheckpoint(page, `${topic} notes`, { feature: 'video-narration-notes' });
  });

  test(`${topic} notes: print keeps only the narration, three whole rows a page`, async ({ page }) => {
    await page.setViewportSize({ width: LETTER.width, height: 1000 });
    await page.goto(notesUrl);
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => {
      const title = document.querySelector('h1');
      const rows = [...document.querySelectorAll('h3')].map(heading => heading.closest('section'));
      // The narration is its title (with the line above it) and its cue rows.
      const narration = [title, title.previousElementSibling, ...rows];
      const strays = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        const shown = walker.currentNode.textContent.trim() && range.getClientRects().length > 0;
        if (shown && !narration.some(part => part.contains(walker.currentNode))) strays.push(walker.currentNode.textContent.trim().slice(0, 40));
      }
      const clipped = rows.filter((row) => {
        const bottom = row.getBoundingClientRect().bottom;
        return [...row.querySelectorAll('h2, h3, img, li')].some(part => part.getBoundingClientRect().bottom > bottom + 0.5);
      }).map(row => row.querySelector('h3').textContent);
      // The height a page must hold: the title and the first three rows, and
      // any three rows in a row (a margin at a page break is dropped).
      const top = element => element.getBoundingClientRect().top;
      const bottom = element => element.getBoundingClientRect().bottom;
      const spans = rows.slice(2).map((row, index) => bottom(row) - top(rows[index]));
      return { strays, clipped, firstPage: bottom(rows[2]) - top(title.parentElement), page: Math.max(...spans) };
    });
    expect(printed.strays, 'text outside the narration prints').toEqual([]);
    expect(printed.clipped, 'rows whose content runs past their edge').toEqual([]);
    expect(printed.firstPage).toBeLessThanOrEqual(LETTER.height);
    expect(printed.page).toBeLessThanOrEqual(LETTER.height);
  });

  test(`${topic}: the chapter links the notes and their PDF`, async ({ page, request }) => {
    await page.goto(lesson.chapter);
    const pdf = page.getByRole('link', { name: /^PDF, \d+ pages$/ });
    const response = await request.get(await pdf.getAttribute('href'));
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    await page.getByRole('link', { name: 'Lesson notes with pictures' }).click();
    await expect(page).toHaveURL(new RegExp(`${notesUrl}$`));
  });
}
