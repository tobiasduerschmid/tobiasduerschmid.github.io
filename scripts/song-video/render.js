/**
 * Renders an SE Book song video from its storyboard (_data/songs/<song>.yml),
 * the same file the page's lyrics transcript is built from:
 *
 *   node scripts/song-video/render.js <song> [--frames-dir DIR]
 *   node scripts/song-video/render.js <song> --stills 18.6,61.2 --out DIR
 *
 * Outputs (paths from the storyboard):
 *   video     H.264 1920×1080 + the AAC soundtrack
 *   captions  WebVTT of the lyrics (captions.js)
 *   poster    JPEG of the frame at poster_time
 *   described_soundtrack / described_timeline  Narrated M4A and live-player timing
 *
 * A storyboard without `video` plays only in the live vector player: the
 * render then skips the frames, the encode, and the poster, and writes just
 * the captions and the audio-described track (add --check-flashes to capture
 * the frames anyway and screen them for flashing, WCAG 2.3.1).
 *
 * Pipeline: serve the repo root on loopback → open stage.html in several
 * headless Chromes (960×540 CSS px at device scale 2) → capture contiguous
 * chunks of frames as JPEGs (the stage is deterministic, so chunks render
 * independently) → screen them for flashing (../video-tools/check-flashes.swift,
 * WCAG 2.3.1; a failure stops the render) → encode with the soundtrack
 * (../video-tools/encode-mp4.swift) → write the captions and the poster.
 *
 * --stills renders just the listed moments as PNGs, for checking a
 * choreography without a full render. --skip-capture re-encodes the frames
 * an earlier run kept in --frames-dir (for example after changing the
 * bitrate or the soundtrack).
 *
 * Needs macOS with Xcode Command Line Tools (`swift`), a Chromium for
 * Playwright (set PLAYWRIGHT_CHROME_EXECUTABLE to use an installed Chrome),
 * and network access for the stage's Google Fonts. A full render writes about
 * 1.5 GB of frames to a temp directory, deleted afterwards unless
 * --frames-dir keeps them.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { chromium } = require('playwright');
const { startLocalSiteServer } = require('../local-site-server');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { songCaptions, describedCaptions } = require('./captions');
const { speakNarrations, planDescribedCut, describedTimeline, linkDescribedFrames, mixDescribedAudio } = require('./described-cut');
const { readWav, writeWav } = require('./wav');

const ROOT = path.resolve(__dirname, '..', '..');
const TOOLS = path.join(__dirname, '..', 'video-tools');
const STAGE = { width: 960, height: 540, scale: 2 };
// Flat graphics with gentle motion: at this rate VideoToolbox's H.264 keeps
// text as crisp as at 1 Mbit/s in 1:1 crops (about 21 MB for four minutes).
const VIDEO_BITS_PER_SECOND = 550_000;
const AUDIO_SAMPLE_RATE = 48_000;
const OUTPUTS = ['video', 'captions', 'described_video', 'described_captions', 'described_soundtrack', 'described_timeline', 'poster'];

const frameFileName = (index) => `frame-${String(index).padStart(5, '0')}.jpg`;
const FRAME_JPEG_QUALITY = 92;
const POSTER_JPEG_QUALITY = 84;
const CAPTURE_WORKERS = Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));

function usage() {
  return 'Usage: node scripts/song-video/render.js <song> [--frames-dir DIR [--skip-capture]] [--check-flashes] | <song> --stills t1,t2,… --out DIR';
}

function parseArgs(argv) {
  const args = { song: null, framesDir: null, skipCapture: false, checkFlashes: false, stills: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--frames-dir' && argv[i + 1]) args.framesDir = path.resolve(argv[++i]);
    else if (arg === '--skip-capture') args.skipCapture = true;
    else if (arg === '--check-flashes') args.checkFlashes = true;
    else if (arg === '--stills' && argv[i + 1]) args.stills = argv[++i].split(',').map(Number);
    else if (arg === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (!arg.startsWith('--') && !args.song) args.song = arg;
    else throw new Error(`Unknown argument "${arg}". ${usage()}`);
  }
  if (!args.song) throw new Error(usage());
  if (args.stills && (!args.out || args.stills.some(Number.isNaN))) throw new Error(usage());
  if (args.skipCapture && !args.framesDir) throw new Error(`--skip-capture reuses the frames in --frames-dir. ${usage()}`);
  return args;
}

/** Maps a site URL path from the storyboard (/assets/video/…) to its repo file. */
function repoFile(urlPath) {
  return path.join(ROOT, ...urlPath.split('/').filter(Boolean));
}

