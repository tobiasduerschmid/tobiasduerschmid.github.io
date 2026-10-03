/** Exercise the real runtime API on the site's origin; never a UI substitute. */
async function installSmalltalk(page) {
  await page.goto('/robots.txt');
  await page.setContent('<!doctype html><html lang="en"><head><title>Smalltalk runtime fixture</title></head><body></body></html>');
  await page.addScriptTag({ url: '/js/smalltalk/protocol.js' });
  await page.addScriptTag({ url: '/js/smalltalk/runtime-host.js' });
}
async function withSmalltalk(page, scenario, data, options = {}) {
  await installSmalltalk(page);
  return page.evaluate(async ({ source, data, options }) => {
    const waiters = [];
    const events = {
      items: [],
      waitFor(predicate) {
        const previous = this.items.find(predicate);
        return previous ? Promise.resolve(previous) : new Promise(resolve => waiters.push({ predicate, resolve }));
      },
    };
    const host = await window.SEBookSmalltalk.RuntimeHost.create({
      manifestURL: '/js/vendor/smalltalk/manifest.json', ...options,
      onEvent(event) {
        events.items.push(event);
        for (const waiter of [...waiters]) if (waiter.predicate(event)) {
          waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(event);
        }
      },
    });
    try { return await (0, eval)('(' + source + ')')(host, data, events); }
    finally { host.dispose(); }
  }, { source: scenario.toString(), data, options });
}
module.exports = { withSmalltalk, installSmalltalk };

/** Compose production views with real Monaco, Workspace and VM; no service/UI substitutes. */
async function mountSmalltalkFixture(page, { program, drafts = [], views = ['browser', 'inspector'] }) {
  await page.goto('/robots.txt');
  await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noai, noimageai, noarchive"><meta name="dcterms.rights" content="Tobias Dürschmid expressly reserves text and data mining rights, including AI training; prior written permission is required."><meta name="tdm-reservation" content="1"><title>Smalltalk System Browser test</title></head><body><a class="skip-link" href="#main">Skip to main content</a><main id="main"><h1>Smalltalk image tools</h1><div id="browser-root"></div><div id="inspector-root"></div></main></body></html>');
  for (const url of ['/css/bootstrap.ucla.css', '/css/design-tokens.css', '/css/portfolio.css', '/css/smalltalk-browser.css', '/css/print-light.css']) await page.addStyleTag({ url });
  // The robots.txt document can start in Windows-1252; setContent cannot change it.
  // Explicit script encoding preserves real UTF-8 source without a synthetic UI.
  for (const url of ['/js/smalltalk/protocol.js', '/js/smalltalk/runtime-host.js', '/js/smalltalk/workspace.js', '/js/monaco-sebook-langs.js', '/js/monaco-focus-exit.js', '/js/smalltalk/source-views.js', '/js/smalltalk/refactorings.js', '/js/smalltalk/refactoring-view.js', '/js/smalltalk/browser.js', '/js/smalltalk/inspector.js', '/js/vendor/monaco-editor/0.44.0/min/vs/loader.js']) await page.evaluate(url => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.charset = 'utf-8'; script.src = url;
    script.onload = resolve; script.onerror = () => reject(new Error('Fixture script failed: ' + url)); document.head.append(script);
  }), url);
  await page.evaluate(async ({ program, drafts, views }) => {
    window.require.config({ paths: { vs: '/js/vendor/monaco-editor/0.44.0/min/vs' } });
    await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, reject));
    window.SebookMonacoLangs.register(window.monaco);
    const setTheme = () => window.monaco.editor.setTheme(document.documentElement.classList.contains('dark-mode') ? 'sebook-dark' : 'sebook-light'); setTheme();
    const observer = new MutationObserver(setTheme); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const runtime = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const workspace = await window.SEBookSmalltalk.Workspace.create({ runtime, program, drafts });
    window.smalltalkFixtureWorkspace = workspace;
    const mounted = [];
    const refactorings = window.SEBookSmalltalk.FEATURES.refactorings && views.includes('refactorings') ? window.SEBookSmalltalk.Refactorings.create(workspace) : null;
    window.smalltalkFixtureRefactorings = refactorings;
    function createEditor({ element, value, language, ariaLabel, onChange }) {
      let suppress = false;
      const model = window.monaco.editor.createModel(value, language);
      const editor = window.monaco.editor.create(element, { model, ariaLabel, fontSize: 17, minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true, scrollBeyondLastLine: false, accessibilitySupport: 'on', tabSize: 2 });
      const listener = model.onDidChangeContent(() => { if (!suppress) onChange(model.getValue()); });
      window.SebookMonacoFocusExit.attach(editor);
      return { getValue: () => model.getValue(), setValue(value) { suppress = true; try { model.setValue(value); } finally { suppress = false; } }, getSelection() { const selection = editor.getSelection(); return { start: model.getOffsetAt(selection.getStartPosition()), end: model.getOffsetAt(selection.getEndPosition()) }; }, dispose() { listener.dispose(); editor.dispose(); model.dispose(); } };
    }
    try {
      if (views.includes('browser')) { const browser = window.SEBookSmalltalk.Browser.mount({ root: document.getElementById('browser-root'), workspace, createEditor, ...(refactorings ? { refactorings } : {}) }); window.smalltalkFixtureBrowser = browser; mounted.push(browser); await browser.ready; }
      if (views.includes('inspector')) mounted.push(window.SEBookSmalltalk.Inspector.mount({ root: document.getElementById('inspector-root'), workspace, createEditor }));
    } catch (error) { mounted.forEach(view => view.dispose()); workspace.dispose(); runtime.dispose(); observer.disconnect(); throw error; }
    window.cleanupSmalltalkFixture = () => { mounted.forEach(view => view.dispose()); workspace.dispose(); runtime.dispose(); observer.disconnect(); };
  }, { program, drafts, views });
  return () => page.evaluate(() => window.cleanupSmalltalkFixture());
}
module.exports.mountSmalltalkFixture = mountSmalltalkFixture;
