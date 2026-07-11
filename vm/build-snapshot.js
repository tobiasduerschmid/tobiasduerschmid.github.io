#!/usr/bin/env node
/**
 * Boots the tutorial VM in a headless Chromium via the snapshot harness page,
 * waits for the shell prompt, calls v86's save_state(), and writes the result
 * to vm/dist/state.bin.gz with compatibility/checksum manifests.
 *
 * Prereqs:
 *   1. Jekyll dev server running (make run) on $JEKYLL_PORT (default 4000).
 *   2. vm/dist/bzImage and vm/dist/rootfs.cpio.gz built (./vm/setup.sh).
 *   3. Playwright Chromium installed (npx playwright install chromium).
 *
 * Usage:
 *   node vm/build-snapshot.js
 *   JEKYLL_PORT=4001 node vm/build-snapshot.js
 */
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { chromium } = require('playwright');

const PORT = process.env.JEKYLL_PORT || '4000';
const URL  = `http://127.0.0.1:${PORT}/vm/snapshot/`;
const OUT  = path.join(__dirname, 'dist', 'state.bin.gz');
const OUT_TMP = `${OUT}.new`;
const SNAPSHOT_INPUTS = path.join(__dirname, 'dist', 'SNAPSHOT_INPUTS');
const CHECKSUM_MANIFEST = path.join(__dirname, 'dist', 'SHA256SUMS');
const MEMORY_MB = 192;
const VGA_MEMORY_MB = 2;

const SNAPSHOT_DEPENDENCIES = Object.freeze({
  BZIMAGE_SHA256: path.join(__dirname, 'dist', 'bzImage'),
  ROOTFS_SHA256: path.join(__dirname, 'dist', 'rootfs.cpio.gz'),
  V86_LIBV86_SHA256: path.join(__dirname, '..', 'assets', 'v86', 'libv86.js'),
  V86_WASM_SHA256: path.join(__dirname, '..', 'assets', 'v86', 'v86.wasm'),
  V86_SEABIOS_SHA256: path.join(__dirname, '..', 'assets', 'v86', 'seabios.bin'),
  V86_VGABIOS_SHA256: path.join(__dirname, '..', 'assets', 'v86', 'vgabios.bin'),
});

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function replaceFileAtomically(filePath, contents) {
  const temporaryPath = `${filePath}.new`;
  fs.writeFileSync(temporaryPath, contents);
  fs.renameSync(temporaryPath, filePath);
}

function writeReleaseMetadata() {
  const dependencyLines = Object.entries(SNAPSHOT_DEPENDENCIES)
    .map(([name, filePath]) => `${name}=${sha256File(filePath)}`);
  replaceFileAtomically(SNAPSHOT_INPUTS, [
    ...dependencyLines,
    `MEMORY_MB=${MEMORY_MB}`,
    `VGA_MEMORY_MB=${VGA_MEMORY_MB}`,
    '',
  ].join('\n'));

  const releaseFiles = ['SNAPSHOT_INPUTS', 'bzImage', 'rootfs.cpio.gz', 'state.bin.gz'];
  const checksumLines = releaseFiles.map(filename => {
    const filePath = path.join(__dirname, 'dist', filename);
    return `${sha256File(filePath)}  ${filename}`;
  });
  replaceFileAtomically(CHECKSUM_MANIFEST, `${checksumLines.join('\n')}\n`);
}

(async () => {
  console.log(`[snapshot] navigating ${URL}`);
  const browser = await chromium.launch({
    // SharedArrayBuffer needs cross-origin isolation; the COI service worker
    // sets the right headers in production but headless Chromium starts before
    // the SW activates, so force the flags directly.
    args: [
      '--enable-features=SharedArrayBuffer',
      '--disable-web-security',
    ],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`[page:error] ${err.message}`));

    await page.goto(URL, { waitUntil: 'load' });

    console.log('[snapshot] waiting for VM boot (up to 90s)…');
    await page.waitForFunction(
      () => window.__vmReady === true || window.__vmError,
      null,
      { timeout: 90_000 }
    );

    const err = await page.evaluate(() => window.__vmError);
    if (err) throw new Error(`VM did not boot: ${err}`);

    console.log('[snapshot] VM booted, calling save_state()…');

    // The harness's __saveState() builds a Blob and triggers a download — the
    // download event ships hundreds of MB out of the page without serializing
    // through page.evaluate's JSON boundary.
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    const reportedSize = await page.evaluate(() => window.__saveState());
    console.log(`[snapshot] page reports ${reportedSize} bytes raw; awaiting download…`);
    const download = await downloadPromise;

    // Stream the download through gzip directly into state.bin.gz — avoids
    // staging a 150+ MB raw file on disk. zlib.constants.Z_BEST_COMPRESSION (9)
    // takes a few extra seconds but trims another ~10% off the wire size.
    fs.rmSync(OUT_TMP, { force: true });
    try {
      await pipeline(
        await download.createReadStream(),
        zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
        fs.createWriteStream(OUT_TMP)
      );
      fs.renameSync(OUT_TMP, OUT);
      writeReleaseMetadata();
    } finally {
      fs.rmSync(OUT_TMP, { force: true });
    }

    const stat = fs.statSync(OUT);
    console.log(`[snapshot] wrote ${OUT} (${(stat.size/1024/1024).toFixed(1)} MB gzipped from ${reportedSize} bytes raw)`);
    console.log(`[snapshot] wrote ${SNAPSHOT_INPUTS} and ${CHECKSUM_MANIFEST}`);
  } finally {
    await browser.close();
  }

})().catch((err) => {
  console.error(err);
  process.exit(1);
});
