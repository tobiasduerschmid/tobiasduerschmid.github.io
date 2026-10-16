// Targeted browser matrix against an already-built Jekyll site served with
// HTTP byte-range support, as native media seeking requires. A plain Python
// http.server does not provide that support; use Jekyll's server or equivalent.
const { defineConfig } = require('@playwright/test');
const { chromiumLaunchOptions } = require('../scripts/chromium-launch-options');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: /song-(?:controls-playlist|vector-player|vector-resources|vector-art|vector-fullscreen|video|video-graph-track)\.spec\.js$/,
  outputDir: process.env.SONG_PLAYER_TEST_OUTPUT || '../test-results/song-player',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.SONG_PLAYER_BASE_URL || 'http://127.0.0.1:4189',
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: chromiumLaunchOptions() } },
    { name: 'firefox', grepInvert: /@chromium/, use: { browserName: 'firefox' } },
    { name: 'webkit', grepInvert: /@chromium/, use: { browserName: 'webkit' } },
  ],
});