async function openStage(song, baseUrl) {
  const browser = await chromium.launch(chromiumLaunchOptions());
  const page = await browser.newPage({
    viewport: { width: STAGE.width, height: STAGE.height },
    deviceScaleFactor: STAGE.scale,
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(new Error(message.text()));
  });
  try {
    await page.goto(`${baseUrl}/scripts/song-video/stage.html?song=${encodeURIComponent(song)}`);
    await page.evaluate(() => window.songVideo.ready);
  } catch (error) {
    await browser.close();
    throw pageErrors[0] || error;
  }
  return { browser, page, pageErrors };
}

/**
 * Poses the stage at t and captures it with Chrome's own screenshot command
 * (about twice as fast as page.screenshot()). The explicit clip pins the
 * output to the stage at 2× whatever window size the browser actually has.
 */
async function capture(cdp, page, t, { format, quality }) {
  await page.evaluate((time) => window.songVideo.seek(time), t);
  const clip = { x: 0, y: 0, width: STAGE.width, height: STAGE.height, scale: STAGE.scale };
  const options = format === 'jpeg'
    ? { format: 'jpeg', quality, optimizeForSpeed: true, clip, captureBeyondViewport: true }
    : { format: 'png', clip, captureBeyondViewport: true };
  const { data } = await cdp.send('Page.captureScreenshot', options);
  return Buffer.from(data, 'base64');
}

const FRAME_FORMAT = { format: 'jpeg', quality: FRAME_JPEG_QUALITY };
const POSTER_FORMAT = { format: 'jpeg', quality: POSTER_JPEG_QUALITY };
const STILL_FORMAT = { format: 'png' };

async function renderStills(args, storyboard) {
  const server = await startLocalSiteServer({ rootDirectory: ROOT });
  let stage = null;
  try {
    stage = await openStage(args.song, server.baseUrl);
    fs.mkdirSync(args.out, { recursive: true });
    const cdp = await stage.page.context().newCDPSession(stage.page);
    for (const t of args.stills) {
      const file = path.join(args.out, `still-${t.toFixed(2).padStart(7, '0')}.png`);
      fs.writeFileSync(file, await capture(cdp, stage.page, t, STILL_FORMAT));
    }
    if (stage.pageErrors.length) throw stage.pageErrors[0];
    console.log(`Wrote ${args.stills.length} stills of ${storyboard.title} to ${args.out}`);
  } finally {
    if (stage) await stage.browser.close();
    await server.close();
  }
}

/**
 * Captures every frame (unless `skipCapture` reuses the ones already in
 * workDir) — split into contiguous chunks across headless browsers — and the
 * poster.
 */
async function renderFrames(args, storyboard, workDir) {
  const server = await startLocalSiteServer({ rootDirectory: ROOT });
  const frameCount = Math.round(storyboard.fps * storyboard.duration);
  const workers = args.skipCapture ? 1 : CAPTURE_WORKERS;
  const chunk = Math.ceil(frameCount / workers);
  const stages = [];
  let captured = 0;
  try {
    await Promise.all(Array.from({ length: workers }, async (_, worker) => {
      const stage = await openStage(args.song, server.baseUrl);
      stages.push(stage);
      if (args.skipCapture) return;
      const cdp = await stage.page.context().newCDPSession(stage.page);
      const from = worker * chunk;
      for (let frame = from; frame < Math.min(frameCount, from + chunk); frame++) {
        const jpeg = await capture(cdp, stage.page, frame / storyboard.fps, FRAME_FORMAT);
        fs.writeFileSync(path.join(workDir, frameFileName(frame)), jpeg);
        captured += 1;
        if (captured % storyboard.fps === 0 || captured === frameCount) {
          process.stdout.write(`\r  captured ${captured}/${frameCount} frames`);
        }
      }
    }));
    if (!args.skipCapture) process.stdout.write('\n');
    const errors = stages.flatMap((stage) => stage.pageErrors);
    if (errors.length) throw errors[0];

    // Chrome's own capture, like the frames: page.screenshot() waits for an
    // animation frame, which never comes while the virtual clock owns them.
    if (storyboard.poster) {
      const { page } = stages[0];
      const cdp = await page.context().newCDPSession(page);
      fs.writeFileSync(repoFile(storyboard.poster), await capture(cdp, page, storyboard.poster_time, POSTER_FORMAT));
    }
  } finally {
    await Promise.all(stages.map((stage) => stage.browser.close()));
    await server.close();
  }
}

