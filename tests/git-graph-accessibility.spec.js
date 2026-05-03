// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('GitGraph accessibility', () => {
  test('live tutorial graph uses a live summary instead of exposing the SVG as an image', async ({ page }) => {
    await page.goto('/');
    await page.setContent(`
      <!doctype html>
      <html lang="en">
      <body>
        <div id="host" class="tvm-git-graph-container"></div>
        <script src="/js/git-graph.js"></script>
      </body>
      </html>
    `);
    await page.waitForFunction(() => !!window.GitGraph);

    await page.evaluate(() => {
      const host = document.getElementById('host');
      const data = window.GitGraph.parseGitState(
        'B0000000|A0000000|Second commit|HEAD -> main\nA0000000||Initial commit|',
        '* main',
        'refs/heads/main',
        { staged: [], unstaged: [], untracked: [], stashed: [] }
      );
      window.__testGitGraph = new window.GitGraph(host);
      window.__testGitGraph.render(data);
    });

    const host = page.locator('#host');
    await expect(host).toHaveAttribute('role', 'region');
    await expect(host).toHaveAttribute('aria-label', 'Live Git graph');

    const svg = host.locator('svg');
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    await expect(svg).not.toHaveAttribute('role', 'img');

    await expect(host.locator('.git-graph-accessible-summary')).toContainText('HEAD is on branch main');
    const status = host.locator('.git-graph-live-status');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toContainText('Git graph updated');
    const details = host.locator('.git-graph-accessible-details');
    await expect(details).toContainText('Detailed Git graph text alternative');
    await expect(details).toContainText('Commit B: Second commit. Labels: HEAD -> main. Parents: A: Initial commit');
    await expect(details).toContainText('Commit A: Initial commit. Parents: none. Children: B: Second commit');

    await page.evaluate(() => {
      const data = window.GitGraph.parseGitState(
        'C0000000|B0000000|Add new feature|HEAD -> main\n' +
        'B0000000|A0000000|Second commit|\n' +
        'A0000000||Initial commit|',
        '* main',
        'refs/heads/main',
        { staged: [], unstaged: [], untracked: [], stashed: [] }
      );
      window.__testGitGraph.render(data);
    });
    await expect(status).toContainText('HEAD and branch main moved to commit C with message "Add new feature"');

    const staticSvgRole = await page.evaluate(() => {
      const data = window.GitGraph.parseGitState(
        'B0000000|A0000000|Second commit|HEAD -> main\nA0000000||Initial commit|',
        '* main',
        'refs/heads/main'
      );
      const wrapper = document.createElement('div');
      wrapper.innerHTML = window.GitGraph.renderToSVG(data);
      return wrapper.querySelector('svg')?.getAttribute('role') || null;
    });
    expect(staticSvgRole).toBe('img');
  });
});
