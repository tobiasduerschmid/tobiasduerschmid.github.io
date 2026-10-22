// Monaco picks its shortcuts from the page's user agent, while Playwright's
// ControlOrMeta follows the host OS. The configured devices emulate Windows or
// macOS regardless of the host, so ControlOrMeta+A can miss Monaco's binding.
// The browser then selects only Monaco's hidden textarea, and Monaco adopts or
// drops that selection depending on event timing.
async function selectAllInMonaco(editor) {
  const chord = await editor.page().evaluate(() => (/Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A'));
  await editor.press(chord);
}

// Firefox's synthetic multi-line insertText can duplicate source in Monaco's
// hidden textarea. Keep native editing behavior by pressing Enter between lines.
async function insertLinesInMonaco(editor, text) {
  for (const [index, line] of text.split('\n').entries()) {
    if (index) await editor.press('Enter');
    await editor.page().keyboard.insertText(line);
  }
}

module.exports = { selectAllInMonaco, insertLinesInMonaco };
