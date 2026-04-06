// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({

  webServer: {
    // The command to start your local server
    command: 'make run JEKYLL_PORT=4000',

    // The URL Playwright will ping to check if the server is ready.
    // It waits for a 200 OK response before starting tests.
    url: 'http://localhost:4000',

    // If true, it won't try to start a new server if one is already running on that port.
    // Highly recommended for local development to save time.
    reuseExistingServer: !process.env.CI,

    // Optional: How long to wait for the server to start before timing out (in milliseconds)
    timeout: 120 * 1000,
  },

  testDir: './tests',
  // Run tests sequentially since we're hitting a single local server
  workers: 1,
  // Retry once on CI
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4000',
    // Fail fast on page errors
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
