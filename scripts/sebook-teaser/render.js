/**
 * Renders the SE Book teaser from the storyboard in _data/sebook_teaser.yml —
 * the same file the /SEBook/ transcript is built from, so re-render whenever
 * its text or timing changes:
 *
 *   node scripts/sebook-teaser/render.js [--frames-dir DIR]
 *
 * Outputs (paths from the storyboard):
 *   video               instrumental cut (H.264 + AAC music)
 *   described_video     audio-described cut: same picture, narration over
 *                       ducked music (WCAG 1.2.5)
 *   captions            WebVTT captions of the music
 *   described_captions  WebVTT captions of the narration and music
 *   poster              JPEG of the frame at poster_time
 *
 * Pipeline: serve the repo root on loopback → open stage.html in headless
 * Chromium → seek + screenshot every frame and read the stage's sound cues →
 * screen the frames for flashing (check-flashes.swift, WCAG 2.3.1; a failure
 * stops the render) → score the soundtrack against the cues
 * (audio/soundtrack.js) and voice the narration (audio/narration.js) →
 * encode both cuts with encode-mp4.swift.
 *
 * Needs macOS (Swift/AVFoundation for encoding, `say` for the narration
 * voice), Playwright's Chromium (`npx playwright install chromium`), and
 * network access for the stage's Google Fonts. `--frames-dir` keeps the PNG
 * frames and WAV mixes for inspection; otherwise they go to a temp directory
 * that is deleted afterwards.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { chromium } = require('playwright');
const { startLocalSiteServer } = require('../local-site-server');
const { writeWav } = require('./audio/dsp');
const { renderMusic, master, mixDescribed } = require('./audio/soundtrack');
const { renderNarration } = require('./audio/narration');
const { instrumentalCaptions, describedCaptions } = require('./captions');

const ROOT = path.resolve(__dirname, '..', '..');
const STORYBOARD_FILE = path.join(ROOT, '_data', 'sebook_teaser.yml');
const STAGE_URL_PATH = '/scripts/sebook-teaser/stage.html';
const ENCODER = path.join(__dirname, 'encode-mp4.swift');
const FLASH_CHECK = path.join(__dirname, 'check-flashes.swift');
// At 2 Mbit/s VideoToolbox's H.264 is visually lossless at page size and only
// shows faint halos at 1:1 in the busiest (shaking) frames; 20 s ≈ 4.7 MB.
const VIDEO_BITS_PER_SECOND = 2_000_000;
const POSTER_JPEG_QUALITY = 82;

function parseArgs(argv) {
  const args = { framesDir: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--frames-dir' && argv[i + 1]) args.framesDir = path.resolve(argv[++i]);
    else throw new Error(`Unknown argument "${argv[i]}". Usage: node scripts/sebook-teaser/render.js [--frames-dir DIR]`);
  }
  return args;
}

/** Maps a site URL path from the storyboard (/assets/video/…) to its repo file. */
function repoFile(urlPath) {
  return path.join(ROOT, ...urlPath.split('/').filter(Boolean));
}

function prepareWorkDir(requested) {
  if (!requested) return fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-teaser-'));
  fs.mkdirSync(requested, { recursive: true });
  for (const name of fs.readdirSync(requested)) {
    if (/^frame-\d+\.png$/.test(name)) fs.rmSync(path.join(requested, name));
  }
  return requested;
}

async function captureFrames(page, { fps, duration }, framesDir) {
  const frameCount = Math.round(fps * duration);
  for (let index = 0; index < frameCount; index++) {
    await page.evaluate((t) => window.teaser.seek(t), index / fps);
    await page.screenshot({ path: path.join(framesDir, `frame-${String(index).padStart(5, '0')}.png`) });
    if (index % fps === 0) process.stdout.write(`\r  captured ${index}/${frameCount} frames`);
  }
  process.stdout.write(`\r  captured ${frameCount}/${frameCount} frames\n`);
}

/** Screenshots every frame and the poster; returns the stage's sound cues. */
async function renderPicture(storyboard, framesDir) {
  const server = await startLocalSiteServer({ rootDirectory: ROOT });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: storyboard.width, height: storyboard.height },
      deviceScaleFactor: 1,
    });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.goto(`${server.baseUrl}${STAGE_URL_PATH}`);
    await page.evaluate(() => window.teaser.ready);
    await captureFrames(page, storyboard, framesDir);

    await page.evaluate((t) => window.teaser.seek(t), storyboard.poster_time);
    await page.screenshot({ path: repoFile(storyboard.poster), type: 'jpeg', quality: POSTER_JPEG_QUALITY });
    const cues = await page.evaluate(() => window.teaser.cues);
    if (pageErrors.length) throw pageErrors[0];
    return cues;
  } finally {
    await browser.close();
    await server.close();
  }
}

/** Scores both mixes and writes them as WAVs; returns the narration timing. */
function renderSound(storyboard, cues, workDir) {
  const music = renderMusic(storyboard, cues);
  const narration = renderNarration(storyboard, workDir);
  const described = mixDescribed(music, narration);
  const target = { targetLufs: storyboard.audio.loudness };
  const mixes = { instrumental: music, described };
  for (const [name, mix] of Object.entries(mixes)) {
    const { loudness, peak } = master(mix, target);
    console.log(`  ${name} mix: ${loudness.toFixed(1)} LUFS, peak ${peak.toFixed(1)} dBFS`);
    writeWav(path.join(workDir, `${name}.wav`), mix);
  }
  return narration.lines;
}

function encode(framesDir, fps, wavPath, output) {
  execFileSync('swift', [ENCODER, framesDir, String(fps), String(VIDEO_BITS_PER_SECOND), output, wavPath], {
    stdio: 'inherit',
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storyboard = yaml.load(fs.readFileSync(STORYBOARD_FILE, 'utf8'));
  const workDir = prepareWorkDir(args.framesDir);
  const outputs = ['video', 'described_video', 'captions', 'described_captions', 'poster'];
  for (const key of outputs) fs.mkdirSync(path.dirname(repoFile(storyboard[key])), { recursive: true });

  console.log(`Rendering ${storyboard.duration} s at ${storyboard.fps} fps (work files in ${workDir})`);
  const cues = await renderPicture(storyboard, workDir);
  execFileSync('swift', ['-O', FLASH_CHECK, workDir, String(storyboard.fps)], { stdio: 'inherit' });
  const narrationLines = renderSound(storyboard, cues, workDir);
  encode(workDir, storyboard.fps, path.join(workDir, 'instrumental.wav'), repoFile(storyboard.video));
  encode(workDir, storyboard.fps, path.join(workDir, 'described.wav'), repoFile(storyboard.described_video));
  fs.writeFileSync(repoFile(storyboard.captions), instrumentalCaptions(storyboard));
  fs.writeFileSync(repoFile(storyboard.described_captions), describedCaptions(storyboard, narrationLines));
  if (!args.framesDir) fs.rmSync(workDir, { recursive: true, force: true });

  for (const key of outputs) {
    const { size } = fs.statSync(repoFile(storyboard[key]));
    console.log(`  ${storyboard[key]}  ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
