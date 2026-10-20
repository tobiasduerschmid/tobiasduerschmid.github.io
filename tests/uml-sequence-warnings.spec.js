const { test, expect: baseExpect } = require('@playwright/test');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');
const expect = baseExpect.configure({ timeout: 30_000 });

const sources = {
  Python: `class Payment:
    def authorize(self) -> None:
        self.capture()
    def capture(self) -> None:
        self.refund()
    def refund(self) -> None:
        self.authorize()
payment = Payment()
payment.authorize()
payment.refund()`,
  Java: `class Payment {
    void authorize() { capture(); }
    void capture() { refund(); }
    void refund() { authorize(); }
}
class Example {
    public static void main(String[] args) {
        Payment payment = new Payment();
        payment.authorize();
        payment.refund();
    }
}`,
  'C++': `class Payment {
public:
    void authorize() { capture(); }
    void capture() { refund(); }
    void refund() { authorize(); }
};
int main() {
    Payment payment;
    payment.authorize();
    payment.refund();
}`,
  TypeScript: `class Payment {
    authorize(): void { this.capture(); }
    capture(): void { this.refund(); }
    refund(): void { this.authorize(); }
}
const payment = new Payment();
payment.authorize();
payment.refund();`
};

for (const [language, source] of Object.entries(sources)) {
  test(`${language}: a recursive sequence warns visibly and recovers after reset`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/SEBook/uml_sequence_diagram.html');
    if (language === 'TypeScript') {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    }
    const lab = page.getByRole('region', { name: 'UML code lab: Calls determine message order', exact: true });
    await lab.getByRole('tab', { name: language, exact: true }).click();
    const editor = lab.getByRole('textbox', { name: language + ' code' });
    await expect(lab.getByRole('status')).toHaveText('Diagram updated.');
    await editor.focus();
    await selectAllInMonaco(editor);
    // Pasting preserves indentation and does not execute the learner's program.
    await editor.evaluate((element, text) => {
      const instance = window.monaco.editor.getEditors().find(candidate => candidate.getDomNode().contains(element));
      instance.trigger('keyboard', 'paste', { text });
    }, source);
    const status = lab.getByRole('status');
    await expect(status).toContainText('Recursive call detected');
    await expect(status).toBeVisible();
    await expect(status).toContainText('Later calls and returns may be unreachable');
    await expect(lab.getByRole('img')).toContainText('Warning: partial sequence inference');
    await expect(lab.getByRole('img')).toHaveAccessibleName(/Recursive call detected/);
    await expect(editor).toBeFocused();
    await a11yCheckpoint(page, `${language} sequence recursion warning`, { include: '.uml-code-lab' });
    await lab.getByRole('button', { name: 'Reset code', exact: true }).click();
    await expect(status).toHaveText('Diagram updated.');
    await expect(lab.getByRole('img')).not.toContainText('Warning:');
    await expect(lab.getByRole('img')).not.toHaveAccessibleName(/Recursive call detected/);
    expect(errors).toEqual([]);
  });
}

test('Python tutorial omits free-function and string warnings while retaining unknown object calls', async ({ page }) => {
  test.setTimeout(120_000);
  const { waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');
  await page.goto('/SEBook/tools/uml-sequence-diagram-python.html#self-calls');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  const source = `class DiscordBot:
    def _log(self, message: str) -> None:
        print(message.lower())
    def send(self, message: str) -> None:
        print(message)
    def handle_message(self, message: str) -> None:
        self._log(message)
        self.send(message)
bot = DiscordBot()
bot.handle_message("hi there")`;
  expect(await setEditorContent(page, source)).toBe(true);
  const viewer = page.getByRole('region', { name: /Interactive UML diagram viewer/ });
  await page.getByRole('button', { name: 'Sequence Diagram', exact: true }).click();
  const diagram = viewer.getByRole('img');
  await expect(diagram).toContainText('_log(message)');
  await expect(diagram).toContainText('send(message)');
  await expect(diagram).not.toContainText('Warning:');
  await expect(diagram).not.toHaveAccessibleName(/partial sequence inference/);
  expect(await setEditorContent(page, source + '\nmissing.send()')).toBe(true);
  await page.getByRole('button', { name: /Refresh$/ }).click();
  await expect(diagram).toContainText('missing.send');
  await expect(diagram).toHaveAccessibleName(/could not be resolved/);
  expect(await setEditorContent(page, source)).toBe(true);
  await page.getByRole('button', { name: /Refresh$/ }).click();
  await expect(diagram).not.toContainText('Warning:');
});
