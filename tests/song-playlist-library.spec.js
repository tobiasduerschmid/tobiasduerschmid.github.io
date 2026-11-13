const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const songsDir = path.join(__dirname, '../_data/songs');
const catalogSize = fs.readdirSync(songsDir).filter(name => name.endsWith('.yml'))
  .map(name => yaml.load(fs.readFileSync(path.join(songsDir, name), 'utf8')))
  .filter(song => song.player).length;
const playlist = '/SEBook/playlist.html';
const queue = page => page.getByRole('list', { name: 'Your playlist', exact: true });
const library = page => page.getByRole('region', { name: 'Video library', exact: true });
const cards = page => library(page).getByRole('listitem');

async function createPlaylist(page, name) {
  await page.getByRole('button', { name: 'New playlist', exact: true }).click();
  await page.getByLabel('Playlist name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create playlist', exact: true }).click();
}
async function options(page) { await page.getByLabel('Playlist options', { exact: true }).click(); }

test('all videos remain available, with intersecting category and search filters', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(playlist);
  await expect(cards(page)).toHaveCount(catalogSize);
  await page.getByRole('button', { name: 'Tools & systems', exact: true }).click();
  await expect(cards(page)).toHaveCount(3);
  await page.getByRole('searchbox', { name: 'Search videos' }).fill('Git');
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page)).toContainText('Snapshots and Pointers');
  await page.getByRole('button', { name: 'Teamwork', exact: true }).click();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No videos found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(cards(page)).toHaveCount(catalogSize);
  expect(errors).toEqual([]);
});

test('new playlists preserve the old queue, support names, switching, deletion and Undo', async ({ page, context, baseURL }) => {
  await page.goto(playlist);
  await page.evaluate(() => localStorage.setItem('song-player-playlist', JSON.stringify({ version: 1, songs: ['unbox_the_stack', 'always_code'] })));
  await page.reload();
  await expect(queue(page).getByRole('listitem')).toHaveCount(2);
  const originalName = await page.getByRole('combobox', { name: 'Current playlist' }).locator('option:checked').textContent();
  await createPlaylist(page, 'Exam review');
  await expect(queue(page).getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('#playlist-frame')).toBeHidden();
  await page.getByRole('button', { name: /^Add to playlist\s*: Always Code/ }).click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  const frame = page.locator('#playlist-frame').contentFrame();
  await expect(frame.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Current playlist' }).selectOption({ label: originalName });
  await expect(queue(page).getByRole('listitem')).toHaveCount(2);
  await expect(queue(page).getByRole('listitem').first()).toContainText('Unbox the Stack');
  await page.reload();
  await page.getByRole('combobox', { name: 'Current playlist' }).selectOption({ label: 'Exam review' });
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  await options(page);
  await page.getByRole('button', { name: 'Rename playlist' }).click();
  await page.getByLabel('Playlist name', { exact: true }).fill('Final review');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('combobox', { name: 'Current playlist' }).locator('option:checked')).toHaveText('Final review');
  await options(page);
  await page.getByRole('button', { name: 'Delete playlist' }).click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo change' }).click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Current playlist' }).locator('option:checked')).toHaveText('Final review');
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  // A second tab receives changes without starting playback.
  const other = await context.newPage();
  await other.goto(new URL(playlist, baseURL).href);
  await createPlaylist(page, 'Second tab');
  await expect(other.getByRole('combobox', { name: 'Current playlist' }).locator('option:checked')).toHaveText('Second tab');
  await expect(other.locator('#playlist-frame')).toBeHidden();
});

test('playlist dialogs validate names, cancel with Escape, and restore keyboard focus', async ({ page }) => {
  await page.goto(playlist);
  await createPlaylist(page, 'Review');
  const newButton = page.getByRole('button', { name: 'New playlist', exact: true });
  await newButton.click();
  await page.getByLabel('Playlist name', { exact: true }).fill(' Review ');
  await page.getByRole('button', { name: 'Create playlist' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await a11yCheckpoint(page, 'new playlist dialog', { feature: 'song-playlist', include: '#song-playlist' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(newButton).toBeFocused();
  await options(page);
  await page.getByRole('button', { name: 'Rename playlist' }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Playlist options', { exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Rename playlist' })).toBeHidden();
});


test('playing a library video adds it once and opens the main player', async ({ page }) => {
  await page.goto(playlist);
  await createPlaylist(page, 'Listen now');
  const preview = library(page).getByRole('link', { name: 'Play: Always Code: clean-design karaoke', exact: true });
  await preview.click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  const frame = page.locator('#playlist-frame').contentFrame();
  const audio = frame.getByLabel('Always Code: clean-design karaoke audio', { exact: true });
  await expect.poll(() => audio.evaluate(media => media.currentTime)).toBeGreaterThan(0);
  await frame.getByRole('button', { name: 'Pause song', exact: true }).click();
  await preview.click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(1);
  await expect(audio).toHaveJSProperty('paused', false);
});
