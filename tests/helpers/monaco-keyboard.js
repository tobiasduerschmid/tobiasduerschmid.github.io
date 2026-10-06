// Monaco picks its shortcuts from the page's user agent, while Playwright's
// ControlOrMeta follows the host OS. The configured devices emulate Windows or
// macOS regardless of the host, so ControlOrMeta+A can miss Monaco's binding.
// The browser then selects only Monaco's hidden textarea, and Monaco adopts or
// drops that selection depending on event timing.
async function selectAllInMonaco(editor) {
  const chord = await editor.page().evaluate(() => (/Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A'));
  await editor.press(chord);
}

module.exports = { selectAllInMonaco };
