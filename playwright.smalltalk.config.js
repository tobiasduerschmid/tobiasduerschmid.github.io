// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const base = require('./playwright.config');
const features = require('./tests/helpers/smalltalk-features');

// A local Chrome executable must never leak into Firefox or WebKit projects.
const { launchOptions, ...sharedUse } = base.use;

module.exports = defineConfig({
  ...base,
  testMatch: '**/smalltalk-*.spec.js',
  use: sharedUse,
  // Individual cases use this same production capability helper. Retain their
  // explicit skips in reports instead of filtering out whole mixed-scope files.
  metadata: { ...base.metadata, smalltalkRefactoringsEnabled: features.refactorings },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
