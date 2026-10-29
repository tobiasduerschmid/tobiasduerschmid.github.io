#!/usr/bin/env node
/* Renders the printable notes of a video narration (docs/video-narration.md,
   "Printable notes"): a still of every cue's picture at rest, then the notes
   page as a PDF, and a record of what they were rendered from.

     node scripts/render-video-narration-notes.js --topic scrum [--base-url http://127.0.0.1:4000]

   The base URL is a Jekyll server serving this checkout (make run). Run it
   whenever a source in notesSources() changes; the notes test fails until
   the record's fingerprint matches the sources again. */
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
// A still is the cue's resting pose, the same moment the stage audits check.
const REST_LEAD = 0.3;
const STILL = Object.freeze({ width: 960, height: 540, scale: 1.25, quality: 82 });
const SERVER_WAIT_MS = 180000;

const repoPath = (sitePath) => sitePath.replace(/^\//, '');
const readText = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function lessonOf(topic) {
  const lesson = yaml.load(readText('_data/video_narrations.yml'))[topic];
  if (!lesson) throw new Error(`No video narration named "${topic}" in _data/video_narrations.yml.`);
  return lesson;
}

/** Where a topic's notes live: the page, the record in _data, and the stills and PDF under assets. */
function notesPaths(topic) {
  const assets = `/assets/video-narration/${topic}`;
  return {
    page: `${repoPath(lessonOf(topic).views)}/notes.html`,
    record: `_data/explainers/${topic}_notes_render.json`,
    stills: `${assets}/slides`,
    pdf: `${assets}/${topic}-notes.pdf`,
  };
}

/** A cue's still, named as the stage names the cue: <scene id>-<cue number>. */
const stillName = (sceneId, cueNumber) => `${sceneId}-${cueNumber}.jpg`;

// The site files a layout links by literal path ('/css/…' or '/js/…').
function linkedAssets(layout) {
  return [...readText(layout).matchAll(/'(\/(?:css|js)\/[^']+\.(?:css|js))'/g)].map((match) => repoPath(match[1]));
}

/** Every file whose change can change the stills or the PDF, sorted. */
function notesSources(topic) {
  const { animation } = lessonOf(topic);
  return [...new Set([
    `_data/explainers/${topic}.yml`,
    `_data/explainers/${topic}_timing.json`,
    `_data/explainers/${topic}_notes.yml`,
    '_layouts/video-narration-stage.html',
    ...linkedAssets('_layouts/video-narration-stage.html'),
    ...animation.styles.map(repoPath),
    ...animation.scripts.map(repoPath),
    '_layouts/video-narration-notes.html',
    ...linkedAssets('_layouts/video-narration-notes.html'),
    '_includes/video-narration-notes.html',
    path.relative(ROOT, __filename),
  ])].sort();
}

/** One hash over the topic's registry entry and every notes source. */
function notesFingerprint(topic) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(lessonOf(topic)));
  for (const file of notesSources(topic)) hash.update(`\0${file}\0`).update(fs.readFileSync(path.join(ROOT, file)));
  return hash.digest('hex');
}

/** The number of pages in a PDF that Chromium wrote (it stores no object streams). */
function pdfPageCount(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  if (fallback === undefined) throw new Error(`Missing --${name}.`);
  return fallback;
}

// An incremental Jekyll server rebuilds a page when its file changes, not
// when only the _data it reads does, so touch the page first.
function rebuildPage(file) {
  if (!fs.existsSync(path.join(ROOT, file))) throw new Error(`${file} is missing; see "Printable notes" in docs/video-narration.md.`);
  const now = new Date();
  fs.utimesSync(path.join(ROOT, file), now, now);
}

// Loads `url` until `isCurrent` holds there, so a server still rebuilding
// after an edit is never captured.
async function openWhenCurrent(page, url, isCurrent, expected) {
  const deadline = Date.now() + SERVER_WAIT_MS;
  for (;;) {
    const response = await page.goto(url);
    if (response && response.ok() && await page.evaluate(isCurrent, expected)) return;
    if (Date.now() > deadline) throw new Error(`${url} did not show the current sources; is the server serving this checkout?`);
    await page.waitForTimeout(2000);
  }
}

