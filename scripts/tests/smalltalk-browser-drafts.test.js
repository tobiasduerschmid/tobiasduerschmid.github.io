const { test, before, after } = require('node:test');
const { chromium, expect } = require('@playwright/test');
let browser;
before(async () => { browser = await chromium.launch(process.env.PLAYWRIGHT_CHROME_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE } : {}); });
after(async () => { if (browser) await browser.close(); });

// Presentation control: real DOM, Workspace, private MessageChannel and Browser.
// Only the runtime browse boundary supplies fixed source; this is not native proof.
for (const origin of ['owner', 'remote']) test(`${origin} Revert removes discarded source from both Browser views`, async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<main><section id="owner" aria-label="Owner view"></section><section id="remote" aria-label="Remote view"></section></main>');
    for (const name of ['protocol', 'workspace', 'popup', 'source-views', 'browser']) await page.addScriptTag({ path: 'js/smalltalk/' + name + '.js' });
    await page.evaluate(async () => {
      const api = window.SEBookSmalltalk;
      const runtime = { subscribe: () => () => {}, openSession: async () => ({ sessionId: 'test-session', revision: 0 }),
        loadProgram: async () => {}, stopSession() {}, request: async (session, operation, query) => {
          if (operation !== 'browse') throw new Error('Unexpected operation: ' + operation);
          return { revision: 0, items: [], nextOffset: null, ...(query.kind === 'source' ? { source: 'value\n ^ 1' } : {}) };
        } };
      const workspace = await api.Workspace.create({ runtime, program: { version: 1, stepKey: 'draft-presentation', revision: 0,
        files: [], changes: { version: 1, source: '', entries: [] }, runCommand: null } });
      const { port1, port2 } = new MessageChannel();
      const connection = api.PopupWorkspaceOwner.serve({ port: port1, workspace, sessionId: 'presentation-connection' });
      const remote = await api.PopupWorkspace.connect({ port: port2, sessionId: 'presentation-connection' });
      const createEditor = ({ element, value, ariaLabel, onChange }) => {
        const input = document.createElement('textarea'); input.setAttribute('aria-label', ariaLabel); input.value = value;
        input.addEventListener('input', () => onChange(input.value)); element.append(input);
        return { getValue: () => input.value, setValue: value => { input.value = value; }, dispose: () => input.remove() };
      };
      const views = [];
      for (const [id, source] of [['owner', workspace], ['remote', remote]]) {
        const view = api.Browser.mount({ root: document.getElementById(id), workspace: source, createEditor });
        views.push(view); await view.ready;
        await view.navigate({ kind: 'method', packageName: 'Example', className: 'Counter', side: 'instance', selector: 'value' });
      }
      window.closeDraftFixture = () => { remote.dispose(); connection.close(); views.forEach(view => view.dispose()); workspace.dispose(); };
    });
    const sender = page.getByRole('region', { name: origin === 'owner' ? 'Owner view' : 'Remote view', exact: true });
    const receiver = page.getByRole('region', { name: origin === 'owner' ? 'Remote view' : 'Owner view', exact: true });
    await sender.getByRole('textbox', { name: 'Smalltalk method source', exact: true }).fill('value\n ^ 99');
    await expect(receiver.getByRole('textbox', { name: 'Smalltalk method source', exact: true })).toHaveValue('value\n ^ 99');
    await sender.getByRole('button', { name: 'Revert', exact: true }).click();
    for (const view of [sender, receiver]) {
      await expect(view.getByRole('textbox', { name: 'Smalltalk method source', exact: true })).toHaveValue('value\n ^ 1');
      await expect(view.getByRole('region', { name: 'Method source', exact: true })).toContainText('Accepted source');
      await expect(view.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
      await expect(view.getByRole('button', { name: 'Revert', exact: true })).toBeDisabled();
    }
  } finally { await page.evaluate(() => window.closeDraftFixture && window.closeDraftFixture()); await page.close(); }
});
