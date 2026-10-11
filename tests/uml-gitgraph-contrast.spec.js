const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'test-uml.html'), 'utf8')
  .split('<h2>78. Colors and Textures — Git Graph</h2>')[1]
  .split('<code class="diagram-gitgraph">')[1].split('</code>')[0];

let serializedGraph;
test.beforeAll(async ({ browser }) => {
  const renderer = await browser.newPage();
  await renderer.setContent('<div id="graph"></div>');
  await renderer.addScriptTag({ path: path.join(root, 'js/git-graph.js') });
  await renderer.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  serializedGraph = await renderer.evaluate((spec) => {
    const host = document.getElementById('graph');
    window.UMLGitGraphDiagram.render(host, spec);
    return host.innerHTML;
  }, source);
  await renderer.close();
});

for (const mode of ['light', 'dark', 'print from dark']) {
  test(`serialized Git graph branch labels retain AA contrast in ${mode} mode`, async ({ page }) => {
    // Static diagrams must follow the page theme without a live renderer or
    // its MutationObserver. This is the same stylesheet set as /test-uml.
    await page.setContent('<main><div class="uml-gitgraph-diagram-container"></div></main>');
    await page.addStyleTag({ path: path.join(root, 'css/uml-diagram.css') });
    await page.addStyleTag({ path: path.join(root, 'css/print-light.css') });
    await page.locator('.uml-gitgraph-diagram-container').evaluate((host, svg) => {
      host.innerHTML = svg;
    }, serializedGraph);
    await page.evaluate((theme) => {
      document.documentElement.classList.toggle('dark-mode', theme !== 'light');
      document.documentElement.classList.toggle('print-light-mode', theme === 'print from dark');
    }, mode);
    if (mode === 'print from dark') await page.emulateMedia({ media: 'print' });

    const contrasts = await page.locator('.git-graph-branch-label').evaluateAll((labels) => {
      const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number);
      const luminance = (color) => color.map((component) => {
        const normalized = component / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);
      return labels.map((label) => {
        const background = label.parentElement.querySelector('.git-graph-label-bg');
        const tint = background.nextElementSibling;
        const baseColor = rgb(getComputedStyle(background).fill);
        const tintStyle = getComputedStyle(tint);
        const tintColor = rgb(tintStyle.fill);
        const opacity = Number(tintStyle.fillOpacity);
        const backdrop = baseColor.map((component, index) => component * (1 - opacity) + tintColor[index] * opacity);
        const fg = luminance(rgb(getComputedStyle(label).fill));
        const bg = luminance(backdrop);
        return { label: label.textContent, ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) };
      });
    });
    expect(contrasts.map(({ label }) => label).sort()).toEqual(['feature', 'hotfix', 'main']);
    for (const contrast of contrasts) {
      expect(contrast.ratio, `${contrast.label} contrasts with its composited chip background`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