async function renderStills(browser, topic, baseUrl) {
  const lesson = lessonOf(topic);
  const story = yaml.load(readText(`_data/explainers/${topic}.yml`));
  const timing = JSON.parse(readText(`_data/explainers/${topic}_timing.json`));
  const unanimated = story.scenes.filter((scene) => !scene.animation).map((scene) => scene.id);
  if (unanimated.length) throw new Error(`Notes stills come from the animated stage, but these scenes are not animated: ${unanimated.join(', ')}.`);

  const directory = path.join(ROOT, repoPath(notesPaths(topic).stills));
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  // A stage page with no host page draws in light mode, as print does.
  const page = await browser.newPage({ viewport: { width: STILL.width, height: STILL.height }, deviceScaleFactor: STILL.scale });
  rebuildPage(repoPath(lesson.animation.page));
  await openWhenCurrent(page, `${baseUrl}${lesson.animation.page}`,
    (source) => JSON.parse(document.getElementById('narration-timing').textContent).source_sha256 === source, timing.source_sha256);
  await page.evaluate(() => window.VideoNarrationStage.ready);
  for (const [sceneIndex, scene] of story.scenes.entries()) {
    for (const [cueIndex] of scene.cues.entries()) {
      const cue = timing.scenes[sceneIndex].cues[cueIndex];
      await page.evaluate((time) => window.VideoNarrationStage.seek(time), cue.end - REST_LEAD);
      await page.screenshot({ path: path.join(directory, stillName(scene.id, cueIndex + 1)), type: 'jpeg', quality: STILL.quality });
    }
  }
  await page.close();
}

async function renderPdf(browser, topic, baseUrl, fingerprint) {
  const lesson = lessonOf(topic);
  const story = yaml.load(readText(`_data/explainers/${topic}.yml`));
  const page = await browser.newPage();
  // Stills come straight from this checkout, never from a server that has
  // not copied the new ones yet.
  await page.route(/\/slides\/[^/?]+\.jpg(\?|$)/, (route) => {
    route.fulfill({ path: path.join(ROOT, repoPath(new URL(route.request().url()).pathname)) });
  });
  rebuildPage(notesPaths(topic).page);
  await openWhenCurrent(page, `${baseUrl}${lesson.views}/notes/`,
    (source) => document.querySelector('[data-notes-source]').dataset.notesSource === source, fingerprint);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  const footer = `<div style="width: 100%; padding: 0 0.5in; font: 9pt system-ui, sans-serif; color: #4a5566; display: flex; justify-content: space-between;">
    <span>${story.title.replace(/[<&]/g, '')} · Lesson notes</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  const pdf = await page.pdf({
    path: path.join(ROOT, repoPath(notesPaths(topic).pdf)),
    format: 'Letter',
    // The same margins as css/video-narration-notes.css's @page rule.
    margin: { top: '0.4in', right: '0.5in', bottom: '0.55in', left: '0.5in' },
    printBackground: true,
    tagged: true,
    outline: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer,
  });
  await page.close();
  return { pages: pdfPageCount(pdf), bytes: pdf.length };
}

function writeRecord(topic, record) {
  fs.writeFileSync(path.join(ROOT, notesPaths(topic).record), `${JSON.stringify(record, null, 2)}\n`);
}

async function main() {
  const { chromium } = require('@playwright/test');
  const { chromiumLaunchOptions } = require('./chromium-launch-options');
  const topic = argument('topic');
  const baseUrl = argument('base-url', 'http://127.0.0.1:4000').replace(/\/$/, '');
  const fingerprint = notesFingerprint(topic);
  const paths = notesPaths(topic);
  const stills = { directory: paths.stills, width: STILL.width * STILL.scale, height: STILL.height * STILL.scale };

  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    await renderStills(browser, topic, baseUrl);
    // The notes page shows the stills once the record names their fingerprint.
    writeRecord(topic, { source_sha256: fingerprint, stills });
    const pdf = await renderPdf(browser, topic, baseUrl, fingerprint);
    writeRecord(topic, { source_sha256: fingerprint, stills, pdf: { path: paths.pdf, ...pdf } });
    rebuildPage(paths.page);
    console.log(`Rendered ${topic} notes: ${pdf.pages} pages, ${(pdf.bytes / 1e6).toFixed(1)} MB.`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { notesSources, notesFingerprint, notesPaths, pdfPageCount, stillName };
