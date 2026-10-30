const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const surfaces = [
  { name: 'pattern narration', player: 'narrated-lesson narrated-pattern', diagram: 'np-diagram' },
  { name: 'video narration', player: 'narrated-lesson video-narration', diagram: 'np-diagram' },
  { name: 'case study', player: 'narrated-case-study', diagram: 'case-diagram' },
];
const inversion = 'invert(1) hue-rotate(180deg)';

async function renderNarrationDiagram(page, surface, annotated) {
  // Exercise the real shared styles and renderer together. The wrappers come
  // from the narration includes; the SVG hooks are documented in ArchUML/REFERENCE.md.
  await page.setContent(`<main class="narrated-explainer ${surface.player}">
    <div class="${surface.diagram}"><div id="diagram"></div></div>
  </main>`);
  for (const file of [
    'css/uml-diagram.css', 'js/ArchUML/css/callouts.css',
    'css/narrated-explainer.css', 'css/narrated-pattern.css',
    'css/narrated-case-study.css', 'css/print-light.css',
  ]) await page.addStyleTag({ path: path.join(root, file) });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  await page.evaluate(withCallout => {
    const source = 'class Account' + (withCallout
      ? '\ncallout right of text "Account" : A template for objects' : '');
    const host = document.getElementById('diagram');
    window.UMLShared.prepareDiagramContainer(host, 'class');
    window.UMLClassDiagram.render(host, source);
    window.UMLShared.applySvgAccessibility(host, 'class', source);
  }, annotated);
  await expect(page.getByRole('img')).toBeVisible();
}

async function expectDiagramTheme(page, { dark, annotated }) {
  const svg = page.getByRole('img');
  // Both the root and model layer affect the final pixels. Checking just fill
  // colors misses the double inversion that turns a dark diagram light again.
  await expect(svg).toHaveCSS('filter', dark && !annotated ? inversion : 'none');
  if (!annotated) return;
  await expect(svg.locator('.uml-model-layer')).toHaveCSS('filter', dark ? inversion : 'none');
  await expect(svg.locator('.uml-callout-bubble')).toHaveCSS('fill', dark ? 'rgb(255, 209, 0)' : 'rgb(0, 59, 92)');
  await expect(svg.getByText('A template for objects', { exact: true })).toHaveCSS('fill', dark ? 'rgb(0, 59, 92)' : 'rgb(255, 255, 255)');
}

for (const surface of surfaces) {
  for (const annotated of [false, true]) {
    const description = annotated ? 'with teaching callouts' : 'without teaching callouts';
    test(`${surface.name}: diagrams ${description} follow theme changes and print light`, async ({ page }) => {
      await renderNarrationDiagram(page, surface, annotated);
      for (const dark of [false, true, false, true]) {
        await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
        await expectDiagramTheme(page, { dark, annotated });
      }

      // A dedicated print view is light even while displayed on screen with a
      // saved dark preference. Browser print must also work from the dark reader.
      await page.evaluate(() => document.documentElement.classList.add('print-light-mode'));
      await expectDiagramTheme(page, { dark: false, annotated });
      await page.evaluate(() => document.documentElement.classList.remove('print-light-mode'));
      await page.emulateMedia({ media: 'print' });
      await expectDiagramTheme(page, { dark: false, annotated });
      await page.emulateMedia({ media: 'screen' });
      await expectDiagramTheme(page, { dark: true, annotated });
    });
  }
}
