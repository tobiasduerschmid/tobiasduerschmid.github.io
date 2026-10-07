// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const { chromiumLaunchOptions } = require('./scripts/chromium-launch-options');

const requestedJekyllPort = process.env.JEKYLL_PORT || '4000';
const jekyllPort = /^\d+$/.test(requestedJekyllPort) ? requestedJekyllPort : '4000';
const jekyllHost = '127.0.0.1';
const serveBuiltSite = process.env.PLAYWRIGHT_SERVE_BUILT_SITE === '1';
const defaultWebServerTimeoutMs = 10 * 60 * 1000;
const requestedWebServerTimeoutMs = process.env.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS;
const parsedWebServerTimeoutMs = Number(requestedWebServerTimeoutMs);
const webServerTimeoutMs = /^\d+$/.test(requestedWebServerTimeoutMs || '')
  && Number.isSafeInteger(parsedWebServerTimeoutMs)
  && parsedWebServerTimeoutMs > 0
  ? parsedWebServerTimeoutMs
  : defaultWebServerTimeoutMs;

module.exports = defineConfig({

  webServer: {
    // The command to start your local server
    command: serveBuiltSite
      ? `python3 -m http.server ${jekyllPort} --bind ${jekyllHost} --directory _site`
      : `make test-run JEKYLL_PORT=${jekyllPort}`,

    // The URL Playwright will ping to check if the server is ready.
    // It waits for a 200 OK response before starting tests.
    url: `http://${jekyllHost}:${jekyllPort}`,

    // If true, it won't try to start a new server if one is already running on that port.
    // Highly recommended for local development to save time.
    reuseExistingServer: !process.env.CI,

    // Optional: How long to wait for the server to start before timing out (in milliseconds)
    // A clean build of this content-heavy site can exceed five minutes on CI.
    // Keep a finite startup bound while allowing slower runners to override it.
    timeout: webServerTimeoutMs,
  },

  testDir: './tests',
  // Run tests sequentially since we're hitting a single local server
  workers: 1,
  // Retry once on CI
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://${jekyllHost}:${jekyllPort}`,
    // Fail fast on page errors
    actionTimeout: 10000,
    launchOptions: chromiumLaunchOptions(),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'avatar-firefox',
      testMatch: /se-gym-hero-(artifacts|representation)\.spec\.js/,
      grep: /Selecting a beard paints|Beards remain attached|Full beard shapes stay below|Detached and hidden avatar templates/,
      // Hidden SVG geometry differs between engines; exercise the beard fix
      // in Firefox without duplicating the entire site's Chromium suite.
      use: { ...devices['Desktop Firefox'], launchOptions: {} },
    },
  ],
});