function encode(framesDir, fps, soundtrack, output) {
  execFileSync('swift', [
    path.join(TOOLS, 'encode-mp4.swift'), framesDir, String(fps), String(VIDEO_BITS_PER_SECOND), output, soundtrack,
  ], { stdio: 'inherit' });
}

/**
 * The audio-described cut (described-cut.js): the same frames, held at the
 * start of each section while the narrator describes it, with its own
 * soundtrack and captions.
 */
function renderDescribedCut(storyboard, workDir) {
  const songWav = path.join(workDir, 'soundtrack.wav');
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEI16@${AUDIO_SAMPLE_RATE}`, path.join(ROOT, storyboard.soundtrack), songWav]);
  const voices = speakNarrations(storyboard, workDir, AUDIO_SAMPLE_RATE);
  const plan = planDescribedCut(storyboard, voices, AUDIO_SAMPLE_RATE);
  const describedWav = path.join(workDir, 'described.wav');
  writeWav(describedWav, mixDescribedAudio(plan, readWav(songWav), voices));
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac ', '-b', '160000', describedWav, repoFile(storyboard.described_soundtrack)]);
  fs.writeFileSync(repoFile(storyboard.described_timeline), `${JSON.stringify(describedTimeline(plan), null, 2)}\n`);
  if (storyboard.described_video) {
    const describedFrames = path.join(workDir, 'described');
    linkDescribedFrames(plan, workDir, describedFrames, frameFileName);
    encode(describedFrames, storyboard.fps, describedWav, repoFile(storyboard.described_video));
  }
  fs.writeFileSync(repoFile(storyboard.described_captions), describedCaptions(storyboard, plan));
  console.log(`  described cut: ${plan.duration.toFixed(1)} s with ${plan.holds.length} described pauses`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const storyboard = yaml.load(fs.readFileSync(path.join(ROOT, '_data', 'songs', `${args.song}.yml`), 'utf8'));
  if (args.stills) {
    await renderStills(args, storyboard);
    return;
  }

  const workDir = args.framesDir || fs.mkdtempSync(path.join(os.tmpdir(), `song-video-${args.song}-`));
  fs.mkdirSync(workDir, { recursive: true });
  if (!args.skipCapture) {
    for (const name of fs.readdirSync(workDir)) {
      if (/^frame-\d+\.(jpg|png)$/.test(name)) fs.rmSync(path.join(workDir, name));
    }
  }
  const outputKeys = OUTPUTS.filter((key) => storyboard[key]);
  for (const key of outputKeys) fs.mkdirSync(path.dirname(repoFile(storyboard[key])), { recursive: true });

  // Live-only songs (no `video`) need frames just to screen them for flashing.
  if (storyboard.video || args.checkFlashes) {
    console.log(`Rendering ${storyboard.title}: ${storyboard.duration} s at ${storyboard.fps} fps with ${CAPTURE_WORKERS} browsers (frames in ${workDir})`);
    await renderFrames(args, storyboard, workDir);
    execFileSync('swift', ['-O', path.join(TOOLS, 'check-flashes.swift'), workDir, String(storyboard.fps)], { stdio: 'inherit' });
  }
  if (storyboard.video) encode(workDir, storyboard.fps, path.join(ROOT, storyboard.soundtrack), repoFile(storyboard.video));
  fs.writeFileSync(repoFile(storyboard.captions), songCaptions(storyboard));
  renderDescribedCut(storyboard, workDir);
  if (!args.framesDir) fs.rmSync(workDir, { recursive: true, force: true });

  for (const key of outputKeys) {
    const { size } = fs.statSync(repoFile(storyboard[key]));
    console.log(`  ${storyboard[key]}  ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
