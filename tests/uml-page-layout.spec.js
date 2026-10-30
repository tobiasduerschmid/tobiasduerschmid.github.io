// @ts-check
const { test, expect } = require('@playwright/test');

const fs = require('node:fs');
const path = require('node:path');

// Follow the requested authored corpus automatically as diagrams are added.
const repositoryRoot = path.resolve(__dirname, '..');
const chapterFiles = fs.readdirSync(path.join(repositoryRoot, 'SEBook'))
  .filter((name) => /^uml.*\.md$/.test(name)).map((name) => `SEBook/${name}`);
const patternFiles = fs.readdirSync(path.join(repositoryRoot, 'SEBook/designpatterns'))
  .filter((name) => name.endsWith('.md')).map((name) => `SEBook/designpatterns/${name}`);
const pages = ['test-uml.html', ...chapterFiles, ...patternFiles].map((file) => {
  const source = fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
  const authoredDiagrams = (source.match(/data-uml-spec\s*=|<code\s+class=["'](?:language-uml-|diagram-)/g) || []).length;
  return { url: `/${file.replace(/\.md$/, '.html')}`, authoredDiagrams };
}).filter((entry) => entry.authoredDiagrams > 0);

const DISPLAY_MODES = [
  { name: 'desktop light', width: 1440, dark: false, print: false },
  { name: 'desktop dark', width: 1440, dark: true, print: false },
  { name: 'narrow light', width: 320, dark: false, print: false },
  { name: 'print with saved dark theme', width: 1440, dark: true, print: true },
];

/** Read text geometry after the browser has applied the real page's styles. */
function findTextOverlaps(diagrams) {
  const overlaps = [];
  for (const [diagramIndex, diagram] of diagrams.entries()) {
    const svg = diagram.querySelector('svg');
    if (!svg) continue;
    const svgWidth = svg.getBoundingClientRect().width;
    if (!svgWidth) {
      overlaps.push({ diagram: diagramIndex + 1, error: 'Diagram has no measurable width' });
      continue;
    }
    const screenToDiagram = svg.viewBox.baseVal.width / svgWidth;
    const labels = Array.from(svg.querySelectorAll('text'), (label) => ({
      text: label.textContent.trim(),
      bounds: label.getBoundingClientRect(),
    }));
    for (let first = 0; first < labels.length; first += 1) {
      for (let second = first + 1; second < labels.length; second += 1) {
        const a = labels[first].bounds;
        const b = labels[second].bounds;
        const width = (Math.min(a.right, b.right) - Math.max(a.left, b.left)) * screenToDiagram;
        const height = (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) * screenToDiagram;
        // One SVG unit tolerates subpixel font bounds, independently of zoom.
        if (width > 1 && height > 1) {
          overlaps.push({
            diagram: diagramIndex + 1,
            first: labels[first].text,
            second: labels[second].text,
          });
        }
      }
    }
  }
  return overlaps;
}

for (const mode of DISPLAY_MODES) {
  test.describe(mode.name, () => {
    test.use({ viewport: { width: mode.width, height: 1000 } });

    for (const { url, authoredDiagrams } of pages) {
      test(`${url} renders its complete diagram inventory with separate text labels`, async ({ page }) => {
        const scriptErrors = [];
        page.on('pageerror', (error) => scriptErrors.push(error.message));
        await page.emulateMedia({ media: mode.print ? 'print' : 'screen' });
        await page.goto(String(url));
        await page.evaluate(async (dark) => {
          await document.fonts.ready;
          document.documentElement.classList.toggle('dark-mode', dark);
          document.querySelectorAll('details').forEach((details) => { details.open = true; });
        }, mode.dark);

        // Production figures are already rendered; development pages and
        // runtime embeds may still carry their public source declarations. A
        // narration player's diagram host shows a copy of a reading-step figure
        // that is already counted, so it declares nothing new.
        const declared = page.locator('.sebook-figure--archuml > [role="img"], [data-uml-type]:not([data-np-diagram]), pre > code[class^="language-uml-"], pre > code[class^="diagram-"]');
        const diagramCount = await declared.count();
        expect(diagramCount, `${url}: authored diagrams are present before measuring generated embeds`)
          .toBeGreaterThanOrEqual(authoredDiagrams);
        const diagrams = page.getByRole('img', { includeHidden: true })
          .and(page.locator('.sebook-figure--archuml > [role="img"]'));
        await expect(diagrams, `${url}: every authored and embedded diagram renders`)
          .toHaveCount(Number(diagramCount));
        await expect(diagrams.locator('svg'), `${url}: every diagram has graphical output`)
          .toHaveCount(Number(diagramCount));
        // Expose every quiz/flashcard face in place for measurement. Preserve
        // the actual page typography and each diagram's existing SVG geometry.
        await diagrams.evaluateAll((elements) => {
          for (const element of elements) {
            for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
              ancestor.removeAttribute('hidden');
              const style = getComputedStyle(ancestor);
              if (style.display === 'none') ancestor.style.setProperty('display', 'block', 'important');
              if (style.visibility !== 'visible') ancestor.style.setProperty('visibility', 'visible', 'important');
              if (style.contentVisibility === 'hidden') ancestor.style.setProperty('content-visibility', 'visible', 'important');
            }
          }
        });
        expect(await diagrams.evaluateAll(findTextOverlaps), `${url}: painted text labels must not overlap`)
          .toEqual([]);
        expect(scriptErrors, `${url}: diagram page loads without JavaScript errors`).toEqual([]);
      });
    }
  });
}
