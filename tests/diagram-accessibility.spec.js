// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('diagram accessibility text alternatives', () => {
  test('ArchUML verbose descriptions are screen-reader only and non-interactive', async ({ page }) => {
    await page.goto('/');
    await page.setContent(`
      <!doctype html>
      <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/uml-diagram.css">
      </head>
      <body>
        <script src="/js/ArchUML/uml-bundle.js"></script>
        <script src="/js/uml-auto-describe.js"></script>
      </body>
      </html>
    `);
    await page.waitForFunction(() => (
      !!window.UMLShared &&
      !!window.UMLAutoDescribe &&
      !!window.UMLShared.__umlAutoDescribeRenderAllPatched
    ));
    await page.evaluate(() => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-uml-class';
      code.textContent = `@startuml
class Customer {
  +id
}
@enduml`;
      pre.appendChild(code);
      document.body.appendChild(pre);
      window.UMLShared.renderAll();
    });

    const verbose = page.locator('.sebook-figure__verbose');
    await expect(verbose).toHaveCount(1);
    await expect(verbose).toContainText('Detailed description');
    await expect(page.locator('details.sebook-figure__verbose')).toHaveCount(0);
    await expect(verbose.locator('summary')).toHaveCount(0);

    const styles = await verbose.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        position: style.position,
        width: style.width,
        height: style.height,
        overflow: style.overflow,
        clipPath: style.clipPath,
      };
    });
    expect(styles.position).toBe('absolute');
    expect(styles.width).toBe('1px');
    expect(styles.height).toBe('1px');
    expect(styles.overflow).toBe('hidden');
    expect(styles.clipPath).toBe('inset(50%)');
  });

  test('Git command lab keeps graph details in GitGraph sr-only nodes only', async ({ page }) => {
    await page.goto('/');
    await page.setContent(`
      <!doctype html>
      <html lang="en">
      <body>
        <div id="lab" data-git-command-lab>
          <script type="application/json">
            {
              "command": "git commit -m test",
              "before": {
                "log": "A0000000||Initial commit|HEAD -> main",
                "branches": "* main",
                "head": "refs/heads/main"
              },
              "after": {
                "log": "B0000000|A0000000|Second commit|HEAD -> main\\nA0000000||Initial commit|",
                "branches": "* main",
                "head": "refs/heads/main"
              }
            }
          </script>
        </div>
        <script src="/js/git-graph.js"></script>
        <script src="/js/git-command-lab.js"></script>
      </body>
      </html>
    `);

    const details = page.locator('#lab .git-graph-accessible-details');
    await expect(details).toHaveClass(/sr-only/);
    await expect(details).toContainText('Detailed Git graph text alternative');
    await expect(page.locator('#lab .git-command-lab__details')).toHaveCount(0);
    await expect(page.locator('#lab details')).toHaveCount(0);
  });
});
