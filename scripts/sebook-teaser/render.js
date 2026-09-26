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
 * Chromium → screenshot several sub-frames per frame across the storyboard's
 * `motion_blur` shutter and average them into motion-blurred frames
 * (blend-frames.swift) → read the stage's sound cues → screen the frames for
 * flashing (check-flashes.swift, WCAG 2.3.1; a failure stops the render) →
 * score the soundtrack against the cues
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
const BLENDER = path.join(__dirname, 'blend-frames.swift');
// At 2 Mbit/s VideoToolbox's H.264 is visually lossless even at 1:1, film
// grain included; 20 s ≈ 5.3 MB.
const VIDEO_BITS_PER_SECOND = 2_000_000;
const POSTER_JPEG_QUALITY = 82;
// Headless browsers capturing sub-frames side by side (each is one busy core).
const CAPTURE_WORKERS = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

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
  const workDir = requested || fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-teaser-'));
  fs.mkdirSync(workDir, { recursive: true });
  for (const name of fs.readdirSync(workDir)) {
    if (/^frame-\d+\.png$/.test(name)) fs.rmSync(path.join(workDir, name));
  }
  fs.rmSync(path.join(workDir, 'sub'), { recursive: true, force: true });
  fs.mkdirSync(path.join(workDir, 'sub'));
  return workDir;
}

/**
 * Screenshots `samples` sub-frames for each frame in [from, to), spread
 * evenly across `shutter` of the frame interval and centred on the frame's
 * time, into `subDir`. Uses Chrome's own capture (CDP), about twice as fast
 * as page.screenshot() — there are thousands of shots.
 */
async function captureSubFrames(page, { fps, motion_blur: { samples, shutter } }, subDir, from, to, onFrame) {
  const cdp = await page.context().newCDPSession(page);
  for (let frame = from; frame < to; frame++) {
    for (let sample = 0; sample < samples; sample++) {
      const offset = ((sample + 0.5) / samples - 0.5) * shutter;
      await page.evaluate((t) => window.teaser.seek(t), Math.max(0, (frame + offset) / fps));
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      fs.writeFileSync(path.join(subDir, `sub-${String(frame).padStart(5, '0')}-${sample}.png`), Buffer.from(data, 'base64'));
    }
    onFrame();
  }
  await cdp.detach();
}

async function openStage(storyboard, baseUrl) {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: storyboard.width, height: storyboard.height },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto(`${baseUrl}${STAGE_URL_PATH}`);
  await page.evaluate(() => window.teaser.ready);
  return { browser, page, pageErrors };
}

/**
 * Captures the sub-frames — split into contiguous chunks across several
 * headless browsers, since the stage is deterministic — and the poster.
 * Returns the stage's sound cues.
 */
async function renderPicture(storyboard, workDir) {
  const server = await startLocalSiteServer({ rootDirectory: ROOT });
  const frameCount = Math.round(storyboard.fps * storyboard.duration);
  const chunk = Math.ceil(frameCount / CAPTURE_WORKERS);
  const stages = [];
  let captured = 0;
  const onFrame = () => {
    captured += 1;
    if (captured % storyboard.fps === 0 || captured === frameCount) {
      process.stdout.write(`\r  captured ${captured}/${frameCount} frames × ${storyboard.motion_blur.samples} sub-frames`);
    }
  };
  try {
    await Promise.all(Array.from({ length: CAPTURE_WORKERS }, async (_, worker) => {
      const stage = await openStage(storyboard, server.baseUrl);
      stages.push(stage);
      const from = worker * chunk;
      await captureSubFrames(stage.page, storyboard, path.join(workDir, 'sub'), from, Math.min(frameCount, from + chunk), onFrame);
    }));
    process.stdout.write('\n');
    const errors = stages.flatMap((stage) => stage.pageErrors);
    if (errors.length) throw errors[0];

    const { page } = stages[0];
    await page.evaluate((t) => window.teaser.seek(t), storyboard.poster_time);
    await page.screenshot({ path: repoFile(storyboard.poster), type: 'jpeg', quality: POSTER_JPEG_QUALITY });
    return await page.evaluate(() => window.teaser.cues);
  } finally {
    await Promise.all(stages.map((stage) => stage.browser.close()));
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
  const { samples, grain } = storyboard.motion_blur;
  execFileSync('swift', ['-O', BLENDER, path.join(workDir, 'sub'), String(samples), String(grain), workDir], {
    stdio: 'inherit',
  });
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
