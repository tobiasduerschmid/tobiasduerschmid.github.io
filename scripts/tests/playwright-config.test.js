const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../..');
const configPath = path.join(repositoryRoot, 'playwright.config.js');
const defaultWebServerTimeoutMs = 10 * 60 * 1000;

function loadConfiguredWebServerTimeout(environmentValue) {
  const environment = { ...process.env };
  if (environmentValue === undefined) {
    delete environment.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS;
  } else {
    environment.PLAYWRIGHT_WEB_SERVER_TIMEOUT_MS = environmentValue;
  }

  const result = spawnSync(
    process.execPath,
    ['-e', `process.stdout.write(String(require(${JSON.stringify(configPath)}).webServer.timeout))`],
    { cwd: repositoryRoot, encoding: 'utf8', env: environment },
  );

  assert.equal(result.status, 0, result.stderr);
  return Number(result.stdout);
}

test('Playwright gives a clean Jekyll build enough startup time by default', () => {
  assert.equal(loadConfiguredWebServerTimeout(), defaultWebServerTimeoutMs);
});

test('Playwright accepts a positive integer server-startup override', () => {
  assert.equal(loadConfiguredWebServerTimeout('900000'), 900_000);
});

for (const invalidValue of ['', '0', '-1', 'not-a-number', '900000ms', '999999999999999999999']) {
  test(`Playwright rejects unsafe server-startup override ${JSON.stringify(invalidValue)}`, () => {
    assert.equal(
      loadConfiguredWebServerTimeout(invalidValue),
      defaultWebServerTimeoutMs,
    );
  });
}
