// Launch options for every Chromium that the tests and scripts start.
// Playwright's bundled browsers can be missing (for example after a Playwright
// upgrade); PLAYWRIGHT_CHROME_EXECUTABLE then names an installed Chrome.
function chromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
  return executablePath ? { executablePath } : {};
}

module.exports = { chromiumLaunchOptions };
