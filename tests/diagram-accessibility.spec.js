// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

function contrastRatio(foreground, background) {
  function luminance(hex) {
    const channels = hex.replace('#', '').match(/.{2}/g).map((channel) => {
      const value = Number.parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

test.describe('diagram accessibility text alternatives', () => {
  test('ArchUML bundle exposes an accessible SVG fallback hook', async ({ page }) => {
    await page.goto('/');
    await page.setContent(`
      <!doctype html>
      <html lang="en">
      <body>
        <script src="/js/ArchUML/uml-bundle.js"></script>
      </body>
      </html>
    `);
    await page.waitForFunction(() => (
      !!window.UMLShared &&
      typeof window.UMLShared.applySvgAccessibility === 'function'
    ));
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
      document.body.appendChild(container);
      window.UMLShared.applySvgAccessibility(
        container,
        'class',
        '@startuml\nclass Customer\n@enduml',
      );
    });

    const diagram = page.getByRole('img', { name: /UML class diagram/i });
    await expect(diagram).toBeVisible();
    await expect(diagram.locator('title')).toHaveText(/UML class diagram/i);
  });

  test('auto-describer replaces the fallback with a model-specific SVG name', async ({ page }) => {
    await page.goto('/');
    await page.setContent(`
      <!doctype html>
      <html lang="en">
      <body>
        <script src="/js/ArchUML/uml-bundle.js"></script>
        <script src="/js/uml-auto-describe.js"></script>
      </body>
      </html>
    `);
    await page.waitForFunction(() => (
      !!window.UMLShared &&
      !!window.UMLShared.__umlAutoDescribeAccessibilityPatched
    ));
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.innerHTML = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10">',
        '<circle cx="5" cy="5" r="4"></circle>',
        '</svg>',
      ].join('');
      document.body.appendChild(container);
      window.UMLShared.applySvgAccessibility(
        container,
        'class',
        '@startuml\nclass Customer\n@enduml',
      );
    });

    const diagram = page.getByRole('img', {
      name: /UML class diagram.*Customer/i,
    });
    await expect(diagram).toBeVisible();
    await expect(diagram.locator('title')).toHaveText(/UML class diagram.*Customer/i);
  });

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

  test('build-time UML describer returns brief and verbose text alternatives', () => {
    const input = {
      classDiagram: {
        type: 'class',
        spec: '@startuml\nclass Customer {\n  +id\n}\n@enduml'
      }
    };

    const stdout = execFileSync('node', ['js/uml-describe-cli.js'], {
      cwd: repoRoot,
      input: JSON.stringify(input),
      encoding: 'utf8'
    });
    const result = JSON.parse(stdout);

    expect(result.classDiagram.brief).toContain('UML class diagram');
    expect(result.classDiagram.brief).toContain('Customer');
    expect(result.classDiagram.verbose.summary).toContain('UML class diagram');
    expect(result.classDiagram.verbose.sections.length).toBeGreaterThan(0);
  });

  test('build-time UML renderer supports static page diagram types', async ({ page }) => {
    const input = {
      classDiagram: {
        type: 'class',
        text: '@startuml\nclass Customer\n@enduml'
      },
      folderTree: {
        type: 'folder-tree',
        text: '@startuml\nproject/\n  src/\n    app.js  ← application entry point\n@enduml'
      },
      gitGraph: {
        type: 'gitgraph',
        text: '@startuml\nbranch main:\n  A "Initial commit"\n  B "Add auth module"\nhead main\n@enduml'
      },
      erDiagram: {
        type: 'er',
        text: '@startuml\nentity User {\n  id key\n}\n@enduml'
      }
    };

    const stdout = execFileSync('node', ['js/ArchUML/uml_to_svg.js'], {
      cwd: repoRoot,
      input: JSON.stringify(input),
      encoding: 'utf8'
    });
    const result = JSON.parse(stdout);

    for (const [name, svg] of Object.entries(result)) {
      expect(svg.trim().startsWith('<svg'), `${name} should render to SVG`).toBe(true);
    }

    const annotationFill = await page.evaluate((svgMarkup) => {
      const documentNode = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
      const annotation = Array.from(documentNode.querySelectorAll('text')).find((element) =>
        (element.textContent || '').includes('application entry point')
      );
      return annotation && annotation.getAttribute('fill');
    }, result.folderTree);
    expect(annotationFill, 'folder-tree annotation should render as secondary text')
      .toMatch(/^#[0-9a-f]{6}$/i);
    expect(
      contrastRatio(annotationFill, '#ffffff'),
      `folder-tree annotation ${annotationFill} should meet AA contrast on white`
    ).toBeGreaterThanOrEqual(4.5);
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
